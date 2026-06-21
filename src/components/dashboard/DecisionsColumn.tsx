import React, { useMemo } from 'react';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import { ChatDigestData, DecisionItem } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface DecisionsColumnProps {
  digest: ChatDigestData;
  searchTerm: string;
  filterParticipant: string | null;
  onSelectDetail: (detail: any) => void;
  language: Language;
}

export default function DecisionsColumn({
  digest,
  searchTerm,
  filterParticipant,
  onSelectDetail,
  language,
}: DecisionsColumnProps) {
  const filteredDecisions = useMemo(() => {
    return digest.decisions.filter((dec) => {
      const matchesSearch = searchTerm
        ? dec.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          dec.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesParticipant = filterParticipant ? dec.sender === filterParticipant : true;
      return matchesSearch && matchesParticipant;
    });
  }, [digest.decisions, searchTerm, filterParticipant]);
  return (
    <div
      className="lg:col-span-4 bg-[#121212] rounded-xl border border-white/5 p-5 flex flex-col h-[540px] hover:border-white/10 transition-colors"
      id="column-decisions-grid"
    >
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/5 text-emerald-400 rounded-lg border border-white/10">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-[#FFF]/80 font-bold">
            {getTranslation('keyDecisions', language)}
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#0A0A0A] text-emerald-400 rounded-full border border-white/5">
          {filteredDecisions.length} recorded
        </span>
      </div>

      <div className="p-2.5 bg-[#0A0A0A] border border-white/10 rounded mb-4 text-[10px] text-gray-500 leading-normal shrink-0 flex items-start gap-1.5 font-light">
        <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-blue-400 shrink-0" />
        <span>
          Highlights moments demonstrating formal validation, consensus markers, or resolution agreements like{' '}
          <b className="text-gray-300 font-normal">"agreed"</b> or <b className="text-gray-300 font-normal">"deal."</b>
        </span>
      </div>

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
              onClick={() =>
                onSelectDetail({
                  id: dec.id,
                  type: 'decision',
                  sender: dec.sender,
                  text: dec.text,
                  dateStr: dec.dateStr,
                })
              }
              className="p-3.5 bg-[#0A0A0A] rounded border border-white/5 relative hover:border-white/10 hover:bg-white/3 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2 font-light pb-2 border-b border-white/5">
                <span className="font-semibold text-gray-300 group-hover:text-blue-400 transition-colors">
                  {dec.sender}
                </span>
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
  );
}
