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

export interface RoundEndRequest {
  tableId: string;
  roundNumber: number;
  gameState: GameState;
  players: Player[];
  winners: number[];
}

const JOIN_TABLE_ENDPOINT = '/api/join-table';
const LEAVE_TABLE_ENDPOINT = '/api/leave-table';
const ACTION_ENDPOINT = '/api/action';
const GAME_STATE_ENDPOINT = '/api/game-state';
const ROUND_END_ENDPOINT = '/api/round-end';

// --- API Functions ---

/**
 * Call this when a player attempts to sit at a specific seat.
 */
export const joinTable = async (payload: JoinTableRequest): Promise<JoinTableResponse> => {
  console.log(`[API] joinTable called:`, payload);
  try {
    const response = await fetch(JOIN_TABLE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[API] joinTable failed with status', response.status);
      return { success: false, message: 'Failed to join table' };
    }

    const data = (await response.json()) as JoinTableResponse;
    return data;
  } catch (error) {
    console.error('[API] joinTable error:', error);
    return { success: false, message: 'Network error' };
  }
};

/**
 * Call this when a player leaves a seat.
 */
export const leaveTable = async (tableId: string, playerId: number): Promise<{ success: boolean }> => {
  console.log(`[API] leaveTable called for player ${playerId} on table ${tableId}`);
  try {
    const response = await fetch(LEAVE_TABLE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tableId, playerId }),
    });

    if (!response.ok) {
      console.error('[API] leaveTable failed with status', response.status);
      return { success: false };
    }

    const data = (await response.json()) as { success: boolean };
    return data;
  } catch (error) {
    console.error('[API] leaveTable error:', error);
    return { success: false };
  }
};

/**
 * Call this when a player performs an action (Check, Call, Raise, Fold).
 */
export const sendAction = async (payload: ActionRequest): Promise<GameStateResponse | null> => {
  console.log(`[API] sendAction called:`, payload);
  // In a real app, this would return the updated GameState from the server.
  try {
    const response = await fetch(ACTION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[API] sendAction failed with status', response.status);
      return null;
    }

    const data = (await response.json()) as GameStateResponse;
    return data;
  } catch (error) {
    console.error('[API] sendAction error:', error);
    return null;
  }
};

/**
 * Call this to sync the game state (e.g., polling or socket connection init).
 */
export const fetchGameState = async (tableId: string): Promise<GameStateResponse | null> => {
  console.log(`[API] fetchGameState called for table ${tableId}`);
  try {
    const url = `${GAME_STATE_ENDPOINT}?tableId=${encodeURIComponent(tableId)}`;
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error('[API] fetchGameState failed with status', response.status);
      return null;
    }

    const data = (await response.json()) as GameStateResponse;
    return data;
  } catch (error) {
    console.error('[API] fetchGameState error:', error);
    return null;
  }
};

export const sendRoundEnd = async (payload: RoundEndRequest): Promise<GameStateResponse | null> => {
  try {
    const response = await fetch(ROUND_END_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[API] sendRoundEnd failed with status', response.status);
      return null;
    }

    const data = (await response.json()) as GameStateResponse;
    return data;
  } catch (error) {
    console.error('[API] sendRoundEnd error:', error);
    return null;
  }
};
