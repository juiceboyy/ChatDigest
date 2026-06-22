import React, { useMemo, useState } from 'react';
import { Smile, Meh, Frown } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language } from '../../lib/translations';

interface ExpandedTimelineViewProps {
  digest: ChatDigestData;
  language: Language;
}

export default function ExpandedTimelineView({ digest, language }: ExpandedTimelineViewProps) {
  const totalMessages = digest.messages.length;
  const [hoveredNode, setHoveredNode] = useState<{
    x: number;
    y: number;
    dateStr: string;
    avgSentiment: number;
    messageCount: number;
    topSender: string;
  } | null>(null);

  const svgSparklinePoints = useMemo(() => {
    const list = digest.timeline;
    if (list.length <= 1) return [];
    const paddingX = 40, paddingY = 30;
    const chartWidth = 900 - paddingX * 2;
    const chartHeight = 220 - paddingY * 2;
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
    const start = `M ${svgSparklinePoints[0].x} 200`;
    const line = svgSparklinePoints.map((p) => `L ${p.x} ${p.y}`).join(' ');
    const end = `L ${svgSparklinePoints[svgSparklinePoints.length - 1].x} 200 Z`;
    return `${start} ${line} ${end}`;
  }, [svgSparklinePoints]);

  return (
    <div className="space-y-6">
      {/* Expanded Chart */}
      <div className="bg-[#0A0A0A] p-5 rounded-xl border border-white/5">
        <h4 className="text-xs font-semibold text-gray-300 mb-4 font-mono uppercase tracking-wider">High-Fidelity Sentiment Wave</h4>
        {digest.timeline.length <= 1 ? (
          <div className="h-40 flex items-center justify-center text-center text-xs text-gray-500 italic">
            Not enough data points to plot sentiment charts.
          </div>
        ) : (
          <div className="relative">
            <svg viewBox="0 0 900 220" className="w-full h-44 text-blue-500" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradientLarge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="20" y1="110" x2="880" y2="110" stroke="#222" strokeWidth="1" strokeDasharray="4,4" />
              <path d={svgSparklineAreaPath} fill="url(#chartGradientLarge)" />
              <path
                d={svgSparklinePointsPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
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
                    r="5"
                    fill="#0A0A0A"
                    stroke={pointColor}
                    strokeWidth="2.5"
                    className="transition-transform hover:scale-150 cursor-pointer"
                    onMouseEnter={() => {
                      setHoveredNode({
                        x: point.x,
                        y: point.y,
                        dateStr: originalNode.dateStr,
                        avgSentiment: originalNode.avgSentiment,
                        messageCount: originalNode.messageCount,
                        topSender: originalNode.topSender,
                      });
                    }}
                    onMouseLeave={() => setHoveredNode(null)}
                  />
                );
              })}
            </svg>
            {hoveredNode && (
              <div
                className="absolute z-20 bg-[#161616]/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl text-left pointer-events-none -translate-x-1/2 -translate-y-full text-[11px] space-y-1 w-44 transition-all duration-100 ease-out"
                style={{
                  left: `${(hoveredNode.x / 900) * 100}%`,
                  top: `${(hoveredNode.y / 220) * 100 - 6}%`,
                }}
              >
                <div className="font-semibold text-white border-b border-white/5 pb-1 mb-1 flex justify-between items-center">
                  <span>{hoveredNode.dateStr}</span>
                  <span className={`w-2 h-2 rounded-full ${hoveredNode.avgSentiment > 0.1 ? 'bg-emerald-500 animate-pulse' : hoveredNode.avgSentiment < -0.1 ? 'bg-rose-500' : 'bg-gray-500'}`} />
                </div>
                <div className="text-gray-400">
                  Messages: <span className="font-medium text-gray-250">{hoveredNode.messageCount}</span>
                </div>
                <div className="text-gray-400">
                  Sentiment:{' '}
                  <span className={`font-medium ${hoveredNode.avgSentiment > 0.1 ? 'text-emerald-400' : hoveredNode.avgSentiment < -0.1 ? 'text-rose-400' : 'text-gray-400'}`}>
                    {hoveredNode.avgSentiment > 0.1 ? 'Positive' : hoveredNode.avgSentiment < -0.1 ? 'Constructive' : 'Neutral'} ({hoveredNode.avgSentiment})
                  </span>
                </div>
                <div className="text-gray-400 truncate">
                  Top Speaker: <span className="font-medium text-blue-450 font-semibold">{hoveredNode.topSender}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-500 font-mono">
              <span>Start ({digest.startDateStr})</span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Positive
                <span className="w-2 h-2 bg-rose-500 rounded-full" /> Negative
              </span>
              <span>End ({digest.endDateStr})</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid of days detailed info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {digest.timeline.map((node) => {
          let sentimentText = 'Fine / Equal';
          let sentimentClass = 'text-gray-400 bg-white/5 border-white/10';
          let SentimentIcon = Meh;

          if (node.avgSentiment > 0.12) {
            sentimentText = 'Positive';
            sentimentClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            SentimentIcon = Smile;
          } else if (node.avgSentiment < -0.12) {
            sentimentText = 'Constructive';
            sentimentClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            SentimentIcon = Frown;
          }

          return (
            <div key={node.dateStr} className="p-4.5 bg-[#0D0D0D] border border-white/5 rounded-xl flex flex-col justify-between animate-fadeIn">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h5 className="text-xs font-bold text-white">{node.dateStr}</h5>
                  <p className="text-[10px] text-gray-550 mt-0.5">Peak Speaker: <span className="text-blue-400 font-semibold">{node.topSender}</span></p>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-semibold ${sentimentClass}`}>
                  <SentimentIcon className="w-3 h-3" />
                  {sentimentText}
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
