import React, { useMemo } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface ExpandedDecisionsViewProps {
  digest: ChatDigestData;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSelectDetail: (detail: any) => void;
  language: Language;
}

export default function ExpandedDecisionsView({
  digest,
  searchTerm,
  setSearchTerm,
  onSelectDetail,
  language,
}: ExpandedDecisionsViewProps) {
  const filtered = useMemo(() => {
    return digest.decisions.filter((dec) => {
      return searchTerm
        ? dec.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          dec.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
    });
  }, [digest.decisions, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Search toolbar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder={getTranslation('searchDecisions', language)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Grid of Decisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 text-center text-gray-500 text-xs italic">
            No decisions match search parameters.
          </div>
        ) : (
          filtered.map((dec) => (
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
              className="p-4 bg-[#0D0D0D] border border-white/5 rounded-xl relative hover:border-white/10 hover:bg-white/3 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-3 border-b border-white/5 pb-2">
                <span className="font-semibold text-blue-400">{dec.sender}</span>
                <span>{dec.dateStr}</span>
              </div>
              <p className="text-xs font-light text-gray-300 leading-relaxed italic pr-6 flex-1">
                "{dec.text}"
              </p>
              <div className="mt-3 flex items-center justify-end text-emerald-500 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
