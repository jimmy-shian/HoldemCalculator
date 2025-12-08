const PLAYER_COUNT = 4;
const INITIAL_CHIPS = 10000;
const SMALL_BLIND = 50;
const BIG_BLIND = 100;

type Stage = 'IDLE' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

type MoveType = 'check' | 'call' | 'raise' | 'fold' | 'allin';

interface PlayerState {
  index: number;
  name: string | null;
  chips: number;
  bet: number;
  totalHandBet: number;
  hasFolded: boolean;
}

interface RoomState {
  handId: number;
  deckSeed: number;
  stage: Stage;
  pot: number;
  highestBet: number;
  dealerIndex: number;
  currentTurnIndex: number;
  winners: number[];
  players: PlayerState[];
}

interface JoinBody {
  op: 'join';
  name: string;
}

interface StartBody {
  op: 'start';
}

interface MoveBody {
  op: 'move';
  playerIndex: number;
  move: MoveType;
  amount?: number;
}

interface SettleBody {
  op: 'settle';
  winners: number[];
}

type Body = JoinBody | StartBody | MoveBody | SettleBody;

function createInitialRoom(): RoomState {
  const players: PlayerState[] = [];
  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    players.push({
      index: i,
      name: null,
      chips: INITIAL_CHIPS,
      bet: 0,
      totalHandBet: 0,
      hasFolded: false,
    });
  }
  return {
    handId: 0,
    deckSeed: Date.now(),
    stage: 'IDLE',
    pot: 0,
    highestBet: 0,
    dealerIndex: 0,
    currentTurnIndex: -1,
    winners: [],
    players,
  };
}

let room: RoomState = createInitialRoom();

function send(res: any, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function ensureRoom(): void {
  if (!room || room.players.length !== PLAYER_COUNT) {
    room = createInitialRoom();
  }
}

function handleJoin(body: JoinBody, res: any): void {
  ensureRoom();
  const rawName = typeof body.name === 'string' ? body.name : '';
  const name = rawName.trim();
  if (!name) {
    send(res, 400, { error: 'name required' });
    return;
  }
  let target: PlayerState | undefined = room.players.find(p => p.name === null);
  if (!target) {
    target = room.players.find(p => p.name === name);
  }
  if (!target) {
    send(res, 400, { error: 'table full' });
    return;
  }
  target.name = name;
  target.chips = INITIAL_CHIPS;
  target.bet = 0;
  target.totalHandBet = 0;
  target.hasFolded = false;
  send(res, 200, { playerIndex: target.index, room });
}

function startHand(res: any): void {
  ensureRoom();
  room.handId += 1;
  room.deckSeed = Date.now();
  room.stage = 'PREFLOP';
  room.pot = 0;
  room.highestBet = BIG_BLIND;
  room.winners = [];
  room.dealerIndex = (room.dealerIndex + 1) % PLAYER_COUNT;
  for (const p of room.players) {
    p.bet = 0;
    p.totalHandBet = 0;
    p.hasFolded = false;
  }
  const sbIndex = (room.dealerIndex + 1) % PLAYER_COUNT;
  const bbIndex = (room.dealerIndex + 2) % PLAYER_COUNT;
  const sb = room.players[sbIndex];
  const bb = room.players[bbIndex];
  const sbAmount = Math.min(sb.chips, SMALL_BLIND);
  const bbAmount = Math.min(bb.chips, BIG_BLIND);
  sb.chips -= sbAmount;
  sb.bet = sbAmount;
  sb.totalHandBet = sbAmount;
  bb.chips -= bbAmount;
  bb.bet = bbAmount;
  bb.totalHandBet = bbAmount;
  room.pot = sbAmount + bbAmount;
  room.currentTurnIndex = (bbIndex + 1) % PLAYER_COUNT;
  send(res, 200, { room });
}

function applyMove(body: MoveBody, res: any): void {
  ensureRoom();
  const playerIndex = body.playerIndex;
  if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) {
    send(res, 400, { error: 'invalid playerIndex' });
    return;
  }
  const player = room.players[playerIndex];
  const move = body.move;
  const amount = typeof body.amount === 'number' ? body.amount : 0;
  let highest = room.highestBet;
  if (move === 'fold') {
    player.hasFolded = true;
  } else if (move === 'check') {
  } else if (move === 'call') {
    const callAmount = room.highestBet - player.bet;
    const pay = Math.min(player.chips, callAmount);
    player.chips -= pay;
    player.bet += pay;
    player.totalHandBet += pay;
    room.pot += pay;
  } else if (move === 'raise' || move === 'allin') {
    let raiseTo = amount;
    if (raiseTo < room.highestBet && player.chips + player.bet > raiseTo) {
      raiseTo = room.highestBet;
    }
    const diff = raiseTo - player.bet;
    const add = Math.min(player.chips, diff);
    player.chips -= add;
    player.bet += add;
    player.totalHandBet += add;
    room.pot += add;
    if (player.bet > highest) {
      highest = player.bet;
    }
  }
  room.highestBet = highest;
  room.currentTurnIndex = (playerIndex + 1) % PLAYER_COUNT;
  send(res, 200, { room });
}

function settle(body: SettleBody, res: any): void {
  ensureRoom();
  const uniqueWinners: number[] = [];
  for (const idx of body.winners) {
    if (typeof idx === 'number' && idx >= 0 && idx < PLAYER_COUNT) {
      if (!uniqueWinners.includes(idx)) {
        uniqueWinners.push(idx);
      }
    }
  }
  if (uniqueWinners.length === 0) {
    send(res, 400, { error: 'no winners' });
    return;
  }
  const share = Math.floor(room.pot / uniqueWinners.length);
  for (const idx of uniqueWinners) {
    const p = room.players[idx];
    p.chips += share;
  }
  room.winners = uniqueWinners;
  room.stage = 'SHOWDOWN';
  send(res, 200, { room });
}

export default function handler(req: any, res: any): void {
  if (req.method === 'GET') {
    ensureRoom();
    send(res, 200, { room });
    return;
  }
  if (req.method === 'POST') {
    const body: Body = req.body as Body;
    if (!body || typeof body.op !== 'string') {
      send(res, 400, { error: 'invalid body' });
      return;
    }
    if (body.op === 'join') {
      handleJoin(body as JoinBody, res);
      return;
    }
    if (body.op === 'start') {
      startHand(res);
      return;
    }
    if (body.op === 'move') {
      applyMove(body as MoveBody, res);
      return;
    }
    if (body.op === 'settle') {
      settle(body as SettleBody, res);
      return;
    }
    send(res, 400, { error: 'unknown op' });
    return;
  }
  send(res, 405, { error: 'method not allowed' });
}
