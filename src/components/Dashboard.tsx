import React, { useState, useMemo } from 'react';
import { 
  FileText, Calendar, Users, MessageSquare, Download, CheckSquare, 
  TrendingUp, HelpCircle, Search, Clock, ArrowRight, CheckCircle2,
  AlertCircle, ChevronRight, ShieldCheck, Heart, Smile, Meh, Frown,
  Sparkles, Send, Loader2, X, Image, FileUp, FileAudio, Check, Trash2, PlusCircle, Edit2, RefreshCw,
  BookOpen, Bookmark
} from 'lucide-react';
import { ChatDigestData, ChatDecision, ActionItem, TimelineDataPoint, PlaybookPlay, PlaybookData } from '../types';
import { exportDigestToPdf, exportPlaybookToPdf } from '../lib/pdfExporter';
import ConfirmationModal from './ConfirmationModal';
import { Language, getTranslation } from '../lib/translations';

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

interface DashboardProps {
  digest: ChatDigestData;
  onUpdateActionItem: (actionItemId: string, completed: boolean) => void;
  onUpdateActionItemAssignee?: (actionItemId: string, assignee: string) => void;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export default function Dashboard({ digest, onUpdateActionItem, onUpdateActionItemAssignee, onSaveDigest, language }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterParticipant, setFilterParticipant] = useState<string | null>(null);
  const [filterOnlyIncompleteActionItems, setFilterOnlyIncompleteActionItems] = useState(false);

