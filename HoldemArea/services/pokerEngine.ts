import { Card, Suit, Rank, HandRank, HandResult } from '../types';
import { HAND_NAMES } from '../constants';

// Linear Congruential Generator for deterministic seeded randomness
class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns a pseudo-random number between 0 and 1
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export const createDeck = (seed: number): Card[] => {
  const rng = new SeededRNG(seed);
  const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
  const ranks = [
    Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN,
    Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
  ];

  let deck: Card[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({ suit, rank, key: `${rank}${suit}` });
    });
  });

  // Fisher-Yates shuffle using seeded RNG
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};

// --- Hand Evaluation Logic ---

const getRankValue = (r: Rank): number => r;

const isFlush = (cards: Card[]): boolean => {
  if (cards.length < 5) return false;
  const suits = cards.map(c => c.suit);
  return suits.every(s => s === suits[0]);
};

// Checks for straight and returns the cards forming it
const getStraightCards = (cards: Card[]): Card[] | null => {
  // Sort unique ranks descending
  const sorted = [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
  const uniqueRankCards: Card[] = [];
  const seenRanks = new Set();
  
  for (const c of sorted) {
    if (!seenRanks.has(c.rank)) {
      uniqueRankCards.push(c);
      seenRanks.add(c.rank);
    }
  }

  if (uniqueRankCards.length < 5) return null;

  for (let i = 0; i <= uniqueRankCards.length - 5; i++) {
    const subset = uniqueRankCards.slice(i, i + 5);
    if (getRankValue(subset[0].rank) - getRankValue(subset[4].rank) === 4) {
      return subset;
    }
  }

  // Wheel (A, 2, 3, 4, 5)
  if (uniqueRankCards[0].rank === Rank.ACE) {
     const wheel = [
       uniqueRankCards[0], 
       ...uniqueRankCards.filter(c => [Rank.FIVE, Rank.FOUR, Rank.THREE, Rank.TWO].includes(c.rank))
     ];
     // We need exactly A, 5, 4, 3, 2. The filter might return doubles if we didn't dedup, 
     // but uniqueRankCards handles dedup.
     // Check if we have 5,4,3,2
     const hasLow = [Rank.FIVE, Rank.FOUR, Rank.THREE, Rank.TWO].every(r => uniqueRankCards.some(c => c.rank === r));
     if (hasLow) {
        // Find the specific cards
        return [
           uniqueRankCards.find(c => c.rank === Rank.FIVE)!,
           uniqueRankCards.find(c => c.rank === Rank.FOUR)!,
           uniqueRankCards.find(c => c.rank === Rank.THREE)!,
           uniqueRankCards.find(c => c.rank === Rank.TWO)!,
           uniqueRankCards[0], // Ace at end for visual sorting usually, but logic counts score
        ];
     }
  }
  
  return null;
};

export const evaluateHand = (holeCards: Card[], communityCards: Card[]): HandResult => {
  const allCards = [...holeCards, ...communityCards];
  
  // Sort by Rank Descending
  allCards.sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

  // Check Flush
  const suitCounts: Record<string, Card[]> = { [Suit.HEARTS]: [], [Suit.DIAMONDS]: [], [Suit.CLUBS]: [], [Suit.SPADES]: [] };
  allCards.forEach(c => suitCounts[c.suit].push(c));
  
  let flushCards: Card[] | null = null;
  for (const s in suitCounts) {
    if (suitCounts[s].length >= 5) {
      flushCards = suitCounts[s].slice(0, 5); // Best 5 of that suit
      break;
    }
  }

  // Check Straight Flush
  if (flushCards) {
     // We need to check if the FLUSH cards form a straight
     // Use the original pool of that suit to check straight
     const suitCards = suitCounts[flushCards[0].suit];
     const straightFlushCards = getStraightCards(suitCards);
     
     if (straightFlushCards) {
        const topRank = getRankValue(straightFlushCards[0].rank);
        if (topRank === Rank.ACE && straightFlushCards.some(c => c.rank === Rank.KING)) {
           return { rank: HandRank.ROYAL_FLUSH, score: 9000, description: HAND_NAMES[9], winningCards: straightFlushCards };
        }
        return { rank: HandRank.STRAIGHT_FLUSH, score: 8000 + topRank, description: HAND_NAMES[8], winningCards: straightFlushCards };
     }
  }

  // Count Ranks
  const rankGroups: Record<number, Card[]> = {};
  allCards.forEach(c => {
    const val = getRankValue(c.rank);
    if (!rankGroups[val]) rankGroups[val] = [];
    rankGroups[val].push(c);
  });

  const quads = Object.values(rankGroups).filter(g => g.length === 4);
  const trips = Object.values(rankGroups).filter(g => g.length === 3).sort((a,b) => getRankValue(b[0].rank) - getRankValue(a[0].rank));
  const pairs = Object.values(rankGroups).filter(g => g.length === 2).sort((a,b) => getRankValue(b[0].rank) - getRankValue(a[0].rank));

  // Four of a Kind
  if (quads.length > 0) {
    const main = quads[0];
    const kicker = allCards.filter(c => c.rank !== main[0].rank)[0];
    return { 
        rank: HandRank.FOUR_OF_A_KIND, 
        score: 7000 + getRankValue(main[0].rank), 
        description: HAND_NAMES[7],
        winningCards: [...main, kicker]
    };
  }

  // Full House
  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
     const main = trips[0];
     const secondary = trips.length > 1 ? trips[1].slice(0, 2) : pairs[0];
     return { 
         rank: HandRank.FULL_HOUSE, 
         score: 6000 + getRankValue(main[0].rank), 
         description: HAND_NAMES[6],
         winningCards: [...main, ...secondary]
     };
  }

  // Flush
  if (flushCards) {
    return { 
        rank: HandRank.FLUSH, 
        score: 5000 + getRankValue(flushCards[0].rank), 
        description: HAND_NAMES[5],
        winningCards: flushCards
    };
  }

  // Straight
  const straightCards = getStraightCards(allCards);
  if (straightCards) {
    return { 
        rank: HandRank.STRAIGHT, 
        score: 4000 + getRankValue(straightCards[0].rank), 
        description: HAND_NAMES[4],
        winningCards: straightCards
    };
  }

  // Three of a Kind
  if (trips.length > 0) {
    const main = trips[0];
    const kickers = allCards.filter(c => c.rank !== main[0].rank).slice(0, 2);
    return { 
        rank: HandRank.THREE_OF_A_KIND, 
        score: 3000 + getRankValue(main[0].rank), 
        description: HAND_NAMES[3],
        winningCards: [...main, ...kickers]
    };
  }

  // Two Pair
  if (pairs.length >= 2) {
    const main = [...pairs[0], ...pairs[1]];
    const kicker = allCards.filter(c => !main.includes(c))[0];
    return { 
        rank: HandRank.TWO_PAIR, 
        score: 2000 + getRankValue(pairs[0][0].rank) + getRankValue(pairs[1][0].rank)/100, 
        description: HAND_NAMES[2],
        winningCards: [...main, kicker]
    };
  }

  // Pair
  if (pairs.length === 1) {
    const main = pairs[0];
    const kickers = allCards.filter(c => c.rank !== main[0].rank).slice(0, 3);
    return { 
        rank: HandRank.PAIR, 
        score: 1000 + getRankValue(main[0].rank), 
        description: HAND_NAMES[1],
        winningCards: [...main, ...kickers]
    };
  }

  // High Card
  return { 
      rank: HandRank.HIGH_CARD, 
      score: getRankValue(allCards[0].rank), 
      description: `${HAND_NAMES[0]} ${Rank[allCards[0].rank]}`, 
      winningCards: allCards.slice(0, 5)
  };
};