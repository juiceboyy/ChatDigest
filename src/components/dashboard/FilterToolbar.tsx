import React from 'react';
import { Search } from 'lucide-react';
import { Language, getTranslation } from '../../lib/translations';

interface FilterToolbarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterParticipant: string | null;
  setFilterParticipant: (participant: string | null) => void;
  participants: string[];
  language: Language;
}

export default function FilterToolbar({
  searchTerm,
  setSearchTerm,
  filterParticipant,
  setFilterParticipant,
  participants,
  language,
}: FilterToolbarProps) {
  return (
    <div className="p-4 bg-[#121212] rounded-xl border border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-inner" id="filter-toolbar">
      <div className="relative flex-1" id="search-box">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder={getTranslation('searchPlaceholder', language)}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0A0A0A] border border-white/10 rounded pl-10 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
          >
            {getTranslation('clearSearch', language)}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto py-1 pr-1" id="speaker-filter-list">
        <span className="text-xs text-gray-500 font-light shrink-0">Speaker:</span>
        <button
          onClick={() => setFilterParticipant(null)}
          className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all shrink-0 ${filterParticipant === null ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'}`}
        >
          {getTranslation('allContributors', language)}
        </button>
        {participants.slice(0, 5).map((name) => (
          <button
            key={name}
            onClick={() => setFilterParticipant(name === filterParticipant ? null : name)}
            className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all truncate shrink-0 max-w-[120px] ${name === filterParticipant ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-[#0A0A0A] border border-white/5 text-gray-400 hover:border-white/10 hover:text-white'}`}
          >
            {name}
          </button>
        ))}
        {participants.length > 5 && (
          <div className="text-[10px] text-slate-500 font-light shrink-0 self-center pl-1">
            +{participants.length - 5} {getTranslation('moreSpeakers', language)}
          </div>
        )}
      </div>
    </div>
  );
}