  // Gemini AI synthesis state variables
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Custom confirmation dialog state for parsed media items
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);

  // Gemini AI chat assistant state variables
  const [queryInput, setQueryInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // State for committing Gemini answer as a decision and checking conflicts
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
    parts: {
      partId: string;
      text: string;
      isContrary: boolean;
      explanation: string;
      shouldDelete: boolean;
    }[];
  }[]>([]);

  // Modal active state for clicked Action Items or Key Decisions
  const [selectedDetail, setSelectedDetail] = useState<{
    id: string;
    type: 'action' | 'decision';
    sender: string;
    text: string;
    dateStr: string;
    completed?: boolean;
  } | null>(null);

  // Executive 2-3 sentence summary state
  const [isGeneratingExecSummary, setIsGeneratingExecSummary] = useState(false);
  const [execSummaryError, setExecSummaryError] = useState<string | null>(null);
  const [isEditingExecSummary, setIsEditingExecSummary] = useState(false);
  const [editingExecSummaryText, setEditingExecSummaryText] = useState('');
  const generatingRef = React.useRef(false);
  const onSaveDigestRef = React.useRef(onSaveDigest);
  React.useEffect(() => {
    onSaveDigestRef.current = onSaveDigest;
  }, [onSaveDigest]);

  // AI Playbook states
  const [isGeneratingPlaybook, setIsGeneratingPlaybook] = useState(false);
  const [playbookError, setPlaybookError] = useState<string | null>(null);
  const [activePlayId, setActivePlayId] = useState<string | null>(null);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [editingPlayTitle, setEditingPlayTitle] = useState('');
  const [editingPlayCategory, setEditingPlayCategory] = useState('');
  const [editingPlayDescription, setEditingPlayDescription] = useState('');
  const [editingPlayStepsText, setEditingPlayStepsText] = useState(''); // newline-separated
  const [editingPlayTipsText, setEditingPlayTipsText] = useState(''); // newline-separated


  // Gemini Media Parser state variables
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [parsedMediaResult, setParsedMediaResult] = useState<{
    fileName: string;
    fileMimeType: string;
    description: string;
    decisions: any[];
    actionItems: any[];
  } | null>(null);

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaError(null);
      setParsedMediaResult(null);

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data URI prefix if present (Gemini SDK uses raw base64 data)
        const base64Content = result.split(',')[1] || result;
        setMediaBase64(base64Content);
      };
      reader.onerror = () => {
        setMediaError("Could not read file data.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeMedia = async () => {
    if (!mediaBase64 || !mediaFile) return;
    setMediaLoading(true);
    setMediaError(null);

    try {
      const response = await fetch('/api/parse-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: mediaFile.name,
          fileMimeType: mediaFile.type,
          fileBase64: mediaBase64,
          chatSummary: digest.summary,
          userPrompt: customPrompt.trim() || undefined,
          language
        })
      });

      if (!response.ok) {
        await handleResponseError(response, "Failed to analyze media file using Gemini.");
      }

      const data = await response.json();
      setParsedMediaResult({
        fileName: mediaFile.name,
        fileMimeType: mediaFile.type,
        description: data.description,
        decisions: data.decisions,
        actionItems: data.actionItems
      });

      // Clear current file selects
      setMediaFile(null);
      setMediaBase64(null);
      setCustomPrompt('');
    } catch (err: any) {
      setMediaError(err.message || "An unknown media query error occurred.");
    } finally {
      setMediaLoading(false);
    }
  };

  const handleMergeMediaIntoDigest = (mediaResult: {
    fileName: string;
    fileMimeType: string;
    description: string;
    decisions: any[];
    actionItems: any[];
  }) => {
    if (!mediaResult || !onSaveDigest) return;

    // Generate unique IDs
    const newDecisions = mediaResult.decisions.map((d, index) => ({
      id: `dec-m-${index}-${Date.now()}`,
      sender: d.sender || 'Group Attachment',
      text: d.text,
      dateStr: d.dateStr || new Date().toISOString().split('T')[0],
    }));

    const newActionItems = mediaResult.actionItems.map((a, index) => ({
      id: `act-m-${index}-${Date.now()}`,
      sender: a.sender || 'The Group',
      text: a.text,
      dateStr: a.dateStr || new Date().toISOString().split('T')[0],
      completed: false,
    }));

    const newMediaItem = {
      id: `media-${Date.now()}`,
      fileName: mediaResult.fileName,
      fileMimeType: mediaResult.fileMimeType,
      parsedAt: Date.now(),
      description: mediaResult.description,
      decisions: newDecisions,
      actionItems: newActionItems,
    };

    const currentMediaList = digest.parsedMedia || [];
    const updatedDigest: ChatDigestData = {
      ...digest,
      decisions: [...digest.decisions, ...newDecisions],
      actionItems: [...digest.actionItems, ...newActionItems],
      parsedMedia: [...currentMediaList, newMediaItem],
    };

    onSaveDigest(updatedDigest);
    setParsedMediaResult(null);
  };

  const handleDeleteParsedMedia = (mediaId: string) => {
    setDeleteMediaId(mediaId);
  };

  const executeDeleteParsedMedia = (mediaId: string) => {
    setDeleteMediaId(null);
    if (!onSaveDigest) return;

    const currentMediaList = digest.parsedMedia || [];
    const updatedDigest: ChatDigestData = {
      ...digest,
      parsedMedia: currentMediaList.filter((m) => m.id !== mediaId),
    };

    onSaveDigest(updatedDigest);
  };

  const handleSynthesize = async () => {
    if (isSynthesizing) return;
    setIsSynthesizing(true);
    setSynthesisError(null);

    try {
      const response = await fetch('/api/digest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: digest.fileName,
          fileSize: digest.fileSize,
          messages: digest.messages,
          language
        }),
      });

      if (!response.ok) {
        await handleResponseError(response, 'Server failed to analyze log with Gemini');
      }

      const geminiDigest = await response.json();

      // Merge beautiful Gemini analysis with deterministic local analytics
      const finalData: ChatDigestData = {
        ...digest,
        summary: geminiDigest.summary,
        keywords: geminiDigest.keywords,
        decisions: geminiDigest.decisions.map((d: any, i: number) => ({
          id: `dec-g-${i}-${Date.now()}`,
          sender: d.sender,
          text: d.text,
          dateStr: d.dateStr,
        })),
        actionItems: geminiDigest.actionItems.map((a: any, i: number) => ({
          id: `act-g-${i}-${Date.now()}`,
          sender: a.sender,
          text: a.text,
          dateStr: a.dateStr,
          completed: false,
        })),
      };

      if (onSaveDigest) {
        onSaveDigest(finalData);
      }
    } catch (err: any) {
      console.error(err);
      setSynthesisError(err.message || 'Error executing Gemini AI Synthesis. Please verify your GEMINI_API_KEY in the setup panel.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleInitiateCommit = async (text: string) => {
    // Strip bullet points, leading/trailing markdown characters or prefix is nice, but we can keep it as is or do a simple trim
    const cleanText = text.replace(/^-\s+/, '').replace(/^\*\s+/, '').trim();
    const initialDescObj = {
      text: cleanText,
      sender: 'Gemini AI',
      dateStr: new Date().toISOString().split('T')[0],
    };
    setCommittingDecision(initialDescObj);
    setIsAuditingContradictions(true);
    setAuditError(null);
    setContradictions([]);

    try {
      const response = await fetch('/api/check-contradictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDecisionText: cleanText,
          existingDecisions: digest.decisions,
          language
        }),
      });

      if (!response.ok) {
        await handleResponseError(response, 'Failed to audit ledger for contrary items.');
      }

      const responseJSON = await response.json();
      const rawContradictions = responseJSON.contradictions || [];

      const matchedContradictions = rawContradictions.map((raw: any) => {
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
            shouldDelete: !!p.isContrary,
          }))
        };
      });

      setContradictions(matchedContradictions);
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
        body: JSON.stringify({
          newDecisionText: updatedText,
          existingDecisions: digest.decisions,
          language
        }),
      });

      if (!response.ok) {
        await handleResponseError(response, 'Failed to re-audit ledger.');
      }

      const responseJSON = await response.json();
      const rawContradictions = responseJSON.contradictions || [];

      const matchedContradictions = rawContradictions.map((raw: any) => {
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
            shouldDelete: !!p.isContrary,
          }))
        };
      });

      setContradictions(matchedContradictions);
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
        // Keep decision as is
        finalDecisions.push(d);
      } else {
        // Iterate through all parts of the contrary decision
        contradiction.parts.forEach((p, index) => {
          if (!p.shouldDelete) {
            // Keep the non-contradictory part! Add it to the ledger as a singular commitment
            finalDecisions.push({
              id: `${d.id}-part-${p.partId || index}-${Date.now()}`,
              sender: d.sender,
              text: p.text,
              dateStr: d.dateStr,
            });
          }
        });
      }
    }

    finalDecisions.push(newDecisionObj);

    const updatedDigest: ChatDigestData = {
      ...digest,
      decisions: finalDecisions,
    };

    onSaveDigest(updatedDigest);
    setCommittingDecision(null);
    setContradictions([]);
  };

  const toggleContradictionPartDelete = (decisionId: string, partId: string) => {
    setContradictions((prev) =>
      prev.map((c) => {
        if (c.id !== decisionId) return c;
        return {
          ...c,
          parts: c.parts.map((p) =>
            p.partId === partId ? { ...p, shouldDelete: !p.shouldDelete } : p
          ),
        };
      })
    );
  };

  // Clear chat memory whenever the active backup file changes
  React.useEffect(() => {
    setChatHistory([]);
    setQueryInput('');
    setChatError(null);
  }, [digest.id]);

  // Keyboard Escape key to close details modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Generate the 2-3 sentence executive summary automatically if missing
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
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: digest.messages,
              language
            }),
          });
          if (!active) return;
          if (!response.ok) {
            await handleResponseError(response, 'Failed to auto-generate summary');
          }
          const data = await response.json();
          if (!active) return;
          if (data.executiveSummary && onSaveDigestRef.current) {
            const updatedDigest: ChatDigestData = {
              ...digest,
              executiveSummary: data.executiveSummary,
            };
            onSaveDigestRef.current(updatedDigest);
          }
        } catch (err: any) {
          console.error("Auto executive summary generation error:", err);
          if (active) {
            setExecSummaryError(err.message || "Failed to auto-generate summary.");
          }
        } finally {
          generatingRef.current = false;
          setIsGeneratingExecSummary(false);
        }
      };
      autoGenerate();
    }
    return () => {
      active = false;
    };
  }, [digest.id, digest.executiveSummary, digest.messages?.length]);

  const handleManualRegenerateExecSummary = async () => {
    generatingRef.current = true;
    setIsGeneratingExecSummary(true);
    setExecSummaryError(null);
    setIsEditingExecSummary(false);
    try {
      const response = await fetch('/api/executive-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: digest.messages,
          language
        }),
      });
      if (!response.ok) {
        await handleResponseError(response, 'Failed to regenerate executive summary');
      }
      const data = await response.json();
      if (data.executiveSummary && onSaveDigest) {
        const updatedDigest: ChatDigestData = {
          ...digest,
          executiveSummary: data.executiveSummary,
        };
        onSaveDigest(updatedDigest);
      }
    } catch (err: any) {
      console.error(err);
      setExecSummaryError(err.message || 'Failed to manually regenerate executive summary.');
    } finally {
      generatingRef.current = false;
      setIsGeneratingExecSummary(false);
    }
  };

  const handleStartEditExecSummary = () => {
    setEditingExecSummaryText(digest.executiveSummary || '');
    setIsEditingExecSummary(true);
  };

  const handleSaveExecSummaryEdit = () => {
    if (onSaveDigest) {
      const updatedDigest: ChatDigestData = {
        ...digest,
        executiveSummary: editingExecSummaryText,
      };
      onSaveDigest(updatedDigest);
    }
    setIsEditingExecSummary(false);
  };

  // Playbook Action Handlers
  const handleGeneratePlaybook = async () => {
    setIsGeneratingPlaybook(true);
    setPlaybookError(null);
    try {
      const response = await fetch('/api/playbook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decisions: digest.decisions,
          actionItems: digest.actionItems,
          language
        }),
      });

      if (!response.ok) {
        await handleResponseError(response, 'Failed to generate playbook');
      }

      const data = await response.json();
      if (data.playbook && onSaveDigest) {
        const updatedDigest: ChatDigestData = {
          ...digest,
          playbook: data.playbook,
        };
        onSaveDigest(updatedDigest);
        // Set first play active by default if there are plays
        if (data.playbook.plays && data.playbook.plays.length > 0) {
          setActivePlayId(data.playbook.plays[0].id);
        }
      }
    } catch (err: any) {
      console.error("AI Playbook generation error:", err);
      setPlaybookError(err.message || "Failed to compile Playbook with Gemini.");
    } finally {
      setIsGeneratingPlaybook(false);
    }
  };

  const handleStartEditPlay = (play: PlaybookPlay) => {
    setEditingPlayId(play.id);
    setEditingPlayTitle(play.title);
    setEditingPlayCategory(play.category);
    setEditingPlayDescription(play.description);
    setEditingPlayStepsText((play.steps || []).join('\n'));
    setEditingPlayTipsText((play.tips || []).join('\n'));
  };

  const handleSavePlayEdit = () => {
    if (!digest.playbook || !onSaveDigest) return;

    const updatedPlays = (digest.playbook.plays || []).map((p) => {
      if (p.id !== editingPlayId) return p;
      return {
        ...p,
        title: editingPlayTitle,
        category: editingPlayCategory,
        description: editingPlayDescription,
        steps: editingPlayStepsText.split('\n').map((s) => s.trim()).filter(Boolean),
        tips: editingPlayTipsText.split('\n').map((t) => t.trim()).filter(Boolean),
      };
    });

    const updatedDigest: ChatDigestData = {
      ...digest,
      playbook: {
        ...digest.playbook,
        plays: updatedPlays,
      },
    };

    onSaveDigest(updatedDigest);
    setEditingPlayId(null);
  };

  const handleDeletePlay = (playId: string) => {
    if (!digest.playbook || !onSaveDigest) return;

    const updatedPlays = (digest.playbook.plays || []).filter((p) => p.id !== playId);
    const updatedDigest: ChatDigestData = {
      ...digest,
      playbook: {
        ...digest.playbook,
        plays: updatedPlays,
      },
    };

    onSaveDigest(updatedDigest);
    if (activePlayId === playId) {
      setActivePlayId(updatedPlays.length > 0 ? updatedPlays[0].id : null);
    }
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

    const updatedDigest: ChatDigestData = {
      ...digest,
      playbook: {
        ...digest.playbook,
        plays: [...(digest.playbook.plays || []), newPlay],
      },
    };

    onSaveDigest(updatedDigest);
    setActivePlayId(newPlay.id);
    handleStartEditPlay(newPlay);
  };

  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || chatLoading) return;

    const userQuestion = queryInput.trim();
    setQueryInput('');
    setChatError(null);
    setChatLoading(true);

    const updatedHistory = [...chatHistory, { role: 'user', text: userQuestion }];
    setChatHistory(updatedHistory);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: digest.messages,
          decisions: digest.decisions,
          chatHistory: chatHistory,
          userQuestion: userQuestion,
          language
        }),
      });

      if (!response.ok) {
        await handleResponseError(response, 'Server failed to answer search query.');
      }

      const responseJSON = await response.json();
      setChatHistory((prev) => [...prev, { role: 'model', text: responseJSON.text }]);
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Error communicating with Gemini assistant.');
    } finally {
      setChatLoading(false);
    }
  };

  // Stats calculation
  const totalMessages = digest.messages.length;
  const participantCount = digest.participants.length;
  const startAndEnd = `${digest.startDateStr} - ${digest.endDateStr}`;

  const isHeuristicSummary = digest.summary.startsWith('This conversational thread spans from') || 
                             digest.summary.includes('comprising a total of');

  // Filter messages based on search query or selected participants
  const filteredMessages = useMemo(() => {
    return digest.messages.filter((msg) => {
      const matchesSearch = searchTerm 
        ? msg.text.toLowerCase().includes(searchTerm.toLowerCase()) || msg.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesParticipant = filterParticipant 
        ? msg.sender === filterParticipant 
        : true;
      return matchesSearch && matchesParticipant;
    });
  }, [digest.messages, searchTerm, filterParticipant]);

  // Dynamic filter for decisions
  const filteredDecisions = useMemo(() => {
    return digest.decisions.filter((dec) => {
      const matchesSearch = searchTerm 
        ? dec.text.toLowerCase().includes(searchTerm.toLowerCase()) || dec.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesParticipant = filterParticipant 
        ? dec.sender === filterParticipant 
        : true;
      return matchesSearch && matchesParticipant;
    });
  }, [digest.decisions, searchTerm, filterParticipant]);

  // Dynamic filter for action items
  const filteredActionItems = useMemo(() => {
    return digest.actionItems.filter((act) => {
      const matchesSearch = searchTerm 
        ? act.text.toLowerCase().includes(searchTerm.toLowerCase()) || act.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesParticipant = filterParticipant 
        ? act.sender === filterParticipant 
        : true;
      const matchesComplete = filterOnlyIncompleteActionItems 
        ? !act.completed 
        : true;
      return matchesSearch && matchesParticipant && matchesComplete;
    });
  }, [digest.actionItems, searchTerm, filterParticipant, filterOnlyIncompleteActionItems]);

  // Calculate sentiment totals for display
  const sentimentStats = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    
    digest.messages.forEach(m => {
      if (m.sentiment === 'positive') positive++;
      else if (m.sentiment === 'negative') negative++;
      else neutral++;
    });

    const total = totalMessages || 1;
    return {
      positive: Math.round((positive / total) * 100),
      negative: Math.round((negative / total) * 100),
      neutral: Math.round((neutral / total) * 100)
    };
  }, [digest.messages, totalMessages]);

  const handleExportPDF = () => {
    exportDigestToPdf(digest);
  };

  const handleExportPlaybookPDF = () => {
    exportPlaybookToPdf(digest);
  };

  // Build points for a gorgeous custom SVG trend path
  const svgSparklinePoints = useMemo(() => {
    const list = digest.timeline;
    if (list.length <= 1) return '';

    // Height range 100, Width range 500
    const paddingX = 25;
    const paddingY = 20;
    const chartWidth = 500 - (paddingX * 2);
    const chartHeight = 120 - (paddingY * 2);

    // X coordinates step values
    const stepX = chartWidth / (list.length - 1);
    
    // Y coordinates sentiment scores (from -1 to +1 map to height limits)
    // -1 goes to bottom (chartHeight + paddingY), +1 goes to top (paddingY)
    return list.map((node, i) => {
      const x = paddingX + i * stepX;
      // Normalizing avgSentiment from [-1, 1] to index.
      // -1 => height, 1 => 0. So normalized = (1 - val) / 2
      const normalizedValue = (1 - node.avgSentiment) / 2;
      const y = paddingY + normalizedValue * chartHeight;
      return { x, y };
    });
  }, [digest.timeline]);

  const svgSparklinePointsPath = useMemo(() => {
    if (svgSparklinePoints.length === 0) return '';
    return svgSparklinePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [svgSparklinePoints]);

  const svgSparklineAreaPath = useMemo(() => {
    if (svgSparklinePoints.length === 0) return '';
    const start = `M ${svgSparklinePoints[0].x} 100`;
    const line = svgSparklinePoints.map(p => `L ${p.x} ${p.y}`).join(' ');
    const end = `L ${svgSparklinePoints[svgSparklinePoints.length - 1].x} 100 Z`;
    return `${start} ${line} ${end}`;
  }, [svgSparklinePoints]);

  return (
    <div className="space-y-6" id="dashboard-root">
      
      {/* Dashboard Executive Header Control Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[#0F0F0F] rounded-xl border border-white/10 shadow-sm" id="dashboard-header-control">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/25 font-mono px-2 py-0.5 rounded-full font-semibold">Active Digest</span>
            <span className="text-slate-400 text-xs flex items-center gap-1 bg-white/5 px-2 py-0.5 border border-white/5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Synthesized with Gemini AI
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            {digest.title || digest.fileName}
          </h1>
          {digest.title && (
            <p className="text-[10px] text-gray-500 font-mono tracking-wider">
              FILE: {digest.fileName}
            </p>
          )}
          <p className="text-xs text-gray-400 font-light flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {startAndEnd}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              {participantCount} Speakers
            </span>
            <span className="flex items-center gap-1 font-mono">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              {totalMessages} Blocks
            </span>
          </p>
        </div>

        {/* PDF Export Button and Actions */}
        <div className="flex items-center gap-2.5 shrink-0" id="header-action-buttons">
          <button
            onClick={handleExportPDF}
            className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-sm transition-colors font-medium flex items-center justify-center gap-2"
            id="pdf-download-btn"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* 2-3 SENTENCE AI EXECUTIVE SUMMARY SNAPSHOT */}
      <div className="bg-gradient-to-r from-blue-950/15 via-[#11131a] to-blue-950/5 border border-blue-500/10 p-5 rounded-xl shadow-lg relative overflow-hidden text-left space-y-3.5 animate-fadeIn" id="ai-executive-snapshot-card">
        {/* Glow backdrop detail */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </span>
            <div>
              <span className="text-[10px] tracking-widest font-mono text-blue-400 uppercase font-semibold">Gemini AI Executive Briefing</span>
              <h3 className="text-xs font-bold text-gray-200 mt-0.5">Quick Conversation Snapshot</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditingExecSummary ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditingExecSummary(false)}
                  className="px-2.5 py-1 text-[10px] font-mono tracking-wider text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveExecSummaryEdit}
                  className="px-2.5 py-1 text-[10px] font-mono tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
              </>
            ) : (
              <>
                {digest.executiveSummary && (
                  <button
                    type="button"
                    onClick={handleStartEditExecSummary}
                    title="Edit summary manually"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={isGeneratingExecSummary}
                  onClick={handleManualRegenerateExecSummary}
                  title="Force regenerate of executive snapshot with Gemini"
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingExecSummary ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {isGeneratingExecSummary ? (
          <div className="py-4 flex items-center gap-3 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <div className="space-y-1.5 flex-1">
              <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">Synthesizing instant executive brief...</p>
              <div className="h-2.5 bg-white/5 rounded w-11/12" />
            </div>
          </div>
        ) : execSummaryError ? (
          <div className="text-xs text-orange-400 flex items-start gap-2 bg-orange-950/10 border border-orange-900/20 p-3 rounded">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-300">Brief Generation Interrupted</p>
              <p className="opacity-80 mt-0.5">{execSummaryError}</p>
            </div>
          </div>
        ) : isEditingExecSummary ? (
          <div className="space-y-2">
            <textarea
              rows={2}
              value={editingExecSummaryText}
              onChange={(e) => setEditingExecSummaryText(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-xs text-gray-250 placeholder-gray-550 focus:outline-none focus:border-blue-500/50 transition-colors select-text"
              placeholder="Edit the 2-3 sentence executive summary of the conversation..."
            />
            <p className="text-[9px] text-gray-500 font-mono tracking-wide leading-normal">Keep it strictly to 2 or 3 sentences to stay concise.</p>
          </div>
        ) : (
          <div className="relative">
            <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-light italic pl-4 border-l-2 border-blue-500/30 select-text">
              "{digest.executiveSummary || "No executive summary available yet. Click the refresh button to generate one."}"
            </p>
          </div>
        )}
      </div>

      {/* AI PLAYBOOK COMPILER BLUEPRINT */}
      <div className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-lg relative overflow-hidden text-left space-y-4 animate-fadeIn" id="ai-operational-playbook-section">
        {/* Decorative ambient decoration */}
        <div className="absolute top-0 right-0 w-80 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <span className="text-[10px] tracking-widest font-mono text-indigo-400 uppercase font-semibold">Strategic Blueprint</span>
              <h2 className="text-sm font-bold text-gray-150 mt-0.5">{getTranslation('btnCreatePlaybook', language)}</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {digest.playbook ? (
              <>
                <button
                  type="button"
                  onClick={handleExportPlaybookPDF}
                  className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Export Playbook as PDF"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleAddPlay}
                  className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                  Add Manual Play
                </button>
                <button
                  type="button"
                  disabled={isGeneratingPlaybook}
                  onClick={handleGeneratePlaybook}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPlaybook ? 'animate-spin' : ''}`} />
                  Regenerate with AI
                </button>
              </>
            ) : null}
          </div>
        </div>

        {isGeneratingPlaybook ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-white/10 rounded-xl bg-[#0A0A0A]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <div className="space-y-1.5 max-w-sm">
              <p className="text-xs text-gray-200 font-mono uppercase tracking-widest font-semibold">Sensing strategic commitments...</p>
              <p className="text-xs text-gray-450 leading-normal font-light">
                Gemini AI is parsing the ledger decisions and action items to map tech stacks, schedules, governance rules, and runbook streams.
              </p>
            </div>
          </div>
        ) : playbookError ? (
          <div className="p-4 bg-orange-950/10 border border-orange-900/30 rounded-xl text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
              <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
              <span>Compilation Interrupted</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed pr-2">{playbookError}</p>
            <button
              onClick={handleGeneratePlaybook}
              className="mt-2 text-xs font-mono font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4 cursor-pointer"
            >
              Retry Playbook construction
            </button>
          </div>
        ) : !digest.playbook ? (
          <div className="py-10 px-6 border border-dashed border-white/10 rounded-xl bg-[#0b0b0e]/40 flex flex-col md:flex-row items-center gap-6 justify-between text-left">
            <div className="space-y-2 flex-1 max-w-xl">
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full text-[10px] font-mono border border-indigo-500/15 uppercase tracking-wider font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Ledger Sync Integration
              </div>
              <h3 className="text-sm font-bold text-gray-200 font-sans">{getTranslation('convertPlaybookTitle', language)}</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-light">
                {getTranslation('convertPlaybookDesc', language)}
              </p>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handleGeneratePlaybook}
                className="w-full md:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/10 text-white rounded-xl text-xs font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-indigo-500/25 shadow-md font-mono"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {getTranslation('btnCreatePlaybook', language).toUpperCase()}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            {/* Playbook Roadmap Overview */}
            <div className="p-4 bg-[#0A0A0A] border border-white/5 rounded-xl relative overflow-hidden flex items-start gap-4" id="playbook-overview-card">
              <div className="absolute right-0 bottom-0 pointer-events-none opacity-5">
                <Bookmark className="w-32 h-32 text-indigo-400" />
              </div>
              <span className="p-1 px-1.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-mono border border-indigo-500/15 uppercase tracking-wide font-bold mt-0.5 shrink-0">Overview</span>
              <p className="text-xs md:text-sm text-gray-350 leading-relaxed select-text font-sans">
                {digest.playbook.overview}
              </p>
            </div>

            {/* Main Plays Board */}
            {(!digest.playbook.plays || digest.playbook.plays.length === 0) ? (
              <div className="py-8 text-center border border-white/5 rounded-lg text-gray-500 text-xs bg-[#0A0A0A]">
                No operational plays defined. Click "Add Manual Play" or "Regenerate with AI" to construct them.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5" id="plays-board-main">
                {/* Plays Index Roster List (Left) */}
                <div className="md:col-span-4 space-y-2 max-h-[420px] overflow-y-auto pr-1 select-none flex flex-col gap-1.5" id="plays-sidebar-list">
                  <div className="text-[9px] uppercase font-mono tracking-widest font-bold px-2 py-1 text-indigo-400 bg-indigo-500/5 rounded border border-indigo-500/10 self-start">
                    Plays Chapters Roster
                  </div>
                  {(digest.playbook.plays || []).map((play) => {
                    const isActive = play.id === activePlayId;
                    return (
                      <button
                        key={play.id}
                        type="button"
                        onClick={() => {
                          setActivePlayId(play.id);
                          if (editingPlayId !== play.id) {
                            setEditingPlayId(null);
                          }
                        }}
                        className={`w-full p-3 rounded-xl border text-left transition-all relative flex flex-col gap-1 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-950/15 border-indigo-500/35 text-white shadow-xl ring-1 ring-indigo-500/20'
                            : 'bg-[#0A0A0A]/40 border-white/5 text-gray-400 hover:border-white/15 hover:text-gray-200'
                        }`}
                      >
                        <span className={`text-[8px] uppercase tracking-widest font-mono font-bold px-1.5 py-0.5 rounded self-start ${
                          isActive 
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' 
                            : 'bg-white/5 text-gray-500 border border-transparent'
                        }`}>
                          {play.category || 'General'}
                        </span>
                        <h4 className="text-xs font-semibold leading-relaxed tracking-wide mt-1.5">
                          {play.title}
                        </h4>
                      </button>
                    );
                  })}
                </div>

                {/* Play Details Board (Right) */}
                <div className="md:col-span-8 bg-[#0a0a0d] border border-white/5 rounded-xl p-5 relative min-h-[340px] flex flex-col justify-between" id="plays-details-board">
                  {(() => {
                    const activePlay = (digest.playbook?.plays || []).find((p) => p.id === activePlayId) || (digest.playbook?.plays || [])[0];
                    if (!activePlay) {
                      return (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs py-12 font-mono">
                          SELECT A PLAY FROM THE COLUMN ROSTER INDEX
                        </div>
                      );
                    }

                    const isEditing = editingPlayId === activePlay.id;

                    if (isEditing) {
                      return (
                        <div className="space-y-4 flex-1 text-xs text-left animate-fadeIn">
                          <div className="flex items-center justify-between pb-2 border-b border-white/5">
                            <span className="text-[10px] font-mono tracking-widest font-bold text-indigo-400 uppercase">🛠️ Modifying Play Chapter</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingPlayId(null)}
                                className="px-2.5 py-1 font-mono text-[9px] tracking-wide text-gray-400 bg-white/5 border border-white/5 rounded hover:text-white transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSavePlayEdit}
                                className="px-2.5 py-1 font-mono text-[9px] tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:text-emerald-300 flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Play Title</label>
                                <input
                                  type="text"
                                  value={editingPlayTitle}
                                  onChange={(e) => setEditingPlayTitle(e.target.value)}
                                  className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/50"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Category Tag</label>
                                <input
                                  type="text"
                                  value={editingPlayCategory}
                                  onChange={(e) => setEditingPlayCategory(e.target.value)}
                                  className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/50"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Rationale & Action Description</label>
                              <textarea
                                rows={3}
                                value={editingPlayDescription}
                                onChange={(e) => setEditingPlayDescription(e.target.value)}
                                className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/50 leading-relaxed font-light"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Tactical Steps (one per line)</label>
                                <textarea
                                  rows={5}
                                  value={editingPlayStepsText}
                                  onChange={(e) => setEditingPlayStepsText(e.target.value)}
                                  className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-500/50"
                                  placeholder="Step 1&#10;Step 2&#10;Step 3"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Strategic Tips (one per line)</label>
                                <textarea
                                  rows={5}
                                  value={editingPlayTipsText}
                                  onChange={(e) => setEditingPlayTipsText(e.target.value)}
                                  className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-500/50"
                                  placeholder="Pro-Tip 1&#10;Pro-Tip 2"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4 text-left flex-1 flex flex-col justify-between animate-fadeIn">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2.5">
                            <div>
                              <span className="text-[9px] uppercase tracking-widest font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15">
                                {activePlay.category || 'General'}
                              </span>
                              <h3 className="text-sm md:text-base font-bold text-gray-150 leading-tight mt-1.5 select-text">
                                {activePlay.title}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditPlay(activePlay)}
                                className="p-1 px-2 text-[10px] font-mono border border-white/10 bg-white/5 rounded text-gray-400 hover:text-white transition-all cursor-pointer"
                                title="Edit Playbook Chapter"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePlay(activePlay.id)}
                                className="p-1 px-2 text-[10px] font-mono border border-rose-500/10 bg-rose-500/5 rounded text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                                title="Remove this play"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-light italic select-text pl-3 border-l-2 border-indigo-500/35">
                            "{activePlay.description}"
                          </p>

                          <div className="space-y-4 mt-5">
                            {/* Execution Tasks */}
                            <div className="space-y-2">
                              <p className="text-[10px] uppercase font-mono tracking-widest text-[#a1a1aa] font-bold">🎯 Sequence Execution Steps Checkpoints</p>
                              <div className="space-y-2 pl-1.5">
                                {activePlay.steps && activePlay.steps.length > 0 ? (
                                  activePlay.steps.map((st, sidx) => (
                                    <div key={sidx} className="flex items-start gap-2 text-xs group">
                                      {/* Interactive checklist indicator details */}
                                      <span className="text-indigo-400 font-mono text-[10px] font-extrabold bg-indigo-500/10 h-5 w-5 flex items-center justify-center rounded border border-indigo-500/20 shrink-0 mt-0.5 shadow-inner">
                                        {sidx + 1}
                                      </span>
                                      <p className="text-gray-300 leading-normal pt-0.5 select-text font-sans font-light">
                                        {st}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-500 italic pl-2">No sequence steps defined.</span>
                                )}
                              </div>
                            </div>

                            {/* Expert Advice / Tips */}
                            <div className="space-y-2 mt-5 pt-4 border-t border-white/5">
                              <p className="text-[10px] uppercase font-mono tracking-widest text-[#a1a1aa] font-bold">💡 Strategic Architecture Runbook Advice</p>
                              <div className="space-y-2 pl-1">
                                {activePlay.tips && activePlay.tips.length > 0 ? (
                                  activePlay.tips.map((tp, tidx) => (
                                    <div key={tidx} className="flex items-start gap-2.5 text-xs text-slate-350 select-text bg-[#030303]/40 p-3 rounded-lg border border-white/5 leading-relaxed font-light">
                                      <Sparkles className="w-3.5 h-3.5 text-yellow-500/70 shrink-0 mt-0.5 animate-pulse" />
                                      <p className="leading-relaxed">
                                        {tp}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-500 italic pl-1">No pro tips documented.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
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
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>

        {/* Participant Selectors */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 pr-1" id="speaker-filter-list">
          <span className="text-xs text-gray-500 font-light shrink-0">Speaker:</span>
          <button
            onClick={() => setFilterParticipant(null)}
            className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all shrink-0 ${
              filterParticipant === null
                ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
            }`}
          >
            All Contributors
          </button>
          {digest.participants.slice(0, 5).map((name) => (
            <button
              key={name}
              onClick={() => setFilterParticipant(name === filterParticipant ? null : name)}
              className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all truncate shrink-0 max-w-[120px] ${
                name === filterParticipant
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                  : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
              }`}
            >
              {name}
            </button>
          ))}
          {digest.participants.length > 5 && (
            <div className="text-[10px] text-slate-500 font-light shrink-0 self-center pl-1">
              +{digest.participants.length - 5} more
            </div>
          )}
        </div>
      </div>

      {/* AUTOMATED SUMMARY ENGINE PANEL */}
      <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-xl relative overflow-hidden animate-fadeIn" id="summary-panel">
        <div className="flex items-center justify-between gap-4 mb-4 border-b border-white/5 pb-4 animate-fadeIn" id="summary-panel-header">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-widest">Premium Executive summary</h3>
              <p className="text-[10px] uppercase text-slate-400 tracking-wider font-mono">Gemini AI Executive Synthesis</p>
            </div>
          </div>

          {!isHeuristicSummary && !isSynthesizing && (
            <button
              onClick={handleSynthesize}
              title="Re-run Gemini AI synthesis on this conversation"
              className="text-[10px] uppercase font-mono px-3 py-1.5 bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 border border-white/5 hover:border-white/10 rounded flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
              Re-Synthesize
            </button>
          )}
        </div>

        {isSynthesizing ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 animate-infinite" />
            <div>
              <p className="text-sm font-semibold text-white animate-pulse">Synthesizing Chat with Gemini 3.5...</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-md mx-auto font-light leading-relaxed">This will analyze the entire timeline, tracking participant sentiments and extracting custom decision items.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Narrative Box */}
            <div className="relative z-10 animate-fadeIn" id="summary-narrative-box">
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed select-text whitespace-pre-wrap font-light">
                {/* Bold highlight syntax wrapper helper */}
                {digest.summary.split('**').map((substring, i) => {
                  if (i % 2 === 1) {
                    return (
                      <strong key={i} className="font-semibold text-blue-400">
                        {substring}
                      </strong>
                    );
                  }
                  return substring;
                })}
              </p>
            </div>

            {isHeuristicSummary && (
              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/25 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn text-left">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Using Offline Word-Counting Heuristic</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-light leading-relaxed">
                      This summary was generated using local word-counting heuristics. Activate Gemini AI to get deep interactive insights, action items, and topic tagging.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSynthesize}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 duration-100"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Synthesize with Gemini
                </button>
              </div>
            )}

            {synthesisError && (
              <div className="mt-4 p-4 bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs rounded-lg flex items-start gap-3 text-left animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-200">Gemini Synthesis Failed</p>
                  <p className="font-light">{synthesisError}</p>
                </div>
              </div>
            )}

            {/* Keywords cluster bar */}
            <div className="mt-5 pt-4.5 border-t border-white/5 flex flex-wrap items-center gap-2 animate-fadeIn" id="keywords-cluster">
              <span className="text-[10px] text-gray-505 uppercase tracking-widest font-mono">Principal Focus:</span>
              {digest.keywords.map((word) => (
                <span
                  key={word}
                  className="text-[11px] font-mono px-2.5 py-1 bg-[#0A0A0A] text-blue-400 rounded border border-white/5 transition-transform duration-200 hover:-translate-y-0.5 cursor-default hover:border-white/10"
                >
                  #{word}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* GEMINI MULTIMODAL MEDIA ANALYZER */}
      <div className="p-6 bg-[#121212] border border-white/5 rounded-xl hover:border-white/10 transition-all duration-200 mb-6 animate-fadeIn" id="multimodal-media-analyzer">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Image className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Multimodal Media Analyzer</h3>
              <p className="text-[10px] uppercase text-gray-400 tracking-wider font-mono">Parse images, audio, and documents with Gemini AI</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono bg-[#0A0A0A] text-gray-500 px-2 py-0.5 rounded border border-white/5 self-start sm:self-center">
            Omni-media Beta
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="media-analyzer-workspace">
          {/* LEFT COLUMN: Upload and Prompt */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-xs text-gray-400 leading-relaxed font-light">
              Upload images, voice notes, drawing sketches, or document PDFs shared during discussions. Gemini will analyze the media directly in the context of your conversation backup themes.
            </div>

            {/* File drop zone box */}
            <div className="relative border border-dashed border-white/10 hover:border-white/20 transition-all rounded-lg p-5 bg-[#0A0A0A] text-center" id="media-file-dropzone">
              <input
                type="file"
                accept="image/*,audio/*,application/pdf"
                onChange={handleMediaFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 font-sans"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-2.5 bg-white/5 text-gray-405 rounded-full border border-white/5">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300">
                    {mediaFile ? mediaFile.name : "Select Media Attachment"}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {mediaFile ? `${(mediaFile.size / 1024).toFixed(1)} KB • ${mediaFile.type}` : "Drag and drop Images, Audio, or PDFs (max 15MB)"}
                  </p>
                </div>
              </div>
            </div>

            {/* ZIP attachments roster catalog if available on this digest */}
            {digest.zipAttachments && digest.zipAttachments.length > 0 && (
              <div className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg space-y-2" id="zip-attachments-deck">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-bold">Files Extracted from Backup ZIP ({digest.zipAttachments.length})</span>
                  <span className="text-[8px] uppercase tracking-widest font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/15">Attachment Deck</span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  {digest.zipAttachments.map((item, idx) => {
                    const isSelected = mediaFile && mediaFile.name === item.name;
                    const FileIcon = item.mimeType.startsWith('image/')
                      ? Image
                      : item.mimeType.startsWith('audio/')
                      ? FileAudio
                      : FileText;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setMediaFile({
                            name: item.name,
                            type: item.mimeType,
                            size: item.size
                          } as any);
                          setMediaBase64(item.base64);
                          setMediaError(null);
                        }}
                        className={`p-1.5 rounded border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-blue-300 animate-pulse'
                            : 'bg-[#121212] border-white/5 hover:border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className={`p-1 rounded shrink-0 ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
                          <FileIcon className="w-3 h-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium truncate leading-tight">{item.name}</p>
                          <p className="text-[9px] text-gray-500 font-mono">{(item.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If file is uploaded, show prompt and analyze button */}
            {mediaFile && (
              <div className="space-y-3 bg-[#0A0A0A] p-3 border border-white/5 rounded-lg animate-fadeIn">
                {/* Visual Preview element if we have base64 */}
                {mediaBase64 && (
                  <div className="flex flex-col items-center justify-center p-2.5 bg-[#121212] rounded border border-white/5 space-y-2">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[9px] text-gray-500 font-mono uppercase">Media Preview</span>
                      <button 
                        onClick={() => {
                          setMediaFile(null);
                          setMediaBase64(null);
                          setMediaError(null);
                        }}
                        className="text-[9px] hover:text-red-400 text-gray-500 flex items-center gap-0.5"
                      >
                        <X className="w-2.5 h-2.5" /> Clear
                      </button>
                    </div>
                    {mediaFile.type.startsWith('image/') ? (
                      <img
                        src={`data:${mediaFile.type};base64,${mediaBase64}`}
                        alt={mediaFile.name}
                        className="max-h-36 object-contain rounded border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : mediaFile.type.startsWith('audio/') ? (
                      <audio
                        src={`data:${mediaFile.type};base64,${mediaBase64}`}
                        controls
                        className="w-full max-w-xs h-8 rounded opacity-90"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <span className="truncate max-w-[180px]">{mediaFile.name}</span>
                      </div>
                    )}
                  </div>
                )}

                <label className="block text-[11px] font-mono text-gray-400 uppercase tracking-wider">Analysis Target / Custom Instructions (Optional)</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Explain what to analyze (e.g., 'Who approved this dashboard diagram?', 'Provide a full transcript of this audio snippet', 'Summarize this file requirements...')"
                  rows={2}
                  className="w-full text-xs bg-[#121212] border border-white/5 rounded p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
                />
                
                <button
                  onClick={handleAnalyzeMedia}
                  disabled={mediaLoading}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/30 text-white font-semibold text-xs tracking-wide uppercase rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                >
                  {mediaLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Decomposing Media...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Analyze with Gemini Flash
                    </>
                  )}
                </button>
              </div>
            )}

            {mediaLoading && (
              <div className="p-3 bg-blue-950/10 border border-blue-900/30 text-blue-300 text-[11px] rounded-lg space-y-1.5 animate-pulse font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                  <span>Synthesizing Multimodal Nodes...</span>
                </div>
                <p className="text-[10px] text-gray-400 font-sans font-light">
                  Gemini is linking image entities, decoding conversational structures, or transcribing sound streams with relation to the chat logs. This takes about 3-8 seconds.
                </p>
              </div>
            )}

            {mediaError && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-300 text-xs rounded-lg flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-200">Media Analysis Failure</p>
                  <p className="font-light text-[11px] mt-0.5 text-gray-400">{mediaError}</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Active parsing result OR parsed media history */}
          <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between min-h-[220px]" id="media-results-panel">
            {parsedMediaResult ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Analyzed Successfully
                  </span>
                  <button
                    onClick={() => handleMergeMediaIntoDigest(parsedMediaResult)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Commit Extracted Items & Log File
                  </button>
                </div>

                <div className="bg-[#0A0A0A] p-4.5 rounded-lg border border-white/5 space-y-3.5 max-h-[360px] overflow-y-auto custom-scrollbar" id="latest-analysis-details">
                  <div>
                    <h4 className="text-[10px] uppercase font-mono text-gray-500 tracking-wider">File Metadata</h4>
                    <p className="text-xs font-semibold text-gray-300 mt-0.5">{parsedMediaResult.fileName} ({parsedMediaResult.fileMimeType})</p>
                  </div>

                  <div>
                    <h4 className="text-[10px] uppercase font-mono text-gray-500 tracking-wider">Multimodal Narrative</h4>
                    <div className="text-xs text-gray-300 leading-relaxed font-light mt-1.5 prose prose-invert max-w-none">
                      {parsedMediaResult.description.split('\n\n').map((para, idx) => (
                        <p key={idx} className="mb-2.5">
                          {para.split('**').map((tok, ti) => ti % 2 === 1 ? <strong key={ti} className="text-blue-400 font-semibold">{tok}</strong> : tok)}
                        </p>
                      ))}
                    </div>
                  </div>

                  {parsedMediaResult.decisions.length > 0 && (
                    <div className="border-t border-white/5 pt-3">
                      <h4 className="text-[10px] uppercase font-mono text-emerald-405 tracking-wider mb-2 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Latent Decisions Found ({parsedMediaResult.decisions.length})
                      </h4>
                      <ul className="space-y-1.5 text-xs">
                        {parsedMediaResult.decisions.map((dec, i) => (
                          <li key={i} className="flex gap-2 items-start bg-[#121212] p-2 rounded border border-white/5">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded shrink-0">{dec.sender || 'Sender'}</span>
                            <span className="text-gray-300 font-light">{dec.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsedMediaResult.actionItems.length > 0 && (
                    <div className="border-t border-white/5 pt-3">
                      <h4 className="text-[10px] uppercase font-mono text-blue-400 tracking-wider mb-2 font-bold flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                        Latent Actions Found ({parsedMediaResult.actionItems.length})
                      </h4>
                      <ul className="space-y-1.5 text-xs">
                        {parsedMediaResult.actionItems.map((act, i) => (
                          <li key={i} className="flex gap-2 items-start bg-[#121212] p-2 rounded border border-white/5">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded shrink-0">{act.sender || 'Group'}</span>
                            <span className="text-gray-300 font-light">{act.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between space-y-4">
                <div>
                  <h4 className="text-[10px] uppercase font-mono text-gray-500 tracking-wider mb-2">Parsed Media Ledger History</h4>
                  
                  {(!digest.parsedMedia || digest.parsedMedia.length === 0) ? (
                    <div className="h-44 flex flex-col justify-center items-center p-4 bg-[#0A0A0A] border border-white/5 rounded-lg text-center text-xs text-gray-500 italic font-light space-y-2">
                      <Image className="w-5 h-5 text-gray-750 animate-pulse" />
                      <p className="max-w-xs leading-relaxed">No media attachments have been parsed yet. Upload shared drawing schemas, sound tracks, or invoices to run auditing.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10" id="media-history-scrollable">
                      {digest.parsedMedia.map((media) => (
                        <div key={media.id} className="p-3 bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition-colors rounded-lg flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/10 font-bold max-w-64 truncate">
                                {media.fileName}
                              </span>
                              <span className="text-[9px] text-gray-500 font-mono">
                                {new Date(media.parsedAt).toLocaleString()}
                              </span>
                            </div>
                            
                            <div className="text-[11px] text-gray-400 line-clamp-2 font-light leading-relaxed">
                              {media.description}
                            </div>

                            <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-500 font-mono">
                              <span>Decisions: <strong className="text-emerald-400 font-bold">{media.decisions?.length || 0}</strong></span>
                              <span>•</span>
                              <span>Tasks: <strong className="text-blue-400 font-bold">{media.actionItems?.length || 0}</strong></span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteParsedMedia(media.id)}
                            className="p-1.5 text-gray-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/5 rounded transition-all cursor-pointer shadow-sm"
                            title="Delete file audit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-gray-600 font-mono border-t border-white/5 pt-3 flex items-center gap-1.5 justify-end">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
                  Assets analyzed server-side. Local data is sandbox-persisted offline.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CORE THREE COLUMN SEGMENTED LAYOUT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="three-column-grid">
        
        {/* ================= COLUMN 1: TIMELINE GRID ================= */}
        <div className="lg:col-span-4 bg-[#121212] rounded-xl border border-white/5 p-5 flex flex-col h-[540px] hover:border-white/10 transition-colors" id="column-timeline-grid">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/5 text-blue-400 rounded-lg border border-white/10">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">{getTranslation('tabTimeline', language)}</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-gray-400 rounded-full border border-white/5">
              {digest.timeline.length} peaks
            </span>
          </div>

          {/* Sparkline trend overlay */}
          <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 mb-4 shrink-0" id="sparkline-trend-card">
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-2 font-mono">
              <span className="flex items-center gap-1.5 font-sans font-medium text-gray-305">
                Sentiment Trends Sparkline
              </span>
              <span className="text-[9px] uppercase tracking-wider text-gray-500">Chronological Wave</span>
            </div>

            {digest.timeline.length <= 1 ? (
              <div className="h-16 flex items-center justify-center text-center text-[10px] text-gray-500 italic pb-2">
                Not enough data nodes to chart sentiment trends
              </div>
            ) : (
              <div className="relative" id="trend-canvas-container">
                <svg
                  viewBox="0 0 500 120"
                  className="w-full h-18 text-blue-500"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Horizontal axis baseline */}
                  <line x1="10" y1="60" x2="490" y2="60" stroke="#222" strokeWidth="0.8" strokeDasharray="3,3" />

                  {/* Gradient Area Fill */}
                  <path d={svgSparklineAreaPath} fill="url(#chartGradient)" />

                  {/* Primary Wave Line */}
                  <path
                    d={svgSparklinePointsPath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Node Anchor Points */}
                  {svgSparklinePoints.map((point, index) => {
                    const originalNode = digest.timeline[index];
                    let pointColor = '#3b82f6'; // Neutral
                    if (originalNode.avgSentiment > 0.1) pointColor = '#10b981'; // Positive Emerald
                    if (originalNode.avgSentiment < -0.1) pointColor = '#f43f5e'; // Negative Rose

                    return (
                      <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r="3.5"
                        fill="#0A0A0A"
                        stroke={pointColor}
                        strokeWidth="1.5"
                        className="transition-transform hover:scale-150 cursor-pointer"
                      >
                        <title>{`${originalNode.dateStr}: Sentiment ${originalNode.avgSentiment} (${originalNode.messageCount} msgs)`}</title>
                      </circle>
                    );
                  })}
                </svg>

                {/* Legend indicator labels */}
                <div className="flex justify-between items-center mt-2 pt-1 border-t border-[#222] text-[9px] text-gray-500 font-mono">
                  <span>Start ({digest.startDateStr.split(',')[0]})</span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Positive
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full ml-1"></span> Negative
                  </span>
                  <span>End ({digest.endDateStr.split(',')[0]})</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Timeline Grid Nodes list */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" id="timeline-chronological-list">
            {digest.timeline.map((node) => {
              const sentimentPercentage = node.avgSentiment;
              let sentimentText = 'Fine / Equal';
              let sentimentColorClass = 'text-gray-400 bg-white/5 border-white/10';
              let SentimentIcon = Meh;

              if (sentimentPercentage > 0.12) {
                sentimentText = 'Positive';
                sentimentColorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                SentimentIcon = Smile;
              } else if (sentimentPercentage < -0.12) {
                sentimentText = 'Constructive';
                sentimentColorClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                SentimentIcon = Frown;
              }

              return (
                <div 
                  key={node.dateStr}
                  className="p-3 bg-white/3 rounded-lg border border-white/5 relative hover:border-white/10 transition-colors"
                >
                  {/* Left decorative color slider anchor */}
                  <div className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-md ${
                    sentimentPercentage > 0.12 ? 'bg-emerald-500/70' : sentimentPercentage < -0.12 ? 'bg-rose-500/70' : 'bg-gray-600/70'
                  }`}></div>

                  <div className="flex justify-between items-start pl-2 mb-2">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-200">{node.dateStr}</h4>
                      <p className="text-[10px] text-gray-550 mt-0.5 leading-none">
                        Peak speaker: <span className="font-semibold text-blue-400">{node.topSender}</span>
                      </p>
                    </div>

                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${sentimentColorClass}`}>
                      <SentimentIcon className="w-2.5 h-2.5" />
                      {sentimentText}
                    </div>
                  </div>

                  {/* Small progress meter of conversation depth */}
                  <div className="space-y-1 pl-2">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      <span>Message Volume</span>
                      <span className="font-semibold text-gray-300">{node.messageCount} msg</span>
                    </div>
                    <div className="w-full bg-[#0A0A0A] h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (node.messageCount / totalMessages) * 250)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= COLUMN 2: KEY DECISIONS ARRAY ================= */}
        <div className="lg:col-span-4 bg-[#121212] rounded-xl border border-white/5 p-5 flex flex-col h-[540px] hover:border-white/10 transition-colors" id="column-decisions-grid">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/5 text-emerald-400 rounded-lg border border-white/10">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">{getTranslation('keyDecisions', language)}</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-emerald-400 rounded-full border border-white/5">
              {filteredDecisions.length} recorded
            </span>
          </div>

          {/* Helper alert block */}
          <div className="p-2.5 bg-[#0A0A0A] border border-white/10 rounded mb-4 text-[10px] text-gray-500 leading-normal shrink-0 flex items-start gap-1.5 font-light">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-blue-400 shrink-0" />
            <span>Highlights moments demonstrating formal validation, consensus markers, or resolution agreements like <b className="text-gray-300 font-normal">"agreed"</b> or <b className="text-gray-300 font-normal">"deal."</b></span>
          </div>

          {/* Decisions List Container */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1" id="decisions-array-list">
            {filteredDecisions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500" id="empty-decisions">
                <p className="text-xs italic">No consensus markers matched</p>
                <p className="text-[10px] text-gray-600 mt-1 max-w-[200px] leading-relaxed">
                  Try typing basic agreement phrases in chat or widening your speaker constraints.
                </p>
              </div>
            ) : (
              filteredDecisions.map((dec) => (
                <div
                  key={dec.id}
                  onClick={() => setSelectedDetail({
                    id: dec.id,
                    type: 'decision',
                    sender: dec.sender,
                    text: dec.text,
                    dateStr: dec.dateStr
                  })}
                  className="p-3.5 bg-[#0A0A0A] rounded border border-white/5 relative hover:border-white/10 hover:bg-white/3 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2 font-light pb-2 border-b border-white/5">
                    <span className="font-semibold text-gray-300 group-hover:text-blue-400 transition-colors">{dec.sender}</span>
                    <span>{dec.dateStr}</span>
                  </div>

                  <p className="text-xs font-light text-gray-300 leading-relaxed italic pr-5 line-clamp-3">
                    "{dec.text}"
                  </p>

                  <div className="absolute right-3.5 bottom-3 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4 shadow-sm" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: ACTION ITEM TRACKER ================= */}
        <div className="lg:col-span-4 bg-[#121212] rounded-xl border border-white/5 p-5 flex flex-col h-[540px] hover:border-white/10 transition-colors" id="column-action-items">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/5 text-blue-400 rounded-lg border border-white/10">
                <CheckSquare className="w-4 h-4" />
              </div>
              <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">{getTranslation('tabActionItems', language)}</h3>
            </div>
            
            {/* Filter checkboxes */}
            <button
              onClick={() => setFilterOnlyIncompleteActionItems(!filterOnlyIncompleteActionItems)}
              className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                filterOnlyIncompleteActionItems
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/45'
                  : 'bg-[#0A0A0A] text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              {filterOnlyIncompleteActionItems ? (language === 'nl' ? 'Openstaande taken' : 'Pending Tasks') : (language === 'nl' ? 'Alle taken' : 'All Tasks')}
            </button>
          </div>

          {/* Local Status Alert */}
          <div className="p-2.5 bg-[#0A0A0A] border border-white/10 rounded mb-4 text-[10px] text-gray-500 leading-normal shrink-0 flex flex-col gap-2 font-light" id="action-tracker-tip">
            <span className="flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Checking off items updates the local <b className="text-gray-350 font-normal">IndexedDB database</b> instance instantly and permanently.</span>
            </span>
            <span className="flex items-start gap-1.5 pt-1.5 border-t border-white/5">
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Tasks assigned to <b className="text-amber-400 font-semibold">Group / Unassigned</b> haven't been assigned to a person yet. Click on any task to assign it!</span>
            </span>
          </div>

          {/* Action List Section */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" id="action-items-checklist-container">
            {filteredActionItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500" id="empty-actions">
                <p className="text-xs italic">No follow-ups identified</p>
                <p className="text-[10px] text-gray-650 mt-1 max-w-[200px] leading-relaxed">
                  We look for expressions of action, e.g. <b className="text-[#a1a1aa] font-medium">"I will send reports"</b> or direct Todo assignments.
                </p>
              </div>
            ) : (
              filteredActionItems.map((act) => (
                <div
                  key={act.id}
                  onClick={() => setSelectedDetail({
                    id: act.id,
                    type: 'action',
                    sender: act.sender,
                    text: act.text,
                    dateStr: act.dateStr,
                    completed: act.completed
                  })}
                  className={`group flex items-start gap-3 p-3.5 rounded border cursor-pointer select-none transition-all duration-200 ${
                    act.completed
                      ? 'bg-[#0A0A0A] border-white/5 text-gray-500 opacity-60'
                      : 'bg-[#0A0A0A] border-white/10 hover:bg-white/5 hover:border-white/20'
                  }`}
                  id={`action-block-${act.id}`}
                >
                  {/* Interactive Custom Checkbox */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateActionItem(act.id, !act.completed);
                    }}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                      act.completed
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'border-white/20 bg-[#0A0A0A] text-transparent group-hover:border-white/40'
                    }`}
                  >
                    {act.completed && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <p className={`text-xs leading-relaxed truncate-2-lines break-words font-light group-hover:text-white transition-colors ${act.completed ? 'line-through text-gray-550 font-extralight' : 'text-gray-200'}`}>
                      {act.text}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                      {act.sender === 'The Group' ? (
                        <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Group / Unassigned
                        </span>
                      ) : (
                        <span className="font-semibold text-blue-400 truncate max-w-[130px]">{act.sender}</span>
                      )}
                      <span>{act.dateStr}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* GEOMETRIC ASSISTANT PANEL */}
      <div className="p-5 bg-[#121212] rounded-xl border border-white/5 shadow-sm" id="gemini-chatbot-assistant">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">{getTranslation('btnAskAI', language)}</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-light">Query topics, quote assertions, or search timeline agreements</p>
            </div>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-slate-400 rounded-full border border-white/5 uppercase select-none">
            Gemini Flash Active
          </span>
        </div>

        {/* Chat window viewport */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/10 p-4 min-h-[140px] max-h-[300px] overflow-y-auto space-y-4 mb-4 select-text" id="assistant-viewport animate-fadeIn">
          {chatHistory.length === 0 ? (
            <div className="h-28 flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
              <MessageSquare className="w-6 h-6 text-gray-600 animate-pulse" />
              <p className="text-xs italic font-light">Ask any question about this group conversation</p>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-lg mt-2">
                {[
                  "What were the key issues?",
                  "Who said what about agreements?",
                  "Is there any task without an owner?",
                  "Tell me who was most active and why"
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setQueryInput(sample);
                    }}
                    className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 hover:text-white text-gray-300 font-light rounded-md border border-white/5 transition-colors cursor-pointer"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((chat, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs leading-relaxed max-w-[90%] ${
                  chat.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                <div className="flex flex-col space-y-1">
                  <div className={`text-[9px] uppercase font-mono ${chat.role === 'user' ? 'text-blue-400 text-right' : 'text-emerald-400 text-left'}`}>
                    {chat.role === 'user' ? 'You' : 'Gemini AI'}
                  </div>
                  <div
                    className={`p-3 rounded-lg whitespace-pre-wrap text-left ${
                      chat.role === 'user'
                        ? 'bg-blue-600/25 border border-blue-500/25 text-white rounded-br-none'
                        : 'bg-white/5 border border-white/10 text-gray-300 rounded-bl-none'
                    }`}
                  >
                    {chat.text}
                  </div>
                  {chat.role === 'model' && (
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => handleInitiateCommit(chat.text)}
                        className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 border border-emerald-500/25 px-2.5 py-1 rounded transition-all cursor-pointer font-mono"
                      >
                        <PlusCircle className="w-3 h-3 text-emerald-400" />
                        Commit as Decision
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500 italic">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span>Gemini is analyzing conversation history...</span>
            </div>
          )}

          {chatError && (
            <div className="flex items-start gap-2 p-3 bg-rose-950/20 text-rose-300 rounded-lg border border-rose-900/40 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-250">Assistant Query Blocked</p>
                <p className="font-light">{chatError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Query form input text bar */}
        <form onSubmit={handleSendQuery} className="flex gap-2" id="assistant-form">
          <input
            type="text"
            required
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            disabled={chatLoading}
            placeholder={getTranslation('askQuestionPlaceholder', language)}
            className="flex-1 bg-[#0A0A0A] border border-white/10 rounded px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={chatLoading || !queryInput.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:scale-100 disabled:opacity-50 rounded text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {getTranslation('askGemini', language)}
          </button>
        </form>
      </div>

      {/* FILTERED MESSAGES LOG VIEWER (Premium extension for timeline visibility) */}
      <div className="p-5 bg-[#121212] rounded-xl border border-white/5 shadow-sm" id="chat-messages-browser">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-white/5 pb-3" id="messages-browser-header">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-mono">Filtered view</span>
            <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Exchanged Message Logs</h3>
          </div>
          <span className="text-[10px] font-mono text-gray-500">
            Showing {filteredMessages.length} of {totalMessages} messages
          </span>
        </div>

        {/* Message Logs viewport */}
        <div className="h-[280px] overflow-y-auto space-y-3.5 pr-2 font-mono bg-[#0A0A0A] p-4 rounded border border-white/10" id="messages-scroller-view">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-650 text-xs italic">
              No matching lines in thread
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const matchesSelf = digest.participants[0] === msg.sender;
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[85%] ${matchesSelf ? 'ml-auto text-right' : 'text-left'}`}
                  id={`message-row-${msg.id}`}
                >
                  <div className={`flex items-center gap-2 text-[10px] text-gray-500 mb-1 font-sans ${matchesSelf ? 'justify-end' : ''}`}>
                    <span className="font-bold text-gray-300">{msg.sender}</span>
                    <span>•</span>
                    <span>{msg.dateStr}</span>
                    <span>{msg.timeStr}</span>
                  </div>

                  <div 
                    className={`p-3 rounded-xl text-xs font-sans leading-relaxed select-text whitespace-pre-wrap text-left inline-block max-w-full ${
                      matchesSelf 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white/5 border border-white/10 text-gray-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SENSITIVE FULL TEXT DETAIL MODAL */}
      {selectedDetail && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedDetail(null)}
          id="item-detail-modal-overlay"
        >
          <div 
            className="bg-[#121212] border border-white/10 rounded-xl p-6 max-w-xl w-full text-left shadow-2xl relative animate-slideRight space-y-4"
            onClick={(e) => e.stopPropagation()}
            id="item-detail-modal-container"
          >
            {/* Top Close icon */}
            <button 
              onClick={() => setSelectedDetail(null)}
              className="absolute right-4 top-4 text-gray-450 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Type Header Badge */}
            <div className="flex items-center gap-2">
              {selectedDetail.type === 'action' ? (
                <>
                  <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] tracking-widest font-mono text-blue-400 uppercase font-semibold">Action Item Assignment</span>
                    <p className="text-[11px] text-gray-500 font-sans">Recognized follow-up task</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] tracking-widest font-mono text-emerald-400 uppercase font-semibold">Consensus Agreement Decision</span>
                    <p className="text-[11px] text-gray-500 font-sans">Formal discussion marker</p>
                  </div>
                </>
              )}
            </div>

            {/* Complete sentence content */}
            <div className="bg-[#0A0A0A] p-5 rounded-lg border border-white/5 select-text">
              <p className="text-sm md:text-base font-light text-gray-250 leading-relaxed whitespace-pre-wrap italic break-words">
                "{selectedDetail.text}"
              </p>
            </div>

            {/* If action item, show interactive delegator form */}
            {selectedDetail.type === 'action' && (
              <div className="p-4 bg-white/3 border border-white/5 rounded-xl space-y-3 text-xs text-left">
                <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase text-blue-400 font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  Assignee/Delegate Settings
                </div>
                
                <div className="space-y-1.5 bg-[#0A0A0A] p-3 rounded-lg border border-white/5">
                  <label className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">Assign To</label>
                  <select
                    value={selectedDetail.sender}
                    onChange={(e) => {
                      const newAssignee = e.target.value;
                      if (onUpdateActionItemAssignee) {
                        onUpdateActionItemAssignee(selectedDetail.id, newAssignee);
                      }
                      setSelectedDetail(prev => prev ? { ...prev, sender: newAssignee } : null);
                    }}
                    className="w-full bg-[#121212] border border-white/10 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <option value="The Group">The Group (Collective / Unassigned)</option>
                    {digest.participants.map((person) => (
                      <option key={person} value={person}>{person}</option>
                    ))}
                  </select>
                </div>

                {selectedDetail.sender === 'The Group' && (
                  <div className="text-[10px] text-amber-450 bg-amber-500/5 border border-amber-500/15 rounded p-2.5 flex items-start gap-1.5 leading-normal">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-450" />
                    <span>This item is currently flagged for <b>Collective / Custom Group assignment</b>. This usually indicates it has not been delegated to an individual yet. Select a team member from the list above to assign it.</span>
                  </div>
                )}
              </div>
            )}

            {/* Participant and Datestamp section */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/25 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-400 font-mono">
                  {selectedDetail.sender.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-200">{selectedDetail.sender}</p>
                  <p className="text-[9px] text-gray-500">Contributor</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-gray-300">{selectedDetail.dateStr}</p>
                <p className="text-[9px] text-gray-500">Activity Date</p>
              </div>
            </div>

            {/* Actions panel */}
            <div className="pt-2 flex justify-end gap-2 text-xs">
              {selectedDetail.type === 'action' && (
                <button
                  type="button"
                  onClick={() => {
                    // Toggle state on parent
                    onUpdateActionItem(selectedDetail.id, !selectedDetail.completed);
                    // Update current modal state in place to trigger responsive rendering
                    setSelectedDetail(prev => prev ? { ...prev, completed: !prev.completed } : null);
                  }}
                  className={`px-4 py-2 rounded font-semibold flex items-center gap-1.5 transition-all text-xs border cursor-pointer active:scale-95 ${
                    selectedDetail.completed
                      ? 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-500/20 text-blue-400'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedDetail.completed ? 'Mark as Pending' : 'Mark as Completed'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10 rounded font-semibold text-gray-350 transition-colors text-xs cursor-pointer"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>
      )}

      {committingDecision && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => {
            setCommittingDecision(null);
            setContradictions([]);
          }}
          id="commit-decision-modal-overlay"
        >
          <div 
            className="bg-[#121212] border border-white/10 rounded-xl p-6 max-w-2xl w-full text-left shadow-2xl relative animate-slideRight space-y-5"
            onClick={(e) => e.stopPropagation()}
            id="commit-decision-modal-container"
          >
            {/* Top Close icon */}
            <button 
              onClick={() => {
                setCommittingDecision(null);
                setContradictions([]);
              }}
              className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Badge */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] tracking-widest font-mono text-emerald-400 uppercase font-semibold">Gemini Answer Commit Panel</span>
                <h3 className="text-sm font-semibold text-white">Commit Answer as Decision</h3>
              </div>
            </div>

            {/* Edit Panel form */}
            <div className="space-y-4">
              {/* Decision Statement Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">Decision Statement</label>
                  <button
                    type="button"
                    disabled={isAuditingContradictions || !committingDecision.text.trim()}
                    onClick={() => handleReAudit(committingDecision.text)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-mono disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Loader2 className={`w-3 h-3 ${isAuditingContradictions ? 'animate-spin' : ''}`} />
                    Re-audit Conflicts
                  </button>
                </div>
                <textarea
                  required
                  rows={4}
                  value={committingDecision.text}
                  onChange={(e) => {
                    const textVal = e.target.value;
                    setCommittingDecision(prev => prev ? { ...prev, text: textVal } : null);
                  }}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-3 text-xs text-gray-250 placeholder-gray-650 focus:outline-none focus:border-emerald-500/50 transition-colors select-text"
                  placeholder="The text statement describing the consensus or agreement."
                />
              </div>

              {/* Contributor & Date row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">Associated Contributor</label>
                  <select
                    value={committingDecision.sender}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCommittingDecision(prev => prev ? { ...prev, sender: val } : null);
                    }}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                  >
                    <option value="Gemini AI">Gemini AI</option>
                    <option value="The Group">The Group</option>
                    {digest.participants.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">Consensus Date</label>
                  <input
                    type="date"
                    required
                    value={committingDecision.dateStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCommittingDecision(prev => prev ? { ...prev, dateStr: val } : null);
                    }}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg p-2.5 text-xs text-gray-250 focus:outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Contradiction System Audit section */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <h4 className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider font-mono">Conflict Auditing Status</h4>
              
              {isAuditingContradictions ? (
                <div className="flex flex-col items-center justify-center p-6 bg-[#0A0A0A] rounded-lg border border-white/5 space-y-2 animate-pulse text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <p className="text-xs font-semibold text-amber-400 font-mono uppercase tracking-wider">AI Ledger Crossref Search Active</p>
                  <p className="text-[10px] text-gray-400 max-w-md font-light">Analyzing existing consensus ledger entries to detect contrary declarations or direct scheduling conflicts...</p>
                </div>
              ) : auditError ? (
                <div className="flex items-start gap-3 p-4 bg-orange-950/10 text-orange-400 rounded-lg border border-orange-900/30 text-xs text-left">
                  <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-orange-300">Conflict Check Unavailable</p>
                    <p className="text-gray-400 font-light mt-0.5">Could not perform automated conflict audit: {auditError}. You can still manually commit this decision.</p>
                  </div>
                </div>
              ) : contradictions.length === 0 ? (
                <div className="flex items-start gap-3 p-4 bg-emerald-950/15 text-emerald-400 rounded-lg border border-emerald-900/25 text-xs text-left">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-300">Clean Ledger Compliance Verified</p>
                    <p className="text-gray-400 font-light mt-0.5">This decision complies cleanly with all agreements in your active ledger. No opposing statements found.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3.5 bg-rose-950/15 text-rose-450 rounded-lg border border-rose-900/35 text-xs text-left" id="logical-contradiction-heading">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="font-semibold text-rose-300 font-sans">Contrary Commitment Conflict Detected</p>
                      <p className="text-[#a1a1aa] font-sans font-light mt-1 leading-normal">
                        We analyzed the existing ledger and identified a contradiction. The conflicting commitment has been broken down into singular parts below. Check items to <b>delete</b> them, or uncheck them to <b>keep the individual consistent statement</b>:
                      </p>
                    </div>
                  </div>
                  
                  <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1" id="contradictions-ledger-list">
                    {contradictions.map((c) => (
                      <div 
                        key={c.id} 
                        className="p-3.5 rounded-xl border border-white/5 bg-[#17171d]/15 text-left space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono font-bold pb-1.5 border-b border-white/5 mb-2">
                            <span className="text-gray-400 uppercase">Original Action by {c.sender}</span>
                            <span>{c.dateStr}</span>
                          </div>
                          <p className="text-gray-400 italic text-xs leading-normal pl-2 border-l border-white/10 select-text">
                            "{c.originalText}"
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-mono font-semibold text-blue-400 uppercase tracking-widest pl-1">
                            {c.isMultiPart 
                              ? "⚡ Atomic Commitment Breakdown (Keep vs Delete)" 
                              : "⚡ Sole Atomic Commitment Part"
                            }
                          </p>
                          
                          <div className="space-y-2 pl-1">
                            {c.parts.map((p) => (
                              <div
                                key={p.partId}
                                className={`p-2.5 rounded-lg border transition-all text-xs flex items-start gap-2.5 bg-[#0a0a0c] ${
                                  p.shouldDelete 
                                    ? 'border-rose-500/20 hover:border-rose-500/30' 
                                    : 'border-white/5 hover:border-white/10 opacity-75'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={p.shouldDelete}
                                  onChange={() => toggleContradictionPartDelete(c.id, p.partId)}
                                  className="mt-0.5 accent-rose-500 rounded border-white/10 shrink-0 cursor-pointer"
                                />
                                <div className="flex-1 space-y-1 select-text">
                                  <p className="text-gray-250 font-normal leading-normal text-[11px]">
                                    "{p.text}"
                                  </p>
                                  {p.isContrary ? (
                                    <div className="text-[9px] text-rose-350 font-mono font-medium opacity-90 p-1 bg-rose-500/5 rounded border border-rose-500/10">
                                      Conflict: {p.explanation}
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono font-medium bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 uppercase tracking-wider">
                                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                                      Consistent (Will preserve on ledger)
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="pt-3 border-t border-white/5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCommittingDecision(null);
                  setContradictions([]);
                }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 rounded font-semibold text-gray-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAuditingContradictions || !committingDecision.text.trim()}
                onClick={handleConfirmCommitDecision}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:scale-100"
              >
                <Check className="w-3.5 h-3.5" />
                {contradictions.some(c => c.parts.some(p => p.shouldDelete)) ? 'Delete Contrary & Commit' : 'Confirm & Commit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Media Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteMediaId !== null}
        title="Delete Media Analysis"
        message="Are you sure you want to delete this media analysis record? Extracted action items and decisions will remain on their boards, but the media description will be cleared."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteMediaId) {
            executeDeleteParsedMedia(deleteMediaId);
          }
        }}
        onCancel={() => setDeleteMediaId(null)}
      />
    </div>
  );
}
