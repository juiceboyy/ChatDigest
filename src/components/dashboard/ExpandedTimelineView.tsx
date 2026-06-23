import React, { useState, useMemo, useEffect } from 'react';
import { ChatDigestData } from '../../types';
import { Language } from '../../lib/translations';
import TimelineRangeSlider from './TimelineRangeSlider';
import PeriodAnalysisPanel from './PeriodAnalysisPanel';

interface PeriodAnalysisResult {
  summary: string;
  trends: string | null;
  decisions: string[];
  actionItems: string[];
}

interface ExpandedTimelineViewProps {
  digest: ChatDigestData;
  language: Language;
  onSelectDate?: (dateStr: string) => void;
  periodAnalyses?: Record<string, PeriodAnalysisResult>;
  setPeriodAnalyses?: React.Dispatch<React.SetStateAction<Record<string, PeriodAnalysisResult>>>;
}

export default function ExpandedTimelineView({
  digest,
  language,
  onSelectDate,
  periodAnalyses = {},
  setPeriodAnalyses,
}: ExpandedTimelineViewProps) {
  const totalMessages = digest.messages.length;
  const timelineLength = digest.timeline.length;

  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(Math.max(0, timelineLength - 1));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customAnalyses = periodAnalyses;

  // Reset indices if digest changes (switched to a different chat digest)
  useEffect(() => {
    setStartIndex(0);
    setEndIndex(Math.max(0, digest.timeline.length - 1));
  }, [digest.id]);

  // Adjust handles
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setStartIndex(Math.min(val, endIndex - 1 >= 0 ? endIndex - 1 : 0));
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      setEndIndex(Math.max(val, startIndex + 1 < timelineLength ? startIndex + 1 : timelineLength - 1));
    }
  };

  const startDateStr = digest.timeline[startIndex]?.dateStr || '';
  const endDateStr = digest.timeline[endIndex]?.dateStr || '';
  const cacheKey = `${startDateStr}_${endDateStr}`;
  const customAnalysis = customAnalyses[cacheKey] || null;
  const dayCount = endIndex - startIndex + 1;
  const includeTrends = dayCount > 7;

  const filteredTimeline = useMemo(() => {
    if (timelineLength === 0) return [];
    return digest.timeline.slice(startIndex, endIndex + 1);
  }, [digest.timeline, startIndex, endIndex, timelineLength]);

  const handlePeriodAnalysis = async () => {
    if (customAnalysis || loading || timelineLength <= 1) return;

    setLoading(true);
    setError(null);

    const selectedDatesSet = new Set(filteredTimeline.map(n => n.dateStr));
    const selectedMessages = digest.messages.filter(msg => selectedDatesSet.has(msg.dateStr));

    try {
      const response = await fetch('/api/period-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: selectedMessages,
          includeTrends,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch period analysis.');
      }

      const data: PeriodAnalysisResult = await response.json();
      setPeriodAnalyses?.(prev => ({
        ...prev,
        [cacheKey]: data,
      }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred while generating period summary.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Range Slider UI Component */}
      <TimelineRangeSlider
        timelineLength={timelineLength}
        startIndex={startIndex}
        endIndex={endIndex}
        startDateStr={startDateStr}
        endDateStr={endDateStr}
        dayCount={dayCount}
        language={language}
        includeTrends={includeTrends}
        loading={loading}
        hasAnalysis={!!customAnalysis}
        onStartChange={handleStartChange}
        onEndChange={handleEndChange}
        onAnalyze={handlePeriodAnalysis}
      />

      {/* AI Overview result rendering panel */}
      <PeriodAnalysisPanel
        loading={loading}
        error={error}
        analysis={customAnalysis}
        language={language}
      />

      {/* Grid of days detailed info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTimeline.map((node) => {
          return (
            <div
              key={node.dateStr}
              onClick={() => onSelectDate && onSelectDate(node.dateStr)}
              className="p-4.5 bg-[#0D0D0D] border border-white/5 rounded-xl flex flex-col justify-between animate-fadeIn cursor-pointer hover:bg-white/5 active:scale-98 transition-all hover:border-white/10"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h5 className="text-xs font-bold text-white">{node.dateStr}</h5>
                  <p className="text-[10px] text-gray-550 mt-0.5">Peak Speaker: <span className="text-blue-400 font-semibold">{node.topSender}</span></p>
                </div>
              </div>

              {/* Message stats */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>Message Volume:</span>
                  <span className="text-gray-300 font-semibold">{node.messageCount} messages</span>
                </div>
                <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (node.messageCount / totalMessages) * 200)}%` }}
                  />
                </div>
              </div>

              {/* Senders frequency inside day */}
              <div className="mt-3.5 pt-3 border-t border-white/5">
                <p className="text-[9px] uppercase tracking-wider text-gray-500 font-mono font-semibold mb-2">Contributors & Volume</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(node.senderDistribution).map(([name, count]) => (
                    <span key={name} className="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400 font-light border border-white/5">
                      {name}: <b className="text-gray-300 font-medium">{count}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
