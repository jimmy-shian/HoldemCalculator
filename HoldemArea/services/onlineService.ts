export type OnlineStage = 'IDLE' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export type OnlineMoveType = 'check' | 'call' | 'raise' | 'fold' | 'allin';

export interface OnlinePlayerState {
  index: number;
  name: string | null;
  chips: number;
  bet: number;
  totalHandBet: number;
  hasFolded: boolean;
}

export interface OnlineRoomState {
  handId: number;
  deckSeed: number;
  stage: OnlineStage;
  pot: number;
  highestBet: number;
  dealerIndex: number;
  currentTurnIndex: number;
  winners: number[];
  players: OnlinePlayerState[];
}

interface JoinResponse {
  playerIndex: number;
  room: OnlineRoomState;
}

interface RoomResponse {
  room: OnlineRoomState;
}

const API_URL = '/api/room';

async function callApi<T>(init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL, {
    method: init?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
    body: init?.body ?? undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function joinRoom(name: string): Promise<JoinResponse> {
  return callApi<JoinResponse>({
    method: 'POST',
    body: JSON.stringify({ op: 'join', name }),
  });
}

export async function startHandOnline(): Promise<RoomResponse> {
  return callApi<RoomResponse>({
    method: 'POST',
    body: JSON.stringify({ op: 'start' }),
  });
}

export async function moveOnline(
  playerIndex: number,
  move: OnlineMoveType,
  amount?: number,
): Promise<RoomResponse> {
  return callApi<RoomResponse>({
    method: 'POST',
    body: JSON.stringify({ op: 'move', playerIndex, move, amount }),
  });
}

export async function settleOnline(winners: number[]): Promise<RoomResponse> {
  return callApi<RoomResponse>({
    method: 'POST',
    body: JSON.stringify({ op: 'settle', winners }),
  });
}

export async function fetchRoom(): Promise<RoomResponse> {
  return callApi<RoomResponse>({ method: 'GET' });
}
