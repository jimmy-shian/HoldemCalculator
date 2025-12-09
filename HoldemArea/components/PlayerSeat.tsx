import React, { useState } from 'react';
import { Player, GameStage, GameMode, Card } from '../types';
import { CardComponent } from './CardComponent';
import { User, Bot, Coins } from 'lucide-react';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  gameStage: GameStage;
  positionClass: string;
  orientation?: 'vertical' | 'horizontal';
  isSpectating: boolean;
  onJoin: (seatIndex: number, name: string) => void;
  winningCards?: Card[];
  isWinner?: boolean;
  pendingName?: string | null;
  seatIndex: number;
  gameMode: GameMode;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isActive,
  gameStage,
  positionClass,
  orientation = 'vertical',
  isSpectating,
  onJoin,
  winningCards,
  isWinner,
  pendingName,
  seatIndex,
  gameMode
}) => {
  const [joinName, setJoinName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinName.trim()) {
      onJoin(seatIndex, joinName.trim());
      setIsJoining(false);
    }
  };

  // Logic to allow joining:
  // 1. In Multiplayer: If it's a Bot, you can join (take over).
  // 2. In Singleplayer: Seat 0 is joinable if you are spectating.
  const canJoin = (gameMode === GameMode.MULTIPLAYER && !player.isHuman) || 
                  (gameMode === GameMode.SINGLEPLAYER && seatIndex === 0 && isSpectating);

  // Visual classes for Mobile vs Desktop
  const containerBase = orientation === 'horizontal' 
    ? 'flex flex-row items-center gap-1 md:gap-4' 
    : 'flex flex-col items-center gap-1 md:gap-2';
    
  const avatarSize = 'w-10 h-10 md:w-16 md:h-16';
  const fontSizeName = 'text-[10px] md:text-sm';
  const fontSizeChips = 'text-[10px] md:text-xs';
  
  // Determine Bubble Position based on Seat Index
  // Seat 2 (Top) -> Below. Everyone else -> Above.
  const getActionBubbleClass = () => {
    if (seatIndex === 2) {
        return 'top-full mt-1 md:mt-2 left-1/2 -translate-x-1/2';
    }
    return 'bottom-full mb-1 md:mb-2 left-1/2 -translate-x-1/2';
  };

  // Determine Bet Bubble Position (Side)
  // Seats 0, 1 (Info First): Place on Left (away from cards)
  // Seats 2, 3 (Cards First): Place on Right (away from cards)
  const getBetBubbleClass = () => {
     if (seatIndex === 0 || seatIndex === 1) {
         return 'right-full mr-2 top-1/2 -translate-y-1/2';
     }
     return 'left-full ml-2 top-1/2 -translate-y-1/2';
  };

  const InfoBlock = (
    <div className={`relative ${isActive ? 'z-30' : 'z-20'} flex flex-col items-center group`}>
      {/* Action Bubble */}
      {player.actionText && (
        <div className={`absolute whitespace-nowrap px-2 py-0.5 md:px-3 md:py-1 bg-yellow-500 text-slate-900 rounded-full font-bold text-[10px] md:text-sm shadow-lg animate-bounce z-50 border-2 border-white ${getActionBubbleClass()}`}>
          {player.actionText}
        </div>
      )}

      {/* Current Bet Bubble (Attached to Info Plate - Side) */}
      {player.bet > 0 && (
        <div className={`absolute ${getBetBubbleClass()} flex items-center gap-1 bg-slate-700/95 px-2 py-1 rounded-lg border border-slate-500 shadow-sm z-30 whitespace-nowrap`}>
            <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-red-500 border border-red-700"></div>
            <span className="text-xs md:text-sm font-mono text-white leading-none font-bold">{player.bet}</span>
        </div>
      )}

      {/* Avatar Circle */}
      <div className={`relative ${avatarSize} rounded-full border-2 md:border-4 flex items-center justify-center shadow-lg transition-all duration-300 ${isActive ? 'border-yellow-400 bg-slate-800 scale-110 shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'border-slate-600 bg-slate-900'}`}>
        {player.isHuman ? (
           <User className={`${isActive ? 'text-yellow-400' : 'text-blue-400'}`} size={20} strokeWidth={2.5} />
        ) : (
           <Bot className={`${isActive ? 'text-yellow-400' : 'text-emerald-400'}`} size={20} strokeWidth={2.5} />
        )}
        
        {/* Dealer Button */}
        {player.isDealer && (
          <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-4 h-4 md:w-6 md:h-6 bg-white text-black rounded-full flex items-center justify-center font-bold text-[8px] md:text-xs border border-slate-400 shadow-sm z-10">
            D
          </div>
        )}

        {/* Join Overlay Button for MP/Spectator */}
        {canJoin && !isJoining && (
             <button 
                onClick={() => setIsJoining(true)}
                className="absolute bottom-[-6px] md:bottom-[-8px] left-1/2 -translate-x-1/2 bg-green-600 hover:bg-green-500 text-white text-[8px] md:text-[10px] px-2 py-0.5 rounded-full shadow-lg z-50 whitespace-nowrap border border-white"
             >
                + 入座
             </button>
        )}
        
        {/* Name Input Overlay */}
        {isJoining && (
             <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 bg-slate-800 p-2 rounded border border-slate-600 shadow-xl z-50 w-24 md:w-32">
                 <form onSubmit={handleJoinSubmit}>
                    <input 
                      autoFocus
                      className="w-full bg-slate-900 text-white text-xs px-1 py-1 rounded border border-slate-500 mb-1"
                      placeholder="Name"
                      maxLength={8}
                      value={joinName}
                      onChange={e => setJoinName(e.target.value)}
                      onBlur={() => { if(!joinName) setIsJoining(false); }}
                    />
                    <div className="flex gap-1">
                        <button type="submit" className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-[10px] text-white rounded py-0.5">Go</button>
                        <button type="button" onClick={() => setIsJoining(false)} className="flex-1 bg-slate-600 hover:bg-slate-500 text-[10px] text-white rounded py-0.5">X</button>
                    </div>
                 </form>
             </div>
        )}
      </div>

      {/* Name & Chips Plate */}
      <div className={`mt-1 md:mt-2 bg-slate-800/90 backdrop-blur border border-slate-600 rounded md:rounded-lg p-0.5 md:p-1 min-w-[64px] md:min-w-[90px] text-center shadow-lg flex flex-col items-center justify-center transition-colors relative z-20 ${isActive ? 'border-yellow-500/50' : ''}`}>
         {seatIndex === 0 && pendingName ? (
             <div className="text-yellow-500 text-[10px] italic">等待中...</div>
         ) : (
             <>
                <div className={`${fontSizeName} font-bold text-white truncate max-w-[64px] md:max-w-[100px] leading-tight`}>
                    {player.name}
                </div>
                <div className={`${fontSizeChips} font-mono text-yellow-500 flex items-center gap-1 leading-tight`}>
                    <Coins size={10} className="md:w-3 md:h-3" />
                    {player.chips.toLocaleString()}
                </div>
             </>
         )}
      </div>
    </div>
  );

  // Cards Layout
  const CardsBlock = (
    <div className={`flex ${isActive ? 'filter-none' : 'brightness-90'} transition-all duration-300 relative z-10`} style={{ perspective: '500px' }}>
            {/* Card 1 */}
            <div className={`transform transition-transform duration-500 ${isActive ? 'translate-y-[-5px]' : ''}`} style={{ transformOrigin: 'bottom center' }}>
                <CardComponent 
                    card={player.cards[0]} 
                    hidden={!player.cards[0] || (player.isHuman ? false : (gameStage !== GameStage.SHOWDOWN))} 
                    className="transform -rotate-6 mr-[-10px] md:mr-[-15px] shadow-[-2px_0_5px_rgba(0,0,0,0.3)]"
                    size="md" // Increased size
                    isWinning={winningCards?.some(c => c.key === player.cards[0]?.key)}
                    isDimmed={isWinner !== undefined && !isWinner && gameStage === GameStage.SHOWDOWN}
                />
            </div>
            {/* Card 2 */}
            <div className={`transform transition-transform duration-500 ${isActive ? 'translate-y-[-5px]' : ''}`} style={{ transformOrigin: 'bottom center', zIndex: 1 }}>
                <CardComponent 
                    card={player.cards[1]} 
                    hidden={!player.cards[1] || (player.isHuman ? false : (gameStage !== GameStage.SHOWDOWN))} 
                    className="transform rotate-6 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
                    size="md" // Increased size
                    isWinning={winningCards?.some(c => c.key === player.cards[1]?.key)}
                    isDimmed={isWinner !== undefined && !isWinner && gameStage === GameStage.SHOWDOWN}
                />
            </div>
            
            {isWinner && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 md:-top-16 flex items-center justify-center pointer-events-none z-50">
                    <div className="bg-yellow-500 text-black font-black text-xs md:text-base px-2 py-0.5 md:px-3 md:py-1 rounded shadow-[0_0_15px_rgba(250,204,21,1)] animate-bounce border-2 border-white uppercase tracking-widest transform rotate-[-5deg]">
                        WIN
                    </div>
                </div>
            )}
    </div>
  );

  // Layout Logic:
  // Seat 0 (Bottom) & Seat 1 (Left): Info -> Cards
  // Seat 2 (Top) & Seat 3 (Right): Cards -> Info
  const isInfoFirst = seatIndex === 0 || seatIndex === 1;

  return (
    <div className={`absolute ${positionClass} ${containerBase}`}>
        {orientation === 'horizontal' ? (
            isInfoFirst ? (
                <>
                    {InfoBlock}
                    {CardsBlock}
                </>
            ) : (
                <>
                    {CardsBlock}
                    {InfoBlock}
                </>
            )
        ) : (
            <div className="flex flex-col items-center gap-1">
                {InfoBlock}
                {CardsBlock}
            </div>
        )}
    </div>
  );
};