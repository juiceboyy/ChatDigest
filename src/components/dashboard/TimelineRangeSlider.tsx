import React from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { Language } from '../../lib/translations';

interface TimelineRangeSliderProps {
  timelineLength: number;
  startIndex: number;
  endIndex: number;
  startDateStr: string;
  endDateStr: string;
  dayCount: number;
  language: Language;
  includeTrends: boolean;
  loading: boolean;
  hasAnalysis: boolean;
  onStartChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: () => void;
}

export default function TimelineRangeSlider({
  timelineLength,
  startIndex,
  endIndex,
  startDateStr,
  endDateStr,
  dayCount,
  language,
  includeTrends,
  loading,
  hasAnalysis,
  onStartChange,
  onEndChange,
  onAnalyze,
}: TimelineRangeSliderProps) {
  const startPct = timelineLength > 1 ? (startIndex / (timelineLength - 1)) * 100 : 0;
  const endPct = timelineLength > 1 ? (endIndex / (timelineLength - 1)) * 100 : 100;

  return (
    <div className="bg-[#0A0A0A] p-5 rounded-xl border border-white/5 space-y-4 text-left">
      <style>{`
        .range-slider-input::-webkit-slider-thumb {
          pointer-events: auto !important;
          appearance: none !important;
          width: 14px !important;
          height: 14px !important;
          border-radius: 50% !important;
          background: #3b82f6 !important;
          border: 2px solid #ffffff !important;
          cursor: grab !important;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.6) !important;
          transition: transform 0.1s ease;
        }
        .range-slider-input::-webkit-slider-thumb:active {
          cursor: grabbing !important;
          transform: scale(1.2);
        }
        .range-slider-input::-moz-range-thumb {
          pointer-events: auto !important;
          width: 14px !important;
          height: 14px !important;
          border-radius: 50% !important;
          background: #3b82f6 !important;
          border: 2px solid #ffffff !important;
          cursor: grab !important;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.6) !important;
          transition: transform 0.1s ease;
        }
        .range-slider-input::-moz-range-thumb:active {
          cursor: grabbing !important;
          transform: scale(1.2);
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-gray-300">
            {language === 'nl' ? 'Periode Selecteren' : 'Select Period'}
          </h4>
        </div>
        <div className="text-xs font-medium text-gray-300">
          {language === 'nl' 
            ? `Geselecteerd: ${startDateStr} t/m ${endDateStr} (${dayCount} dagen)`
            : `Selected: ${startDateStr} to ${endDateStr} (${dayCount} days)`
          }
        </div>
      </div>

      {timelineLength <= 1 ? (
        <p className="text-xs text-gray-500 italic">
          {language === 'nl' ? 'Onvoldoende datapunten om een bereik te kiezen.' : 'Insufficient data points to select a range.'}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Custom Dual Slider Component */}
          <div className="relative w-full h-8 flex items-center select-none">
            <div className="absolute left-0 right-0 h-1.5 bg-white/5 border border-white/10 rounded-full" />
            <div
              className="absolute h-1.5 bg-blue-500 rounded-full"
              style={{
                left: `${startPct}%`,
                width: `${endPct - startPct}%`,
              }}
            />
            <input
              type="range"
              min={0}
              max={timelineLength - 1}
              value={startIndex}
              onChange={onStartChange}
              className="range-slider-input absolute w-full h-1.5 pointer-events-none appearance-none bg-transparent focus:outline-none z-30"
              style={{ WebkitAppearance: 'none' }}
            />
            <input
              type="range"
              min={0}
              max={timelineLength - 1}
              value={endIndex}
              onChange={onEndChange}
              className="range-slider-input absolute w-full h-1.5 pointer-events-none appearance-none bg-transparent focus:outline-none z-35"
              style={{ WebkitAppearance: 'none' }}
            />
          </div>

          {/* AI Analyze Trigger Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
            <div className="text-[10px] font-sans text-gray-400">
              {includeTrends 
                ? (language === 'nl' ? '✓ Inclusief trendanalyse (> 7 dagen geselecteerd)' : '✓ Includes trend analysis (> 7 days selected)')
                : (language === 'nl' ? '• Trendanalyse uitgeschakeld (selecteer > 7 dagen)' : '• Trend analysis disabled (select > 7 days)')
              }
            </div>
            <button
              onClick={onAnalyze}
              disabled={loading || hasAnalysis}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                hasAnalysis
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/50 hover:shadow-lg active:scale-98 disabled:opacity-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {hasAnalysis 
                ? (language === 'nl' ? 'Periode geanalyseerd' : 'Period analyzed')
                : (language === 'nl' ? 'Analyseer deze periode met AI' : 'Analyze this period with AI')
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
