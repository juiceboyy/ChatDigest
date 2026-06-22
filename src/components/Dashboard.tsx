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
import ItemDetailModal from './dashboard/ItemDetailModal';
import UpdateChatModal from './dashboard/UpdateChatModal';
import DateFilterBar from './dashboard/DateFilterBar';
import FilterToolbar from './dashboard/FilterToolbar';

// ── Hooks ──────────────────────────────────────────────────────────────────────
import { useDashboard } from './dashboard/useDashboard';
import { useMediaHandlers } from './dashboard/useMediaHandlers';
import { useChatHandlers } from './dashboard/useChatHandlers';
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
    const mergedDigest: ChatDigestData = {
      ...digest,
      summary: updatedFilteredDigest.summary,
      keywords: updatedFilteredDigest.keywords,
      decisions: updatedFilteredDigest.decisions,
      actionItems: updatedFilteredDigest.actionItems,
      playbook: updatedFilteredDigest.playbook,
      executiveSummary: updatedFilteredDigest.executiveSummary,
    };
    onSaveDigest(mergedDigest);
  };

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterParticipant, setFilterParticipant] = useState<string | null>(null);

  // ── Item detail modal state ───────────────────────────────────────────────────
  const [selectedDetail, setSelectedDetail] = useState<{
    id: string;
    type: 'action' | 'decision';
    sender: string;
    text: string;
    dateStr: string;
    completed?: boolean;
  } | null>(null);

  // ── Custom Hooks ──────────────────────────────────────────────────────────────
  const {
    isSynthesizing,
    synthesisError,
    isGeneratingExecSummary,
    execSummaryError,
    isEditingExecSummary,
    editingExecSummaryText,
    isGeneratingPlaybook,
    playbookError,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    setIsEditingExecSummary,
    setEditingExecSummaryText,
    handleSynthesize,
    handleManualRegenerateExecSummary,
    handleSaveExecSummaryEdit,
    handleGeneratePlaybook,
    handleSavePlayEdit,
    handleDeletePlay,
    handleAddPlay,
  } = useDashboard({ digest: filteredDigest, onSaveDigest: handleSaveDigestFiltered, language });

  const {
    mediaFile,
    mediaBase64,
    mediaLoading,
    mediaError,
    customPrompt,
    parsedMediaResult,
    deleteMediaId,
    setCustomPrompt,
    setMediaFile,
    setMediaBase64,
    setDeleteMediaId,
    handleMediaFileChange,
    handleSetMediaFromZip,
    handleAnalyzeMedia,
    handleMergeMediaIntoDigest,
    handleDeleteParsedMedia,
    executeDeleteParsedMedia,
  } = useMediaHandlers({ digest: filteredDigest, onSaveDigest: handleSaveDigestFiltered, language });

  const {
    queryInput,
    chatHistory,
    chatLoading,
    chatError,
    committingDecision,
    isAuditingContradictions,
    auditError,
    contradictions,
    setQueryInput,
    setCommittingDecision,
    setContradictions,
    handleSendQuery,
    handleInitiateCommit,
    handleReAudit,
    handleConfirmCommitDecision,
    handleToggleContradictionPartDelete,
  } = useChatHandlers({ digest: filteredDigest, onSaveDigest: handleSaveDigestFiltered, language });

  // Escape key to close detail modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDetail(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to top when modals open
  useEffect(() => {
    if (selectedDetail || isUpdateModalOpen) {
      const scroller = document.getElementById('main-scroller');
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDetail, isUpdateModalOpen]);

  const firstParticipant = filteredDigest.participants[0] || '';

  return (
    <div className="space-y-6" id="dashboard-root">
      {/* Header */}
      <DashboardHeader
        digest={filteredDigest}
        onUpdateChat={() => setIsUpdateModalOpen(true)}
        language={language}
      />

      {/* Executive snapshot */}
      <ExecSummaryCard
        executiveSummary={filteredDigest.executiveSummary}
        isGenerating={isGeneratingExecSummary}
        error={execSummaryError}
        isEditing={isEditingExecSummary}
        editingText={editingExecSummaryText}
        onEditingTextChange={setEditingExecSummaryText}
        onStartEdit={() => {
          setEditingExecSummaryText(filteredDigest.executiveSummary || '');
          setIsEditingExecSummary(true);
        }}
        onSaveEdit={handleSaveExecSummaryEdit}
        onCancelEdit={() => setIsEditingExecSummary(false)}
        onRegenerate={handleManualRegenerateExecSummary}
      />

      {/* Summary panel */}
      <SummaryPanel
        digest={filteredDigest}
        isSynthesizing={isSynthesizing}
        synthesisError={synthesisError}
        onSynthesize={handleSynthesize}
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
        />
        <DecisionsColumn
          digest={filteredDigest}
          searchTerm={searchTerm}
          filterParticipant={filterParticipant}
          onSelectDetail={setSelectedDetail}
          language={language}
        />
        <ActionItemsColumn
          actionItems={filteredDigest.actionItems}
          searchTerm={searchTerm}
          filterParticipant={filterParticipant}
          onUpdateActionItem={onUpdateActionItem}
          onSelectDetail={setSelectedDetail}
          language={language}
        />
      </div>

      {/* Playbook */}
      <PlaybookSection
        digest={filteredDigest}
        isGeneratingPlaybook={isGeneratingPlaybook}
        playbookError={playbookError}
        onGeneratePlaybook={handleGeneratePlaybook}
        onExportPlaybookPDF={() => exportPlaybookToPdf(filteredDigest)}
        onAddPlay={handleAddPlay}
        onSavePlayEdit={handleSavePlayEdit}
        onDeletePlay={handleDeletePlay}
        language={language}
      />

      {/* Media analyzer */}
      <MediaAnalyzer
        digest={filteredDigest}
        mediaFile={mediaFile}
        mediaBase64={mediaBase64}
        mediaLoading={mediaLoading}
        mediaError={mediaError}
        parsedMediaResult={parsedMediaResult}
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
        onMediaFileChange={handleMediaFileChange}
        onSetMediaFromZip={handleSetMediaFromZip}
        onClearMedia={() => {
          setMediaFile(null);
          setMediaBase64(null);
        }}
        onAnalyzeMedia={handleAnalyzeMedia}
        onMergeMediaIntoDigest={handleMergeMediaIntoDigest}
        onDeleteParsedMedia={handleDeleteParsedMedia}
      />

      {/* Chat assistant */}
      <ChatAssistant
        chatHistory={chatHistory}
        chatLoading={chatLoading}
        chatError={chatError}
        queryInput={queryInput}
        onQueryInputChange={setQueryInput}
        onSubmitQuery={handleSendQuery}
        onInitiateCommit={handleInitiateCommit}
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
      <ItemDetailModal
        digest={filteredDigest}
        selectedDetail={selectedDetail}
        committingDecision={committingDecision}
        contradictions={contradictions}
        isAuditingContradictions={isAuditingContradictions}
        auditError={auditError}
        deleteMediaId={deleteMediaId}
        onCloseDetail={() => setSelectedDetail(null)}
        onCloseCommit={() => setCommittingDecision(null)}
        onUpdateActionItem={onUpdateActionItem}
        onUpdateActionItemAssignee={onUpdateActionItemAssignee}
        onUpdateDetailSender={(sender) =>
          setSelectedDetail((prev) => (prev ? { ...prev, sender } : prev))
        }
        onUpdateDetailCompleted={(completed) =>
          setSelectedDetail((prev) => (prev ? { ...prev, completed } : prev))
        }
        onCommittingDecisionTextChange={(text) =>
          setCommittingDecision((prev) => (prev ? { ...prev, text } : prev))
        }
        onCommittingDecisionSenderChange={(sender) =>
          setCommittingDecision((prev) => (prev ? { ...prev, sender } : prev))
        }
        onCommittingDecisionDateChange={(dateStr) =>
          setCommittingDecision((prev) => (prev ? { ...prev, dateStr } : prev))
        }
        onReAudit={handleReAudit}
        onToggleContradictionPartDelete={handleToggleContradictionPartDelete}
        onConfirmCommitDecision={handleConfirmCommitDecision}
        onConfirmDeleteMedia={executeDeleteParsedMedia}
        onCancelDeleteMedia={() => setDeleteMediaId(null)}
      />

      <UpdateChatModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        digest={digest} // Keep raw unfiltered digest here so update operation matches all history
        onSaveDigest={onSaveDigest || (() => {})}
        language={language}
      />
    </div>
  );
}
