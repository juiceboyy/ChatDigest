import React from 'react';
import { FileText, Calendar, Users, MessageSquare, Download } from 'lucide-react';
import { ChatDigestData } from '../../types';
import { exportDigestToPdf } from '../../lib/pdfExporter';

interface DashboardHeaderProps {
  digest: ChatDigestData;
}

export default function DashboardHeader({ digest }: DashboardHeaderProps) {
  const participantCount = digest.participants.length;
  const totalMessages = digest.messages.length;
  const startAndEnd = `${digest.startDateStr} - ${digest.endDateStr}`;

  return (
    <div
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[#0F0F0F] rounded-xl border border-white/10 shadow-sm"
      id="dashboard-header-control"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/25 font-mono px-2 py-0.5 rounded-full font-semibold">
            Active Digest
          </span>
          <span className="text-slate-400 text-xs flex items-center gap-1 bg-white/5 px-2 py-0.5 border border-white/5 rounded-full">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            Synthesized with Gemini AI
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          {digest.title || digest.fileName}
        </h1>
        {digest.title && (
          <p className="text-[10px] text-gray-500 font-mono tracking-wider">FILE: {digest.fileName}</p>
        )}
        <p className="text-xs text-gray-400 font-light flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            {startAndEnd}
          </span>
          <span className="flex items-center gap-1 font-mono">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            {participantCount} Speakers
          </span>
          <span className="flex items-center gap-1 font-mono">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            {totalMessages} Blocks
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2.5 shrink-0" id="header-action-buttons">
        <button
          onClick={() => exportDigestToPdf(digest)}
          className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-sm transition-colors font-medium flex items-center justify-center gap-2"
          id="pdf-download-btn"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>
    </div>
  );
}
