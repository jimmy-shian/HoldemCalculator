import React, { useState, useEffect } from 'react';
import { Rank, Suit, Card } from '../types';
import { ArrowLeft } from 'lucide-react';

interface CardSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (card: Card) => void;
  unavailableCards: Set<string>;
}

export const CardSelector: React.FC<CardSelectorProps> = ({ isOpen, onClose, onSelect, unavailableCards }) => {
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null);

  // Reset selection when modal is opened/closed
  useEffect(() => {
    if (!isOpen) setSelectedSuit(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const ranks = Object.values(Rank).reverse(); // A to 2
  const suits = Object.values(Suit);

  const getSuitSymbol = (suit: Suit) => {
    switch (suit) {
      case Suit.HEARTS: return '♥';
      case Suit.DIAMONDS: return '♦';
      case Suit.CLUBS: return '♣';
      case Suit.SPADES: return '♠';
    }
  };

  const getSuitColorClass = (suit: Suit, isDarkBg: boolean) => {
    switch (suit) {
      case Suit.HEARTS: return 'text-red-500';
      case Suit.DIAMONDS: return 'text-blue-500';
      case Suit.CLUBS: return 'text-green-500';
      case Suit.SPADES: return isDarkBg ? 'text-slate-200' : 'text-slate-900';
    }
  };

  const getSuitButtonStyles = (suit: Suit) => {
    switch (suit) {
      case Suit.HEARTS: return 'bg-red-500/10 hover:bg-red-500/20 border-red-500/50';
      case Suit.DIAMONDS: return 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/50';
      case Suit.CLUBS: return 'bg-green-500/10 hover:bg-green-500/20 border-green-500/50';
      case Suit.SPADES: return 'bg-slate-700/50 hover:bg-slate-700 border-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-sm flex flex-col shadow-2xl overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {selectedSuit && (
              <button 
                onClick={() => setSelectedSuit(null)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h3 className="text-lg font-bold text-white">
              {selectedSuit ? `選擇點數 (${getSuitSymbol(selectedSuit)})` : '請先選擇花色'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        {/* Content Area */}
        <div className="p-4 overflow-y-auto">
          {!selectedSuit ? (
            // Step 1: Suit Selection
            <div className="grid grid-cols-2 gap-4">
              {suits.map(suit => (
                <button
                  key={suit}
                  onClick={() => setSelectedSuit(suit)}
                  className={`
                    aspect-[4/3] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all
                    ${getSuitButtonStyles(suit)}
                  `}
                >
                  <span className={`text-6xl ${getSuitColorClass(suit, true)}`}>{getSuitSymbol(suit)}</span>
                  <span className="text-slate-400 font-medium">
                    {suit === Suit.HEARTS ? '紅心' : suit === Suit.DIAMONDS ? '方塊' : suit === Suit.CLUBS ? '梅花' : '黑桃'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            // Step 2: Rank Selection
            <div className="grid grid-cols-4 gap-2">
              {ranks.map((rank) => {
                const cardId = `${rank}${selectedSuit}`;
                const isTaken = unavailableCards.has(cardId);
                
                return (
                  <button
                    key={cardId}
                    disabled={isTaken}
                    onClick={() => {
                      onSelect({ id: cardId, rank, suit: selectedSuit });
                      onClose();
                    }}
                    className={`
                      aspect-[3/4] rounded-lg font-bold text-xl flex flex-col items-center justify-center border transition-all
                      ${isTaken 
                        ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed opacity-50' 
                        : 'bg-white border-white hover:scale-105 shadow-lg active:scale-95'
                      }
                    `}
                  >
                     <span className={isTaken ? '' : getSuitColorClass(selectedSuit, false)}>
                       {rank}
                     </span>
                     <span className={`text-sm ${isTaken ? '' : getSuitColorClass(selectedSuit, false)}`}>
                        {getSuitSymbol(selectedSuit)}
                     </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {/* <div className="p-4 border-t border-slate-700 bg-slate-800 text-center shrink-0">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-white underline">取消</button>
        </div> */}
      </div>
    </div>
  );
};