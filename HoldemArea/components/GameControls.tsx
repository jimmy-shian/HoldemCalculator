import React, { useState, useEffect } from 'react';
import { MAX_ALLIN } from '../constants';

interface GameControlsProps {
  onCall: () => void;
  onFold: () => void;
  onRaise: (amount: number) => void;
  onCheck: () => void;
  canCheck: boolean;
  canRaise: boolean;
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  playerChips: number;
  disabled: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onCall,
  onFold,
  onRaise,
  onCheck,
  canCheck,
  canRaise,
  callAmount,
  minRaise,
  maxRaise,
  playerChips,
  disabled
}) => {
  // Cap the slider max value at 3000 or player's max
  const sliderMax = Math.min(maxRaise, MAX_ALLIN);
  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  // Update raise amount if minRaise changes (e.g. someone else raised)
  useEffect(() => {
    if (minRaise > sliderMax) {
       // If min raise is forced higher than cap (unlikely with this ruleset but possible), clamp it
       setRaiseAmount(sliderMax);
    } else {
       setRaiseAmount(Math.max(minRaise, raiseAmount));
    }
  }, [minRaise, sliderMax]);

  const handleRaiseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaiseAmount(Number(e.target.value));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 border-t border-slate-700 flex flex-col md:flex-row items-center justify-center gap-4 backdrop-blur-md z-50">
      <div className="flex items-center gap-4 w-full md:w-auto justify-center">
        <button
          onClick={onFold}
          disabled={disabled}
          className="px-6 py-3 rounded-lg bg-red-800 text-white border border-red-700 hover:bg-red-700 font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg"
        >
          棄牌 (Fold)
        </button>

        {canCheck ? (
          <button
            onClick={onCheck}
            disabled={disabled}
            className="px-6 py-3 rounded-lg bg-teal-800 text-emerald-100 border border-teal-700 hover:bg-teal-700 font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            過牌 (Check)
          </button>
        ) : (
          <button
            onClick={onCall}
            disabled={disabled}
            className="px-6 py-3 rounded-lg bg-teal-800 text-emerald-100 border border-teal-700 hover:bg-teal-700 font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            跟注 (Call) {callAmount}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-center bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-inner">
         {canRaise && sliderMax >= minRaise ? (
           <>
             <div className="flex flex-col w-48 px-2">
               <input
                type="range"
                min={minRaise}
                max={sliderMax}
                step={50}
                value={raiseAmount}
                onChange={handleRaiseChange}
                disabled={disabled}
                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                 <span>{minRaise}</span>
                 <span>{sliderMax}</span>
              </div>
             </div>
             <button
              onClick={() => onRaise(raiseAmount)}
              disabled={disabled}
              className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed text-sm whitespace-nowrap shadow-md border border-yellow-500"
             >
              加注 (Raise) {raiseAmount}
             </button>
           </>
         ) : (
             <div className="text-xs text-slate-400 px-2">無法加注 (Maxed)</div>
         )}
         
         <button
            onClick={() => onRaise(Math.min(playerChips + (callAmount || 0), MAX_ALLIN))}
            disabled={disabled}
            className="ml-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed text-sm whitespace-nowrap border border-purple-400 shadow-[0_0_10px_rgba(147,51,234,0.5)]"
          >
            All In {Math.min(playerChips + (callAmount || 0), MAX_ALLIN)}
          </button>
      </div>
    </div>
  );
};