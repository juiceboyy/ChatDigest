import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Loader2, AlertCircle, ShieldCheck, Check } from 'lucide-react';
import { ChatDigestData } from '../../types';

export interface CommittingDecision {
  text: string;
  sender: string;
  dateStr: string;
}

export interface ContradictionPart {
  partId: string;
  text: string;
  isContrary: boolean;
  explanation: string;
  shouldDelete: boolean;
}

export interface Contradiction {
  id: string;
  sender: string;
  dateStr: string;
  originalText: string;
  isMultiPart: boolean;
  parts: ContradictionPart[];
}

interface CommitDecisionModalProps {
  digest: ChatDigestData;
  committingDecision: CommittingDecision | null;
  contradictions: Contradiction[];
  isAuditingContradictions: boolean;
  auditError: string | null;
  onCloseCommit: () => void;
  onCommittingDecisionTextChange: (text: string) => void;
  onCommittingDecisionSenderChange: (sender: string) => void;
  onCommittingDecisionDateChange: (date: string) => void;
  onReAudit: (text: string) => void;
  onToggleContradictionPartDelete: (contradictionId: string, partId: string) => void;
  onConfirmCommitDecision: () => void;
}

export default function CommitDecisionModal({
  digest,
  committingDecision,
  contradictions,
  isAuditingContradictions,
  auditError,
  onCloseCommit,
  onCommittingDecisionTextChange,
  onCommittingDecisionSenderChange,
  onCommittingDecisionDateChange,
  onReAudit,
  onToggleContradictionPartDelete,
  onConfirmCommitDecision,
}: CommitDecisionModalProps) {
  if (!committingDecision) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
      onClick={onCloseCommit}
      id="commit-decision-modal-overlay"
    >
      <div
        className="bg-[#121212] border border-white/10 rounded-xl p-6 max-w-2xl w-full text-left text-white shadow-2xl relative animate-slideRight space-y-5"
        onClick={(e) => e.stopPropagation()}
        id="commit-decision-modal-container"
      >
        <button
          onClick={onCloseCommit}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <span className="text-[10px] tracking-widest font-mono text-emerald-400 uppercase font-semibold">
              Gemini Answer Commit Panel
            </span>
            <h3 className="text-sm font-semibold text-white">Commit Answer as Decision</h3>
          </div>
        </div>

        <div className="space-y-4">
          {/* Decision text */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">
                Decision Statement
              </label>
              <button
                type="button"
                disabled={isAuditingContradictions || !committingDecision.text.trim()}
                onClick={() => onReAudit(committingDecision.text)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-mono disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Loader2 className={`w-3.5 h-3.5 ${isAuditingContradictions ? 'animate-spin' : ''}`} />
                Re-audit Conflicts
              </button>
            </div>
            <textarea
              required
              rows={4}
              value={committingDecision.text}
              onChange={(e) => onCommittingDecisionTextChange(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-xs text-gray-250 placeholder-gray-655 focus:outline-none focus:border-emerald-500/50 transition-colors select-text"
              placeholder="The text statement describing the consensus or agreement."
            />
          </div>

          {/* Contributor & date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">
                Associated Contributor
              </label>
              <select
                value={committingDecision.sender}
                onChange={(e) => onCommittingDecisionSenderChange(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
              >
                <option value="Gemini AI">Gemini AI</option>
                <option value="The Group">The Group</option>
                {digest.participants.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">
                Consensus Date
              </label>
              <input
                type="date"
                required
                value={committingDecision.dateStr}
                onChange={(e) => onCommittingDecisionDateChange(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-2.5 text-xs text-gray-250 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Contradiction audit */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">
            Conflict Auditing Status
          </h4>

          {isAuditingContradictions ? (
            <div className="flex flex-col items-center justify-center p-6 bg-[#0A0A0A] rounded-lg border border-white/5 space-y-2 animate-pulse text-center">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <p className="text-xs font-semibold text-amber-400 font-mono uppercase tracking-wider">
                AI Ledger Crossref Search Active
              </p>
              <p className="text-[10px] text-gray-400 max-w-md font-light">
                Analyzing existing consensus ledger entries to detect contrary declarations or direct scheduling conflicts...
              </p>
            </div>
          ) : auditError ? (
            <div className="flex items-start gap-3 p-4 bg-orange-950/10 text-orange-400 rounded-lg border border-orange-900/30 text-xs text-left">
              <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-300">Conflict Check Unavailable</p>
                <p className="text-gray-400 font-light mt-0.5">
                  Could not perform automated conflict audit: {auditError}. You can still manually commit this decision.
                </p>
              </div>
            </div>
          ) : contradictions.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-emerald-950/15 text-emerald-400 rounded-lg border border-emerald-900/25 text-xs text-left">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-300">Clean Ledger Compliance Verified</p>
                <p className="text-gray-400 font-light mt-0.5">
                  This decision complies cleanly with all agreements in your active ledger. No opposing statements found.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 bg-rose-950/15 text-rose-455 rounded-lg border border-rose-900/35 text-xs text-left" id="logical-contradiction-heading">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-300 font-sans">Contrary Commitment Conflict Detected</p>
                  <p className="text-[#a1a1aa] font-sans font-light mt-1 leading-normal">
                    We analyzed the existing ledger and identified a contradiction. The conflicting commitment has
                    been broken down into singular parts below. Check items to <b>delete</b> them, or uncheck them
                    to <b>keep the individual consistent statement</b>:
                  </p>
                </div>
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1" id="contradictions-ledger-list">
                {contradictions.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl border border-white/5 bg-[#17171d]/15 text-left space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono font-bold pb-1.5 border-b border-white/5 mb-2">
                        <span className="text-gray-400 uppercase">Original Action by {c.sender}</span>
                        <span>{c.dateStr}</span>
                      </div>
                      <p className="text-gray-400 italic text-xs leading-normal pl-2 border-l border-white/10 select-text">
                        "{c.originalText}"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono font-semibold text-blue-400 uppercase tracking-widest pl-1">
                        {c.isMultiPart ? '⚡ Atomic Commitment Breakdown (Keep vs Delete)' : '⚡ Sole Atomic Commitment Part'}
                      </p>
                      <div className="space-y-2 pl-1">
                        {c.parts.map((p) => (
                          <div
                            key={p.partId}
                            className={`p-2.5 rounded-lg border transition-all text-xs flex items-start gap-2.5 bg-[#0a0a0c] ${
                              p.shouldDelete
                                ? 'border-rose-500/20 hover:border-rose-500/30'
                                : 'border-white/5 hover:border-white/10 opacity-75'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={p.shouldDelete}
                              onChange={() => onToggleContradictionPartDelete(c.id, p.partId)}
                              className="mt-0.5 accent-rose-500 rounded border-white/10 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1 select-text">
                              <p className="text-gray-250 font-normal leading-normal text-[11px]">"{p.text}"</p>
                              {p.isContrary ? (
                                <div className="text-[9px] text-rose-350 font-mono font-medium opacity-90 p-1 bg-rose-500/5 rounded border border-rose-500/10">
                                  Conflict: {p.explanation}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono font-medium bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 uppercase tracking-wider">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                                  Consistent (Will preserve on ledger)
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-white/5 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onCloseCommit}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 rounded font-semibold text-gray-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isAuditingContradictions || !committingDecision.text.trim()}
            onClick={onConfirmCommitDecision}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:scale-100"
          >
            <Check className="w-3.5 h-3.5" />
            {contradictions.some((c) => c.parts.some((p) => p.shouldDelete))
              ? 'Delete Contrary & Commit'
              : 'Confirm & Commit'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
