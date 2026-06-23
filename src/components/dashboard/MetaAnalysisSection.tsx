import React, { useState } from 'react';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language } from '../../lib/translations';

interface MetaAnalysisSectionProps {
  digest: ChatDigestData;
  language: Language;
  metaAnalysis: any;
  setMetaAnalysis?: React.Dispatch<React.SetStateAction<any>>;
}

export default function MetaAnalysisSection({
  digest,
  language,
  metaAnalysis,
  setMetaAnalysis,
}: MetaAnalysisSectionProps) {
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const handleMetaAnalysis = async () => {
    if (metaLoading) return;

    setMetaLoading(true);
    setMetaError(null);

    try {
      const response = await fetch('/api/meta-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayAnalyses: digest.dayAnalyses || {},
          periodAnalyses: digest.periodAnalyses || {},
          timeline: digest.timeline,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform overall meta-analysis.');
      }

      const data = await response.json();
      setMetaAnalysis?.(data);
    } catch (err: any) {
      console.error(err);
      setMetaError(err.message || 'Error occurred during meta-analysis.');
    } finally {
      setMetaLoading(false);
    }
  };

  const parseBasicMarkdown = (text: string) => {
    if (!text) return null;
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded font-mono">$1</code>');
    return <div className="space-y-2 whitespace-pre-line text-xs text-gray-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="bg-[#11131c] border border-blue-500/10 p-5 rounded-xl space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </span>
          <div>
            <span className="text-[9px] tracking-widest font-mono text-blue-400 uppercase font-semibold">
              {language === 'nl' ? 'Overkoepelende Meta-Analyse' : 'Overall Meta-Analysis'}
            </span>
            <h3 className="text-xs font-bold text-gray-200 mt-0.5">
              {language === 'nl' ? 'Chronologisch Tijdsbeeld & Ontwikkeling' : 'Chronological Timeline Progression'}
            </h3>
          </div>
        </div>

        <button
          onClick={handleMetaAnalysis}
          disabled={metaLoading}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold hover:shadow-lg active:scale-98 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          {metaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {metaAnalysis ? (language === 'nl' ? 'Opnieuw Analyseren' : 'Analyze Again') : (language === 'nl' ? 'Start Meta-Analyse' : 'Run Meta-Analysis')}
        </button>
      </div>

      <div className="text-[10px] text-gray-400 flex flex-wrap gap-x-4 gap-y-1 font-mono">
        <span>• Day Analyses: <b>{Object.keys(digest.dayAnalyses || {}).length}</b></span>
        <span>• Period Analyses: <b>{Object.keys(digest.periodAnalyses || {}).length}</b></span>
      </div>

      {metaLoading && (
        <div className="py-4 flex items-center gap-3 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <div className="space-y-1.5 flex-1">
            <p className="text-xs text-gray-400 font-mono">
              {language === 'nl' ? 'Gemini analyseert alle opgeslagen periodes en dagen...' : 'Gemini is meta-analyzing all saved period and day profiles...'}
            </p>
            <div className="h-2 bg-white/5 rounded w-11/12" />
          </div>
        </div>
      )}

      {metaError && (
        <div className="text-xs text-orange-400 flex items-start gap-2 bg-orange-950/10 border border-orange-900/20 p-3 rounded">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-300">Meta-Analysis Failed</p>
            <p className="opacity-80 mt-0.5">{metaError}</p>
          </div>
        </div>
      )}

      {!metaLoading && !metaError && metaAnalysis && (
        <div className="space-y-5 text-xs text-gray-305 pt-2 leading-relaxed">
          <div className="space-y-1.5">
            <h5 className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
              {language === 'nl' ? 'Chronologisch Tijdsbeeld' : 'Chronological Narrative'}
            </h5>
            {parseBasicMarkdown(metaAnalysis.chronology)}
          </div>

          <div className="space-y-1.5 pt-3 border-t border-white/5">
            <h5 className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
              {language === 'nl' ? 'Groepsdynamiek & Sfeerevolutie' : 'Group Dynamics & Tone Shifts'}
            </h5>
            {parseBasicMarkdown(metaAnalysis.dynamics)}
          </div>

          {metaAnalysis.milestones && metaAnalysis.milestones.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/5">
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                {language === 'nl' ? 'Mijlpalen & Besluiten over Tijd' : 'Milestones & Key Agreements'}
              </h5>
              <ul className="space-y-1.5 pl-1 text-xs list-disc list-inside">
                {metaAnalysis.milestones.map((ms: string, idx: number) => (
                  <li key={idx} className="text-gray-305">{ms}</li>
                ))}
              </ul>
            </div>
          )}

          {metaAnalysis.actionSummary && (
            <div className="space-y-1.5 pt-3 border-t border-white/5">
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                {language === 'nl' ? 'Status Overzicht & Deliverables' : 'Progress & Deliverables Summary'}
              </h5>
              <p className="text-xs text-gray-305 leading-relaxed font-sans">{metaAnalysis.actionSummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
