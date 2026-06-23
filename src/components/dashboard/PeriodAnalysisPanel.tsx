import React from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Lightbulb } from 'lucide-react';
import { Language } from '../../lib/translations';

interface PeriodAnalysisResult {
  summary: string;
  trends: string | null;
  decisions: string[];
  actionItems: string[];
}

interface PeriodAnalysisPanelProps {
  loading: boolean;
  error: string | null;
  analysis: PeriodAnalysisResult | null;
  language: Language;
}

export default function PeriodAnalysisPanel({
  loading,
  error,
  analysis,
  language,
}: PeriodAnalysisPanelProps) {
  // Helper to parse basic markdown in overview summary
  const parseBasicMarkdown = (text: string) => {
    if (!text) return null;
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded font-mono">$1</code>');
    return <div className="space-y-2 whitespace-pre-line text-xs text-gray-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!loading && !error && !analysis) return null;

  return (
    <div className="bg-[#141414] border border-blue-500/10 rounded-xl p-5 space-y-4 shadow-lg animate-fadeIn relative text-left">
      <div className="absolute top-0 right-0 w-48 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Sparkles className="w-4 h-4 text-blue-400" />
        <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-blue-400">
          {language === 'nl' ? 'Gemini AI Overzicht van Selectie' : 'Gemini AI Selection Overview'}
        </h4>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-4 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400 animate-infinite" />
          <div className="space-y-1.5 flex-1">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
              {language === 'nl' ? 'Gemini analyseert de geselecteerde periode...' : 'Gemini is analyzing the selected period...'}
            </p>
            <div className="h-2 bg-white/5 rounded w-11/12" />
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-orange-400 flex items-start gap-2 bg-orange-950/10 border border-orange-900/20 p-3 rounded">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-300">Analysis Failed</p>
            <p className="opacity-80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && analysis && (
        <div className="space-y-5 text-left">
          {/* Summary */}
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono">
              {language === 'nl' ? 'Samenvatting' : 'Summary'}
            </span>
            {parseBasicMarkdown(analysis.summary)}
          </div>

          {/* Trends & Dynamics */}
          {analysis.trends && (
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-blue-400" />
                {language === 'nl' ? 'Trends & Dynamiek' : 'Trends & Dynamics'}
              </span>
              {parseBasicMarkdown(analysis.trends)}
            </div>
          )}

          {/* Decisions */}
          {analysis.decisions && analysis.decisions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {language === 'nl' ? 'Besluiten in deze periode' : 'Decisions in this period'}
              </span>
              <ul className="space-y-1.5 pl-1.5 text-xs text-gray-300 leading-relaxed font-sans list-disc list-outside">
                {analysis.decisions.map((dec: string, idx: number) => (
                  <li key={idx} className="ml-3">{dec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {analysis.actionItems && analysis.actionItems.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold font-mono flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                {language === 'nl' ? 'Actiepunten in deze periode' : 'Action Items in this period'}
              </span>
              <ul className="space-y-1.5 pl-1.5 text-xs text-gray-300 leading-relaxed font-sans list-disc list-outside">
                {analysis.actionItems.map((act: string, idx: number) => (
                  <li key={idx} className="ml-3">{act}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
