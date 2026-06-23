import React, { useState, useEffect } from 'react';
import { ChatDigestData } from '../types';
import { exportPlaybookToPdf } from '../lib/pdfExporter';
import { Language } from '../lib/translations';

// ── Sub-components ─────────────────────────────────────────────────────────────
import DashboardHeader from './dashboard/DashboardHeader';
import ExecSummaryCard from './dashboard/ExecSummaryCard';
import SummaryPanel from './dashboard/SummaryPanel';
import TimelineColumn from './dashboard/TimelineColumn';
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
  const handleSaveDigestFiltered = (updatedFilteredDigest: ChatDigestData) => {
    if (!onSaveDigest) return;

    const filterKey = dateFilterType === 'custom'
      ? `custom_${customStartDate}_${customEndDate}`
      : dateFilterType;

    const periodSummaries = { ...(digest.periodSummaries || {}) };

    if (dateFilterType !== 'all') {
      periodSummaries[filterKey] = {
        summary: updatedFilteredDigest.summary,
        keywords: updatedFilteredDigest.keywords,
        decisions: updatedFilteredDigest.decisions,
        actionItems: updatedFilteredDigest.actionItems,
      };
    }

    const mergedDigest: ChatDigestData = {
      ...digest,
      summary: dateFilterType === 'all' ? updatedFilteredDigest.summary : digest.summary,
      keywords: dateFilterType === 'all' ? updatedFilteredDigest.keywords : digest.keywords,
      decisions: dateFilterType === 'all' ? updatedFilteredDigest.decisions : digest.decisions,
      actionItems: dateFilterType === 'all' ? updatedFilteredDigest.actionItems : digest.actionItems,
      playbook: updatedFilteredDigest.playbook,
      executiveSummary: updatedFilteredDigest.executiveSummary,
      periodSummaries,
    };
    onSaveDigest(mergedDigest);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterParticipant, setFilterParticipant] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [selectedDateMessages, setSelectedDateMessages] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<'timeline' | 'decisions' | 'actionItems' | null>(null);
  const [dayAnalyses, setDayAnalyses] = useState<Record<string, any>>({});

  const { dashboard, media, chat } = useDashboardState({
    digest: filteredDigest,
    onSaveDigest: handleSaveDigestFiltered,
    language,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDetail(null);
        setExpandedPanel(null);
        setSelectedDateMessages(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to top when modals open
  useEffect(() => {
    if (selectedDetail || dashboard.isUpdateModalOpen) {
      const scroller = document.getElementById('main-scroller');
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
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

      {/* Three-column grid: Timeline | Decisions | Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="core-metrics-grid">
        <TimelineColumn
          digest={filteredDigest}
          language={language}
          onExpand={() => setExpandedPanel('timeline')}
          onSelectDate={setSelectedDateMessages}
        />
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
        isOpen={expandedPanel !== null}
        onClose={() => setExpandedPanel(null)}
        panelType={expandedPanel}
        digest={filteredDigest}
        onUpdateActionItem={onUpdateActionItem}
        onSelectDetail={setSelectedDetail}
        language={language}
        onSelectDate={setSelectedDateMessages}
      />
    </div>
  );
}
