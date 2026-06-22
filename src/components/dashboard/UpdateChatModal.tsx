import React, { useState, useRef } from 'react';
import { Upload, X, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { Language, getTranslation } from '../../lib/translations';
import { useFileProcessor } from '../upload/useFileProcessor';
import VideoImportWizard from '../upload/VideoImportWizard';

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
  const [parsing, setParsing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newCount, setNewCount] = useState<number>(0);
  const [wizardFiles, setWizardFiles] = useState<File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { processFile } = useFileProcessor({
    language,
    importMode: 'merge',
    mergeTargetId: digest.id,
    digests: [digest],
    onParsed: (newDigest) => {
      const count = newDigest.messages.length - digest.messages.length;
      setNewCount(count);
      onSaveDigest(newDigest);
      setSuccess(true);
      setParsing(false);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    },
    setError,
    setParsing,
  });

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

  const handleIncomingFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const fileArray = Array.from(fileList);
    const firstFile = fileArray[0];
    const isMedia = firstFile.type.startsWith('video/') || firstFile.type.startsWith('image/');

    if (isMedia) {
      setError(null);
      setWizardFiles(fileArray);
    } else {
      processFile(firstFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files) {
      handleIncomingFiles(e.dataTransfer.files);
    }
  };

  if (wizardFiles) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-[#0A0A0A]/85 backdrop-blur-md overflow-y-auto animate-fadeIn" id="update-chat-modal">
        <VideoImportWizard
          files={wizardFiles}
          onParsed={(newDigest) => {
            onSaveDigest(newDigest);
            onClose();
          }}
          onCancel={() => setWizardFiles(null)}
          language={language}
          importMode="merge"
          mergeTargetDigest={digest}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-[#0A0A0A]/85 backdrop-blur-md overflow-y-auto animate-fadeIn" id="update-chat-modal">
      <div className="relative w-full max-w-xl bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          disabled={parsing}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/5 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 text-left">
          <h2 className="text-lg font-semibold text-white">{getTranslation('updateDigestTitle', language)}</h2>
          <p className="text-xs text-gray-400 font-light leading-relaxed">
            {language === 'nl'
              ? 'Upload een nieuw WhatsApp exportbestand (.txt/.zip), screen recording video (.mp4) of screenshots om nieuwe berichten toe te voegen aan dit overzicht.'
              : 'Upload a new WhatsApp export file (.txt/.zip), screen recording video (.mp4), or screenshots to add new messages to this digest.'}
          </p>
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
            accept=".txt,.zip,video/mp4,video/quicktime,video/webm,image/*"
            multiple
            onChange={(e) => e.target.files && handleIncomingFiles(e.target.files)}
            className="hidden"
            disabled={parsing || success}
          />

          {parsing ? (
            <div className="space-y-4 animate-pulse">
              <div className="p-3 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40 inline-flex items-center justify-center">
                <Sparkles className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{getTranslation('synthesizingGemini', language)}</h3>
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
                <h3 className="text-sm font-medium text-white">
                  {language === 'nl'
                    ? 'Sleep uw bestand (.txt/.zip), video (.mp4) of screenshots hiernaartoe, of klik om te bladeren.'
                    : 'Drag and drop your file (.txt/.zip), video (.mp4), or screenshots here, or click to browse.'}
                </h3>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex items-start gap-3 text-rose-300 animate-fadeIn text-xs leading-relaxed text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-450 font-bold" />
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
