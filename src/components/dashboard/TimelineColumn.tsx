import React from 'react';
import { Clock, Maximize2 } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface TimelineColumnProps {
  digest: ChatDigestData;
  language: Language;
  onExpand?: () => void;
  onSelectDate?: (dateStr: string) => void;
}

export default function TimelineColumn({
  digest,
  language,
  onExpand,
  onSelectDate,
}: TimelineColumnProps) {
  const totalMessages = digest.messages.length;

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
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-gray-400 rounded-full border border-white/5">
            {digest.timeline.length} peaks
          </span>
          {onExpand && (
            <button
              onClick={onExpand}
              title="Expand timeline"
              className="p-1 hover:bg-white/5 hover:text-white text-gray-400 rounded transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline node list */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1" id="timeline-chronological-list">
        {digest.timeline.map((node) => {
          return (
            <div
              key={node.dateStr}
              onClick={() => onSelectDate && onSelectDate(node.dateStr)}
              className="p-3 bg-white/3 rounded-lg border border-white/5 relative hover:border-white/10 transition-colors cursor-pointer hover:bg-white/5 active:scale-98"
            >
              <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l-md bg-blue-500/70" />
              <div className="flex justify-between items-start pl-2 mb-2">
                <div>
                  <h4 className="text-xs font-semibold text-gray-200">{node.dateStr}</h4>
                  <p className="text-[10px] text-gray-550 mt-0.5 leading-none">
                    Peak speaker:{' '}
                    <span className="font-semibold text-blue-400">{node.topSender}</span>
                  </p>
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
