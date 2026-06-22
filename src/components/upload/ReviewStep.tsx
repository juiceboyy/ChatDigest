import React from 'react';
import { Trash2, Sparkles } from 'lucide-react';
import { Language, getTranslation } from '../../lib/translations';

interface FrameItem {
  id: string;
  base64: string;
  tinyData?: Uint8ClampedArray;
}

interface ReviewStepProps {
  isVideo: boolean;
  frames: FrameItem[];
  finalFramesToSend: FrameItem[];
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  language: Language;
  onDeleteFrame: (id: string) => void;
  onCancel: () => void;
  onProcess: () => void;
  threshold: number;
  onChangeThreshold: (val: number) => void;
}

export default function ReviewStep({
  isVideo,
  frames,
  finalFramesToSend,
  customPrompt,
  setCustomPrompt,
  language,
  onDeleteFrame,
  onCancel,
  onProcess,
  threshold,
  onChangeThreshold,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-left">
        <h4 className="text-sm font-semibold text-white">{getTranslation('reviewFramesTitle', language)}</h4>
        <p className="text-xs text-gray-400 leading-relaxed font-light">{getTranslation('reviewFramesDesc', language)}</p>
      </div>

      {/* DEDUPLICATION STATS INFO BANNER (Video Mode only) */}
      {isVideo && frames.length > 0 && (
        <div className="bg-[#0A0A0A] border border-white/5 p-3.5 rounded-xl space-y-3 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-gray-300">
                {language === 'nl' ? 'Automatische Ontdubbeling Actief' : 'Automatic Deduplication Active'}
              </h5>
              <p className="text-[10px] text-gray-500 font-light mt-0.5">
                {language === 'nl' 
                  ? 'Pas de drempelwaarde aan om meer of minder frames te behouden.' 
                  : 'Adjust the difference threshold to keep more or fewer frames.'}
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/15 px-3 py-1 rounded-lg shrink-0 self-start sm:self-center">
              {language === 'nl' 
                ? `${finalFramesToSend.length} van ${frames.length} over` 
                : `${finalFramesToSend.length} of ${frames.length} kept`}
            </span>
          </div>

          {/* Slider */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            <span className="text-[10px] text-gray-400 font-mono shrink-0 select-none">
              {language === 'nl' ? 'Gevoeligheid (Drempel):' : 'Sensitivity (Threshold):'}
            </span>
            <input
              type="range"
              min="0.02"
              max="0.35"
              step="0.01"
              value={threshold}
              onChange={(e) => onChangeThreshold(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
            />
            <span className="text-[10px] text-blue-400 font-mono font-bold shrink-0 min-w-[70px] text-right select-none">
              {Math.round(threshold * 100)}% ({finalFramesToSend.length} fr)
            </span>
          </div>
        </div>
      )}

      {/* Grid of frames */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[360px] overflow-y-auto custom-scrollbar p-1 border border-white/5 rounded-xl bg-[#0A0A0A]">
        {finalFramesToSend.map((frame, index) => (
          <div key={frame.id} className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 bg-[#121212] aspect-[9/16] transition-all">
            <img
              src={`data:image/jpeg;base64,${frame.base64}`}
              alt={`Frame ${index + 1}`}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-1 right-1 flex items-center justify-center">
              <button
                onClick={() => onDeleteFrame(frame.id)}
                className="p-1 bg-red-950/80 hover:bg-red-600 border border-red-900/40 text-red-200 hover:text-white rounded-lg transition-all shadow-md cursor-pointer opacity-90 group-hover:opacity-100"
                title="Remove frame"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="absolute bottom-1 left-1.5 text-[9px] font-mono bg-black/60 text-gray-300 px-1.5 py-0.5 rounded border border-white/5 select-none">
              #{index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-2">
          <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider text-left">
            {getTranslation('customInstructions', language)}
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Voorbeeld: 'Dit is een chat over de sprintplanning. Let speciaal op besluiten over de database-migratie.'"
            rows={3}
            className="w-full text-xs bg-[#0A0A0A] border border-white/5 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            {getTranslation('cancelBtn', language)}
          </button>
          <button
            onClick={onProcess}
            disabled={finalFramesToSend.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/30 text-white font-semibold text-xs tracking-wider uppercase rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {getTranslation('btnProcessChat', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
