import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Sparkles } from 'lucide-react';
import JSZip from 'jszip';
import { parseWhatsAppFile } from '../parser';
import { ChatDigestData } from '../types';

interface UploadZoneProps {
  onParsed: (data: ChatDigestData) => void;
}

export default function UploadZone({ onParsed }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setError('Unsupported file type. Please upload a standard WhatsApp export .txt file or a WhatsApp export with media ZIP archive.');
      return;
    }

    setError(null);
    setParsing(true);

    const handleParsedTextFlow = async (text: string, name: string, size: number, zipAttachments?: any[]) => {
      try {
        const parsedData = parseWhatsAppFile(text, name, size);
        if (parsedData.messages.length === 0) {
          setError('Could not identify any valid WhatsApp message structures in this file. Please make sure this is a WhatsApp export with timestamps.');
          setParsing(false);
          return;
        }

        // Slice messages payload on the client side to avoid HTTP payload size limits (e.g., in nginx or express limits)
        const maxMsgsForDigest = 1200;
        const slicedMessagesForDigest = parsedData.messages.length > maxMsgsForDigest
          ? parsedData.messages.slice(-maxMsgsForDigest)
          : parsedData.messages;

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
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Server failed to analyze log with Gemini');
        }

        const geminiDigest = await response.json();

        // Merge beautiful Gemini analysis with deterministic local analytics
        const finalData: ChatDigestData = {
          ...parsedData,
          summary: geminiDigest.summary,
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

        onParsed(finalData);
      } catch (err: any) {
        setError(`Gemini Parsing Error: ${err.message || 'Unknown processing error.'}. Please make sure your GEMINI_API_KEY is active under Settings > Secrets.`);
      } finally {
        setParsing(false);
      }
    };

    if (isZip) {
      try {
        const zip = await JSZip.loadAsync(file);
        
        // Find .txt files
        const txtFiles = Object.keys(zip.files).filter(name => name.endsWith('.txt') && !name.startsWith('__MACOSX/') && !zip.files[name].dir);
        if (txtFiles.length === 0) {
          setError('Could not find any .txt chat history file in the uploaded ZIP archive.');
          setParsing(false);
          return;
        }

        // Find '_chat.txt' if available, otherwise just pick the largest one.
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

        // Extract media items
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
        setError(`ZIP file analysis error: ${err.message}`);
        setParsing(false);
      }
    } else {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const text = e.target?.result as string;
          if (!text) {
            setError('The text file appears to be empty.');
            setParsing(false);
            return;
          }
          await handleParsedTextFlow(text, file.name, file.size);
        };
        reader.onerror = () => {
          setError('Failed to read the file locally.');
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
      <div
        id="drag-drop-box"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        className={`relative cursor-pointer transition-all duration-300 rounded-xl border border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[340px] group ${
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
              <h3 className="text-xl font-semibold text-white">Synthesizing with Gemini AI...</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                Determining meeting topics, tracking participant sentiment, mapping key consensus agreements, and extracting follow-up action items privately via Gemini.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6" id="upload-idle-state">
            <div className="p-5 bg-white/5 rounded-lg text-blue-500 border border-white/10 inline-flex items-center justify-center shadow-inner group-hover:scale-105 duration-200">
              <Upload className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-lg font-medium text-white">Assemble WhatsApp Digest</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                Drag and drop your exported WhatsApp <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono border border-blue-500/20 text-xs text-nowrap">.txt</span> file or <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono border border-blue-500/20 text-xs text-nowrap">.zip</span> media archive here, or click to browse.
              </p>
            </div>

            <div className="text-xs text-gray-500 inline-flex items-center gap-1.5 bg-white/3 py-1.5 px-3 rounded border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Private Processing — Private, server-side log analysis using Gemini 3.5 Flash
            </div>
          </div>
        )}
      </div>

      {error && (
        <div id="upload-error" className="mt-4 p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-start gap-3 text-rose-300 shadow-sm animate-fadeIn text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">Invalid File Attempt</p>
            <p className="leading-relaxed font-light">{error}</p>
          </div>
        </div>
      )}

      <div className="mt-8 p-5 bg-[#121212] rounded-xl border border-white/5 text-left" id="whatsapp-tutorial">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-3">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          How do I export my WhatsApp logs?
        </h4>
        <ol className="list-decimal list-inside space-y-2 text-xs text-gray-500 leading-relaxed font-light">
          <li>Open the WhatsApp thread on your device.</li>
          <li>Tap the participant display or settings bar at the top, then choose <b className="text-gray-300 font-medium">Export Chat</b>.</li>
          <li>Select <b className="text-gray-300 font-medium">"Attach Media"</b> to generate a complete <b className="text-gray-300 font-medium">.zip</b> archive containing the raw text log and files list, or <b className="text-gray-300 font-medium">"Without Media"</b> for a simple text file.</li>
          <li>Import the resulting <b className="text-gray-300 font-medium">.txt</b> or <b className="text-gray-300 font-medium">.zip</b> file directly here to begin parsing.</li>
        </ol>
      </div>
    </div>
  );
}
