import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import { extractFramesFromVideo, FrameExtractionProgress } from './frameExtractor';
import { buildDigestFromMediaData, sampleEvenly, deduplicateMessages } from './digestBuilder';
import ReviewStep from './ReviewStep';
import { ExtractingStep, ProcessingStep, ErrorStep } from './WizardSteps';

interface VideoImportWizardProps {
  files: File[];
  onParsed: (data: ChatDigestData) => void;
  onCancel: () => void;
  language: Language;
}

interface FrameItem {
  id: string;
  base64: string;
  tinyData?: Uint8ClampedArray;
}

export default function VideoImportWizard({ files, onParsed, onCancel, language }: VideoImportWizardProps) {
  const [step, setStep] = useState<'init' | 'extracting' | 'review' | 'processing' | 'error'>('init');
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [progress, setProgress] = useState<FrameExtractionProgress>({ current: 0, total: 0 });
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState<number>(2);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, isSynthesizing: false });
  
  // Custom threshold set to 20% by default, which can be custom-tuned inside ReviewStep if we expose it
  const threshold = 0.20;

  const file = files[0];
  const isVideo = file && file.type.startsWith('video/');

  useEffect(() => {
    if (step !== 'init') return;

    if (isVideo) {
      setStep('extracting');
      extractFramesFromVideo(file, fps, (p) => setProgress(p))
        .then((extracted) => {
          setFrames(
            extracted.map((f, index) => ({
              id: `frame-${index}-${Date.now()}`,
              base64: f.base64,
              tinyData: f.tinyData,
            }))
          );
          setStep('review');
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Error extracting frames from video.');
          setStep('error');
        });
    } else {
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

  // Compute filtered frames using 20% pixel threshold
  const filteredFrames = useMemo(() => {
    if (frames.length === 0) return [];
    const result = [frames[0]];
    let prevTiny = frames[0].tinyData;
    if (!prevTiny) return frames;

    for (let i = 1; i < frames.length; i++) {
      const currentFrame = frames[i];
      const currentTiny = currentFrame.tinyData;
      if (!currentTiny) {
        result.push(currentFrame);
        continue;
      }
      
      let diffSum = 0;
      for (let j = 0; j < currentTiny.length; j += 4) {
        diffSum += Math.abs(currentTiny[j] - prevTiny[j]);
        diffSum += Math.abs(currentTiny[j + 1] - prevTiny[j + 1]);
        diffSum += Math.abs(currentTiny[j + 2] - prevTiny[j + 2]);
      }
      
      const maxDiff = 32 * 32 * 3 * 255;
      const averageDiff = diffSum / maxDiff;
      
      if (averageDiff >= threshold) {
        result.push(currentFrame);
        prevTiny = currentTiny;
      }
    }
    return result;
  }, [frames, threshold]);

  const handleDeleteFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
  };

  const handleProcessChat = async () => {
    if (filteredFrames.length === 0) {
      setErrorMessage('Please upload or extract at least one chat frame.');
      setStep('error');
      return;
    }

    setStep('processing');
    setErrorMessage('');

    // Chunk frames into sets of 8 (with 1 overlapping frame) to bypass Netlify 10s timeout
    const chunkSize = 8;
    const chunks: FrameItem[][] = [];

    for (let i = 0; i < filteredFrames.length; i += (chunkSize - 1)) {
      const chunk = filteredFrames.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      if (chunkSize <= 1) break;
    }

    try {
      let allMessages: any[] = [];

      for (let c = 0; c < chunks.length; c++) {
        setProcessingProgress({ current: c + 1, total: chunks.length, isSynthesizing: false });
        
        const chunk = chunks[c];
        const response = await fetch('/api/digest-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frames: chunk.map((f) => f.base64),
            language,
            extractMessagesOnly: true
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to parse chunk ${c + 1} of ${chunks.length}.`);
        }

        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          allMessages = [...allMessages, ...data.messages];
        }
      }

      setProcessingProgress({ current: chunks.length, total: chunks.length, isSynthesizing: true });
      
      const uniqueMessages = deduplicateMessages(allMessages);
      if (uniqueMessages.length === 0) {
        throw new Error("Gemini did not find any valid chat messages inside the screenshots.");
      }

      const digestResponse = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: isVideo ? file.name : `${files.length} Screenshots`,
          fileSize: files.reduce((acc, f) => acc + f.size, 0),
          messages: uniqueMessages,
          language
        }),
      });

      if (!digestResponse.ok) {
        throw new Error("Failed to compile final analytical digest from reconstructed messages.");
      }

      const geminiDigest = await digestResponse.json();
      
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const compositeName = isVideo ? file.name : `${files.length} Screenshots`;

      const digest = buildDigestFromMediaData({
        messages: uniqueMessages,
        summary: geminiDigest.summary,
        executiveSummary: geminiDigest.executiveSummary,
        keywords: geminiDigest.keywords,
        decisions: geminiDigest.decisions,
        actionItems: geminiDigest.actionItems
      }, compositeName, totalSize);
      
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
        <ExtractingStep isVideo={isVideo} progress={progress} language={language} />
      )}

      {/* REVIEW STEP */}
      {step === 'review' && (
        <ReviewStep
          isVideo={isVideo}
          frames={frames}
          finalFramesToSend={filteredFrames} // Pass ALL filtered frames to show and process rather than capping at 8!
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          language={language}
          onDeleteFrame={handleDeleteFrame}
          onCancel={onCancel}
          onProcess={handleProcessChat}
        />
      )}

      {/* PROCESSING STEP */}
      {step === 'processing' && (
        <ProcessingStep processingProgress={processingProgress} language={language} />
      )}

      {/* ERROR STEP */}
      {step === 'error' && (
        <ErrorStep
          errorMessage={errorMessage}
          onCancel={onCancel}
          onRetry={() => {
            setStep('init');
            setErrorMessage('');
          }}
          language={language}
        />
      )}
    </div>
  );
}
