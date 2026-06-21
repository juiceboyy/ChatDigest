import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Sparkles, X, ChevronLeft, Trash2 } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import { extractFramesFromVideo, FrameExtractionProgress } from './frameExtractor';
import { buildDigestFromMediaData } from './digestBuilder';

interface VideoImportWizardProps {
  files: File[];
  onParsed: (data: ChatDigestData) => void;
  onCancel: () => void;
  language: Language;
}

interface FrameItem {
  id: string;
  base64: string;
}

export default function VideoImportWizard({ files, onParsed, onCancel, language }: VideoImportWizardProps) {
  const [step, setStep] = useState<'init' | 'extracting' | 'review' | 'processing' | 'error'>('init');
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [progress, setProgress] = useState<FrameExtractionProgress>({ current: 0, total: 0 });
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState<number>(2);

  const file = files[0];
  const isVideo = file && file.type.startsWith('video/');

  useEffect(() => {
    if (step !== 'init') return;

    if (isVideo) {
      // Start extracting video frames
      setStep('extracting');
      extractFramesFromVideo(file, fps, (p) => setProgress(p))
        .then((extracted) => {
          setFrames(extracted.map((base64, index) => ({ id: `frame-${index}-${Date.now()}`, base64 })));
          setStep('review');
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Error extracting frames from video.');
          setStep('error');
        });
    } else {
      // Handle screenshot files
      setStep('extracting');
      const loadScreenshots = async () => {
        try {
          const loaded: FrameItem[] = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (!f.type.startsWith('image/')) continue;
            
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1] || (reader.result as string));
              reader.onerror = reject;
              reader.readAsDataURL(f);
            });
            loaded.push({ id: `screenshot-${i}-${Date.now()}`, base64 });
          }
          if (loaded.length === 0) {
            throw new Error("No valid image files detected.");
          }
          setFrames(loaded);
          setStep('review');
        } catch (err: any) {
          setErrorMessage(err.message || 'Error reading screenshot images.');
          setStep('error');
        }
      };
      loadScreenshots();
    }
  }, [step, file, files, isVideo, fps]);

  const handleDeleteFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
  };

  const handleProcessChat = async () => {
    if (frames.length === 0) {
      setErrorMessage('Please upload or extract at least one chat frame.');
      setStep('error');
      return;
    }

    setStep('processing');
    setErrorMessage('');

    try {
      const response = await fetch('/api/digest-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frames: frames.map((f) => f.base64),
          userPrompt: customPrompt.trim() || undefined,
          language,
        }),
      });

      if (!response.ok) {
        let errMsg = 'Failed to analyze chat media. Please try again.';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) {
          try {
            const errText = await response.text();
            errMsg = errText || errMsg;
          } catch (__) {}
        }
        throw new Error(errMsg);
      }

      const geminiData = await response.json();
      
      // Calculate remaining file details
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const compositeName = isVideo ? file.name : `${files.length} Screenshots`;

      const digest = buildDigestFromMediaData(geminiData, compositeName, totalSize);
      onParsed(digest);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while contacting the Gemini service.');
      setStep('error');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#121212] border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fadeIn" id="video-import-wizard-container">
      {/* HEADER */}
      <div className="flex items-start justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/5 rounded-xl border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            title={getTranslation('btnBack', language)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">{getTranslation('videoWizardTitle', language)}</h3>
            <p className="text-xs text-gray-400 font-light mt-0.5">{getTranslation('videoWizardDesc', language)}</p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/15">
          {isVideo ? 'Video Mode' : 'Screenshot Mode'}
        </span>
      </div>

      {/* EXTRACTING STEP */}
      {step === 'extracting' && (
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
      )}

      {/* REVIEW STEP */}
      {step === 'review' && (
        <div className="space-y-6">
          <div className="space-y-1 text-left">
            <h4 className="text-sm font-semibold text-white">{getTranslation('reviewFramesTitle', language)}</h4>
            <p className="text-xs text-gray-400 leading-relaxed font-light">{getTranslation('reviewFramesDesc', language)}</p>
          </div>

          {/* Grid of frames */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[360px] overflow-y-auto custom-scrollbar p-1 border border-white/5 rounded-xl bg-[#0A0A0A]">
            {frames.map((frame, index) => (
              <div key={frame.id} className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 bg-[#121212] aspect-[9/16] transition-all">
                <img
                  src={`data:image/jpeg;base64,${frame.base64}`}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-1 right-1 flex items-center justify-center">
                  <button
                    onClick={() => handleDeleteFrame(frame.id)}
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
                onClick={handleProcessChat}
                disabled={frames.length === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/30 text-white font-semibold text-xs tracking-wider uppercase rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {getTranslation('btnProcessChat', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING STEP */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse" />
            <div className="relative p-5 bg-blue-600/10 text-blue-400 rounded-full border border-blue-500/20 animate-spin duration-3000">
              <Sparkles className="w-12 h-12" />
            </div>
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h4 className="text-base font-semibold text-white">{getTranslation('processingChatMedia', language)}</h4>
            <p className="text-xs text-gray-400 font-light leading-relaxed">
              {getTranslation('processingChatMediaDesc', language)}
            </p>
          </div>
        </div>
      )}

      {/* ERROR STEP */}
      {step === 'error' && (
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
              onClick={() => {
                setStep('init');
                setErrorMessage('');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
            >
              Retry Extraction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
