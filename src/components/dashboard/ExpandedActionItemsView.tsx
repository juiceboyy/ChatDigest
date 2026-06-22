import React, { useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { ActionItem } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface ExpandedActionItemsViewProps {
  actionItems: ActionItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  assigneeFilter: string;
  setAssigneeFilter: (assignee: string) => void;
  onUpdateActionItem: (id: string, completed: boolean) => void;
  onSelectDetail: (detail: any) => void;
  language: Language;
}

export default function ExpandedActionItemsView({
  actionItems,
  searchTerm,
  setSearchTerm,
  assigneeFilter,
  setAssigneeFilter,
  onUpdateActionItem,
  onSelectDetail,
  language,
}: ExpandedActionItemsViewProps) {
  const assignees = useMemo(() => {
    const list = new Set(actionItems.map((act) => act.sender));
    return Array.from(list);
  }, [actionItems]);

  const filtered = useMemo(() => {
    return actionItems.filter((act) => {
      const matchesSearch = searchTerm
        ? act.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          act.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesAssignee = assigneeFilter === 'all' ? true : act.sender === assigneeFilter;
      return matchesSearch && matchesAssignee;
    });
  }, [actionItems, searchTerm, assigneeFilter]);

  const pendingTasks = useMemo(() => filtered.filter((t) => !t.completed), [filtered]);
  const completedTasks = useMemo(() => filtered.filter((t) => t.completed), [filtered]);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Search and filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={getTranslation('searchTasks', language)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 bg-[#0A0A0A] px-3.5 py-2.5 rounded-xl border border-white/10">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-[#0A0A0A] text-white text-xs border-none focus:outline-none cursor-pointer"
          >
            <option value="all">{getTranslation('allParticipants', language)}</option>
            {assignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-side Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Pending Column */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4.5">
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/5 shrink-0">
            <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              {language === 'nl' ? 'In Afwachting' : 'Pending'} ({pendingTasks.length})
            </h4>
          </div>
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {pendingTasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-500 italic">No pending tasks.</div>
            ) : (
              pendingTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggle={() => onUpdateActionItem(t.id, true)}
                  onClick={() => onSelectDetail({ ...t, type: 'action' })}
                />
              ))
            )}
          </div>
        </div>

        {/* Completed Column */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4.5">
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/5 shrink-0">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {language === 'nl' ? 'Voltooid' : 'Completed'} ({completedTasks.length})
            </h4>
          </div>
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {completedTasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-500 italic">No completed tasks.</div>
            ) : (
              completedTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggle={() => onUpdateActionItem(t.id, false)}
                  onClick={() => onSelectDetail({ ...t, type: 'action' })}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onToggle, onClick }: { task: ActionItem; onToggle: () => void; onClick: () => void; key?: string }) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-3 p-3 rounded-xl border select-none transition-all duration-200 cursor-pointer ${
        task.completed
          ? 'bg-[#121212] border-white/5 text-gray-500 opacity-60'
          : 'bg-[#121212] border-white/5 hover:border-white/10'
      }`}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
          task.completed
            ? 'bg-blue-650 border-blue-550 text-white'
            : 'border-white/20 bg-[#0A0A0A] text-transparent group-hover:border-white/40'
        }`}
      >
        {task.completed && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`text-xs leading-relaxed break-words font-light group-hover:text-white ${task.completed ? 'line-through' : 'text-gray-200'}`}>
          {task.text}
        </p>
        <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono">
          {task.sender === 'The Group' ? (
            <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium px-1 py-0.5 rounded uppercase">Unassigned</span>
          ) : (
            <span className="font-semibold text-blue-400">{task.sender}</span>
          )}
          <span>{task.dateStr}</span>
        </div>
      </div>
    </div>
  );
}
