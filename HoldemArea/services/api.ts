import { GameState, Player } from '../types';

/**
 * API Service Structure
 * This file defines the expected API functions for communicating with a backend.
 * Currently, these functions just log to the console or return dummy data.
 */

// --- Request Payloads ---

export interface JoinTableRequest {
  tableId: string;
  seatIndex: number;
  playerName: string;
}

export interface ActionRequest {
  tableId: string;
  playerId: number;
  action: 'check' | 'call' | 'raise' | 'fold' | 'allin';
  amount?: number;
}

// --- Response Payloads ---

export interface JoinTableResponse {
  success: boolean;
  message?: string;
  player?: Player;
}

export interface GameStateResponse {
  gameState: GameState;
  players: Player[];
}

// --- API Functions ---

/**
 * Call this when a player attempts to sit at a specific seat.
 */
export const joinTable = async (payload: JoinTableRequest): Promise<JoinTableResponse> => {
  console.log(`[API] joinTable called:`, payload);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return { success: true, message: "Joined successfully" };
};

/**
 * Call this when a player leaves a seat.
 */
export const leaveTable = async (tableId: string, playerId: number): Promise<{ success: boolean }> => {
  console.log(`[API] leaveTable called for player ${playerId} on table ${tableId}`);
  return { success: true };
};

/**
 * Call this when a player performs an action (Check, Call, Raise, Fold).
 */
export const sendAction = async (payload: ActionRequest): Promise<GameStateResponse | null> => {
  console.log(`[API] sendAction called:`, payload);
  // In a real app, this would return the updated GameState from the server.
  return null;
};

/**
 * Call this to sync the game state (e.g., polling or socket connection init).
 */
export const fetchGameState = async (tableId: string): Promise<GameStateResponse | null> => {
  console.log(`[API] fetchGameState called for table ${tableId}`);
  return null;
};
