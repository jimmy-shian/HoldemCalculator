import React from 'react';
import { Card, Suit } from '../types';

interface CardDisplayProps {
  card?: Card;
  onClick?: () => void;
  selected?: boolean;
  placeholder?: string;
  className?: string;
}

const getSuitColor = (suit: Suit) => {
  switch (suit) {
    case Suit.HEARTS: return 'text-red-500';
    case Suit.DIAMONDS: return 'text-blue-500'; // 4-color deck standard
    case Suit.CLUBS: return 'text-green-600'; // 4-color deck standard
    case Suit.SPADES: return 'text-slate-800';
    default: return 'text-gray-800';
  }
};

const getSuitSymbol = (suit: Suit) => {
  switch (suit) {
    case Suit.HEARTS: return '♥';
    case Suit.DIAMONDS: return '♦';
    case Suit.CLUBS: return '♣';
    case Suit.SPADES: return '♠';
  }
};

export const CardDisplay: React.FC<CardDisplayProps> = ({ card, onClick, selected, placeholder, className = "" }) => {
  if (!card) {
    return (
      <div 
        onClick={onClick}
        className={`
          w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed 
          flex items-center justify-center cursor-pointer transition-all
          ${selected ? 'border-yellow-400 bg-white/10' : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'}
          ${className}
        `}
      >
        <span className="text-gray-500 text-xs sm:text-sm font-semibold">{placeholder || '+'}</span>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`
        w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white shadow-lg relative select-none
        flex flex-col items-center justify-between p-1 sm:p-2 cursor-pointer transition-transform
        ${selected ? 'ring-4 ring-yellow-400 scale-105' : 'hover:scale-105'}
        ${className}
      `}
    >
      <div className={`text-lg sm:text-xl font-bold self-start leading-none ${getSuitColor(card.suit)}`}>
        {card.rank}
        <div className="text-xs sm:text-sm">{getSuitSymbol(card.suit)}</div>
      </div>
      <div className={`text-2xl sm:text-4xl absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${getSuitColor(card.suit)}`}>
        {getSuitSymbol(card.suit)}
      </div>
      <div className={`text-lg sm:text-xl font-bold self-end leading-none transform rotate-180 ${getSuitColor(card.suit)}`}>
        {card.rank}
        <div className="text-xs sm:text-sm">{getSuitSymbol(card.suit)}</div>
      </div>
    </div>
  );
};