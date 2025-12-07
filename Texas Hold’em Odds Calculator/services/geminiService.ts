import { Card } from "../types";

// Helper to format cards for the prompt
const formatCards = (cards: (Card | undefined)[]): string => {
  const validCards = cards.filter((c): c is Card => c !== undefined);
  if (validCards.length === 0) return "無 (None)";
  return validCards.map(c => `${c.rank}${c.suit}`).join(", ");
};

export const generateAnalysisPrompt = (
  heroCards: (Card | undefined)[],
  boardCards: (Card | undefined)[],
  potSize: string,
  toCall: string,
  equity: number,
  outs: number,
  potOdds: number,
  currentHand: string
): string => {
  const heroStr = formatCards(heroCards);
  const boardStr = formatCards(boardCards);
  
  const street = boardCards.filter(c => c !== undefined).length === 0 ? "翻牌前 (Pre-flop)" :
                 boardCards.filter(c => c !== undefined).length === 3 ? "翻牌圈 (Flop)" :
                 boardCards.filter(c => c !== undefined).length === 4 ? "轉牌圈 (Turn)" : "河牌圈 (River)";

  return `你是德州撲克 GTO 策略專家。請分析以下局勢並給出最佳行動建議。

【局勢資訊】
- 階段 (Street): ${street}
- 我的手牌 (Hero Hand): [${heroStr}]
- 公共牌 (Board): [${boardStr}]
- 目前牌型: ${currentHand}
- 總底池 (Pot): ${potSize || '未知'}
- 跟注金額 (Call): ${toCall || '未知'}

【數學數據】
- 補牌數 (Outs): ${outs}
- 勝率 (Equity): ${equity.toFixed(1)}%
- 底池賠率 (Pot Odds): ${potOdds.toFixed(1)}%

【問題】
1. 請分析我目前的牌力強弱。
2. 比較勝率與底池賠率，我是否應該跟注？
3. 請給出具體的行動建議（過牌、跟注、加注或棄牌），並解釋背後的 GTO 或剝削策略邏輯。
4. 如果有顯著的聽牌 (Draws)，請評估隱含賠率 (Implied Odds) 的價值。

請用繁體中文詳細回答。`;
};