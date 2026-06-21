import React, { useState, useRef } from 'react';
import { Upload, X, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import { parseWhatsAppFile } from '../../parser';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import { identifyNewMessages, mergeMessages, recalculateDigestStats, mergeActionItems, mergeDecisions } from '../../lib/merge';

interface UpdateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  digest: ChatDigestData;
  onSaveDigest: (data: ChatDigestData) => void;
  language: Language;
}

export default function UpdateChatModal({ isOpen, onClose, digest, onSaveDigest, language }: UpdateChatModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newCount, setNewCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
    setSuccess(false);
    setStatus(getTranslation('synthesizingGemini', language));

    const handleParsedTextFlow = async (text: string, name: string, size: number, zipAttachments?: any[]) => {
      try {
        const parsedData = parseWhatsAppFile(text, name, size);
        if (parsedData.messages.length === 0) {
          setError(getTranslation('noValidMessages', language));
          setParsing(false);
          return;
        }

        // Find new messages
        const newMessages = identifyNewMessages(digest.messages, parsedData.messages);
        if (newMessages.length === 0) {
          setError(getTranslation('noNewMessages', language));
          setParsing(false);
          return;
        }

        setNewCount(newMessages.length);
        setStatus(getTranslation('mergingAndResynthesizing', language));

        const messagesToProcess = mergeMessages(digest.messages, parsedData.messages);

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

        // Merge target digest and statistics
        const statsDigest = recalculateDigestStats(digest, messagesToProcess, name, size, zipAttachments);
        const finalData: ChatDigestData = {
          ...statsDigest,
          summary: geminiDigest.summary,
          executiveSummary: geminiDigest.executiveSummary,
          keywords: geminiDigest.keywords,
          decisions: mergeDecisions(digest.decisions, geminiDigest.decisions),
          actionItems: mergeActionItems(digest.actionItems, geminiDigest.actionItems),
        };

        onSaveDigest(finalData);
        setSuccess(true);
        setParsing(false);
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err: any) {
        setError(err.message || 'Unknown processing error.');
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
        if (!chatFileName) chatFileName = txtFiles[0];

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
          } else if (ext === 'pdf') mimeType = 'application/pdf';

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
        setError(err.message || 'ZIP processing error.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md animate-fadeIn" id="update-chat-modal">
      <div className="relative w-full max-w-xl bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          disabled={parsing}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/5 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">{getTranslation('updateDigestTitle', language)}</h2>
          <p className="text-xs text-gray-400 font-light leading-relaxed">{getTranslation('updateDigestDesc', language)}</p>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !parsing && !success && fileInputRef.current?.click()}
          className={`relative cursor-pointer transition-all duration-300 rounded-xl border border-dashed p-8 text-center flex flex-col items-center justify-center min-h-[220px] group ${
            isDragActive
              ? 'border-blue-500 bg-blue-950/10'
              : parsing || success
              ? 'border-white/5 bg-[#121212]/50 cursor-not-allowed'
              : 'border-white/10 bg-[#151515] hover:border-white/20 hover:bg-[#181818]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.zip"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            className="hidden"
            disabled={parsing || success}
          />

          {parsing ? (
            <div className="space-y-4 animate-pulse">
              <div className="p-3 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40 inline-flex items-center justify-center">
                <Sparkles className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{status}</h3>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-4 text-emerald-400">
              <div className="p-3 bg-emerald-950/40 rounded-lg border border-emerald-900/40 inline-flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {getTranslation('newMessagesFound', language).replace('{count}', String(newCount))}
                </h3>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg text-blue-500 border border-white/10 inline-flex items-center justify-center group-hover:scale-105 duration-200">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">{getTranslation('dragDropText', language)}</h3>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-start gap-3 text-rose-300 animate-fadeIn text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-200">{getTranslation('invalidAttempt', language)}</p>
              <p className="font-light mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
