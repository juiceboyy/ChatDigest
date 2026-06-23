import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { ChatDigestData } from '../types';
import { exportPlaybookToPdf } from '../lib/pdfExporter';
import { Language, getTranslation } from '../lib/translations';

// ── Sub-components ─────────────────────────────────────────────────────────────
import DashboardHeader from './dashboard/DashboardHeader';
import ExecSummaryCard from './dashboard/ExecSummaryCard';
import SummaryPanel from './dashboard/SummaryPanel';
import ExpandedTimelineView from './dashboard/ExpandedTimelineView';
import DecisionsColumn from './dashboard/DecisionsColumn';
import ActionItemsColumn from './dashboard/ActionItemsColumn';
import PlaybookSection from './dashboard/PlaybookSection';
import MediaAnalyzer from './dashboard/MediaAnalyzer';
import ChatAssistant from './dashboard/ChatAssistant';
import MessagesLog from './dashboard/MessagesLog';
import DateFilterBar from './dashboard/DateFilterBar';
import FilterToolbar from './dashboard/FilterToolbar';
import DashboardModals from './dashboard/DashboardModals';
import ExpandedPanelModal from './dashboard/ExpandedPanelModal';

// ── Hooks ──────────────────────────────────────────────────────────────────────
import { useDashboardState } from './dashboard/useDashboardState';
import { useDateFilter } from '../hooks/useDateFilter';
import { useDigestAnalyses } from '../hooks/useDigestAnalyses';

