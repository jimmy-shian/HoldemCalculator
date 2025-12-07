import pokersolver from 'pokersolver';
import { Card, Suit, Rank } from '../types';

// Extract Hand from the default export
const { Hand } = pokersolver;

// Convert our Card type to pokersolver string format (e.g. "Ah", "Td")
const toSolverCard = (card: Card): string => {
  return `${card.rank}${card.suit}`;
};

// Create a deck of 52 cards
const createDeck = (): string[] => {
  const suits = ['s', 'c', 'h', 'd'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const deck: string[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push(r + s);
    }
  }
  return deck;
};

// Shuffle utility
const shuffle = (array: string[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export interface CalcResult {
  equity: number; // 0-100
  win: number;
  tie: number;
  iterations: number;
}

export const calculateEquity = async (
  heroCards: Card[],
  boardCards: Card[],
  iterations = 1000
): Promise<CalcResult> => {
  // Validate input
  if (heroCards.length !== 2) return { equity: 0, win: 0, tie: 0, iterations: 0 };
  
  const heroStr = heroCards.map(toSolverCard);
  const boardStr = boardCards.map(toSolverCard);
  const knownCards = new Set([...heroStr, ...boardStr]);
  
  const fullDeck = createDeck();
  const deck = fullDeck.filter(c => !knownCards.has(c));

  let wins = 0;
  let ties = 0;

  // Run Monte Carlo Simulation
  for (let i = 0; i < iterations; i++) {
    // Copy deck and shuffle
    const currentDeck = shuffle([...deck]);
    
    // Deal Villain (2 cards)
    const villainHand = [currentDeck.pop()!, currentDeck.pop()!];
    
    // Deal remaining board (up to 5)
    const currentBoard = [...boardStr];
    while (currentBoard.length < 5) {
      currentBoard.push(currentDeck.pop()!);
    }
    
    // Evaluate Hands
    const heroEval = Hand.solve([...heroStr, ...currentBoard]);
    const villainEval = Hand.solve([...villainHand, ...currentBoard]);
    
    const winner = Hand.winners([heroEval, villainEval]);
    
    if (winner.length === 2) {
      ties++;
    } else if (winner[0] === heroEval) {
      wins++;
    }
  }

  const equity = ((wins + (ties / 2)) / iterations) * 100;
  
  return {
    equity,
    win: wins,
    tie: ties,
    iterations
  };
};

// --- New Outs Analysis Logic ---

export interface OutGroup {
  handName: string; // localized name
  count: number;
  cards: string[]; // e.g., ["A♠", "K♦"] - pretty formatted
  rankValue: number; // for sorting
  isExcluded?: boolean; // If true, this group was excluded from the conservative calculation
}

export interface OutsResult {
  totalOuts: number;
  effectiveOuts: number; // New: Outs after deducting weaker groups
  groups: OutGroup[];
  ruleOf42Equity: number;
  currentHandObj: { name: string; localizedName: string };
  winningCards: string[]; // IDs of cards involved in the best hand (e.g., ["Ah", "Kh"])
}

const HAND_NAME_MAP: Record<string, string> = {
  'High Card': '高牌 (High Card)',
  'Pair': '一對 (Pair)',
  'Two Pair': '兩對 (Two Pair)',
  'Three of a Kind': '三條 (Trips)',
  'Straight': '順子 (Straight)',
  'Flush': '同花 (Flush)',
  'Full House': '葫蘆 (Full House)',
  'Four of a Kind': '鐵支 (Quads)',
  'Straight Flush': '同花順 (Straight Flush)',
  'Royal Flush': '皇家同花順 (Royal Flush)'
};

// Higher index = Better hand
const HAND_RANK_ORDER = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush', 
  'Royal Flush'
];

const SUIT_SYMBOL_MAP: Record<string, string> = {
  's': '♠',
  'h': '♥',
  'd': '♦',
  'c': '♣'
};

const formatCardPretty = (solverCard: string): string => {
  const rank = solverCard.slice(0, -1);
  const suit = solverCard.slice(-1);
  return `${rank}${SUIT_SYMBOL_MAP[suit] || suit}`;
};

export const calculateOuts = (heroCards: Card[], boardCards: Card[]): OutsResult => {
  // Rule of 4&2 applies to Post-flop analysis.
  const heroStr = heroCards.map(toSolverCard);
  const boardStr = boardCards.map(toSolverCard);
  
  // Current Hand Rank & Composition
  const currentHand = Hand.solve([...heroStr, ...boardStr]);
  const currentHandLocalized = HAND_NAME_MAP[currentHand.name] || currentHand.name;
  
  // Extract winning cards (best 5)
  // pokersolver's hand.cards contains objects with toString() method returning 'Ah' etc.
  const winningCards = currentHand.cards.map((c: any) => c.toString());

  // If Pre-flop (0 cards) or invalid, return early
  if (boardCards.length < 3) {
    return { 
      totalOuts: 0, 
      effectiveOuts: 0,
      groups: [], 
      ruleOf42Equity: 0,
      currentHandObj: { name: currentHand.name, localizedName: currentHandLocalized },
      winningCards: []
    };
  }

  // If River (5 cards), we know the final hand. There are no outs.
  if (boardCards.length >= 5) {
      return {
          totalOuts: 0,
          effectiveOuts: 0,
          groups: [],
          ruleOf42Equity: 0,
          currentHandObj: { name: currentHand.name, localizedName: currentHandLocalized },
          winningCards
      };
  }

  // --- Outs Calculation (only for Flop & Turn) ---

  // Find current rank index
  const currentRankIndex = HAND_RANK_ORDER.indexOf(currentHand.name);

  const knownCards = new Set([...heroStr, ...boardStr]);
  const fullDeck = createDeck();
  const deck = fullDeck.filter(c => !knownCards.has(c));

  const improvements: Record<string, string[]> = {};
  const uniqueOuts = new Set<string>();

  deck.forEach(card => {
    const nextHand = Hand.solve([...heroStr, ...boardStr, card]);
    const nextRankIndex = HAND_RANK_ORDER.indexOf(nextHand.name);
    
    // Check if the hand category improves (strictly better category)
    if (nextRankIndex > currentRankIndex) {
       const name = HAND_NAME_MAP[nextHand.name] || nextHand.name;
       if (!improvements[name]) {
         improvements[name] = [];
       }
       improvements[name].push(formatCardPretty(card));
       uniqueOuts.add(card);
    }
  });

  // Convert to array
  const groups: OutGroup[] = Object.keys(improvements).map(name => {
     // Reverse lookup for sorting key
     const originalName = Object.keys(HAND_NAME_MAP).find(key => HAND_NAME_MAP[key] === name) || name;
     const rankValue = HAND_RANK_ORDER.indexOf(originalName);

     return {
       handName: name,
       count: improvements[name].length,
       cards: improvements[name],
       rankValue
     };
  });

  // Sort groups by Hand Strength (Strongest first)
  groups.sort((a, b) => b.rankValue - a.rankValue);

  // --- Effective Outs Logic (Conservative) ---
  // If there are multiple groups, exclude the one with the lowest Rank Value (weakest hand improvement)
  let effectiveOutsCount = uniqueOuts.size;
  
  if (groups.length > 1) {
      // The last group is the weakest because we sorted descending
      const weakestGroup = groups[groups.length - 1];
      weakestGroup.isExcluded = true;
      
      // We assume the outs in the weakest group are "dirty" or less desirable
      // Simplified: Subtract the count of the weakest group from the total unique outs.
      // Note: This is a heuristic. In reality, some cards might overlap between groups.
      // But usually, a card creates ONE specific best hand.
      // So simple subtraction is mostly correct for "unique cards that only give the weak hand".
      effectiveOutsCount = Math.max(0, effectiveOutsCount - weakestGroup.count);
  }

  // --- Equity Calculation ---
  // Flop (3 cards): 
  //   If outs <= 8: Outs * 4
  //   If outs > 8: (Outs * 4) - (Outs - 8)  <-- Correction for high outs
  // Turn (4 cards): Outs * 2
  
  let ruleOf42Equity = 0;
  if (boardCards.length === 3) {
      // Flop
      if (effectiveOutsCount > 8) {
          ruleOf42Equity = (effectiveOutsCount * 4) - (effectiveOutsCount - 8);
      } else {
          ruleOf42Equity = effectiveOutsCount * 4;
      }
  } else {
      // Turn
      ruleOf42Equity = effectiveOutsCount * 2;
  }
  
  // Cap at 100%
  ruleOf42Equity = Math.min(ruleOf42Equity, 100);

  return {
    totalOuts: uniqueOuts.size,
    effectiveOuts: effectiveOutsCount,
    groups,
    ruleOf42Equity,
    currentHandObj: { name: currentHand.name, localizedName: currentHandLocalized },
    winningCards
  };
};