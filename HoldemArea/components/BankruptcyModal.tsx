import React, { useState } from 'react';
import { RECOVERY_PASSWORD, INITIAL_CHIPS } from '../constants';
import { AlertTriangle } from 'lucide-react';

interface BankruptcyModalProps {
  onRecover: (amount: number) => void;
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({ onRecover }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.toLowerCase() === RECOVERY_PASSWORD) {
      onRecover(INITIAL_CHIPS);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border-2 border-slate-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You are Bankrupt!</h2>
          <p className="text-slate-400 text-center text-sm">
            You've lost all your chips. Prove your loyalty to the house to receive a stimulus package.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Secret Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500 transition-colors"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-2">Incorrect password. Try again.</p>}
          </div>
          
          <button
            type="submit"
            className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-colors uppercase tracking-wider"
          >
            Recover Chips
          </button>
        </form>
      </div>
    </div>
  );
};