interface DashboardProps {
  digest: ChatDigestData;
  onUpdateActionItem: (actionItemId: string, completed: boolean) => void;
  onUpdateActionItemAssignee?: (actionItemId: string, assignee: string) => void;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export default function Dashboard({
  digest,
  onUpdateActionItem,
  onUpdateActionItemAssignee,
  onSaveDigest,
  language,
}: DashboardProps) {
  // ── Date Filtering ───────────────────────────────────────────────────────────
  const {
    dateFilterType,
    setDateFilterType,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    filteredDigest,
  } = useDateFilter(digest);

  // Wrapper to merge filtered saves back to full digest
  const handleSaveDigestFiltered = (updated: ChatDigestData) => {
    if (!onSaveDigest) return;
    const filterKey = dateFilterType === 'custom' ? `custom_${customStartDate}_${customEndDate}` : dateFilterType;
    const periodSummaries = { ...(digest.periodSummaries || {}) };
    if (dateFilterType !== 'all') {
      periodSummaries[filterKey] = {
        summary: updated.summary,
        keywords: updated.keywords,
        decisions: updated.decisions,
        actionItems: updated.actionItems,
      };
    }
    const isAll = dateFilterType === 'all';
    onSaveDigest({
      ...digest,
      summary: isAll ? updated.summary : digest.summary,
      keywords: isAll ? updated.keywords : digest.keywords,
      decisions: isAll ? updated.decisions : digest.decisions,
      actionItems: isAll ? updated.actionItems : digest.actionItems,
      playbook: updated.playbook,
      executiveSummary: updated.executiveSummary,
      periodSummaries,
    });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterParticipant, setFilterParticipant] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [selectedDateMessages, setSelectedDateMessages] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<'timeline' | 'decisions' | 'actionItems' | null>(null);

  const {
    dayAnalyses,
    setDayAnalyses,
    periodAnalyses,
    setPeriodAnalyses,
    metaAnalysis,
    setMetaAnalysis,
  } = useDigestAnalyses(digest, onSaveDigest);


  const { dashboard, media, chat } = useDashboardState({
    digest: filteredDigest,
    onSaveDigest: handleSaveDigestFiltered,
    language,
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDetail(null);
        setExpandedPanel(null);
        setSelectedDateMessages(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (selectedDetail || dashboard.isUpdateModalOpen) {
      document.getElementById('main-scroller')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDetail, dashboard.isUpdateModalOpen]);

  const firstParticipant = filteredDigest.participants[0] || '';

  return (
    <div className="space-y-6" id="dashboard-root">
      {/* Header */}
      <DashboardHeader
        digest={filteredDigest}
        onUpdateChat={() => dashboard.setIsUpdateModalOpen(true)}
        language={language}
      />

      {/* Executive snapshot */}
      <ExecSummaryCard
        executiveSummary={filteredDigest.executiveSummary}
        isGenerating={dashboard.isGeneratingExecSummary}
        error={dashboard.execSummaryError}
        isEditing={dashboard.isEditingExecSummary}
        editingText={dashboard.editingExecSummaryText}
        onEditingTextChange={dashboard.setEditingExecSummaryText}
        onStartEdit={() => {
          dashboard.setEditingExecSummaryText(filteredDigest.executiveSummary || '');
          dashboard.setIsEditingExecSummary(true);
        }}
        onSaveEdit={dashboard.handleSaveExecSummaryEdit}
        onCancelEdit={() => dashboard.setIsEditingExecSummary(false)}
        onRegenerate={dashboard.handleManualRegenerateExecSummary}
      />

      {/* Summary panel */}
      <SummaryPanel
        digest={filteredDigest}
        isSynthesizing={dashboard.isSynthesizing}
        synthesisError={dashboard.synthesisError}
        onSynthesize={dashboard.handleSynthesize}
      />

      {/* Date Filter Bar */}
      <DateFilterBar
        dateFilterType={dateFilterType}
        setDateFilterType={setDateFilterType}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        language={language}
      />

      {/* Filter toolbar */}
      <FilterToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterParticipant={filterParticipant}
        setFilterParticipant={setFilterParticipant}
        participants={filteredDigest.participants}
        language={language}
      />

      {/* Discussie Tijdlijn - Gedetailleerde Analyse */}
      <div 
        className="bg-[#121212] rounded-xl border border-blue-500/20 p-5 shadow-[0_0_30px_rgba(59,130,246,0.08)] space-y-6" 
        id="timeline-detailed-analysis-section"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {getTranslation('tabTimeline', language)} - {language === 'nl' ? 'Gedetailleerde Analyse' : 'In-depth Analysis'}
              </h3>
              <p className="text-[10px] text-gray-550 font-mono uppercase tracking-wider">Chronological Volume Waves</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-3 py-1 bg-blue-950/20 text-blue-400 rounded-full border border-blue-900/30">
            {filteredDigest.timeline.length} peaks
          </span>
        </div>
        <ExpandedTimelineView
          digest={filteredDigest}
          language={language}
          onSelectDate={setSelectedDateMessages}
          periodAnalyses={periodAnalyses}
          setPeriodAnalyses={setPeriodAnalyses}
          metaAnalysis={metaAnalysis}
          setMetaAnalysis={setMetaAnalysis}
        />
      </div>

      {/* Two-column grid: Decisions | Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="core-metrics-grid">
        <DecisionsColumn
          digest={filteredDigest}
          searchTerm={searchTerm}
          filterParticipant={filterParticipant}
          onSelectDetail={setSelectedDetail}
          language={language}
          onExpand={() => setExpandedPanel('decisions')}
        />
        <ActionItemsColumn
          actionItems={filteredDigest.actionItems}
          searchTerm={searchTerm}
          filterParticipant={filterParticipant}
          onUpdateActionItem={onUpdateActionItem}
          onSelectDetail={setSelectedDetail}
          language={language}
          onExpand={() => setExpandedPanel('actionItems')}
        />
      </div>

      {/* Playbook */}
      <PlaybookSection
        digest={filteredDigest}
        isGeneratingPlaybook={dashboard.isGeneratingPlaybook}
        playbookError={dashboard.playbookError}
        onGeneratePlaybook={dashboard.handleGeneratePlaybook}
        onExportPlaybookPDF={() => exportPlaybookToPdf(filteredDigest)}
        onAddPlay={dashboard.handleAddPlay}
        onSavePlayEdit={dashboard.handleSavePlayEdit}
        onDeletePlay={dashboard.handleDeletePlay}
        language={language}
      />

      {/* Media analyzer */}
      <MediaAnalyzer
        digest={filteredDigest}
        mediaFile={media.mediaFile}
        mediaBase64={media.mediaBase64}
        mediaLoading={media.mediaLoading}
        mediaError={media.mediaError}
        parsedMediaResult={media.parsedMediaResult}
        customPrompt={media.customPrompt}
        onCustomPromptChange={media.setCustomPrompt}
        onMediaFileChange={media.handleMediaFileChange}
        onSetMediaFromZip={media.handleSetMediaFromZip}
        onClearMedia={() => {
          media.setMediaFile(null);
          media.setMediaBase64(null);
        }}
        onAnalyzeMedia={media.handleAnalyzeMedia}
        onMergeMediaIntoDigest={media.handleMergeMediaIntoDigest}
        onDeleteParsedMedia={media.handleDeleteParsedMedia}
      />

      {/* Chat assistant */}
      <ChatAssistant
        chatHistory={chat.chatHistory}
        chatLoading={chat.chatLoading}
        chatError={chat.chatError}
        queryInput={chat.queryInput}
        onQueryInputChange={chat.setQueryInput}
        onSubmitQuery={chat.handleSendQuery}
        onInitiateCommit={chat.handleInitiateCommit}
        language={language}
      />

      {/* Messages log */}
      <MessagesLog
        messages={filteredDigest.messages}
        searchTerm={searchTerm}
        filterParticipant={filterParticipant}
        firstParticipant={firstParticipant}
      />

      {/* Modals */}
      <DashboardModals
        digest={digest}
        filteredDigest={filteredDigest}
        selectedDetail={selectedDetail}
        setSelectedDetail={setSelectedDetail}
        selectedDateMessages={selectedDateMessages}
        setSelectedDateMessages={setSelectedDateMessages}
        dayAnalyses={dayAnalyses}
        setDayAnalyses={setDayAnalyses}
        isUpdateModalOpen={dashboard.isUpdateModalOpen}
        setIsUpdateModalOpen={dashboard.setIsUpdateModalOpen}
        committingDecision={chat.committingDecision}
        setCommittingDecision={chat.setCommittingDecision}
        contradictions={chat.contradictions}
        isAuditingContradictions={chat.isAuditingContradictions}
        auditError={chat.auditError}
        deleteMediaId={media.deleteMediaId}
        setDeleteMediaId={media.setDeleteMediaId}
        onUpdateActionItem={onUpdateActionItem}
        onUpdateActionItemAssignee={onUpdateActionItemAssignee}
        handleReAudit={chat.handleReAudit}
        handleToggleContradictionPartDelete={chat.handleToggleContradictionPartDelete}
        handleConfirmCommitDecision={chat.handleConfirmCommitDecision}
        executeDeleteParsedMedia={media.executeDeleteParsedMedia}
        onSaveDigest={handleSaveDigestFiltered}
        language={language}
      />

      <ExpandedPanelModal
        isOpen={expandedPanel !== null} onClose={() => setExpandedPanel(null)} panelType={expandedPanel}
        digest={filteredDigest} onUpdateActionItem={onUpdateActionItem} onSelectDetail={setSelectedDetail}
        language={language} onSelectDate={setSelectedDateMessages}
        periodAnalyses={periodAnalyses} setPeriodAnalyses={setPeriodAnalyses}
        metaAnalysis={metaAnalysis} setMetaAnalysis={setMetaAnalysis}
      />
    </div>
  );
}
