export const INITIAL_CHIPS = 10000;
export const SMALL_BLIND = 50;
export const BIG_BLIND = 100;
export const PLAYER_COUNT = 4;
export const ANIMATION_DELAY = 1000; // ms between AI turns
export const MAX_ALLIN = 3000;

// Colors for suits
export const SUIT_COLORS = {
  '♥': 'text-red-500',
  '♦': 'text-red-500',
  '♣': 'text-slate-800',
  '♠': 'text-slate-800',
};

export const RECOVERY_PASSWORD = 'camel';

export const HAND_NAMES: Record<number, string> = {
  0: '高牌',
  1: '一對',
  2: '兩對',
  3: '三條',
  4: '順子',
  5: '同花',
  6: '葫蘆',
  7: '四條',
  8: '同花順',
  9: '皇家同花順'
};