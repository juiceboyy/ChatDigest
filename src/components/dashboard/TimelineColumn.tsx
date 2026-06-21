import React from 'react';
import { Clock, Smile, Meh, Frown } from 'lucide-react';
import { ChatDigestData, TimelineDataPoint } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface TimelineColumnProps {
  digest: ChatDigestData;
  totalMessages: number;
  svgSparklinePoints: { x: number; y: number }[];
  svgSparklinePointsPath: string;
  svgSparklineAreaPath: string;
  language: Language;
}

export default function TimelineColumn({
  digest,
  totalMessages,
  svgSparklinePoints,
  svgSparklinePointsPath,
  svgSparklineAreaPath,
  language,
}: TimelineColumnProps) {
  return (
    <div
      className="lg:col-span-4 bg-[#121212] rounded-xl border border-white/5 p-5 flex flex-col h-[540px] hover:border-white/10 transition-colors"
      id="column-timeline-grid"
    >
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/5 text-blue-400 rounded-lg border border-white/10">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">
            {getTranslation('tabTimeline', language)}
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-gray-400 rounded-full border border-white/5">
          {digest.timeline.length} peaks
        </span>
      </div>

      {/* Sparkline trend chart */}
      <div
        className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 mb-4 shrink-0"
        id="sparkline-trend-card"
      >
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
            <svg viewBox="0 0 500 120" className="w-full h-18 text-blue-500" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="10" y1="60" x2="490" y2="60" stroke="#222" strokeWidth="0.8" strokeDasharray="3,3" />
              <path d={svgSparklineAreaPath} fill="url(#chartGradient)" />
              <path
                d={svgSparklinePointsPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {svgSparklinePoints.map((point, index) => {
                const originalNode = digest.timeline[index];
                let pointColor = '#3b82f6';
                if (originalNode.avgSentiment > 0.1) pointColor = '#10b981';
                if (originalNode.avgSentiment < -0.1) pointColor = '#f43f5e';
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
            <div className="flex justify-between items-center mt-2 pt-1 border-t border-[#222] text-[9px] text-gray-500 font-mono">
              <span>Start ({digest.startDateStr.split(',')[0]})</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Positive
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full ml-1" /> Negative
              </span>
              <span>End ({digest.endDateStr.split(',')[0]})</span>
            </div>
          </div>
        )}
      </div>

      {/* Timeline node list */}
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
              <div
                className={`absolute top-0 bottom-0 left-0 w-1 rounded-l-md ${
                  sentimentPercentage > 0.12
                    ? 'bg-emerald-500/70'
                    : sentimentPercentage < -0.12
                    ? 'bg-rose-500/70'
                    : 'bg-gray-600/70'
                }`}
              />
              <div className="flex justify-between items-start pl-2 mb-2">
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">{node.dateStr}</h4>
                  <p className="text-[10px] text-gray-550 mt-0.5 leading-none">
                    Peak speaker:{' '}
                    <span className="font-semibold text-blue-400">{node.topSender}</span>
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] ${sentimentColorClass}`}>
                  <SentimentIcon className="w-2.5 h-2.5" />
                  {sentimentText}
                </div>
              </div>
              <div className="space-y-1 pl-2">
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>Message Volume</span>
                  <span className="font-semibold text-gray-300">{node.messageCount} msg</span>
                </div>
                <div className="w-full bg-[#0A0A0A] h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (node.messageCount / totalMessages) * 250)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
