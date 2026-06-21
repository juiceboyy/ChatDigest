import React, { useState, useRef } from 'react';
import { ChatDigestData, PlaybookPlay } from '../../types';
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

interface UseDashboardProps {
  digest: ChatDigestData;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export function useDashboard({ digest, onSaveDigest, language }: UseDashboardProps) {
  // Synthesis state
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Executive summary state
  const [isGeneratingExecSummary, setIsGeneratingExecSummary] = useState(false);
  const [execSummaryError, setExecSummaryError] = useState<string | null>(null);
  const [isEditingExecSummary, setIsEditingExecSummary] = useState(false);
  const [editingExecSummaryText, setEditingExecSummaryText] = useState('');
  const generatingRef = useRef(false);

  // Playbook state
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false);
  const [playbookError, setPlaybookError] = useState<string | null>(null);

  // Update chat modal state
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Auto-generate executive summary if missing
  React.useEffect(() => {
    let active = true;
    if (!digest.executiveSummary && digest.messages && digest.messages.length > 0 && !generatingRef.current) {
      const autoGenerate = async () => {
        generatingRef.current = true;
        setIsGeneratingExecSummary(true);
        setExecSummaryError(null);
        try {
          const response = await fetch('/api/executive-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: digest.messages, language }),
          });
          if (!active) return;
          if (!response.ok) await handleResponseError(response, 'Failed to auto-generate summary');
          const data = await response.json();
          if (!active) return;
          if (data.executiveSummary && onSaveDigest) {
            onSaveDigest({ ...digest, executiveSummary: data.executiveSummary });
          }
        } catch (err: any) {
          console.error('Auto executive summary generation error:', err);
          if (active) setExecSummaryError(err.message || 'Failed to auto-generate summary.');
        } finally {
          generatingRef.current = false;
          setIsGeneratingExecSummary(false);
        }
      };
      autoGenerate();
    }
    return () => { active = false; };
  }, [digest.id, digest.executiveSummary, digest.messages?.length]);

  const handleSynthesize = async () => {
    if (isSynthesizing) return;
    setIsSynthesizing(true);
    setSynthesisError(null);
    try {
      const response = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: digest.fileName, fileSize: digest.fileSize, messages: digest.messages, language }),
      });
      if (!response.ok) await handleResponseError(response, 'Server failed to analyze log with Gemini');
      const geminiDigest = await response.json();
      const finalData: ChatDigestData = {
        ...digest,
        summary: geminiDigest.summary,
        keywords: geminiDigest.keywords,
        decisions: geminiDigest.decisions.map((d: any, i: number) => ({ id: `dec-g-${i}-${Date.now()}`, sender: d.sender, text: d.text, dateStr: d.dateStr })),
        actionItems: geminiDigest.actionItems.map((a: any, i: number) => ({ id: `act-g-${i}-${Date.now()}`, sender: a.sender, text: a.text, dateStr: a.dateStr, completed: false })),
      };
      if (onSaveDigest) onSaveDigest(finalData);
    } catch (err: any) {
      console.error(err);
      setSynthesisError(err.message || 'Error executing Gemini AI Synthesis. Please verify your GEMINI_API_KEY.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleManualRegenerateExecSummary = async () => {
    generatingRef.current = true;
    setIsGeneratingExecSummary(true);
    setExecSummaryError(null);
    setIsEditingExecSummary(false);
    try {
      const response = await fetch('/api/executive-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: digest.messages, language }),
      });
      if (!response.ok) await handleResponseError(response, 'Failed to regenerate executive summary');
      const data = await response.json();
      if (data.executiveSummary && onSaveDigest) {
        onSaveDigest({ ...digest, executiveSummary: data.executiveSummary });
      }
    } catch (err: any) {
      console.error(err);
      setExecSummaryError(err.message || 'Failed to manually regenerate executive summary.');
    } finally {
      generatingRef.current = false;
      setIsGeneratingExecSummary(false);
    }
  };

  const handleSaveExecSummaryEdit = () => {
    if (onSaveDigest) onSaveDigest({ ...digest, executiveSummary: editingExecSummaryText });
    setIsEditingExecSummary(false);
  };

  const handleGeneratePlaybook = async () => {
    setIsGeneratingPlaybook(true);
    setPlaybookError(null);
    try {
      const response = await fetch('/api/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: digest.decisions, actionItems: digest.actionItems, language }),
      });
      if (!response.ok) await handleResponseError(response, 'Failed to generate playbook');
      const data = await response.json();
      if (data.playbook && onSaveDigest) {
        onSaveDigest({ ...digest, playbook: data.playbook });
      }
    } catch (err: any) {
      console.error('AI Playbook generation error:', err);
      setPlaybookError(err.message || 'Failed to compile Playbook with Gemini.');
    } finally {
      setIsGeneratingPlaybook(false);
    }
  };

  const handleSavePlayEdit = (playId: string, updates: Partial<PlaybookPlay>) => {
    if (!digest.playbook || !onSaveDigest) return;
    const updatedPlays = (digest.playbook.plays || []).map((p) => p.id !== playId ? p : { ...p, ...updates });
    onSaveDigest({ ...digest, playbook: { ...digest.playbook, plays: updatedPlays } });
  };

  const handleDeletePlay = (playId: string) => {
    if (!digest.playbook || !onSaveDigest) return;
    const updatedPlays = (digest.playbook.plays || []).filter((p) => p.id !== playId);
    onSaveDigest({ ...digest, playbook: { ...digest.playbook, plays: updatedPlays } });
  };

  const handleAddPlay = () => {
    if (!digest.playbook || !onSaveDigest) return;
    const newPlay: PlaybookPlay = {
      id: `play-${Date.now()}`,
      title: 'New Custom Play',
      category: 'General',
      description: 'Define the strategic and operational setup for this custom play.',
      steps: ['First task step to execute.'],
      tips: ['Useful expert advice for this setup.'],
    };
    onSaveDigest({ ...digest, playbook: { ...digest.playbook, plays: [...(digest.playbook.plays || []), newPlay] } });
  };

  return {
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
    handleAddPlay
  };
}
