import React, { useState, useMemo, useEffect } from 'react';
import { CardDisplay } from './components/CardDisplay';
import { CardSelector } from './components/CardSelector';
import { AiPromptModal } from './components/AiPromptModal';
import { Card } from './types';
import { calculateEquity, calculateOuts, CalcResult, OutsResult } from './services/pokerCalculator';
import { generateAnalysisPrompt } from './services/geminiService';
import { Calculator, Zap, AlertTriangle, RefreshCw, TrendingUp, Info, Loader2, MousePointerClick, Bot } from 'lucide-react';

export default function App() {
  // --- State ---
  const [heroCards, setHeroCards] = useState<(Card | undefined)[]>([undefined, undefined]);
  const [boardCards, setBoardCards] = useState<(Card | undefined)[]>([undefined, undefined, undefined, undefined, undefined]);
  
  // Selection Modal State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<{ type: 'hero' | 'board', index: number } | null>(null);

  // AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Money / Math State
  const [potSize, setPotSize] = useState<string>(''); // Current Total Pot (including villain bet)
  const [toCall, setToCall] = useState<string>('');   // Amount Hero needs to call
  
  // Analysis State
  const [isCalculating, setIsCalculating] = useState(false);
  const [equityResult, setEquityResult] = useState<CalcResult | null>(null);
  const [outsData, setOutsData] = useState<OutsResult | null>(null);

  // UI State
  const [highlightBestHand, setHighlightBestHand] = useState(false);

  // --- Derived Values ---
  const unavailableCards = useMemo(() => {
    const set = new Set<string>();
    heroCards.forEach(c => c && set.add(c.id));
    boardCards.forEach(c => c && set.add(c.id));
    return set;
  }, [heroCards, boardCards]);

  const cardsDealtCount = boardCards.filter(c => c !== undefined).length;
  const streetName = cardsDealtCount === 0 ? '翻牌前 (Pre-Flop)' : cardsDealtCount === 3 ? '翻牌圈 (Flop)' : cardsDealtCount === 4 ? '轉牌圈 (Turn)' : '河牌圈 (River)';
  const isPostFlop = cardsDealtCount >= 3;

  // --- Auto Calculation Effect ---
  useEffect(() => {
    const validHero = heroCards.every(c => c !== undefined);
    // Reset highlight when cards change
    setHighlightBestHand(false);
    
    // Only calculate if we have 2 hero cards. 
    if (validHero) {
      const validBoard = boardCards.filter((c): c is Card => c !== undefined);
      
      setIsCalculating(true);
      const timer = setTimeout(async () => {
        try {
          if (validBoard.length === 0) {
            // Preflop: Use Monte Carlo only
            const result = await calculateEquity(heroCards as Card[], validBoard);
            setEquityResult(result);
            setOutsData(null);
          } else {
            // Flop/Turn/River: Use Outs Calculation (Rule of 4&2) + Hand Identification
            // Even on River, calculateOuts returns current hand info
            const outs = calculateOuts(heroCards as Card[], validBoard);
            setOutsData(outs);
            setEquityResult(null); 
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsCalculating(false);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setEquityResult(null);
      setOutsData(null);
    }
  }, [heroCards, boardCards]);

  // --- Math Logic ---
  const potOddsPercent = useMemo(() => {
    const pot = parseFloat(potSize);
    const call = parseFloat(toCall);
    if (isNaN(pot) || isNaN(call) || call <= 0 || pot <= 0) return 0;
    
    // User Formula: Call / (Total Pot + Call)
    return (call / (pot + call)) * 100;
  }, [potSize, toCall]);

  // Determine which Equity to show and use for decision
  const displayEquity = useMemo(() => {
     if (isPostFlop && outsData) {
        return outsData.ruleOf42Equity;
     }
     if (equityResult) {
        return equityResult.equity;
     }
     return 0;
  }, [isPostFlop, outsData, equityResult]);

  const decision = useMemo(() => {
    // If Pot Odds aren't valid yet, no decision
    if (potOddsPercent === 0) return null;
    // If we are calculating, no decision yet
    if (isCalculating) return null;
    
    // If Pre-flop and no data, return null
    if (!isPostFlop && !equityResult) return null;
    
    // If Post-flop and no data, return null
    if (isPostFlop && !outsData) return null;

    if (displayEquity >= potOddsPercent) return '跟注 CALL';
    return '棄牌 FOLD';
  }, [displayEquity, potOddsPercent, isCalculating, isPostFlop, equityResult, outsData]);

  // --- Prompt Generation ---
  const aiPromptText = useMemo(() => {
    return generateAnalysisPrompt(
      heroCards,
      boardCards,
      potSize,
      toCall,
      displayEquity,
      outsData ? outsData.effectiveOuts : 0,
      potOddsPercent,
      outsData?.currentHandObj.localizedName || '未計算'
    );
  }, [heroCards, boardCards, potSize, toCall, displayEquity, outsData, potOddsPercent]);


  // --- Helpers ---
  const getSuitTextColor = (cardStr: string) => {
    if (cardStr.includes('♥')) return 'text-red-400';
    if (cardStr.includes('♦')) return 'text-blue-400';
    if (cardStr.includes('♣')) return 'text-green-400';
    return 'text-slate-300'; // Spades
  };

  const isCardInBestHand = (cardId: string | undefined): boolean => {
    if (!cardId || !outsData || !outsData.winningCards) return false;
    return outsData.winningCards.includes(cardId);
  };

  // --- Handlers ---
  const handleCardClick = (type: 'hero' | 'board', index: number) => {
    setSelectionTarget({ type, index });
    setIsSelectorOpen(true);
  };

  const handleSelectCard = (card: Card) => {
    if (!selectionTarget) return;
    
    if (selectionTarget.type === 'hero') {
      const newHand = [...heroCards];
      newHand[selectionTarget.index] = card;
      setHeroCards(newHand);
    } else {
      const newBoard = [...boardCards];
      newBoard[selectionTarget.index] = card;
      setBoardCards(newBoard);
    }
  };

  const clearBoard = () => {
    setHeroCards([undefined, undefined]);
    setBoardCards([undefined, undefined, undefined, undefined, undefined]);
    setEquityResult(null);
    setOutsData(null);
    setPotSize('');
    setToCall('');
    setHighlightBestHand(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-20 font-sans">
      
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-4 pt-8 top-0 z-30 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="text-emerald-500 w-6 h-6" />
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              德州撲克勝率計算器
            </h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAiModalOpen(true)}
              className="text-xs text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 flex items-center gap-1 border border-transparent rounded px-3 py-1.5 transition-all shadow-md"
            >
              <Bot size={14} /> 詢問 AI
            </button>
            <button 
              onClick={clearBoard}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 border border-slate-700 rounded px-2 py-1 transition-colors"
            >
              <RefreshCw size={14} /> 重置
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        
        {/* Table & Cards Section */}
        <section className="bg-emerald-900/20 border border-emerald-900/50 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
           {/* Decorative felt texture/gradient */}
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-900 to-slate-900 -z-10"></div>
           
           <div className="flex flex-col items-center gap-6 sm:gap-8">
              
              {/* Board Cards */}
              <div className="flex flex-col items-center gap-2 w-full">
                <span className="text-emerald-500/80 text-xs font-bold uppercase tracking-widest">{streetName}</span>
                <div className="flex flex-wrap gap-6 justify-center sm:gap-4 place-items-center">
                  {boardCards.map((card, idx) => {
                    const isDimmed = highlightBestHand && card && !isCardInBestHand(card.id);
                    return (
                      <CardDisplay 
                        key={`board-${idx}`} 
                        card={card} 
                        placeholder={idx < 3 ? '翻牌' : idx === 3 ? '轉牌' : '河牌'}
                        onClick={() => handleCardClick('board', idx)}
                        className={`
                            ${idx >= 3 && cardsDealtCount < idx ? "opacity-30" : ""}
                            ${isDimmed ? "opacity-20 grayscale transition-all duration-300" : "transition-all duration-300"}
                            ${highlightBestHand && isCardInBestHand(card?.id) ? "ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] scale-105" : ""}
                        `}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Hero Cards */}
              <div className="flex flex-col items-center gap-2">
                 <span className="text-yellow-500/80 text-xs font-bold uppercase tracking-widest">你的手牌 (Hero)</span>
                 <div className="flex gap-2 sm:gap-4">
                    {heroCards.map((card, idx) => {
                      const isDimmed = highlightBestHand && card && !isCardInBestHand(card.id);
                      return (
                        <CardDisplay 
                          key={`hero-${idx}`} 
                          card={card} 
                          placeholder="手牌"
                          onClick={() => handleCardClick('hero', idx)}
                          selected={!highlightBestHand}
                          className={`
                            ${isDimmed ? "opacity-20 grayscale transition-all duration-300" : "transition-all duration-300"}
                            ${highlightBestHand && isCardInBestHand(card?.id) ? "ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] scale-105" : ""}
                          `}
                        />
                      );
                    })}
                 </div>
              </div>

           </div>
        </section>

        {/* Controls & Math Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left: Auto Outs / Equity Display */}
          <div className="space-y-6 order-2 md:order-1 w-full">
             <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm relative overflow-hidden flex flex-col h-[420px] md:h-full">
               <div className="flex justify-between items-center mb-4 shrink-0">
                  <h2 className="text-slate-400 text-sm font-semibold uppercase flex items-center gap-2">
                    <Zap size={16} /> 勝率估算 (二四法則)
                  </h2>
                  {isCalculating && <Loader2 className="animate-spin text-emerald-500" size={16} />}
               </div>

               <div className="space-y-3 flex-1 flex flex-col min-h-0">
                 
                 {/* Current Hand Display */}
                 {isPostFlop && outsData && (
                    <div 
                      onClick={() => setHighlightBestHand(!highlightBestHand)}
                      className={`
                        bg-slate-900/80 rounded-lg p-3 flex items-center justify-between border 
                        cursor-pointer select-none transition-all duration-200 shrink-0 group
                        ${highlightBestHand 
                            ? 'border-emerald-500/50 bg-emerald-900/20' 
                            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                        }
                      `}
                    >
                       <div className="flex items-center gap-2">
                          <MousePointerClick size={14} className={`
                              ${highlightBestHand ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}
                          `} />
                          <span className="text-slate-400 text-xs sm:text-sm block">目前牌型 (Current Hand)</span>
                       </div>
                       <div className="text-right">
                          <span className={`font-mono font-bold text-base sm:text-lg transition-colors ${highlightBestHand ? 'text-emerald-400' : 'text-blue-400'}`}>
                            {outsData.currentHandObj.localizedName}
                          </span>
                       </div>
                    </div>
                 )}

                 {/* Auto-calculated Outs Display */}
                 <div className="bg-slate-900/80 rounded-lg p-3 flex items-center justify-between border border-slate-700 shrink-0">
                    <div>
                      <span className="text-slate-400 text-sm block">有效 Outs (補牌張數)</span>
                      <span className="text-slate-600 text-xs block mt-1">
                        {isPostFlop ? (cardsDealtCount === 3 ? '轉牌+河牌 (x4%, 修正值)' : cardsDealtCount === 4 ? '河牌 (x2%)' : '河牌 (無補牌)') : '翻牌前無法計算 Outs'}
                      </span>
                    </div>
                    
                    <div className="text-right">
                      {isPostFlop && outsData ? (
                           <div className="flex flex-col items-end">
                               <span className={`font-mono font-bold text-3xl ${outsData.effectiveOuts > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{outsData.effectiveOuts} 張</span>
                               {outsData.effectiveOuts < outsData.totalOuts && (
                                   <span className="text-[10px] text-slate-500 line-through">總計 {outsData.totalOuts} 張</span>
                               )}
                           </div>
                      ) : (
                           <span className="text-slate-500 text-sm font-mono">-</span>
                      )}
                    </div>
                 </div>

                 {/* Improving Cards List (Detailed Outs) */}
                 <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 flex-1 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-700/50 bg-slate-800/30 text-xs font-semibold text-slate-400">
                       增強手牌的可能牌型 (Specific Outs)
                    </div>
                    
                    <div className="p-2 overflow-y-auto space-y-2 no-scrollbar">
                        {isPostFlop && outsData && outsData.groups.length > 0 ? (
                            outsData.groups.map((group, idx) => (
                                <div 
                                  key={idx} 
                                  className={`
                                    bg-slate-800/50 p-2 rounded border transition-opacity duration-300
                                    ${group.isExcluded ? 'border-slate-800 opacity-40' : 'border-slate-700/30'}
                                  `}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium text-xs ${group.isExcluded ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                                {group.handName}
                                            </span>
                                            {group.isExcluded && <span className="text-[10px] text-amber-500/80">(排除)</span>}
                                        </div>
                                        <span className={`text-xs font-mono ${group.isExcluded ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
                                            {group.count} 張
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {group.cards.map((c, cIdx) => (
                                            <span 
                                              key={cIdx} 
                                              className={`
                                                text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700
                                                ${getSuitTextColor(c)}
                                                ${group.isExcluded ? 'opacity-50' : ''}
                                              `}
                                            >
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
                                {isPostFlop ? (
                                    <span className="text-xs">沒有顯著增強手牌的補牌</span>
                                ) : (
                                    <>
                                       <Info size={16} />
                                       <p className="text-xs">
                                         {cardsDealtCount === 0 ? '翻牌前勝率基於模擬運算' : '請選擇翻牌以計算 Outs'}
                                       </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Right: Decision & Inputs */}
          <div className="space-y-6 order-1 md:order-2">
            
            
            {/* Money Inputs */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-sm">
              <h2 className="text-slate-400 text-sm font-semibold mb-4 uppercase flex items-center gap-2">
                <TrendingUp size={16} /> 底池賠率計算 (Pot Odds)
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block truncate">總底池 (包含對手下注)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input 
                      type="number" 
                      value={potSize}
                      onChange={(e) => setPotSize(e.target.value)}
                      placeholder="例如: 150"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block truncate">你需要跟注的金額</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input 
                      type="number" 
                      value={toCall}
                      onChange={(e) => setToCall(e.target.value)}
                      placeholder="例如: 50"
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Engine */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-1 shadow-2xl flex flex-col">
              <div className="flex-1 bg-slate-950/50 rounded-xl p-4 sm:p-6 flex flex-col justify-center items-center gap-6 sm:gap-8 overflow-hidden">
                 
                 {/* Decision Display */}
                 <div className="text-center space-y-3 z-10 w-full">
                    <h3 className="text-slate-400 text-xs sm:text-sm uppercase tracking-widest font-semibold">決策建議</h3>
                    
                    {isCalculating ? (
                      <div className="text-slate-500 animate-pulse text-lg py-4">計算中...</div>
                    ) : decision ? (
                      <div className={`
                        text-3xl sm:text-5xl font-black tracking-tighter 
                        px-4 py-4 sm:px-8 sm:py-6
                        rounded-2xl border-2 transform transition-all duration-500 break-words w-full
                        ${decision.includes('跟注') 
                          ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]' 
                          : 'text-red-400 border-red-500/50 bg-red-500/10 shadow-[0_0_40px_-10px_rgba(239,68,68,0.5)]'}
                      `}>
                        {decision}
                      </div>
                    ) : (
                      <div className="text-slate-600 text-base sm:text-xl font-bold px-6 py-4 border-2 border-slate-800 border-dashed rounded-2xl">
                        等待數據...
                      </div>
                    )}
                 </div>

                 {/* Stats Comparer */}
                 <div className="w-full grid grid-cols-2 gap-px bg-slate-700/50 rounded-lg overflow-hidden border border-slate-700/50 z-10">
                    
                    {/* Equity */}
                    <div className="bg-slate-900 p-2 sm:p-4 flex flex-col items-center gap-1 group">
                      <span className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold text-center">當前勝率 (EQUITY)</span>
                      <div className="flex items-baseline gap-1">
                        {isCalculating ? (
                          <span className="text-slate-500 text-sm">...</span>
                        ) : (
                          <span className={`text-xl sm:text-3xl font-bold ${displayEquity >= potOddsPercent ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {displayEquity.toFixed(1)}
                          </span>
                        )}
                        <span className="text-[10px] sm:text-sm text-slate-500">%</span>
                      </div>
                      <span className="text-[10px] text-slate-600 text-center scale-90 sm:scale-100">
                         {isPostFlop ? 'Outs × 2% 或 4%' : '系統模擬運算'}
                      </span>
                    </div>

                    {/* Pot Odds */}
                    <div className="bg-slate-900 p-2 sm:p-4 flex flex-col items-center gap-1">
                      <span className="text-[10px] sm:text-xs text-slate-500 uppercase font-semibold text-center">底池賠率 (POT ODDS)</span>
                      <div className="flex items-baseline gap-1">
                         <span className={`text-xl sm:text-3xl font-bold ${potOddsPercent > displayEquity ? 'text-red-400' : 'text-slate-300'}`}>
                          {potOddsPercent.toFixed(1)}
                        </span>
                        <span className="text-[10px] sm:text-sm text-slate-500">%</span>
                      </div>
                      <span className="text-[10px] text-slate-600 text-center scale-90 sm:scale-100">所需勝率門檻</span>
                    </div>

                 </div>
                 
                 {/* Warning */}
                 {!potSize && !toCall && (
                   <div className="bottom-2 flex items-center gap-2 text-amber-500/50 text-[10px] sm:text-xs">
                     <AlertTriangle size={12} /> 請輸入底池大小與跟注金額
                   </div>
                 )}
              </div>
            </div>


          </div>
        </div>

        {/* Instructions / Footer */}
        <div className="bg-slate-800/50 rounded-lg p-4 text-xs text-slate-400 border border-slate-700/50 leading-relaxed mb-8">
           <h4 className="font-bold text-slate-300 mb-2 text-sm">德州撲克數學精華：</h4>
           <div className="space-y-2">
             <p>1. <strong>勝率計算 (Equity)：</strong> <span className="text-emerald-400">使用 Outs 估算中牌的機率</span>。若還有兩張公共牌未開（轉牌＋河牌）：勝率 ≈ Outs × 4% (若 Outs &gt; 8 則修正)。若只看下一張牌：勝率 ≈ Outs × 2%。</p>
             <p>2. <strong>底池賠率 (Pot Odds)：</strong> <span className="text-blue-400">需跟注金額 ÷ (總底池 + 需跟注金額)</span>。例如：底池150，需跟50，總池變200。賠率 = 50÷200 = 25%。</p>
             <p>3. <strong>決策原則：</strong> 若 <span className="text-emerald-400">勝率 &gt; 底池賠率</span>，長期而言應<strong>跟注</strong>；反之則應<strong>棄牌</strong>。</p>
           </div>
        </div>

      </main>

      <CardSelector 
        isOpen={isSelectorOpen} 
        onClose={() => setIsSelectorOpen(false)}
        onSelect={handleSelectCard}
        unavailableCards={unavailableCards}
      />

      <AiPromptModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        promptText={aiPromptText}
      />

    </div>
  );
}