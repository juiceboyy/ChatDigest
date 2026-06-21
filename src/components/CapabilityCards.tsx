import React from 'react';
import { CheckSquare, Layers, Plus } from 'lucide-react';
import { Language, getTranslation } from '../lib/translations';

interface CapabilityCardsProps {
  language: Language;
}

export default function CapabilityCards({ language }: CapabilityCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto mt-14" id="utility-capabilities-grid">
      <div className="p-5 bg-[#121212] rounded-xl border border-white/5 text-left space-y-3 hover:border-white/10 transition-colors animate-fadeIn">
        <div className="p-2 bg-white/5 text-blue-400 rounded-lg border border-white/10 inline-block">
          <CheckSquare className="w-4 h-4" />
        </div>
        <h4 className="text-xs uppercase tracking-wider font-bold text-gray-300">{getTranslation('actionTracker', language)}</h4>
        <p className="text-[11px] text-gray-500 leading-relaxed font-light">{getTranslation('actionTrackerDesc', language)}</p>
      </div>
      <div className="p-5 bg-[#121212] rounded-xl border border-white/5 text-left space-y-3 hover:border-white/10 transition-colors animate-fadeIn">
        <div className="p-2 bg-white/5 text-emerald-400 rounded-lg border border-white/10 inline-block">
          <Layers className="w-4 h-4" />
        </div>
        <h4 className="text-xs uppercase tracking-wider font-bold text-gray-300">{getTranslation('keyDecisions', language)}</h4>
        <p className="text-[11px] text-gray-500 leading-relaxed font-light">{getTranslation('keyDecisionsDesc', language)}</p>
      </div>
      <div className="p-5 bg-[#121212] rounded-xl border border-white/5 text-left space-y-3 hover:border-white/10 transition-colors animate-fadeIn">
        <div className="p-2 bg-white/5 text-indigo-400 rounded-lg border border-white/10 inline-block">
          <Plus className="w-4 h-4" />
        </div>
        <h4 className="text-xs uppercase tracking-wider font-bold text-gray-300">{getTranslation('isolatedStorage', language)}</h4>
        <p className="text-[11px] text-gray-500 leading-relaxed font-light">{getTranslation('isolatedStorageDesc', language)}</p>
      </div>
    </div>
  );
}
