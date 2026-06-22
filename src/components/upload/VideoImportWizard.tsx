import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import { extractFramesFromVideo, FrameExtractionProgress } from './frameExtractor';
import { buildDigestFromMediaData, sampleEvenly, deduplicateMessages, parseRawMediaMessages } from './digestBuilder';
import { identifyNewMessages, mergeMessages, recalculateDigestStats, mergeActionItems, mergeDecisions } from '../../lib/merge';
import { fetchWithRetry } from '../../lib/fetch';
import ReviewStep from './ReviewStep';
import { ExtractingStep, ProcessingStep, ErrorStep } from './WizardSteps';

interface VideoImportWizardProps {
  files: File[];
  onParsed: (data: ChatDigestData) => void;
  onCancel: () => void;
  language: Language;
  importMode?: 'new' | 'merge';
  mergeTargetDigest?: ChatDigestData;
}

interface FrameItem {
  id: string;
  base64: string;
  tinyData?: Uint8ClampedArray;
}

export default function VideoImportWizard({
  files,
  onParsed,
  onCancel,
  language,
  importMode = 'new',
  mergeTargetDigest,
}: VideoImportWizardProps) {
  const [step, setStep] = useState<'init' | 'extracting' | 'review' | 'processing' | 'error'>('init');
  const [frames, setFrames] = useState<FrameItem[]>([]);
  const [progress, setProgress] = useState<FrameExtractionProgress>({ current: 0, total: 0 });
  const [customPrompt, setCustomPrompt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fps, setFps] = useState<number>(2);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, isSynthesizing: false });
  
  const threshold = 0.20;
  const file = files[0];
  const isVideo = file && file.type.startsWith('video/');

  useEffect(() => {
    if (step !== 'init') return;
    if (isVideo) {
      setStep('extracting');
      extractFramesFromVideo(file, fps, (p) => setProgress(p))
        .then((extracted) => {
          setFrames(extracted.map((f, idx) => ({ id: `frame-${idx}-${Date.now()}`, base64: f.base64, tinyData: f.tinyData })));
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
            const base64 = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res((r.result as string).split(',')[1]);
              r.onerror = rej;
              r.readAsDataURL(f);
            });
            loaded.push({ id: `screenshot-${i}-${Date.now()}`, base64 });
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

  const filteredFrames = useMemo(() => {
    if (frames.length === 0) return [];
    const result = [frames[0]];
    let prevTiny = frames[0].tinyData;
    if (!prevTiny) return frames;
    for (let i = 1; i < frames.length; i++) {
      const currentFrame = frames[i];
      const currentTiny = currentFrame.tinyData;
      if (!currentTiny) { result.push(currentFrame); continue; }
      let diffSum = 0;
      for (let j = 0; j < currentTiny.length; j += 4) {
        diffSum += Math.abs(currentTiny[j] - prevTiny[j]);
        diffSum += Math.abs(currentTiny[j + 1] - prevTiny[j + 1]);
        diffSum += Math.abs(currentTiny[j + 2] - prevTiny[j + 2]);
      }
      const maxDiff = 32 * 32 * 3 * 255;
      if ((diffSum / maxDiff) >= threshold) {
        result.push(currentFrame);
        prevTiny = currentTiny;
      }
    }
    return result;
  }, [frames, threshold]);

  const handleProcessChat = async () => {
    if (filteredFrames.length === 0) {
      setErrorMessage('Please upload or extract at least one chat frame.');
      setStep('error');
      return;
    }
    setStep('processing');
    setErrorMessage('');

    const chunkSize = 6;
    const chunks: FrameItem[][] = [];
    for (let i = 0; i < filteredFrames.length; i += (chunkSize - 1)) {
      const chunk = filteredFrames.slice(i, i + chunkSize);
      if (chunk.length > 0) chunks.push(chunk);
      if (chunkSize <= 1) break;
    }

    try {
      let allMessages: any[] = [];
      for (let c = 0; c < chunks.length; c++) {
        setProcessingProgress({ current: c + 1, total: chunks.length, isSynthesizing: false });
        if (c > 0) {
          await new Promise(res => setTimeout(res, 1500)); // Delay between requests
        }
        const chunk = chunks[c];
        const response = await fetchWithRetry('/api/digest-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames: chunk.map((f) => f.base64), language, extractMessagesOnly: true }),
        }, 2, 1200);

        if (!response.ok) {
          let serverError = '';
          try {
            const errData = await response.json();
            serverError = errData.error || errData.errorMessage || errData.message || '';
          } catch (_) {
            try { serverError = await response.text(); } catch (__) {}
          }
          throw new Error(`Failed to parse chunk ${c + 1} of ${chunks.length}${serverError ? `: ${serverError}` : ''}`);
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

      const parsedNewMessages = parseRawMediaMessages(uniqueMessages);
      let messagesToProcess = parsedNewMessages;

      if (importMode === 'merge' && mergeTargetDigest) {
        const newMessages = identifyNewMessages(mergeTargetDigest.messages, parsedNewMessages);
        if (newMessages.length === 0) {
          throw new Error(
            language === 'nl'
              ? 'Geen nieuwe berichten gevonden in deze screenshots/video.'
              : 'No new messages found in these screenshots/video.'
          );
        }
        messagesToProcess = mergeMessages(mergeTargetDigest.messages, parsedNewMessages);
      }

      const maxMsgsForDigest = 1200;
      const slicedMessagesForDigest = messagesToProcess.length > maxMsgsForDigest
        ? messagesToProcess.slice(-maxMsgsForDigest)
        : messagesToProcess;

      const digestResponse = await fetchWithRetry('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: isVideo ? file.name : `${files.length} Screenshots`,
          fileSize: files.reduce((acc, f) => acc + f.size, 0),
          messages: slicedMessagesForDigest,
          language
        }),
      }, 2, 1200);

      if (!digestResponse.ok) {
        throw new Error("Failed to compile final analytical digest from reconstructed messages.");
      }
      const geminiDigest = await digestResponse.json();
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const compositeName = isVideo ? file.name : `${files.length} Screenshots`;

      if (importMode === 'merge' && mergeTargetDigest) {
        const statsDigest = recalculateDigestStats(
          mergeTargetDigest,
          messagesToProcess,
          compositeName,
          totalSize
        );
        const finalData: ChatDigestData = {
          ...statsDigest,
          summary: geminiDigest.summary,
          executiveSummary: geminiDigest.executiveSummary,
          keywords: geminiDigest.keywords,
          decisions: mergeDecisions(mergeTargetDigest.decisions, geminiDigest.decisions),
          actionItems: mergeActionItems(mergeTargetDigest.actionItems, geminiDigest.actionItems),
        };
        onParsed(finalData);
      } else {
        const digest = buildDigestFromMediaData({
          messages: uniqueMessages,
          summary: geminiDigest.summary,
          executiveSummary: geminiDigest.executiveSummary,
          keywords: geminiDigest.keywords,
          decisions: geminiDigest.decisions,
          actionItems: geminiDigest.actionItems
        }, compositeName, totalSize);
        onParsed(digest);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while contacting the Gemini service.');
      setStep('error');
    }
  };

  const handleDeleteFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
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
          finalFramesToSend={filteredFrames}
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
          onRetry={() => { setStep('init'); setErrorMessage(''); }}
          language={language}
        />
      )}
    </div>
  );
}
