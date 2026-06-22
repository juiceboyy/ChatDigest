import React, { useState, useMemo } from 'react';
import { CheckSquare, ShieldCheck, HelpCircle, Maximize2 } from 'lucide-react';
import { ActionItem } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface ActionItemsColumnProps {
  actionItems: ActionItem[];
  searchTerm: string;
  filterParticipant: string | null;
  onUpdateActionItem: (id: string, completed: boolean) => void;
  onSelectDetail: (detail: any) => void;
  language: Language;
  onExpand?: () => void;
}

export default function ActionItemsColumn({
  actionItems,
  searchTerm,
  filterParticipant,
  onUpdateActionItem,
  onSelectDetail,
  language,
  onExpand,
}: ActionItemsColumnProps) {
  const [filterOnlyIncompleteActionItems, setFilterOnlyIncompleteActionItems] = useState(false);

  const onToggleFilter = () => setFilterOnlyIncompleteActionItems((p) => !p);

  const filteredActionItems = useMemo(() => {
    return actionItems.filter((act) => {
      const matchesSearch = searchTerm
        ? act.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          act.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesParticipant = filterParticipant ? act.sender === filterParticipant : true;
      const matchesComplete = filterOnlyIncompleteActionItems ? !act.completed : true;
      return matchesSearch && matchesParticipant && matchesComplete;
    });
  }, [actionItems, searchTerm, filterParticipant, filterOnlyIncompleteActionItems]);
  return (
    <div
      className="lg:col-span-4 bg-[#121212] rounded-xl border border-white/5 p-5 flex flex-col h-[540px] hover:border-white/10 transition-colors"
      id="column-action-items"
    >
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/5 text-blue-400 rounded-lg border border-white/10">
            <CheckSquare className="w-4 h-4" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">
            {getTranslation('tabActionItems', language)}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFilter}
            className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
              filterOnlyIncompleteActionItems
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/45'
                : 'bg-[#0A0A0A] text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {filterOnlyIncompleteActionItems
              ? language === 'nl' ? 'Openstaande taken' : 'Pending Tasks'
              : language === 'nl' ? 'Alle taken' : 'All Tasks'}
          </button>
          {onExpand && (
            <button
              onClick={onExpand}
              title="Expand action items"
              className="p-1 hover:bg-white/5 hover:text-white text-gray-400 rounded transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        className="p-2.5 bg-[#0A0A0A] border border-white/10 rounded mb-4 text-[10px] text-gray-500 leading-normal shrink-0 flex flex-col gap-2 font-light"
        id="action-tracker-tip"
      >
        <span className="flex items-start gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            Checking off items updates the local{' '}
            <b className="text-gray-350 font-normal">IndexedDB database</b> instance instantly and permanently.
          </span>
        </span>
        <span className="flex items-start gap-1.5 pt-1.5 border-t border-white/5">
          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Tasks assigned to{' '}
            <b className="text-amber-400 font-semibold">Group / Unassigned</b> haven't been assigned to a person yet.
            Click on any task to assign it!
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" id="action-items-checklist-container">
        {filteredActionItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500" id="empty-actions">
            <p className="text-xs italic">No follow-ups identified</p>
            <p className="text-[10px] text-gray-650 mt-1 max-w-[200px] leading-relaxed">
              We look for expressions of action, e.g.{' '}
              <b className="text-[#a1a1aa] font-medium">"I will send reports"</b> or direct Todo assignments.
            </p>
          </div>
        ) : (
          filteredActionItems.map((act) => (
            <div
              key={act.id}
              onClick={() =>
                onSelectDetail({
                  ...act,
                  type: 'action',
                })
              }
              className={`group flex items-start gap-3 p-3.5 rounded border cursor-pointer select-none transition-all duration-200 ${
                act.completed
                  ? 'bg-[#0A0A0A] border-white/5 text-gray-500 opacity-60'
                  : 'bg-[#0A0A0A] border-white/10 hover:bg-white/5 hover:border-white/20'
              }`}
              id={`action-block-${act.id}`}
            >
              {/* Interactive checkbox */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateActionItem(act.id, !act.completed);
                }}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                  act.completed
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                    : 'border-white/20 bg-[#0A0A0A] text-transparent group-hover:border-white/40'
                }`}
              >
                {act.completed && (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <p
                  className={`text-xs leading-relaxed truncate-2-lines break-words font-light group-hover:text-white transition-colors ${
                    act.completed ? 'line-through text-gray-550 font-extralight' : 'text-gray-200'
                  }`}
                >
                  {act.text}
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  {act.sender === 'The Group' ? (
                    <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Group / Unassigned
                    </span>
                  ) : (
                    <span className="font-semibold text-blue-400 truncate max-w-[130px]">{act.sender}</span>
                  )}
                  <span>{act.dateStr}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
