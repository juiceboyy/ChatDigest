import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { ChatDigestData } from '../types';
import { exportPlaybookToPdf } from '../lib/pdfExporter';
import { Language, getTranslation } from '../lib/translations';

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

// ── Hooks ──────────────────────────────────────────────────────────────────────
import { useDashboard } from './dashboard/useDashboard';
import { useMediaHandlers } from './dashboard/useMediaHandlers';
import { useChatHandlers } from './dashboard/useChatHandlers';

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
  } = useDashboard({ digest, onSaveDigest, language });

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
  } = useMediaHandlers({ digest, onSaveDigest, language });

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
  } = useChatHandlers({ digest, onSaveDigest, language });

  // Escape key to close detail modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDetail(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to top when detail modal opens
  useEffect(() => {
    if (selectedDetail) {
      const scroller = document.getElementById('main-scroller');
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDetail]);

  const firstParticipant = digest.participants[0] || '';

  return (
    <div className="space-y-6" id="dashboard-root">
      {/* Header */}
      <DashboardHeader
        digest={digest}
        onUpdateChat={() => setIsUpdateModalOpen(true)}
        language={language}
      />

      {/* Executive snapshot */}
      <ExecSummaryCard
        executiveSummary={digest.executiveSummary}
        isGenerating={isGeneratingExecSummary}
        error={execSummaryError}
        isEditing={isEditingExecSummary}
        editingText={editingExecSummaryText}
        onEditingTextChange={setEditingExecSummaryText}
        onStartEdit={() => {
          setEditingExecSummaryText(digest.executiveSummary || '');
          setIsEditingExecSummary(true);
        }}
        onSaveEdit={handleSaveExecSummaryEdit}
        onCancelEdit={() => setIsEditingExecSummary(false)}
        onRegenerate={handleManualRegenerateExecSummary}
      />

      {/* Summary panel */}
      <SummaryPanel
        digest={digest}
        isSynthesizing={isSynthesizing}
        synthesisError={synthesisError}
        onSynthesize={handleSynthesize}
      />

      {/* Filter toolbar */}
      <div className="p-4 bg-[#121212] rounded-xl border border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-inner" id="filter-toolbar">
        <div className="relative flex-1" id="search-box">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={getTranslation('searchPlaceholder', language)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded pl-10 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
            >
              {getTranslation('clearSearch', language)}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto py-1 pr-1" id="speaker-filter-list">
          <span className="text-xs text-gray-500 font-light shrink-0">Speaker:</span>
          <button
            onClick={() => setFilterParticipant(null)}
            className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all shrink-0 ${filterParticipant === null ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'}`}
          >
            {getTranslation('allContributors', language)}
          </button>
          {digest.participants.slice(0, 5).map((name) => (
            <button
              key={name}
              onClick={() => setFilterParticipant(name === filterParticipant ? null : name)}
              className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all truncate shrink-0 max-w-[120px] ${name === filterParticipant ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'}`}
            >
              {name}
            </button>
          ))}
          {digest.participants.length > 5 && (
            <div className="text-[10px] text-slate-500 font-light shrink-0 self-center pl-1">
              +{digest.participants.length - 5} {getTranslation('moreSpeakers', language)}
            </div>
          )}
        </div>
      </div>

      {/* Three-column grid: Timeline | Decisions | Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="core-metrics-grid">
        <TimelineColumn
          digest={digest}
          language={language}
        />
        <DecisionsColumn
          digest={digest}
          searchTerm={searchTerm}
          filterParticipant={filterParticipant}
          onSelectDetail={setSelectedDetail}
          language={language}
        />
        <ActionItemsColumn
          actionItems={digest.actionItems}
          searchTerm={searchTerm}
          filterParticipant={filterParticipant}
          onUpdateActionItem={onUpdateActionItem}
          onSelectDetail={setSelectedDetail}
          language={language}
        />
      </div>

      {/* Playbook */}
      <PlaybookSection
        digest={digest}
        isGeneratingPlaybook={isGeneratingPlaybook}
        playbookError={playbookError}
        onGeneratePlaybook={handleGeneratePlaybook}
        onExportPlaybookPDF={() => exportPlaybookToPdf(digest)}
        onAddPlay={handleAddPlay}
        onSavePlayEdit={handleSavePlayEdit}
        onDeletePlay={handleDeletePlay}
        language={language}
      />

      {/* Media analyzer */}
      <MediaAnalyzer
        digest={digest}
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
        messages={digest.messages}
        searchTerm={searchTerm}
        filterParticipant={filterParticipant}
        firstParticipant={firstParticipant}
      />

      {/* Modals */}
      <ItemDetailModal
        digest={digest}
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
        digest={digest}
        onSaveDigest={onSaveDigest || (() => {})}
        language={language}
      />
    </div>
  );
}
