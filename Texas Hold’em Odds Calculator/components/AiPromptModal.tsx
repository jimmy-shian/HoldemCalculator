import React, { useState } from 'react';
import { Copy, Check, Bot, X } from 'lucide-react';

interface AiPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptText: string;
}

export const AiPromptModal: React.FC<AiPromptModalProps> = ({ isOpen, onClose, promptText }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Bot className="text-emerald-400" size={24} />
            <h3 className="text-lg font-bold text-white">AI 策略詢問 Prompt</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <p className="text-slate-300 text-sm">
            已為您生成包含當前牌局數據的 Prompt。請複製並貼上到 ChatGPT、Claude 或 Gemini 等 AI 助手以獲取詳細策略建議。
          </p>
          
          <div className="relative">
            <textarea
              readOnly
              value={promptText}
              className="w-full h-64 bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            />
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 border border-slate-600 transition-all"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  已複製
                </>
              ) : (
                <>
                  <Copy size={14} />
                  複製內容
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};