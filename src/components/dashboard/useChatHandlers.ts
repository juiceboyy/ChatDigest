import React, { useState } from 'react';
import { ChatDigestData, ChatDecision } from '../../types';
import { Language } from '../../lib/translations';

async function handleResponseError(response: Response, defaultMessage: string): Promise<never> {
  let errMsg = defaultMessage;
  try {
    const errData = await response.json();
    errMsg = errData.error || errMsg;
  } catch (e) {
    try {
      const errText = await response.text();
      errMsg = errText || response.statusText || errMsg;
    } catch (_) {
      errMsg = response.statusText || errMsg;
    }
  }
  throw new Error(errMsg);
}

interface UseChatHandlersProps {
  digest: ChatDigestData;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export function useChatHandlers({ digest, onSaveDigest, language }: UseChatHandlersProps) {
  const [queryInput, setQueryInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Commit decision modal state
  const [committingDecision, setCommittingDecision] = useState<{
    text: string;
    sender: string;
    dateStr: string;
  } | null>(null);
  const [isAuditingContradictions, setIsAuditingContradictions] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [contradictions, setContradictions] = useState<{
    id: string;
    sender: string;
    originalText: string;
    dateStr: string;
    isMultiPart: boolean;
    parts: { partId: string; text: string; isContrary: boolean; explanation: string; shouldDelete: boolean }[];
  }[]>([]);

  // Clear chat on digest change
  React.useEffect(() => {
    setChatHistory([]);
    setQueryInput('');
    setChatError(null);
  }, [digest.id]);

  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || chatLoading) return;
    const userQuestion = queryInput.trim();
    setQueryInput('');
    setChatError(null);
    setChatLoading(true);
    const updatedHistory = [...chatHistory, { role: 'user' as const, text: userQuestion }];
    setChatHistory(updatedHistory);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: digest.messages,
          decisions: digest.decisions,
          chatHistory,
          userQuestion,
          language
        }),
      });
      if (!response.ok) await handleResponseError(response, 'Server failed to answer search query.');
      const responseJSON = await response.json();
      setChatHistory((prev) => [...prev, { role: 'model', text: responseJSON.text }]);
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Error communicating with Gemini assistant.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleInitiateCommit = async (text: string) => {
    const cleanText = text.replace(/^-\s+/, '').replace(/^\*\s+/, '').trim();
    setCommittingDecision({ text: cleanText, sender: 'Gemini AI', dateStr: new Date().toISOString().split('T')[0] });
    setIsAuditingContradictions(true);
    setAuditError(null);
    setContradictions([]);
    try {
      const response = await fetch('/api/check-contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDecisionText: cleanText, existingDecisions: digest.decisions, language }),
      });
      if (!response.ok) await handleResponseError(response, 'Failed to audit ledger for contrary items.');
      const responseJSON = await response.json();
      const rawContradictions = responseJSON.contradictions || [];
      setContradictions(rawContradictions.map((raw: any) => {
        const d = digest.decisions.find((x) => x.id === raw.id);
        return {
          id: raw.id,
          sender: d ? d.sender : 'The Group',
          originalText: d ? d.text : '',
          dateStr: d ? d.dateStr : new Date().toISOString().split('T')[0],
          isMultiPart: !!raw.isMultiPart,
          parts: (raw.parts || []).map((p: any) => ({
            partId: p.partId,
            text: p.text,
            isContrary: !!p.isContrary,
            explanation: p.explanation || '',
            shouldDelete: !!p.isContrary
          })),
        };
      }));
    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || 'Contradiction check failed.');
    } finally {
      setIsAuditingContradictions(false);
    }
  };

  const handleReAudit = async (updatedText: string) => {
    setIsAuditingContradictions(true);
    setAuditError(null);
    setContradictions([]);
    try {
      const response = await fetch('/api/check-contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDecisionText: updatedText, existingDecisions: digest.decisions, language }),
      });
      if (!response.ok) await handleResponseError(response, 'Failed to re-audit ledger.');
      const responseJSON = await response.json();
      const rawContradictions = responseJSON.contradictions || [];
      setContradictions(rawContradictions.map((raw: any) => {
        const d = digest.decisions.find((x) => x.id === raw.id);
        return {
          id: raw.id,
          sender: d ? d.sender : 'The Group',
          originalText: d ? d.text : '',
          dateStr: d ? d.dateStr : new Date().toISOString().split('T')[0],
          isMultiPart: !!raw.isMultiPart,
          parts: (raw.parts || []).map((p: any) => ({
            partId: p.partId,
            text: p.text,
            isContrary: !!p.isContrary,
            explanation: p.explanation || '',
            shouldDelete: !!p.isContrary
          })),
        };
      }));
    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || 'Contradiction recheck failed.');
    } finally {
      setIsAuditingContradictions(false);
    }
  };

  const handleConfirmCommitDecision = () => {
    if (!committingDecision || !onSaveDigest) return;
    const newDecisionObj: ChatDecision = {
      id: `dec-g-commit-${Date.now()}`,
      sender: committingDecision.sender || 'Gemini AI',
      text: committingDecision.text,
      dateStr: committingDecision.dateStr || new Date().toISOString().split('T')[0],
    };
    let finalDecisions: ChatDecision[] = [];
    for (const d of digest.decisions) {
      const contradiction = contradictions.find((c) => c.id === d.id);
      if (!contradiction) {
        finalDecisions.push(d);
      } else {
        contradiction.parts.forEach((p, index) => {
          if (!p.shouldDelete) {
            finalDecisions.push({
              id: `${d.id}-part-${p.partId || index}-${Date.now()}`,
              sender: d.sender,
              text: p.text,
              dateStr: d.dateStr
            });
          }
        });
      }
    }
    finalDecisions.push(newDecisionObj);
    onSaveDigest({ ...digest, decisions: finalDecisions });
    setCommittingDecision(null);
    setContradictions([]);
  };

  const handleToggleContradictionPartDelete = (decisionId: string, partId: string) => {
    setContradictions((prev) => prev.map((c) => {
      if (c.id !== decisionId) return c;
      return {
        ...c,
        parts: c.parts.map((p) => p.partId === partId ? { ...p, shouldDelete: !p.shouldDelete } : p)
      };
    }));
  };

  return {
    queryInput,
    chatHistory,
    chatLoading,
    chatError,
    committingDecision,
    isAuditingContradictions,
    auditError,
    contradictions,
    setQueryInput,
    setChatHistory,
    setChatError,
    setCommittingDecision,
    setContradictions,
    handleSendQuery,
    handleInitiateCommit,
    handleReAudit,
    handleConfirmCommitDecision,
    handleToggleContradictionPartDelete
  };
}
