export enum Suit {
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
  SPADES = '♠',
}

export enum Rank {
  TWO = 2, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN, JACK, QUEEN, KING, ACE
}

export interface Card {
  suit: Suit;
  rank: Rank;
  key: string; // Unique ID for React lists
}

export enum GameStage {
  IDLE = 'IDLE',
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  chips: number;
  bet: number; // Current bet in the active round
  totalHandBet: number; // Total bets in this entire hand
  cards: Card[];
  hasFolded: boolean;
  isDealer: boolean;
  isActive: boolean; // For turn management
  actionText?: string; // "Check", "Call", "Raise 500"
  lastAction?: 'check' | 'call' | 'raise' | 'fold' | 'allin';
}

export enum HandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9
}

export interface HandResult {
  rank: HandRank;
  score: number; // For tie-breaking
  description: string;
  winningCards: Card[]; // The specific cards that make up the hand
}

export interface GameState {
  stage: GameStage;
  pot: number;
  communityCards: Card[];
  deckSeed: number;
  currentTurnIndex: number; // Player ID whose turn it is
  dealerIndex: number;
  highestBet: number; // The amount to call
  minRaise: number;
  winners: number[]; // Player IDs
  winningHand?: string;
  roundNumber: number;
}