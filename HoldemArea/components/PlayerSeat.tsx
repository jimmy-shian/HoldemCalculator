import React, { useState, useEffect } from 'react';
import { Player, Card, GameStage } from '../types';
import { CardComponent } from './CardComponent';
import { User, Bot, Coins, PlusCircle, Clock } from 'lucide-react';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  gameStage: GameStage;
  positionClass: string;
  orientation?: 'vertical' | 'horizontal';
  isSpectating: boolean;
  onJoin?: (name: string) => void;
  winningCards?: Card[];
  isWinner?: boolean;
  pendingName?: string | null;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({ 
  player, 
  isActive, 
  gameStage, 
  positionClass,
  orientation = 'vertical',
  isSpectating,
  onJoin,
  winningCards = [],
  isWinner = false,
  pendingName
}) => {
  const isShowdown = gameStage === GameStage.SHOWDOWN;
  const [joinName, setJoinName] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [displayAction, setDisplayAction] = useState<string | undefined>(undefined);

  // Effect to handle floating action text fade out
  useEffect(() => {
    if (player.actionText) {
      setDisplayAction(player.actionText);
      const timer = setTimeout(() => {
        setDisplayAction(undefined);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [player.actionText, player.bet]);

  const isMe = !isSpectating && player.id === 0;
  const showCards = isMe || (isShowdown && !player.hasFolded);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinName.trim() && onJoin) {
      onJoin(joinName);
      setShowJoinInput(false);
    }
  };

  const canJoin = isSpectating && player.id === 0 && onJoin && !pendingName;
  const isPending = isSpectating && player.id === 0 && pendingName;

  const isCardWinning = (card: Card) => {
    return isWinner && winningCards.some(wc => wc.suit === card.suit && wc.rank === card.rank);
  };

  const isHorizontal = orientation === 'horizontal';

  // Component Parts
  const CardsBlock = (
    <div className={`flex -space-x-4 relative h-24 items-end ${isHorizontal ? 'order-2' : ''}`}>
      {player.cards.map((card, idx) => (
        <div key={idx} className={`transform transition-transform duration-500 origin-bottom-left ${idx === 1 ? 'rotate-6 translate-y-[-4px]' : '-rotate-6'}`}>
          <CardComponent 
            card={card} 
            hidden={!showCards} 
            isWinning={showCards && isCardWinning(card)}
            isDimmed={showCards && isWinner && !isCardWinning(card)}
          />
        </div>
      ))}
      {player.hasFolded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10">
          <span className="text-white font-bold text-xs">棄牌</span>
        </div>
      )}
    </div>
  );

  const InfoBlock = (
    <div className={`relative flex flex-col items-center ${isHorizontal ? 'order-1' : ''}`}>
      
      {/* Avatar & Info */}
      <div className={`relative flex flex-col items-center bg-slate-900/90 border-2 rounded-xl p-2 min-w-[120px] backdrop-blur-sm transition-colors ${isActive ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : isWinner ? 'border-yellow-400 bg-yellow-900/30' : 'border-slate-700'}`}>
        
        {/* Dealer Button */}
        {player.isDealer && (
          <div className="absolute -top-3 -right-3 w-6 h-6 bg-white text-black rounded-full flex items-center justify-center font-bold text-xs border-2 border-slate-900 z-20 shadow-lg">
            D
          </div>
        )}

        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mb-1 border border-slate-600 relative overflow-hidden">
          {(player.isHuman && !isSpectating) ? <User size={20} className="text-blue-400" /> : <Bot size={20} className="text-emerald-400" />}
          
          {/* Win Badge */}
          {isWinner && (
             <div className="absolute inset-0 bg-yellow-500/20 animate-pulse flex items-center justify-center">
                <span className="text-xs font-bold text-yellow-300 drop-shadow-md">WIN</span>
             </div>
          )}
        </div>
        
        <div className="text-center w-full">
          <div className="text-xs font-bold text-slate-200 truncate max-w-[100px]">
            {isPending ? pendingName : player.name}
          </div>
          <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs font-mono mt-0.5">
            <Coins size={10} />
            {player.chips.toLocaleString()}
          </div>
        </div>

        {/* Action Bubble */}
        {displayAction && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-sm font-bold px-4 py-1.5 rounded-full whitespace-nowrap shadow-xl animate-fade-out z-40 border-2 border-white/20">
            {displayAction}
          </div>
        )}

        {/* Current Bet - Attached to info in horizontal mode for stability */}
        {isHorizontal && player.bet > 0 && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/80 text-white text-xs px-2 py-1 rounded-full border border-slate-600 flex items-center gap-1 shadow-md whitespace-nowrap">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-red-700"></div>
                {player.bet}
            </div>
        )}
      </div>

      {/* Current Bet - Vertical Mode default position */}
      {!isHorizontal && player.bet > 0 && (
         <div className="mt-1 bg-slate-800/80 text-white text-xs px-2 py-1 rounded-full border border-slate-600 flex items-center gap-1 shadow-md">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-red-700"></div>
            {player.bet}
         </div>
      )}
    </div>
  );

  return (
    <div className={`absolute flex ${isHorizontal ? 'flex-row items-end gap-4' : 'flex-col items-center gap-2'} transition-all duration-300 ${positionClass} ${player.hasFolded ? 'opacity-50 grayscale' : ''} ${isWinner ? 'scale-110 z-30' : 'z-10'}`}>
      
      {InfoBlock}
      {CardsBlock}

      {/* Join Button Overlay */}
      {canJoin && !showJoinInput && (
        <button 
          onClick={() => setShowJoinInput(true)}
          className={`absolute animate-bounce bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2 z-50 whitespace-nowrap ${isHorizontal ? '-top-12 left-1/2 -translate-x-1/2' : '-top-10'}`}
        >
          <PlusCircle size={16} />
          入座
        </button>
      )}

      {/* Pending State Overlay */}
      {isPending && (
         <div className={`absolute bg-slate-800/90 text-yellow-400 px-3 py-1 rounded-full border border-yellow-500/50 flex items-center gap-2 whitespace-nowrap shadow-lg animate-pulse z-50 ${isHorizontal ? '-top-14 left-1/2 -translate-x-1/2' : '-top-12'}`}>
            <Clock size={14} />
            <span className="text-xs">下一局開始接手...</span>
         </div>
      )}

      {/* Join Input */}
      {canJoin && showJoinInput && (
        <form onSubmit={handleJoinSubmit} className={`absolute bg-slate-800 p-2 rounded-lg border border-yellow-500 shadow-xl z-50 flex gap-1 ${isHorizontal ? '-top-20 left-1/2 -translate-x-1/2' : '-top-16'}`}>
          <input 
            type="text" 
            placeholder="輸入名字" 
            className="w-24 px-2 py-1 text-xs rounded bg-slate-900 text-white border border-slate-700 outline-none focus:border-yellow-500"
            value={joinName}
            onChange={e => setJoinName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="bg-emerald-600 text-white px-2 rounded text-xs">OK</button>
        </form>
      )}

    </div>
  );
};