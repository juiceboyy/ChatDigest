import React, { useState, useRef, useEffect } from 'react';
import { Upload, AlertCircle, Sparkles } from 'lucide-react';
import { ChatDigestData } from '../types';
import { Language, getTranslation } from '../lib/translations';
import UploadTutorial from './UploadTutorial';
import { useFileProcessor } from './upload/useFileProcessor';
import VideoImportWizard from './upload/VideoImportWizard';

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
  const [wizardFiles, setWizardFiles] = useState<File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (digests.length > 0 && !mergeTargetId) {
      setMergeTargetId(digests[0].id);
    }
  }, [digests, mergeTargetId]);

  const { processFile } = useFileProcessor({
    language,
    importMode,
    mergeTargetId,
    digests,
    onParsed,
    setError,
    setParsing,
  });

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
    handleIncomingFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleIncomingFiles(e.target.files);
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  // If the user has uploaded video/screenshots, render the Wizard instead of the dropzone
  if (wizardFiles) {
    return (
      <VideoImportWizard
        files={wizardFiles}
        onParsed={onParsed}
        onCancel={() => setWizardFiles(null)}
        language={language}
      />
    );
  }

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
          accept=".txt,.zip,video/mp4,video/quicktime,video/webm,image/*"
          multiple
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
              <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto leading-relaxed text-center">
                Drag and drop your WhatsApp export (.txt/.zip), screen recording video (.mp4), or screenshots here, or click to browse.
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
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-450 font-bold" />
          <div className="space-y-1 text-left">
            <p className="font-semibold text-rose-250">{getTranslation('invalidAttempt', language)}</p>
            <p className="leading-relaxed font-light">{error}</p>
          </div>
        </div>
      )}

      <UploadTutorial language={language} />
    </div>
  );
}
