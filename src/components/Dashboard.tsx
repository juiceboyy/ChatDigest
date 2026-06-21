/**
 * Dashboard.tsx — Orchestrator component.
 *
 * This component manages all state and handlers for the digest dashboard,
 * then delegates rendering to focused sub-components in ./dashboard/.
 *
 * Sub-components:
 *   DashboardHeader      — Title bar, metadata row, PDF export
 *   ExecSummaryCard      — 2-3 sentence AI executive briefing
 *   SummaryPanel         — Full Gemini AI executive synthesis
 *   TimelineColumn       — Sparkline + chronological node list
 *   DecisionsColumn      — Key consensus decisions list
 *   ActionItemsColumn    — Action item tracker with checkboxes
 *   PlaybookSection      — Operational playbook builder
 *   MediaAnalyzer        — Multimodal Gemini media parser
 *   ChatAssistant        — Q&A assistant with commit-to-decision
 *   MessagesLog          — Filtered message log viewer
 *   ItemDetailModal      — Item detail + commit modals
 */

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { ChatDigestData, ChatDecision, PlaybookPlay, ParsedMediaItem } from '../types';
import { exportDigestToPdf, exportPlaybookToPdf } from '../lib/pdfExporter';
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Props ──────────────────────────────────────────────────────────────────────

interface DashboardProps {
  digest: ChatDigestData;
  onUpdateActionItem: (actionItemId: string, completed: boolean) => void;
  onUpdateActionItemAssignee?: (actionItemId: string, assignee: string) => void;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Dashboard({ digest, onUpdateActionItem, onUpdateActionItemAssignee, onSaveDigest, language }: DashboardProps) {
  // ── Filter state ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterParticipant, setFilterParticipant] = useState<string | null>(null);
  const [filterOnlyIncompleteActionItems, setFilterOnlyIncompleteActionItems] = useState(false);

  // ── Synthesis state ───────────────────────────────────────────────────────────
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // ── Chat assistant state ──────────────────────────────────────────────────────
  const [queryInput, setQueryInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // ── Commit decision modal state ───────────────────────────────────────────────
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

  // ── Item detail modal state ───────────────────────────────────────────────────
  const [selectedDetail, setSelectedDetail] = useState<{
    id: string;
    type: 'action' | 'decision';
    sender: string;
    text: string;
    dateStr: string;
    completed?: boolean;
  } | null>(null);

  // ── Executive summary state ───────────────────────────────────────────────────
  const [isGeneratingExecSummary, setIsGeneratingExecSummary] = useState(false);
  const [execSummaryError, setExecSummaryError] = useState<string | null>(null);
  const [isEditingExecSummary, setIsEditingExecSummary] = useState(false);
  const [editingExecSummaryText, setEditingExecSummaryText] = useState('');
  const generatingRef = React.useRef(false);
  const onSaveDigestRef = React.useRef(onSaveDigest);
  React.useEffect(() => { onSaveDigestRef.current = onSaveDigest; }, [onSaveDigest]);

  // ── Playbook state ────────────────────────────────────────────────────────────
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false);
  const [playbookError, setPlaybookError] = useState<string | null>(null);

  // ── Media analyzer state ──────────────────────────────────────────────────────
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [parsedMediaResult, setParsedMediaResult] = useState<ParsedMediaItem | null>(null);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);

  // ── Effects ───────────────────────────────────────────────────────────────────

  // Reset chat on digest change
  React.useEffect(() => {
    setChatHistory([]);
    setQueryInput('');
    setChatError(null);
  }, [digest.id]);

