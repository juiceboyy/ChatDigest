import React from 'react';
import { ChatDigestData } from '../../types';
import { Language } from '../../lib/translations';

interface ExpandedTimelineViewProps {
  digest: ChatDigestData;
  language: Language;
  onSelectDate?: (dateStr: string) => void;
}

export default function ExpandedTimelineView({ digest, language, onSelectDate }: ExpandedTimelineViewProps) {
  const totalMessages = digest.messages.length;

  return (
    <div className="space-y-6">
      {/* Grid of days detailed info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {digest.timeline.map((node) => {
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
