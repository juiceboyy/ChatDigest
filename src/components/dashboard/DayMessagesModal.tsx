import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Calendar, MessageSquare, BrainCircuit, AlertTriangle, CheckCircle2, AlertCircle, Lightbulb, Smile, Users, Zap, Meh, ThumbsUp, HelpCircle } from 'lucide-react';
import { ParsedMessage } from '../../types';
import { Language } from '../../lib/translations';

interface DayAnalysisResult {
  summary: string;
  sentiment: {
    label: string;
    explanation: string;
  };
  decisions: string[];
  disagreements: string[];
}

interface DayMessagesModalProps {
  dateStr: string | null;
  messages: ParsedMessage[];
  firstParticipant: string;
  onClose: () => void;
  language: Language;
  dayAnalyses: Record<string, DayAnalysisResult>;
  setDayAnalyses: React.Dispatch<React.SetStateAction<Record<string, DayAnalysisResult>>>;
}

export default function DayMessagesModal({
  dateStr,
  messages,
  firstParticipant,
  onClose,
  language,
  dayAnalyses,
  setDayAnalyses,
}: DayMessagesModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayMessages = useMemo(() => {
    if (!dateStr) return [];
    return messages.filter((msg) => msg.dateStr === dateStr);
  }, [messages, dateStr]);

  const filteredMessages = useMemo(() => {
    if (!searchTerm) return dayMessages;
    const lower = searchTerm.toLowerCase();
    return dayMessages.filter(
      (msg) =>
        msg.text.toLowerCase().includes(lower) ||
        msg.sender.toLowerCase().includes(lower)
    );
  }, [dayMessages, searchTerm]);

  // Load AI analysis when modal opens or date changes
  useEffect(() => {
    if (!dateStr || dayMessages.length === 0) return;

    setSearchTerm('');
    setError(null);

    // If already in cache, do not refetch
    if (dayAnalyses[dateStr]) {
      return;
    }

    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/day-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: dayMessages,
            language,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to retrieve daily AI analysis.');
        }

        const data: DayAnalysisResult = await response.json();
        setDayAnalyses((prev) => ({
          ...prev,
          [dateStr]: data,
        }));
      } catch (err: any) {
        console.error('Error fetching day analysis:', err);
        setError(err.message || 'Error occurred during AI analysis.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [dateStr, dayMessages, language, dayAnalyses, setDayAnalyses]);

  if (!dateStr) return null;

  const analysis = dayAnalyses[dateStr];

  const titleText = language === 'nl' ? `Daganalyse & Berichten op ${dateStr}` : `Day Analysis & Messages on ${dateStr}`;
  const searchPlaceholder = language === 'nl' ? 'Zoek in berichten...' : 'Search messages...';
  const noMessagesText = language === 'nl' ? 'Geen berichten gevonden voor dit filter.' : 'No messages found for this filter.';
  const totalMessagesText =
    language === 'nl'
      ? `${filteredMessages.length} van ${dayMessages.length} berichten`
      : `${filteredMessages.length} of ${dayMessages.length} messages`;

  // Determine sentiment color and icon
  const getSentimentStyling = (label: string) => {
    const norm = label.toLowerCase();
    if (norm.includes('collaborative') || norm.includes('samenwerking')) {
      return { Icon: Users, colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
    if (norm.includes('positive') || norm.includes('positief') || norm.includes('vrolijk')) {
      return { Icon: Smile, colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
    if (norm.includes('tense') || norm.includes('gespannen') || norm.includes('conflict')) {
      return { Icon: AlertTriangle, colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    }
    if (norm.includes('urgent') || norm.includes('dringend')) {
      return { Icon: Zap, colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
    if (norm.includes('brainstorming') || norm.includes('brainstorm')) {
      return { Icon: Lightbulb, colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    }
    if (norm.includes('constructive') || norm.includes('opbouwend')) {
      return { Icon: ThumbsUp, colorClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
    }
    return { Icon: Meh, colorClass: 'text-gray-400 bg-white/5 border-white/10' };
  };

  const { Icon: SentimentIcon, colorClass: sentimentColorClass } = analysis 
    ? getSentimentStyling(analysis.sentiment.label)
    : { Icon: HelpCircle, colorClass: 'text-gray-400 bg-white/5 border-white/10' };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      id="day-messages-modal-overlay"
    >
      <div
        className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden text-white shadow-2xl relative animate-slideRight"
        onClick={(e) => e.stopPropagation()}
        id="day-messages-modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0F0F0F] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{titleText}</h3>
              <p className="text-[10px] text-gray-550 font-mono">{totalMessagesText}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content split pane */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Pane (AI Analysis) */}
          <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-white/5 overflow-y-auto p-6 space-y-5 bg-[#141414] flex flex-col">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <BrainCircuit className="w-4.5 h-4.5 text-blue-400" />
              <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-gray-300">
                {language === 'nl' ? 'AI Daganalyse' : 'AI Daily Analysis'}
              </h4>
            </div>

            {loading && (
              <div className="space-y-5 animate-pulse flex-1 justify-center py-4">
                <div className="space-y-2">
                  <div className="h-3.5 bg-white/10 rounded w-1/4"></div>
                  <div className="h-3 bg-white/5 rounded w-full"></div>
                  <div className="h-3 bg-white/5 rounded w-5/6"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-3.5 bg-white/10 rounded w-1/3"></div>
                  <div className="h-12 bg-white/5 rounded w-full border border-white/5"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 bg-white/10 rounded w-1/4"></div>
                  <div className="h-3 bg-white/5 rounded w-full"></div>
                  <div className="h-3 bg-white/5 rounded w-2/3"></div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-500 opacity-80" />
                <p className="text-xs text-rose-400 font-medium">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    // trigger refetch by forcing dateStr change logic
                    const current = dateStr;
                    onClose();
                    setTimeout(() => {
                      // Simulating reopen/retry by reset
                      setDayAnalyses(prev => {
                        const next = { ...prev };
                        delete next[current!];
                        return next;
                      });
                    }, 50);
                  }}
                  className="px-3 py-1 text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 font-semibold"
                >
                  {language === 'nl' ? 'Probeer opnieuw' : 'Retry'}
                </button>
              </div>
            )}

            {!loading && !error && !analysis && (
              <div className="flex-1 flex items-center justify-center text-center text-xs text-gray-500 italic">
                {language === 'nl' ? 'Geen analyse beschikbaar' : 'No analysis available'}
              </div>
            )}

            {!loading && !error && analysis && (
              <div className="space-y-5 flex-1 text-left">
                {/* Summary */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono">
                    {language === 'nl' ? 'Samenvatting' : 'Summary'}
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed font-sans">{analysis.summary}</p>
                </div>

                {/* Sentiment & Atmosphere */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono">
                    {language === 'nl' ? 'Sfeer & Toon' : 'Atmosphere & Tone'}
                  </span>
                  <div className="p-3 bg-white/3 border border-white/5 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-semibold ${sentimentColorClass}`}>
                        <SentimentIcon className="w-3 h-3" />
                        {analysis.sentiment.label}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 font-sans leading-relaxed">{analysis.sentiment.explanation}</p>
                  </div>
                </div>

                {/* Decisions */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    {language === 'nl' ? 'Besluiten' : 'Decisions'}
                  </span>
                  {analysis.decisions.length === 0 ? (
                    <p className="text-[11px] text-gray-550 italic font-sans pl-1">
                      {language === 'nl' ? 'Geen concrete afspraken vastgelegd.' : 'No concrete agreements recorded.'}
                    </p>
                  ) : (
                    <ul className="space-y-1.5 pl-1.5 text-xs text-gray-300 leading-relaxed font-sans list-disc list-outside">
                      {analysis.decisions.map((dec, idx) => (
                        <li key={idx} className="ml-3">{dec}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Disagreements */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {language === 'nl' ? 'Discussies & Conflicten' : 'Tensions & Disagreements'}
                  </span>
                  {analysis.disagreements.length === 0 ? (
                    <p className="text-[11px] text-gray-550 italic font-sans pl-1">
                      {language === 'nl' ? 'Geen meningsverschillen of spanning gedetecteerd.' : 'No disagreements or tensions detected.'}
                    </p>
                  ) : (
                    <ul className="space-y-1.5 pl-1.5 text-xs text-gray-300 leading-relaxed font-sans list-disc list-outside">
                      {analysis.disagreements.map((dis, idx) => (
                        <li key={idx} className="ml-3 text-rose-300/90">{dis}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Pane (Messages) */}
          <div className="w-full md:w-7/12 flex flex-col overflow-hidden bg-[#0A0A0A]">
            {/* Search Bar */}
            <div className="p-4 bg-[#161616] border-b border-white/5 shrink-0 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-550 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-gray-250 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500 text-xs italic">
                  <MessageSquare className="w-8 h-8 mb-2 text-gray-600 opacity-40" />
                  {noMessagesText}
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const matchesSelf = firstParticipant === msg.sender;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${matchesSelf ? 'ml-auto text-right' : 'text-left'}`}
                      id={`day-msg-${msg.id}`}
                    >
                      <div
                        className={`flex items-center gap-2 text-[10px] text-gray-500 mb-1 font-sans ${
                          matchesSelf ? 'justify-end' : ''
                        }`}
                      >
                        <span className="font-bold text-gray-300">{msg.sender}</span>
                        <span>•</span>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0F0F0F] border-t border-white/5 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 rounded-xl font-semibold text-gray-350 transition-colors text-xs cursor-pointer"
          >
            {language === 'nl' ? 'Sluiten' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