  // Escape key to close detail modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedDetail(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to top when detail modal opens
  React.useEffect(() => {
    if (selectedDetail) {
      const scroller = document.getElementById('main-scroller');
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDetail]);

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
          if (data.executiveSummary && onSaveDigestRef.current) {
            onSaveDigestRef.current({ ...digest, executiveSummary: data.executiveSummary });
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

  // ── Computed values ───────────────────────────────────────────────────────────

  const totalMessages = digest.messages.length;

  const filteredMessages = useMemo(() => digest.messages.filter((msg) => {
    const matchesSearch = searchTerm ? msg.text.toLowerCase().includes(searchTerm.toLowerCase()) || msg.sender.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    const matchesParticipant = filterParticipant ? msg.sender === filterParticipant : true;
    return matchesSearch && matchesParticipant;
  }), [digest.messages, searchTerm, filterParticipant]);

  const filteredDecisions = useMemo(() => digest.decisions.filter((dec) => {
    const matchesSearch = searchTerm ? dec.text.toLowerCase().includes(searchTerm.toLowerCase()) || dec.sender.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    const matchesParticipant = filterParticipant ? dec.sender === filterParticipant : true;
    return matchesSearch && matchesParticipant;
  }), [digest.decisions, searchTerm, filterParticipant]);

  const filteredActionItems = useMemo(() => digest.actionItems.filter((act) => {
    const matchesSearch = searchTerm ? act.text.toLowerCase().includes(searchTerm.toLowerCase()) || act.sender.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    const matchesParticipant = filterParticipant ? act.sender === filterParticipant : true;
    const matchesComplete = filterOnlyIncompleteActionItems ? !act.completed : true;
    return matchesSearch && matchesParticipant && matchesComplete;
  }), [digest.actionItems, searchTerm, filterParticipant, filterOnlyIncompleteActionItems]);

  const svgSparklinePoints = useMemo(() => {
    const list = digest.timeline;
    if (list.length <= 1) return [];
    const paddingX = 25, paddingY = 20;
    const chartWidth = 500 - paddingX * 2;
    const chartHeight = 120 - paddingY * 2;
    const stepX = chartWidth / (list.length - 1);
    return list.map((node, i) => ({
      x: paddingX + i * stepX,
      y: paddingY + ((1 - node.avgSentiment) / 2) * chartHeight,
    }));
  }, [digest.timeline]);

  const svgSparklinePointsPath = useMemo(() => {
    if (svgSparklinePoints.length === 0) return '';
    return svgSparklinePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [svgSparklinePoints]);

  const svgSparklineAreaPath = useMemo(() => {
    if (svgSparklinePoints.length === 0) return '';
    const start = `M ${svgSparklinePoints[0].x} 100`;
    const line = svgSparklinePoints.map((p) => `L ${p.x} ${p.y}`).join(' ');
    const end = `L ${svgSparklinePoints[svgSparklinePoints.length - 1].x} 100 Z`;
    return `${start} ${line} ${end}`;
  }, [svgSparklinePoints]);

  // ── Event Handlers ────────────────────────────────────────────────────────────

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
        body: JSON.stringify({ messages: digest.messages, decisions: digest.decisions, chatHistory, userQuestion, language }),
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
          id: raw.id, sender: d ? d.sender : 'The Group', originalText: d ? d.text : '',
          dateStr: d ? d.dateStr : new Date().toISOString().split('T')[0],
          isMultiPart: !!raw.isMultiPart,
          parts: (raw.parts || []).map((p: any) => ({ partId: p.partId, text: p.text, isContrary: !!p.isContrary, explanation: p.explanation || '', shouldDelete: !!p.isContrary })),
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
          id: raw.id, sender: d ? d.sender : 'The Group', originalText: d ? d.text : '',
          dateStr: d ? d.dateStr : new Date().toISOString().split('T')[0],
          isMultiPart: !!raw.isMultiPart,
          parts: (raw.parts || []).map((p: any) => ({ partId: p.partId, text: p.text, isContrary: !!p.isContrary, explanation: p.explanation || '', shouldDelete: !!p.isContrary })),
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
            finalDecisions.push({ id: `${d.id}-part-${p.partId || index}-${Date.now()}`, sender: d.sender, text: p.text, dateStr: d.dateStr });
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
      return { ...c, parts: c.parts.map((p) => p.partId === partId ? { ...p, shouldDelete: !p.shouldDelete } : p) };
    }));
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaError(null);
      setParsedMediaResult(null);
      const reader = new FileReader();
      reader.onload = () => { setMediaBase64((reader.result as string).split(',')[1] || (reader.result as string)); };
      reader.onerror = () => { setMediaError('Could not read file data.'); };
      reader.readAsDataURL(file);
    }
  };

  const handleSetMediaFromZip = (item: { name: string; mimeType: string; size: number; base64: string }) => {
    setMediaFile({ name: item.name, type: item.mimeType, size: item.size } as any);
    setMediaBase64(item.base64);
  };

  const handleAnalyzeMedia = async () => {
    if (!mediaBase64 || !mediaFile) return;
    setMediaLoading(true);
    setMediaError(null);
    try {
      const response = await fetch('/api/parse-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: mediaFile.name, fileMimeType: mediaFile.type, fileBase64: mediaBase64, chatSummary: digest.summary, userPrompt: customPrompt.trim() || undefined, language }),
      });
      if (!response.ok) await handleResponseError(response, 'Failed to analyze media file using Gemini.');
      const data = await response.json();
      setParsedMediaResult({ id: `media-${Date.now()}`, fileName: mediaFile.name, fileMimeType: mediaFile.type, parsedAt: Date.now(), description: data.description, decisions: data.decisions, actionItems: data.actionItems });
      setMediaFile(null);
      setMediaBase64(null);
      setCustomPrompt('');
    } catch (err: any) {
      setMediaError(err.message || 'An unknown media query error occurred.');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleMergeMediaIntoDigest = (mediaResult: ParsedMediaItem) => {
    if (!mediaResult || !onSaveDigest) return;
    const newDecisions = mediaResult.decisions.map((d, index) => ({ id: `dec-m-${index}-${Date.now()}`, sender: d.sender || 'Group Attachment', text: d.text, dateStr: d.dateStr || new Date().toISOString().split('T')[0] }));
    const newActionItems = mediaResult.actionItems.map((a, index) => ({ id: `act-m-${index}-${Date.now()}`, sender: a.sender || 'The Group', text: a.text, dateStr: a.dateStr || new Date().toISOString().split('T')[0], completed: false }));
    const newMediaItem: ParsedMediaItem = { ...mediaResult, id: `media-${Date.now()}`, parsedAt: Date.now(), decisions: newDecisions, actionItems: newActionItems };
    onSaveDigest({ ...digest, decisions: [...digest.decisions, ...newDecisions], actionItems: [...digest.actionItems, ...newActionItems], parsedMedia: [...(digest.parsedMedia || []), newMediaItem] });
    setParsedMediaResult(null);
  };

  const handleDeleteParsedMedia = (mediaId: string) => setDeleteMediaId(mediaId);

  const executeDeleteParsedMedia = (mediaId: string) => {
    setDeleteMediaId(null);
    if (!onSaveDigest) return;
    onSaveDigest({ ...digest, parsedMedia: (digest.parsedMedia || []).filter((m) => m.id !== mediaId) });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const firstParticipant = digest.participants[0] || '';

  return (
    <div className="space-y-6" id="dashboard-root">

      {/* Header */}
      <DashboardHeader digest={digest} />

      {/* Executive snapshot */}
      <ExecSummaryCard
        executiveSummary={digest.executiveSummary}
        isGenerating={isGeneratingExecSummary}
        error={execSummaryError}
        isEditing={isEditingExecSummary}
        editingText={editingExecSummaryText}
        onEditingTextChange={setEditingExecSummaryText}
        onStartEdit={() => { setEditingExecSummaryText(digest.executiveSummary || ''); setIsEditingExecSummary(true); }}
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
            placeholder="Search keywords, decisions, or action assignments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded pl-10 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300">Clear</button>}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto py-1 pr-1" id="speaker-filter-list">
          <span className="text-xs text-gray-500 font-light shrink-0">Speaker:</span>
          <button
            onClick={() => setFilterParticipant(null)}
            className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all shrink-0 ${filterParticipant === null ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'}`}
          >
            All Contributors
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
          {digest.participants.length > 5 && <div className="text-[10px] text-slate-500 font-light shrink-0 self-center pl-1">+{digest.participants.length - 5} more</div>}
        </div>
      </div>

      {/* Three-column grid: Timeline | Decisions | Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="core-metrics-grid">
        <TimelineColumn
          digest={digest}
          totalMessages={totalMessages}
          svgSparklinePoints={svgSparklinePoints}
          svgSparklinePointsPath={svgSparklinePointsPath}
          svgSparklineAreaPath={svgSparklineAreaPath}
          language={language}
        />
        <DecisionsColumn
          digest={digest}
          filteredDecisions={filteredDecisions}
          onSelectDetail={setSelectedDetail}
          language={language}
        />
        <ActionItemsColumn
          filteredActionItems={filteredActionItems}
          filterOnlyIncompleteActionItems={filterOnlyIncompleteActionItems}
          onToggleFilter={() => setFilterOnlyIncompleteActionItems((p) => !p)}
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
        onClearMedia={() => { setMediaFile(null); setMediaBase64(null); }}
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
        filteredMessages={filteredMessages}
        totalMessages={totalMessages}
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
        onUpdateDetailSender={(sender) => setSelectedDetail((prev) => prev ? { ...prev, sender } : prev)}
        onUpdateDetailCompleted={(completed) => setSelectedDetail((prev) => prev ? { ...prev, completed } : prev)}
        onCommittingDecisionTextChange={(text) => setCommittingDecision((prev) => prev ? { ...prev, text } : prev)}
        onCommittingDecisionSenderChange={(sender) => setCommittingDecision((prev) => prev ? { ...prev, sender } : prev)}
        onCommittingDecisionDateChange={(dateStr) => setCommittingDecision((prev) => prev ? { ...prev, dateStr } : prev)}
        onReAudit={handleReAudit}
        onToggleContradictionPartDelete={handleToggleContradictionPartDelete}
        onConfirmCommitDecision={handleConfirmCommitDecision}
        onConfirmDeleteMedia={executeDeleteParsedMedia}
        onCancelDeleteMedia={() => setDeleteMediaId(null)}
      />
    </div>
  );
}
