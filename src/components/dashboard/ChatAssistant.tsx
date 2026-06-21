import React from 'react';
import { Sparkles, Send, Loader2, AlertCircle, MessageSquare, PlusCircle } from 'lucide-react';
import { Language, getTranslation } from '../../lib/translations';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatAssistantProps {
  chatHistory: ChatMessage[];
  chatLoading: boolean;
  chatError: string | null;
  queryInput: string;
  onQueryInputChange: (val: string) => void;
  onSubmitQuery: (e: React.FormEvent) => void;
  onInitiateCommit: (text: string) => void;
  language: Language;
}

export default function ChatAssistant({
  chatHistory,
  chatLoading,
  chatError,
  queryInput,
  onQueryInputChange,
  onSubmitQuery,
  onInitiateCommit,
  language,
}: ChatAssistantProps) {
  const sampleQuestions = [
    "What were the key issues?",
    "Who said what about agreements?",
    "Is there any task without an owner?",
    "Tell me who was most active and why",
  ];

  return (
    <div className="p-5 bg-[#121212] rounded-xl border border-white/5 shadow-sm" id="gemini-chatbot-assistant">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">
              {getTranslation('btnAskAI', language)}
            </h3>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-light">
              Query topics, quote assertions, or search timeline agreements
            </p>
          </div>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-slate-400 rounded-full border border-white/5 uppercase select-none">
          Gemini Flash Active
        </span>
      </div>

      {/* Chat viewport */}
      <div
        className="bg-[#0A0A0A] rounded-lg border border-white/10 p-4 min-h-[140px] max-h-[300px] overflow-y-auto space-y-4 mb-4 select-text"
        id="assistant-viewport animate-fadeIn"
      >
        {chatHistory.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
            <MessageSquare className="w-6 h-6 text-gray-600 animate-pulse" />
            <p className="text-xs italic font-light">Ask any question about this group conversation</p>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-lg mt-2">
              {sampleQuestions.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => onQueryInputChange(sample)}
                  className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 font-light rounded-md border border-white/5 transition-colors cursor-pointer"
                >
                  "{sample}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatHistory.map((chat, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-xs leading-relaxed max-w-[90%] ${
                chat.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
              }`}
            >
              <div className="flex flex-col space-y-1">
                <div
                  className={`text-[9px] uppercase font-mono ${
                    chat.role === 'user' ? 'text-blue-400 text-right' : 'text-emerald-400 text-left'
                  }`}
                >
                  {chat.role === 'user' ? 'You' : 'Gemini AI'}
                </div>
                <div
                  className={`p-3 rounded-lg whitespace-pre-wrap text-left ${
                    chat.role === 'user'
                      ? 'bg-blue-600/25 border border-blue-500/25 text-white rounded-br-none'
                      : 'bg-white/5 border border-white/10 text-gray-300 rounded-bl-none'
                  }`}
                >
                  {chat.text}
                </div>
                {chat.role === 'model' && (
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => onInitiateCommit(chat.text)}
                      className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 border border-emerald-500/25 px-2.5 py-1 rounded transition-all cursor-pointer font-mono"
                    >
                      <PlusCircle className="w-3 h-3 text-emerald-400" />
                      Commit as Decision
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {chatLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500 italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span>Gemini is analyzing conversation history...</span>
          </div>
        )}

        {chatError && (
          <div className="flex items-start gap-2 p-3 bg-rose-950/20 text-rose-300 rounded-lg border border-rose-900/40 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-250">Assistant Query Blocked</p>
              <p className="font-light">{chatError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Query input */}
      <form onSubmit={onSubmitQuery} className="flex gap-2" id="assistant-form">
        <input
          type="text"
          required
          value={queryInput}
          onChange={(e) => onQueryInputChange(e.target.value)}
          disabled={chatLoading}
          placeholder={getTranslation('askQuestionPlaceholder', language)}
          className="flex-1 bg-[#0A0A0A] border border-white/10 rounded px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={chatLoading || !queryInput.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:scale-100 disabled:opacity-50 rounded text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          {getTranslation('askGemini', language)}
        </button>
      </form>
    </div>
  );
}
