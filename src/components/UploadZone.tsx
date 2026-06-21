import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Sparkles } from 'lucide-react';
import JSZip from 'jszip';
import { parseWhatsAppFile } from '../parser';
import { ChatDigestData } from '../types';
import { Language, getTranslation } from '../lib/translations';
import { identifyNewMessages, mergeMessages, recalculateDigestStats, mergeActionItems, mergeDecisions } from '../lib/merge';
import UploadTutorial from './UploadTutorial';

interface UploadZoneProps {
  onParsed: (data: ChatDigestData) => void;
  language: Language;
  digests?: ChatDigestData[];
}

export default function UploadZone({ onParsed, language, digests = [] }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importMode, setImportMode] = useState<'new' | 'merge'>('new');
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (digests.length > 0 && !mergeTargetId) {
      setMergeTargetId(digests[0].id);
    }
  }, [digests, mergeTargetId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    if (!file.name.endsWith('.txt') && !isZip) {
      setError(getTranslation('unsupportedFile', language));
      return;
    }

    setError(null);
    setParsing(true);

    const handleParsedTextFlow = async (text: string, name: string, size: number, zipAttachments?: any[]) => {
      try {
        const parsedData = parseWhatsAppFile(text, name, size);
        if (parsedData.messages.length === 0) {
          setError(getTranslation('noValidMessages', language));
          setParsing(false);
          return;
        }

        let messagesToProcess = parsedData.messages;
        let targetDigest: ChatDigestData | undefined;

        if (importMode === 'merge') {
          targetDigest = digests.find(d => d.id === mergeTargetId);
          if (targetDigest) {
            const newMessages = identifyNewMessages(targetDigest.messages, parsedData.messages);
            if (newMessages.length === 0) {
              setError(getTranslation('noNewMessages', language));
              setParsing(false);
              return;
            }
            messagesToProcess = mergeMessages(targetDigest.messages, parsedData.messages);
          }
        }

        // Slice messages payload on the client side to avoid HTTP payload size limits
        const maxMsgsForDigest = 1200;
        const slicedMessagesForDigest = messagesToProcess.length > maxMsgsForDigest
          ? messagesToProcess.slice(-maxMsgsForDigest)
          : messagesToProcess;

        // Fetch the premium Gemini AI digest analysis from the backend server
        const response = await fetch('/api/digest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: name,
            fileSize: size,
            messages: slicedMessagesForDigest,
            language: language,
          }),
        });

        if (!response.ok) {
          let errMsg = getTranslation('serverFailed', language);
          try {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } catch (e) {
            try {
              const errText = await response.text();
              errMsg = errText || response.statusText || errMsg;
            } catch (_) {
              errMsg = response.statusText || errMsg;
            }
          }
          throw new Error(errMsg);
        }

        const geminiDigest = await response.json();

        let finalData: ChatDigestData;

        if (importMode === 'merge' && targetDigest) {
          const statsDigest = recalculateDigestStats(targetDigest, messagesToProcess, name, size, zipAttachments);
          finalData = {
            ...statsDigest,
            summary: geminiDigest.summary,
            executiveSummary: geminiDigest.executiveSummary,
            keywords: geminiDigest.keywords,
            decisions: mergeDecisions(targetDigest.decisions, geminiDigest.decisions),
            actionItems: mergeActionItems(targetDigest.actionItems, geminiDigest.actionItems),
          };
        } else {
          finalData = {
            ...parsedData,
            summary: geminiDigest.summary,
            executiveSummary: geminiDigest.executiveSummary,
            keywords: geminiDigest.keywords,
            decisions: geminiDigest.decisions.map((d: any, i: number) => ({
              id: `dec-g-${i}-${Date.now()}`,
              sender: d.sender,
              text: d.text,
              dateStr: d.dateStr,
            })),
            actionItems: geminiDigest.actionItems.map((a: any, i: number) => ({
              id: `act-g-${i}-${Date.now()}`,
              sender: a.sender,
              text: a.text,
              dateStr: a.dateStr,
              completed: false,
            })),
            zipAttachments,
          };
        }

        onParsed(finalData);
      } catch (err: any) {
        setError(`${getTranslation('parsingError', language)}: ${err.message || 'Unknown processing error.'}`);
      } finally {
        setParsing(false);
      }
    };

    if (isZip) {
      try {
        const zip = await JSZip.loadAsync(file);
        const txtFiles = Object.keys(zip.files).filter(name => name.endsWith('.txt') && !name.startsWith('__MACOSX/') && !zip.files[name].dir);
        if (txtFiles.length === 0) {
          setError('Could not find any .txt chat history file in the uploaded ZIP archive.');
          setParsing(false);
          return;
        }

        let chatFileName = txtFiles.find(name => name.toLowerCase().endsWith('_chat.txt'));
        if (!chatFileName) {
          let largestSize = -1;
          for (const fName of txtFiles) {
            const entry = zip.files[fName];
            const size = (entry as any)._data?.uncompressedSize || 0;
            if (size > largestSize) {
              largestSize = size;
              chatFileName = fName;
            }
          }
        }
        if (!chatFileName) {
          chatFileName = txtFiles[0];
        }

        const chatFileEntry = zip.files[chatFileName];
        const rawText = await chatFileEntry.async('string');

        const supportedMediaExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'pdf'];
        const zipAttachments: any[] = [];

        const mediaFiles = Object.keys(zip.files).filter(name => {
          const lowerName = name.toLowerCase();
          const ext = lowerName.split('.').pop() || '';
          return (
            supportedMediaExtensions.includes(ext) &&
            !name.startsWith('__MACOSX/') &&
            !zip.files[name].dir
          );
        });

        for (const mName of mediaFiles) {
          const entry = zip.files[mName];
          const ext = mName.split('.').pop()?.toLowerCase() || '';
          let mimeType = 'application/octet-stream';
          if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
            mimeType = `audio/${ext === 'mp3' ? 'mpeg' : ext === 'm4a' ? 'mp4' : ext}`;
          } else if (ext === 'pdf') {
            mimeType = 'application/pdf';
          }

          try {
            const base64Data = await entry.async('base64');
            const uncompressedSize = (entry as any)._data?.uncompressedSize || 0;
            const cleanName = mName.split('/').pop() || mName;

            zipAttachments.push({
              name: cleanName,
              mimeType,
              base64: base64Data,
              size: uncompressedSize
            });
          } catch (err) {
            console.warn(`Could not extract media file ${mName}:`, err);
          }
        }

        await handleParsedTextFlow(rawText, chatFileName, file.size, zipAttachments);
      } catch (err: any) {
        setError(`${getTranslation('zipError', language)}: ${err.message}`);
        setParsing(false);
      }
    } else {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target?.result as string;
          if (!text) {
            setError(getTranslation('emptyFile', language));
            setParsing(false);
            return;
          }
          await handleParsedTextFlow(text, file.name, file.size);
        };
        reader.onerror = () => {
          setError(getTranslation('failedReadLocal', language));
          setParsing(false);
        };
        reader.readAsText(file, 'utf-8');
      } catch (err: any) {
        setError(`File error: ${err.message}`);
        setParsing(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto" id="upload-zone-container">
      {digests && digests.length > 0 && (
        <div className="mb-6 bg-[#121212] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left animate-fadeIn">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">Import Option</h4>
            <p className="text-[10px] text-gray-500 font-light">Create a new digest or append to an existing one.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 select-none">
              <button
                type="button"
                onClick={() => setImportMode('new')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  importMode === 'new' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {getTranslation('importOptionNew', language)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportMode('merge');
                  if (!mergeTargetId && digests.length > 0) {
                    setMergeTargetId(digests[0].id);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  importMode === 'merge' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {getTranslation('importOptionMerge', language)}
              </button>
            </div>

            {importMode === 'merge' && (
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="bg-[#1a1a1a] text-white text-xs font-semibold px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-blue-500"
              >
                {digests.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || d.fileName.replace('.txt', '')}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div
        id="drag-drop-box"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        className={`relative cursor-pointer transition-all duration-300 rounded-xl border border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[300px] group ${
          isDragActive
            ? 'border-blue-500 bg-blue-950/10'
            : 'border-white/10 bg-[#121212] hover:border-white/20 hover:bg-[#151515]'
        }`}
      >
        <input
          id="file-element-input"
          ref={fileInputRef}
          type="file"
          accept=".txt,.zip"
          onChange={handleChange}
          className="hidden"
        />

        {parsing ? (
          <div className="space-y-6 animate-pulse" id="parsing-loader">
            <div className="p-4 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40 inline-flex items-center justify-center">
              <Sparkles className="w-12 h-12 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{getTranslation('synthesizingGemini', language)}</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                {getTranslation('synthesizingDesc', language)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6" id="upload-idle-state">
            <div className="p-5 bg-white/5 rounded-lg text-blue-500 border border-white/10 inline-flex items-center justify-center shadow-inner group-hover:scale-105 duration-200">
              <Upload className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-lg font-medium text-white">{getTranslation('assembleDigest', language)}</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                {getTranslation('dragDropText', language)}
              </p>
            </div>

            <div className="text-xs text-gray-500 inline-flex items-center gap-1.5 bg-white/3 py-1.5 px-3 rounded border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              {getTranslation('privateProcessing', language)}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div id="upload-error" className="mt-4 p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-start gap-3 text-rose-300 shadow-sm animate-fadeIn text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">{getTranslation('invalidAttempt', language)}</p>
            <p className="leading-relaxed font-light">{error}</p>
          </div>
        </div>
      )}

      <UploadTutorial language={language} />
    </div>
  );
}
