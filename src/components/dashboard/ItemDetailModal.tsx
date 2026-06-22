import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckSquare, CheckCircle2, Users, AlertCircle, ShieldCheck } from 'lucide-react';
import { ChatDigestData } from '../../types';
import ConfirmationModal from '../ConfirmationModal';
import { Language } from '../../lib/translations';

export interface SelectedDetail {
  id: string;
  type: 'action' | 'decision';
  sender: string;
  text: string;
  dateStr: string;
  completed?: boolean;
  completedBy?: string;
  completedMessage?: string;
}

interface ItemDetailModalProps {
  digest: ChatDigestData;
  selectedDetail: SelectedDetail | null;
  deleteMediaId: string | null;
  onCloseDetail: () => void;
  onUpdateActionItem: (id: string, completed: boolean) => void;
  onUpdateActionItemAssignee?: (id: string, assignee: string) => void;
  onUpdateDetailSender: (sender: string) => void;
  onUpdateDetailCompleted: (completed: boolean) => void;
  onConfirmDeleteMedia: (id: string) => void;
  onCancelDeleteMedia: () => void;
  language: Language;
}

export default function ItemDetailModal({
  digest,
  selectedDetail,
  deleteMediaId,
  onCloseDetail,
  onUpdateActionItem,
  onUpdateActionItemAssignee,
  onUpdateDetailSender,
  onUpdateDetailCompleted,
  onConfirmDeleteMedia,
  onCancelDeleteMedia,
  language,
}: ItemDetailModalProps) {
  if (!selectedDetail) return null;

  return (
    <>
      {createPortal(
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

            {/* If completed in chat (Automated completion info) */}
            {selectedDetail.type === 'action' && selectedDetail.completed && (selectedDetail.completedBy || selectedDetail.completedMessage) && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-2 text-xs text-left">
                <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {language === 'nl' ? 'Gedetecteerd als voltooid in chat' : 'Detected as completed in chat'}
                </div>
                <div className="space-y-2 bg-[#0A0A0A] p-3 rounded-lg border border-white/5 font-light">
                  {selectedDetail.completedBy && (
                    <div>
                      <span className="text-gray-400 mr-1 font-mono text-[10px] uppercase">
                        {language === 'nl' ? 'Voltooid door' : 'Completed by'}:
                      </span>
                      <span className="text-emerald-400 font-semibold">{selectedDetail.completedBy}</span>
                    </div>
                  )}
                  {selectedDetail.completedMessage && (
                    <div className="space-y-1">
                      <span className="text-gray-400 font-mono text-[10px] uppercase block">
                        {language === 'nl' ? 'Refererend bericht' : 'Referencing message'}:
                      </span>
                      <p className="italic text-gray-300 pl-2.5 border-l-2 border-emerald-500/30 leading-relaxed whitespace-pre-wrap break-words select-text">
                        "{selectedDetail.completedMessage}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
