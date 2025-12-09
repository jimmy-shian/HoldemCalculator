import React from 'react';
import { Card, Suit, Rank } from '../types';
import { SUIT_COLORS } from '../constants';

interface CardProps {
  card?: Card;
  hidden?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isWinning?: boolean;
  isDimmed?: boolean;
}

export const CardComponent: React.FC<CardProps> = ({ 
  card, 
  hidden, 
  className = '', 
  size = 'md',
  isWinning = false,
  isDimmed = false
}) => {
  // Mobile-first sizing: smaller defaults, scaling up on md screens
  const sizeClasses = {
    xs: 'w-8 h-12 text-[10px]',
    sm: 'w-10 h-14 text-xs',
    md: 'w-12 h-16 md:w-16 md:h-24 text-sm md:text-base', // Responsive: Increased mobile size slightly
    lg: 'w-16 h-24 md:w-24 md:h-36 text-base md:text-xl',
  };

  const highlightClass = isWinning 
    ? 'ring-2 md:ring-4 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)] z-10 scale-110' 
    : isDimmed 
      ? 'opacity-40 grayscale' 
      : '';

  if (hidden || !card) {
    return (
      <div 
        className={`bg-blue-900 border border-white rounded md:rounded-lg shadow-xl relative overflow-hidden transition-all duration-500 ${sizeClasses[size]} ${className} ${highlightClass}`}
        style={{
          backgroundImage: 'linear-gradient(135deg, #1e3a8a 25%, #172554 25%, #172554 50%, #1e3a8a 50%, #1e3a8a 75%, #172554 75%, #172554 100%)',
          backgroundSize: '8px 8px'
        }}
      >
        <div className="absolute inset-0 border border-blue-400 opacity-20 rounded md:rounded-md m-0.5 md:m-1"></div>
      </div>
    );
  }

  const rankDisplay = (r: Rank) => {
    switch (r) {
      case Rank.ACE: return 'A';
      case Rank.KING: return 'K';
      case Rank.QUEEN: return 'Q';
      case Rank.JACK: return 'J';
      default: return r.toString();
    }
  };

  const isFace = [Rank.JACK, Rank.QUEEN, Rank.KING].includes(card.rank);

  return (
    <div className={`bg-white rounded md:rounded-lg shadow-xl flex flex-col justify-between p-0.5 md:p-1 select-none transform transition-all duration-500 ${sizeClasses[size]} ${className} ${highlightClass}`}>
      <div className={`font-bold leading-none ${SUIT_COLORS[card.suit]}`}>
        <div>{rankDisplay(card.rank)}</div>
        <div className="text-[10px] md:text-xs">{card.suit}</div>
      </div>
      
      {isFace && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
           <span className={`text-2xl md:text-4xl ${SUIT_COLORS[card.suit]}`}>{card.suit}</span>
        </div>
      )}

      <div className={`font-bold leading-none self-end rotate-180 ${SUIT_COLORS[card.suit]}`}>
        <div>{rankDisplay(card.rank)}</div>
        <div className="text-[10px] md:text-xs">{card.suit}</div>
      </div>
    </div>
  );
};