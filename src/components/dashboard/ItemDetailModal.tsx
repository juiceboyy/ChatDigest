import React from 'react';
import { createPortal } from 'react-dom';
import {
  X, CheckSquare, CheckCircle2, Users, AlertCircle, ShieldCheck, Sparkles, Loader2, Check,
} from 'lucide-react';
import { ChatDigestData } from '../../types';
import ConfirmationModal from '../ConfirmationModal';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedDetail {
  id: string;
  type: 'action' | 'decision';
  sender: string;
  text: string;
  dateStr: string;
  completed?: boolean;
}

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ItemDetailModalProps {
  digest: ChatDigestData;
  selectedDetail: SelectedDetail | null;
  committingDecision: CommittingDecision | null;
  contradictions: Contradiction[];
  isAuditingContradictions: boolean;
  auditError: string | null;
  deleteMediaId: string | null;
  onCloseDetail: () => void;
  onCloseCommit: () => void;
  onUpdateActionItem: (id: string, completed: boolean) => void;
  onUpdateActionItemAssignee?: (id: string, assignee: string) => void;
  onUpdateDetailSender: (sender: string) => void;
  onUpdateDetailCompleted: (completed: boolean) => void;
  onCommittingDecisionTextChange: (text: string) => void;
  onCommittingDecisionSenderChange: (sender: string) => void;
  onCommittingDecisionDateChange: (date: string) => void;
  onReAudit: (text: string) => void;
  onToggleContradictionPartDelete: (contradictionId: string, partId: string) => void;
  onConfirmCommitDecision: () => void;
  onConfirmDeleteMedia: (id: string) => void;
  onCancelDeleteMedia: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ItemDetailModal({
  digest,
  selectedDetail,
  committingDecision,
  contradictions,
  isAuditingContradictions,
  auditError,
  deleteMediaId,
  onCloseDetail,
  onCloseCommit,
  onUpdateActionItem,
  onUpdateActionItemAssignee,
  onUpdateDetailSender,
  onUpdateDetailCompleted,
  onCommittingDecisionTextChange,
  onCommittingDecisionSenderChange,
  onCommittingDecisionDateChange,
  onReAudit,
  onToggleContradictionPartDelete,
  onConfirmCommitDecision,
  onConfirmDeleteMedia,
  onCancelDeleteMedia,
}: ItemDetailModalProps) {
  return (
    <>
      {/* Item detail modal */}
      {selectedDetail && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={onCloseDetail}
          id="item-detail-modal-overlay"
        >
          <div
            className="bg-[#121212] border border-white/10 rounded-xl p-6 max-w-xl w-full text-left text-white shadow-2xl relative animate-slideRight space-y-4"
            onClick={(e) => e.stopPropagation()}
            id="item-detail-modal-container"
          >
            <button
              onClick={onCloseDetail}
              className="absolute right-4 top-4 text-gray-450 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Type badge */}
            <div className="flex items-center gap-2">
              {selectedDetail.type === 'action' ? (
                <>
                  <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] tracking-widest font-mono text-blue-400 uppercase font-semibold">
                      Action Item Assignment
                    </span>
                    <p className="text-[11px] text-gray-500 font-sans">Recognized follow-up task</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] tracking-widest font-mono text-emerald-400 uppercase font-semibold">
                      Consensus Agreement Decision
                    </span>
                    <p className="text-[11px] text-gray-500 font-sans">Formal discussion marker</p>
                  </div>
                </>
              )}
            </div>

            {/* Text content */}
            <div className="bg-[#0A0A0A] p-5 rounded-lg border border-white/5 select-text">
              <p className="text-sm md:text-base font-light text-gray-250 leading-relaxed whitespace-pre-wrap italic break-words">
                "{selectedDetail.text}"
              </p>
            </div>

            {/* Assignee picker (action items only) */}
            {selectedDetail.type === 'action' && (
              <div className="p-4 bg-white/3 border border-white/5 rounded-xl space-y-3 text-xs text-left">
                <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase text-blue-400 font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  Assignee/Delegate Settings
                </div>
                <div className="space-y-1.5 bg-[#0A0A0A] p-3 rounded-lg border border-white/5">
                  <label className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">Assign To</label>
                  <select
                    value={selectedDetail.sender}
                    onChange={(e) => {
                      const newAssignee = e.target.value;
                      if (onUpdateActionItemAssignee) {
                        onUpdateActionItemAssignee(selectedDetail.id, newAssignee);
                      }
                      onUpdateDetailSender(newAssignee);
                    }}
                    className="w-full bg-[#121212] border border-white/10 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <option value="The Group">The Group (Collective / Unassigned)</option>
                    {digest.participants.map((person) => (
                      <option key={person} value={person}>{person}</option>
                    ))}
                  </select>
                </div>
                {selectedDetail.sender === 'The Group' && (
                  <div className="text-[10px] text-amber-450 bg-amber-500/5 border border-amber-500/15 rounded p-2.5 flex items-start gap-1.5 leading-normal">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-450" />
                    <span>
                      This item is currently flagged for{' '}
                      <b>Collective / Custom Group assignment</b>. Select a team member to assign it.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Participant & date */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/25 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-400 font-mono">
                  {selectedDetail.sender.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-200">{selectedDetail.sender}</p>
                  <p className="text-[9px] text-gray-500">Contributor</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-gray-300">{selectedDetail.dateStr}</p>
                <p className="text-[9px] text-gray-500">Activity Date</p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-2 flex justify-end gap-2 text-xs">
              {selectedDetail.type === 'action' && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateActionItem(selectedDetail.id, !selectedDetail.completed);
                    onUpdateDetailCompleted(!selectedDetail.completed);
                  }}
                  className={`px-4 py-2 rounded font-semibold flex items-center gap-1.5 transition-all text-xs border cursor-pointer active:scale-95 ${
                    selectedDetail.completed
                      ? 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-500/20 text-blue-400'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedDetail.completed ? 'Mark as Pending' : 'Mark as Completed'}
                </button>
              )}
              <button
                type="button"
                onClick={onCloseDetail}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 rounded font-semibold text-gray-350 transition-colors text-xs cursor-pointer"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Commit-decision modal */}
      {committingDecision && createPortal(
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
                    <Loader2 className={`w-3 h-3 ${isAuditingContradictions ? 'animate-spin' : ''}`} />
                    Re-audit Conflicts
                  </button>
                </div>
                <textarea
                  required
                  rows={4}
                  value={committingDecision.text}
                  onChange={(e) => onCommittingDecisionTextChange(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-xs text-gray-250 placeholder-gray-650 focus:outline-none focus:border-emerald-500/50 transition-colors select-text"
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
                  <div className="flex items-start gap-3 p-3.5 bg-rose-950/15 text-rose-450 rounded-lg border border-rose-900/35 text-xs text-left" id="logical-contradiction-heading">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
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
      )}

      {/* Media deletion confirmation */}
      <ConfirmationModal
        isOpen={deleteMediaId !== null}
        title="Delete Media Analysis"
        message="Are you sure you want to delete this media analysis record? Extracted action items and decisions will remain on their boards, but the media description will be cleared."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteMediaId) onConfirmDeleteMedia(deleteMediaId); }}
        onCancel={onCancelDeleteMedia}
      />
    </>
  );
}
