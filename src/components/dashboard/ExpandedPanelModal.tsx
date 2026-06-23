import React, { useState } from 'react';
import { X, Clock, CheckCircle2, CheckSquare } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import ExpandedTimelineView from './ExpandedTimelineView';
import ExpandedDecisionsView from './ExpandedDecisionsView';
import ExpandedActionItemsView from './ExpandedActionItemsView';

interface ExpandedPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  panelType: 'timeline' | 'decisions' | 'actionItems' | null;
  digest: ChatDigestData;
  onUpdateActionItem: (id: string, completed: boolean) => void;
  onSelectDetail: (detail: any) => void;
  language: Language;
  onSelectDate?: (dateStr: string) => void;
}

export default function ExpandedPanelModal({
  isOpen,
  onClose,
  panelType,
  digest,
  onUpdateActionItem,
  onSelectDetail,
  language,
  onSelectDate,
}: ExpandedPanelModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  if (!isOpen || !panelType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md animate-fadeIn" id="expanded-panel-modal">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#121212] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/5 bg-[#0F0F0F] shrink-0">
          <div className="flex items-center gap-3">
            {panelType === 'timeline' && (
              <>
                <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40 animate-pulse">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    {getTranslation('tabTimeline', language)} - {language === 'nl' ? 'Gedetailleerde Analyse' : 'In-depth Analysis'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Chronological Sentiment & Volume Waves</p>
                </div>
              </>
            )}
            {panelType === 'decisions' && (
              <>
                <div className="p-2 bg-emerald-950/40 rounded-lg text-emerald-400 border border-emerald-900/40">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    {getTranslation('keyDecisions', language)} - {language === 'nl' ? 'Besluiten Ledger' : 'Ledger Details'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Consensus agreements mapped chronologically</p>
                </div>
              </>
            )}
            {panelType === 'actionItems' && (
              <>
                <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    {getTranslation('tabActionItems', language)} - {language === 'nl' ? 'Kanban Bord' : 'Kanban Board'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Interactive task flow tracker</p>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {panelType === 'timeline' && <ExpandedTimelineView digest={digest} language={language} onSelectDate={onSelectDate} />}
          {panelType === 'decisions' && (
            <ExpandedDecisionsView
              digest={digest}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onSelectDetail={onSelectDetail}
              language={language}
            />
          )}
          {panelType === 'actionItems' && (
            <ExpandedActionItemsView
              actionItems={digest.actionItems}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              assigneeFilter={assigneeFilter}
              setAssigneeFilter={setAssigneeFilter}
              onUpdateActionItem={onUpdateActionItem}
              onSelectDetail={onSelectDetail}
              language={language}
            />
          )}
        </div>
      </div>
    </div>
  );
}
