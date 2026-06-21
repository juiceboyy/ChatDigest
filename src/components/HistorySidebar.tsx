import React from 'react';
import { History, FileText, Trash2, Calendar, MessageSquare, Plus, Check } from 'lucide-react';
import { ChatDigestData } from '../types';

interface HistorySidebarProps {
  digests: ChatDigestData[];
  selectedId: string | null;
  onSelect: (digest: ChatDigestData) => void;
  onDelete: (id: string) => void;
  onNewImport: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function HistorySidebar({
  digests,
  selectedId,
  onSelect,
  onDelete,
  onNewImport,
}: HistorySidebarProps) {
  return (
    <div className="flex flex-col h-full bg-[#121212] border-r border-white/10 animate-fadeIn" id="history-sidebar">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between" id="sidebar-header">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/5 rounded-lg text-blue-500 border border-white/10">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Local Digests</h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-wider">INDEXEDDB STORAGE</p>
          </div>
        </div>

        <button
          onClick={onNewImport}
          title="Import another WhatsApp chat"
          className="p-2 bg-white/5 hover:bg-white/10 hover:text-blue-400 text-gray-300 rounded border border-white/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Digests List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5" id="sidebar-list-container">
        {digests.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-4" id="empty-sidebar-fallback">
            <div className="p-3 bg-white/5 rounded-lg text-gray-600 border border-white/5 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-xs text-gray-400 font-medium">No saved files</p>
            <p className="text-[10px] text-gray-500 max-w-[150px] mt-1 leading-normal">
              Parse a .txt export. It will be stored here on your device.
            </p>
          </div>
        ) : (
          digests.map((digest) => {
            const isActive = digest.id === selectedId;
            return (
              <div
                key={digest.id}
                onClick={() => onSelect(digest)}
                className={`group relative text-left p-3.5 rounded-xl cursor-pointer transition-all border duration-200 ${
                  isActive
                    ? 'bg-blue-600/10 border-blue-500/30'
                    : 'bg-[#121212]/50 border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
                id={`sidebar-item-${digest.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`mt-0.5 p-1.5 rounded ${isActive ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400' : 'bg-white/3 border border-white/5 text-gray-400'}`}>
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate min-w-0">
                      <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-blue-100' : 'text-gray-300'}`}>
                        {digest.fileName.replace('.txt', '')}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate uppercase tracking-widest font-mono">
                        {formatBytes(digest.fileSize)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(digest.id);
                    }}
                    title="Delete record from local drive"
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-950/40 hover:text-rose-400 text-gray-505 rounded transition-all duration-200 animate-fadeIn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Micro info bar */}
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-505 font-light">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Calendar className="w-3 h-3 text-gray-600" />
                    {digest.startDateStr === digest.endDateStr ? digest.startDateStr : `${digest.startDateStr.split(',')[0]} - ${digest.endDateStr.split(',')[0]}`}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-gray-500">
                    <MessageSquare className="w-3 h-3 text-gray-600" />
                    {digest.messages.length}
                  </span>
                </div>

                {isActive && (
                  <div className="absolute right-2.5 bottom-2 bg-blue-500/20 text-blue-400 rounded-full p-0.5 border border-blue-500/40">
                    <Check className="w-2 h-2" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Device Privacy Footing */}
      <div className="p-3.5 border-t border-white/10 bg-white/3 text-[10px] text-gray-500 leading-normal font-light shrink-0 animate-fadeIn" id="sidebar-footer">
        <p>🔒 Security Status: <span className="font-semibold text-emerald-500">Fully Isolated</span></p>
        <p className="mt-1">All conversations are processed local-first. We do not transmit records or telemetry anywhere.</p>
      </div>
    </div>
  );
}
