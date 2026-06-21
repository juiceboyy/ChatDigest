import React from 'react';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Language, getTranslation } from '../../lib/translations';

interface ExtractingStepProps {
  isVideo: boolean;
  progress: { current: number; total: number };
  language: Language;
}

export function ExtractingStep({ isVideo, progress, language }: ExtractingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4 animate-pulse">
      <div className="p-4 bg-blue-950/40 rounded-full border border-blue-900/40 text-blue-400">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-white">
          {isVideo ? getTranslation('extractingFrames', language) : 'Reading screenshot files...'}
        </p>
        {isVideo && progress.total > 0 && (
          <p className="text-xs text-gray-400">
            {getTranslation('extractingProgress', language)
              .replace('{current}', progress.current.toString())
              .replace('{total}', progress.total.toString())}
          </p>
        )}
      </div>
      {isVideo && progress.total > 0 && (
        <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface ProcessingStepProps {
  processingProgress: { current: number; total: number; isSynthesizing: boolean };
  language: Language;
}

export function ProcessingStep({ processingProgress, language }: ProcessingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse" />
        <div className="relative p-5 bg-blue-600/10 text-blue-400 rounded-full border border-blue-500/20 animate-spin duration-3000">
          <Sparkles className="w-12 h-12" />
        </div>
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h4 className="text-base font-semibold text-white">
          {processingProgress.isSynthesizing
            ? (language === 'nl' ? 'Eindanalyse samenstellen...' : 'Compiling final digest...')
            : (language === 'nl' 
                ? `Frames analyseren: Deel ${processingProgress.current} van ${processingProgress.total}...`
                : `Analyzing frames: Part ${processingProgress.current} of ${processingProgress.total}...`
              )
          }
        </h4>
        <p className="text-xs text-gray-400 font-light leading-relaxed">
          {processingProgress.isSynthesizing
            ? (language === 'nl' 
                ? 'Gemini stelt nu het complete analytische dashboard en de samenvatting samen op basis van alle berichten.' 
                : 'Gemini is compiling the complete analytics dashboard and summary based on all compiled messages.'
              )
            : (language === 'nl' 
                ? 'We verwerken de frames in deeltrajecten om Netlify time-outs te voorkomen.' 
                : 'We are parsing the frames in small batches to bypass Netlify execution timeouts.'
              )
          }
        </p>
      </div>
    </div>
  );
}

interface ErrorStepProps {
  errorMessage: string;
  onCancel: () => void;
  onRetry: () => void;
  language: Language;
}

export function ErrorStep({ errorMessage, onCancel, onRetry, language }: ErrorStepProps) {
  return (
    <div className="space-y-6 py-6">
      <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 flex items-start gap-3.5 text-red-300 max-w-xl mx-auto text-left shadow-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
        <div className="space-y-1">
          <p className="font-semibold text-red-200">Processing Failed</p>
          <p className="text-xs leading-relaxed font-light">{errorMessage || 'An unknown parsing error occurred.'}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
        >
          {getTranslation('cancelBtn', language)}
        </button>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
        >
          Retry Extraction
        </button>
      </div>
    </div>
  );
}
