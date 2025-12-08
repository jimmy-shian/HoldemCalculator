export enum Suit {
  SPADES = 's',
  HEARTS = 'h',
  DIAMONDS = 'd',
  CLUBS = 'c',
}

export enum Rank {
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
  ACE = 'A',
}

export interface Card {
  id: string; // e.g., "Ah", "Td"
  rank: Rank;
  suit: Suit;
}

export interface AnalysisResult {
  outs: number;
  outsList: string[]; // Descriptions of cards, e.g., "Any Heart", "Any 9"
  advice: string;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river';