import React from 'react';
import { Language, getTranslation } from '../../lib/translations';
import { DateFilterType } from '../../hooks/useDateFilter';

interface DateFilterBarProps {
  dateFilterType: DateFilterType;
  setDateFilterType: (type: DateFilterType) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  language: Language;
}

export default function DateFilterBar({
  dateFilterType,
  setDateFilterType,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  language,
}: DateFilterBarProps) {
  return (
    <div className="p-4 bg-[#121212] rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left animate-fadeIn" id="period-filter-bar">
      <div className="space-y-0.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
          {getTranslation('periodFilterLabel', language)}
        </h4>
        <p className="text-[10px] text-gray-500 font-light">
          {language === 'nl' ? 'Filter dashboard inhoud en analyse op datumbereik.' : 'Filter dashboard content and analysis by date range.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 select-none">
          {(['all', 'week', 'month', 'custom'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDateFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                dateFilterType === type
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {type === 'all' && getTranslation('periodAllTime', language)}
              {type === 'week' && getTranslation('periodLastWeek', language)}
              {type === 'month' && getTranslation('periodLastMonth', language)}
              {type === 'custom' && getTranslation('periodCustom', language)}
            </button>
          ))}
        </div>

        {dateFilterType === 'custom' && (
          <div className="flex items-center gap-2 animate-fadeIn">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-mono uppercase">{getTranslation('startDate', language)}</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-[#0A0A0A] text-white text-xs font-mono px-2 py-1.5 rounded border border-white/10 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-mono uppercase">{getTranslation('endDate', language)}</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-[#0A0A0A] text-white text-xs font-mono px-2 py-1.5 rounded border border-white/10 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
