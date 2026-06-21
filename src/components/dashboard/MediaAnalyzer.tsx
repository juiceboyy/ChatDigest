import React from 'react';
import {
  Image, FileUp, FileText, FileAudio, Loader2, AlertCircle, Check, PlusCircle,
  ShieldCheck, CheckCircle2, CheckSquare, X, File as FileIcon,
} from 'lucide-react';
import { ChatDigestData, ParsedMedia } from '../../types';

interface MediaAnalyzerProps {
  digest: ChatDigestData;
  mediaFile: File | null;
  mediaBase64: string | null;
  mediaLoading: boolean;
  mediaError: string | null;
  parsedMediaResult: ParsedMedia | null;
  customPrompt: string;
  onCustomPromptChange: (val: string) => void;
  onMediaFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetMediaFromZip: (item: { name: string; mimeType: string; size: number; base64: string }) => void;
  onClearMedia: () => void;
  onAnalyzeMedia: () => void;
  onMergeMediaIntoDigest: (result: ParsedMedia) => void;
  onDeleteParsedMedia: (id: string) => void;
}

export default function MediaAnalyzer({
  digest,
  mediaFile,
  mediaBase64,
  mediaLoading,
  mediaError,
  parsedMediaResult,
  customPrompt,
  onCustomPromptChange,
  onMediaFileChange,
  onSetMediaFromZip,
  onClearMedia,
  onAnalyzeMedia,
  onMergeMediaIntoDigest,
  onDeleteParsedMedia,
}: MediaAnalyzerProps) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('audio/')) return FileAudio;
    return FileText;
  };

  return (
    <div
      className="p-6 bg-[#121212] border border-white/5 rounded-xl hover:border-white/10 transition-all duration-200 mb-6 animate-fadeIn"
      id="multimodal-media-analyzer"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Image className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Multimodal Media Analyzer</h3>
            <p className="text-[10px] uppercase text-gray-400 tracking-wider font-mono">Parse images, audio, and documents with Gemini AI</p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-mono bg-[#0A0A0A] text-gray-500 px-2 py-0.5 rounded border border-white/5 self-start sm:self-center">
          Omni-media Beta
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="media-analyzer-workspace">
        {/* LEFT: Upload & Prompt */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs text-gray-400 leading-relaxed font-light">
            Upload images, voice notes, drawing sketches, or document PDFs shared during discussions. Gemini will analyze the media directly in the context of your conversation backup themes.
          </div>

          {/* File drop zone */}
          <div className="relative border border-dashed border-white/10 hover:border-white/20 transition-all rounded-lg p-5 bg-[#0A0A0A] text-center" id="media-file-dropzone">
            <input
              type="file"
              accept="image/*,audio/*,application/pdf"
              onChange={onMediaFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 font-sans"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-2.5 bg-white/5 text-gray-405 rounded-full border border-white/5">
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-300">
                  {mediaFile ? mediaFile.name : 'Select Media Attachment'}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {mediaFile ? `${(mediaFile.size / 1024).toFixed(1)} KB • ${mediaFile.type}` : 'Drag and drop Images, Audio, or PDFs (max 15MB)'}
                </p>
              </div>
            </div>
          </div>

          {/* ZIP attachment deck */}
          {digest.zipAttachments && digest.zipAttachments.length > 0 && (
            <div className="p-3 bg-[#0A0A0A] border border-white/5 rounded-lg space-y-2" id="zip-attachments-deck">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-bold">
                  Files Extracted from Backup ZIP ({digest.zipAttachments.length})
                </span>
                <span className="text-[8px] uppercase tracking-widest font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/15">
                  Attachment Deck
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                {digest.zipAttachments.map((item, idx) => {
                  const isSelected = mediaFile && mediaFile.name === item.name;
                  const Icon = getFileIcon(item.mimeType);
                  return (
                    <button
                      key={idx}
                      onClick={() => onSetMediaFromZip(item)}
                      className={`p-1.5 rounded border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-blue-300 animate-pulse'
                          : 'bg-[#121212] border-white/5 hover:border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className={`p-1 rounded shrink-0 ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium truncate leading-tight">{item.name}</p>
                        <p className="text-[9px] text-gray-500 font-mono">{(item.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prompt + analyze button */}
          {mediaFile && (
            <div className="space-y-3 bg-[#0A0A0A] p-3 border border-white/5 rounded-lg animate-fadeIn">
              {mediaBase64 && (
                <div className="flex flex-col items-center justify-center p-2.5 bg-[#121212] rounded border border-white/5 space-y-2">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] text-gray-500 font-mono uppercase">Media Preview</span>
                    <button onClick={onClearMedia} className="text-[9px] hover:text-red-400 text-gray-500 flex items-center gap-0.5">
                      <X className="w-2.5 h-2.5" /> Clear
                    </button>
                  </div>
                  {mediaFile.type.startsWith('image/') ? (
                    <img src={`data:${mediaFile.type};base64,${mediaBase64}`} alt={mediaFile.name} className="max-h-36 object-contain rounded border border-white/10" referrerPolicy="no-referrer" />
                  ) : mediaFile.type.startsWith('audio/') ? (
                    <audio src={`data:${mediaFile.type};base64,${mediaBase64}`} controls className="w-full max-w-xs h-8 rounded opacity-90" />
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <span className="truncate max-w-[180px]">{mediaFile.name}</span>
                    </div>
                  )}
                </div>
              )}

              <label className="block text-[11px] font-mono text-gray-400 uppercase tracking-wider">Analysis Target / Custom Instructions (Optional)</label>
              <textarea
                value={customPrompt}
                onChange={(e) => onCustomPromptChange(e.target.value)}
                placeholder="Explain what to analyze (e.g., 'Who approved this dashboard diagram?', 'Provide a full transcript of this audio snippet', 'Summarize this file requirements...')"
                rows={2}
                className="w-full text-xs bg-[#121212] border border-white/5 rounded p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
              />
              <button
                onClick={onAnalyzeMedia}
                disabled={mediaLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/30 text-white font-semibold text-xs tracking-wide uppercase rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:cursor-not-allowed"
              >
                {mediaLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Decomposing Media...</> : <><span>✨</span> Analyze with Gemini Flash</>}
              </button>
            </div>
          )}

          {mediaLoading && (
            <div className="p-3 bg-blue-950/10 border border-blue-900/30 text-blue-300 text-[11px] rounded-lg space-y-1.5 animate-pulse font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                <span>Synthesizing Multimodal Nodes...</span>
              </div>
              <p className="text-[10px] text-gray-400 font-sans font-light">
                Gemini is linking image entities, decoding conversational structures, or transcribing sound streams with relation to the chat logs. This takes about 3-8 seconds.
              </p>
            </div>
          )}

          {mediaError && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-300 text-xs rounded-lg flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Media Analysis Failure</p>
                <p className="font-light text-[11px] mt-0.5 text-gray-400">{mediaError}</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Results or history */}
        <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between min-h-[220px]" id="media-results-panel">
          {parsedMediaResult ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Analyzed Successfully
                </span>
                <button
                  onClick={() => onMergeMediaIntoDigest(parsedMediaResult)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Commit Extracted Items & Log File
                </button>
              </div>

              <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/5 space-y-3.5 max-h-[360px] overflow-y-auto custom-scrollbar" id="latest-analysis-details">
                <div>
                  <h4 className="text-[10px] uppercase font-mono text-gray-500 tracking-wider">File Metadata</h4>
                  <p className="text-xs font-semibold text-gray-300 mt-0.5">{parsedMediaResult.fileName} ({parsedMediaResult.fileMimeType})</p>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase font-mono text-gray-500 tracking-wider">Multimodal Narrative</h4>
                  <div className="text-xs text-gray-300 leading-relaxed font-light mt-1.5 prose prose-invert max-w-none">
                    {parsedMediaResult.description.split('\n\n').map((para, idx) => (
                      <p key={idx} className="mb-2.5">
                        {para.split('**').map((tok, ti) => ti % 2 === 1 ? <strong key={ti} className="text-blue-400 font-semibold">{tok}</strong> : tok)}
                      </p>
                    ))}
                  </div>
                </div>

                {parsedMediaResult.decisions.length > 0 && (
                  <div className="border-t border-white/5 pt-3">
                    <h4 className="text-[10px] uppercase font-mono text-emerald-405 tracking-wider mb-2 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Latent Decisions Found ({parsedMediaResult.decisions.length})
                    </h4>
                    <ul className="space-y-1.5 text-xs">
                      {parsedMediaResult.decisions.map((dec, i) => (
                        <li key={i} className="flex gap-2 items-start bg-[#121212] p-2 rounded border border-white/5">
                          <span className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded shrink-0">{dec.sender || 'Sender'}</span>
                          <span className="text-gray-300 font-light">{dec.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {parsedMediaResult.actionItems.length > 0 && (
                  <div className="border-t border-white/5 pt-3">
                    <h4 className="text-[10px] uppercase font-mono text-blue-400 tracking-wider mb-2 font-bold flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                      Latent Actions Found ({parsedMediaResult.actionItems.length})
                    </h4>
                    <ul className="space-y-1.5 text-xs">
                      {parsedMediaResult.actionItems.map((act, i) => (
                        <li key={i} className="flex gap-2 items-start bg-[#121212] p-2 rounded border border-white/5">
                          <span className="font-mono text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded shrink-0">{act.sender || 'Group'}</span>
                          <span className="text-gray-300 font-light">{act.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between space-y-4">
              <div>
                <h4 className="text-[10px] uppercase font-mono text-gray-500 tracking-wider mb-2">Parsed Media Ledger History</h4>
                {(!digest.parsedMedia || digest.parsedMedia.length === 0) ? (
                  <div className="h-44 flex flex-col justify-center items-center p-4 bg-[#0A0A0A] border border-white/5 rounded-lg text-center text-xs text-gray-500 italic font-light space-y-2">
                    <Image className="w-5 h-5 text-gray-750 animate-pulse" />
                    <p className="max-w-xs leading-relaxed">No media attachments have been parsed yet. Upload shared drawing schemas, sound tracks, or invoices to run auditing.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10" id="media-history-scrollable">
                    {digest.parsedMedia.map((media) => (
                      <div key={media.id} className="p-3 bg-[#0A0A0A] border border-white/5 hover:border-white/10 transition-colors rounded-lg flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/10 font-bold max-w-64 truncate">{media.fileName}</span>
                            <span className="text-[9px] text-gray-500 font-mono">{new Date(media.parsedAt).toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 line-clamp-2 font-light leading-relaxed">{media.description}</div>
                          <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-500 font-mono">
                            <span>Decisions: <strong className="text-emerald-400 font-bold">{media.decisions?.length || 0}</strong></span>
                            <span>•</span>
                            <span>Tasks: <strong className="text-blue-400 font-bold">{media.actionItems?.length || 0}</strong></span>
                          </div>
                        </div>
                        <button
                          onClick={() => onDeleteParsedMedia(media.id)}
                          className="p-1.5 text-gray-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/5 rounded transition-all cursor-pointer shadow-sm"
                          title="Delete file audit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-gray-600 font-mono border-t border-white/5 pt-3 flex items-center gap-1.5 justify-end">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
                Assets analyzed server-side. Local data is sandbox-persisted offline.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
