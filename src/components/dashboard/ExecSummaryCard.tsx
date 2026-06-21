import React from 'react';
import { Sparkles, RefreshCw, Edit2, Check, Loader2, AlertCircle } from 'lucide-react';

interface ExecSummaryCardProps {
  executiveSummary?: string;
  isGenerating: boolean;
  error: string | null;
  isEditing: boolean;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRegenerate: () => void;
}

export default function ExecSummaryCard({
  executiveSummary,
  isGenerating,
  error,
  isEditing,
  editingText,
  onEditingTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRegenerate,
}: ExecSummaryCardProps) {
  return (
    <div
      className="bg-gradient-to-r from-blue-950/15 via-[#11131a] to-blue-950/5 border border-blue-500/10 p-5 rounded-xl shadow-lg relative overflow-hidden text-left space-y-3.5 animate-fadeIn"
      id="ai-executive-snapshot-card"
    >
      <div className="absolute top-0 right-0 w-64 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </span>
          <div>
            <span className="text-[10px] tracking-widest font-mono text-blue-400 uppercase font-semibold">
              Gemini AI Executive Briefing
            </span>
            <h3 className="text-xs font-bold text-gray-200 mt-0.5">Quick Conversation Snapshot</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-2.5 py-1 text-[10px] font-mono tracking-wider text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveEdit}
                className="px-2.5 py-1 text-[10px] font-mono tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded transition-all flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                Save
              </button>
            </>
          ) : (
            <>
              {executiveSummary && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  title="Edit summary manually"
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                disabled={isGenerating}
                onClick={onRegenerate}
                title="Force regenerate of executive snapshot with Gemini"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {isGenerating ? (
        <div className="py-4 flex items-center gap-3 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <div className="space-y-1.5 flex-1">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
              Synthesizing instant executive brief...
            </p>
            <div className="h-2.5 bg-white/5 rounded w-11/12" />
          </div>
        </div>
      ) : error ? (
        <div className="text-xs text-orange-400 flex items-start gap-2 bg-orange-950/10 border border-orange-900/20 p-3 rounded">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-300">Brief Generation Interrupted</p>
            <p className="opacity-80 mt-0.5">{error}</p>
          </div>
        </div>
      ) : isEditing ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={editingText}
            onChange={(e) => onEditingTextChange(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-xs text-gray-250 placeholder-gray-550 focus:outline-none focus:border-blue-500/50 transition-colors select-text"
            placeholder="Edit the 2-3 sentence executive summary of the conversation..."
          />
          <p className="text-[9px] text-gray-500 font-mono tracking-wide leading-normal">
            Keep it strictly to 2 or 3 sentences to stay concise.
          </p>
        </div>
      ) : (
        <div className="relative">
          <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-light italic pl-4 border-l-2 border-blue-500/30 select-text">
            "{executiveSummary || 'No executive summary available yet. Click the refresh button to generate one.'}"
          </p>
        </div>
      )}
    </div>
  );
}
