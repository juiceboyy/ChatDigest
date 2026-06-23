import React from 'react';
import { ChatDigestData } from '../../types';
import { Language } from '../../lib/translations';
import ItemDetailModal from './ItemDetailModal';
import CommitDecisionModal from './CommitDecisionModal';
import UpdateChatModal from './UpdateChatModal';
import DayMessagesModal from './DayMessagesModal';

interface DashboardModalsProps {
  digest: ChatDigestData;
  filteredDigest: ChatDigestData;
  selectedDetail: {
    id: string;
    type: 'action' | 'decision';
    sender: string;
    text: string;
    dateStr: string;
    completed?: boolean;
    completedBy?: string;
    completedMessage?: string;
  } | null;
  setSelectedDetail: React.Dispatch<React.SetStateAction<any>>;
  selectedDateMessages: string | null;
  setSelectedDateMessages: (dateStr: string | null) => void;
  dayAnalyses: Record<string, any>;
  setDayAnalyses: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (open: boolean) => void;
  committingDecision: any;
  setCommittingDecision: React.Dispatch<React.SetStateAction<any>>;
  contradictions: any;
  isAuditingContradictions: boolean;
  auditError: string | null;
  deleteMediaId: string | null;
  setDeleteMediaId: (id: string | null) => void;
  onUpdateActionItem: (actionItemId: string, completed: boolean) => void;
  onUpdateActionItemAssignee?: (actionItemId: string, assignee: string) => void;
  handleReAudit: (updatedText: string) => Promise<void>;
  handleToggleContradictionPartDelete: (decisionId: string, partId: string) => void;
  handleConfirmCommitDecision: () => void;
  executeDeleteParsedMedia: (mediaId: string) => void;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export default function DashboardModals({
  digest,
  filteredDigest,
  selectedDetail,
  setSelectedDetail,
  selectedDateMessages,
  setSelectedDateMessages,
  dayAnalyses,
  setDayAnalyses,
  isUpdateModalOpen,
  setIsUpdateModalOpen,
  committingDecision,
  setCommittingDecision,
  contradictions,
  isAuditingContradictions,
  auditError,
  deleteMediaId,
  setDeleteMediaId,
  onUpdateActionItem,
  onUpdateActionItemAssignee,
  handleReAudit,
  handleToggleContradictionPartDelete,
  handleConfirmCommitDecision,
  executeDeleteParsedMedia,
  onSaveDigest,
  language,
}: DashboardModalsProps) {
  return (
    <>
      <ItemDetailModal
        digest={filteredDigest}
        selectedDetail={selectedDetail}
        deleteMediaId={deleteMediaId}
        onCloseDetail={() => setSelectedDetail(null)}
        onUpdateActionItem={onUpdateActionItem}
        onUpdateActionItemAssignee={onUpdateActionItemAssignee}
        onUpdateDetailSender={(sender) =>
          setSelectedDetail((prev: any) => (prev ? { ...prev, sender } : prev))
        }
        onUpdateDetailCompleted={(completed) =>
          setSelectedDetail((prev: any) => (prev ? { ...prev, completed } : prev))
        }
        onConfirmDeleteMedia={executeDeleteParsedMedia}
        onCancelDeleteMedia={() => setDeleteMediaId(null)}
        language={language}
      />

      <CommitDecisionModal
        digest={filteredDigest}
        committingDecision={committingDecision}
        contradictions={contradictions}
        isAuditingContradictions={isAuditingContradictions}
        auditError={auditError}
        onCloseCommit={() => setCommittingDecision(null)}
        onCommittingDecisionTextChange={(text) =>
          setCommittingDecision((prev: any) => (prev ? { ...prev, text } : prev))
        }
        onCommittingDecisionSenderChange={(sender) =>
          setCommittingDecision((prev: any) => (prev ? { ...prev, sender } : prev))
        }
        onCommittingDecisionDateChange={(dateStr) =>
          setCommittingDecision((prev: any) => (prev ? { ...prev, dateStr } : prev))
        }
        onReAudit={handleReAudit}
        onToggleContradictionPartDelete={handleToggleContradictionPartDelete}
        onConfirmCommitDecision={handleConfirmCommitDecision}
      />

      <UpdateChatModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        digest={digest}
        onSaveDigest={onSaveDigest || (() => {})}
        language={language}
      />

      <DayMessagesModal
        dateStr={selectedDateMessages}
        messages={filteredDigest.messages}
        firstParticipant={filteredDigest.participants[0] || ''}
        onClose={() => setSelectedDateMessages(null)}
        language={language}
        dayAnalyses={dayAnalyses}
        setDayAnalyses={setDayAnalyses}
      />
    </>
  );
}
