import React from 'react';
import { TrendingUp, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { ChatDigestData } from '../../types';

interface SummaryPanelProps {
  digest: ChatDigestData;
  isSynthesizing: boolean;
  synthesisError: string | null;
  onSynthesize: () => void;
}

export default function SummaryPanel({
  digest,
  isSynthesizing,
  synthesisError,
  onSynthesize,
}: SummaryPanelProps) {
  const isHeuristicSummary =
    digest.summary.startsWith('This conversational thread spans from') ||
    digest.summary.includes('comprising a total of');

  return (
    <div
      className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-xl relative overflow-hidden animate-fadeIn"
      id="summary-panel"
    >
      <div
        className="flex items-center justify-between gap-4 mb-4 border-b border-white/5 pb-4 animate-fadeIn"
        id="summary-panel-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-widest">
              Premium Executive summary
            </h3>
            <p className="text-[10px] uppercase text-slate-400 tracking-wider font-mono">
              Gemini AI Executive Synthesis
            </p>
          </div>
        </div>

        {!isHeuristicSummary && !isSynthesizing && (
          <button
            onClick={onSynthesize}
            title="Re-run Gemini AI synthesis on this conversation"
            className="text-[10px] uppercase font-mono px-3 py-1.5 bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 border border-white/5 hover:border-white/10 rounded flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
            Re-Synthesize
          </button>
        )}
      </div>

      {isSynthesizing ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-white animate-pulse">
              Synthesizing Chat with Gemini 3.5...
            </p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-md mx-auto font-light leading-relaxed">
              This will analyze the entire timeline, tracking participant sentiments and extracting
              custom decision items.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative z-10 animate-fadeIn" id="summary-narrative-box">
            <p className="text-xs md:text-sm text-gray-300 leading-relaxed select-text whitespace-pre-wrap font-light">
              {digest.summary.split('**').map((substring, i) => {
                if (i % 2 === 1) {
                  return (
                    <strong key={i} className="font-semibold text-blue-400">
                      {substring}
                    </strong>
                  );
                }
                return substring;
              })}
            </p>
          </div>

          {isHeuristicSummary && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/25 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                    Using Offline Word-Counting Heuristic
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-light leading-relaxed">
                    This summary was generated using local word-counting heuristics. Activate Gemini AI
                    to get deep interactive insights, action items, and topic tagging.
                  </p>
                </div>
              </div>
              <button
                onClick={onSynthesize}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 duration-100"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Synthesize with Gemini
              </button>
            </div>
          )}

          {synthesisError && (
            <div className="mt-4 p-4 bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs rounded-lg flex items-start gap-3 text-left animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Gemini Synthesis Failed</p>
                <p className="font-light">{synthesisError}</p>
              </div>
            </div>
          )}

          <div
            className="mt-5 pt-4.5 border-t border-white/5 flex flex-wrap items-center gap-2 animate-fadeIn"
            id="keywords-cluster"
          >
            <span className="text-[10px] text-gray-505 uppercase tracking-widest font-mono">
              Principal Focus:
            </span>
            {digest.keywords.map((word) => (
              <span
                key={word}
                className="text-[11px] font-mono px-2.5 py-1 bg-[#0A0A0A] text-blue-400 rounded border border-white/5 transition-transform duration-200 hover:-translate-y-0.5 cursor-default hover:border-white/10"
              >
                #{word}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
