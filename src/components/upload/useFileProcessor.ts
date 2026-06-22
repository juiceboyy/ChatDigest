import { useState } from 'react';
import JSZip from 'jszip';
import { parseWhatsAppFile } from '../../parser';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import { identifyNewMessages, mergeMessages, recalculateDigestStats, mergeActionItems, mergeDecisions } from '../../lib/merge';

interface UseFileProcessorProps {
  language: Language;
  importMode: 'new' | 'merge';
  mergeTargetId: string;
  digests: ChatDigestData[];
  onParsed: (data: ChatDigestData) => void;
  setError: (err: string | null) => void;
  setParsing: (val: boolean) => void;
}

export function useFileProcessor({
  language,
  importMode,
  mergeTargetId,
  digests,
  onParsed,
  setError,
  setParsing,
}: UseFileProcessorProps) {

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

        const maxMsgsForDigest = 1200;
        const slicedMessagesForDigest = messagesToProcess.length > maxMsgsForDigest
          ? messagesToProcess.slice(-maxMsgsForDigest)
          : messagesToProcess;

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
              completed: a.completed || false,
              completedBy: a.completedBy || undefined,
              completedMessage: a.completedMessage || undefined,
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

  return { processFile };
}
