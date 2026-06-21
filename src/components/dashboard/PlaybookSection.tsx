import React, { useState } from 'react';
import { BookOpen, RefreshCw, Loader2, AlertCircle, Sparkles, Check, Download, PlusCircle, Edit2, Trash2, Bookmark } from 'lucide-react';
import { ChatDigestData, PlaybookPlay } from '../../types';
import { Language, getTranslation } from '../../lib/translations';

interface PlaybookSectionProps {
  digest: ChatDigestData;
  isGeneratingPlaybook: boolean;
  playbookError: string | null;
  onGeneratePlaybook: () => void;
  onExportPlaybookPDF: () => void;
  onAddPlay: () => void;
  onSavePlayEdit: (playId: string, updates: Partial<PlaybookPlay>) => void;
  onDeletePlay: (playId: string) => void;
  language: Language;
}

export default function PlaybookSection({
  digest,
  isGeneratingPlaybook,
  playbookError,
  onGeneratePlaybook,
  onExportPlaybookPDF,
  onAddPlay,
  onSavePlayEdit,
  onDeletePlay,
  language,
}: PlaybookSectionProps) {
  const [activePlayId, setActivePlayId] = useState<string | null>(null);
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [editingPlayTitle, setEditingPlayTitle] = useState('');
  const [editingPlayCategory, setEditingPlayCategory] = useState('');
  const [editingPlayDescription, setEditingPlayDescription] = useState('');
  const [editingPlayStepsText, setEditingPlayStepsText] = useState('');
  const [editingPlayTipsText, setEditingPlayTipsText] = useState('');

  const handleStartEditPlay = (play: PlaybookPlay) => {
    setEditingPlayId(play.id);
    setEditingPlayTitle(play.title);
    setEditingPlayCategory(play.category || '');
    setEditingPlayDescription(play.description || '');
    setEditingPlayStepsText((play.steps || []).join('\n'));
    setEditingPlayTipsText((play.tips || []).join('\n'));
  };

  const handleSavePlayEdit = () => {
    if (!editingPlayId) return;
    onSavePlayEdit(editingPlayId, {
      title: editingPlayTitle,
      category: editingPlayCategory,
      description: editingPlayDescription,
      steps: editingPlayStepsText.split('\n').map((s) => s.trim()).filter(Boolean),
      tips: editingPlayTipsText.split('\n').map((t) => t.trim()).filter(Boolean),
    });
    setEditingPlayId(null);
  };

  const activePlay = (digest.playbook?.plays || []).find((p) => p.id === activePlayId) || (digest.playbook?.plays || [])[0];
  const isEditing = editingPlayId === activePlay?.id;

  return (
    <div
      className="bg-[#121212] border border-white/5 rounded-xl p-5 shadow-lg relative overflow-hidden text-left space-y-4 animate-fadeIn"
      id="ai-operational-playbook-section"
    >
      <div className="absolute top-0 right-0 w-80 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </span>
          <div>
            <span className="text-[10px] tracking-widest font-mono text-indigo-400 uppercase font-semibold">Strategic Blueprint</span>
            <h2 className="text-sm font-bold text-gray-150 mt-0.5">{getTranslation('btnCreatePlaybook', language)}</h2>
          </div>
        </div>

        {digest.playbook && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportPlaybookPDF}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Export Playbook as PDF"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={onAddPlay}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              Add Manual Play
            </button>
            <button
              type="button"
              disabled={isGeneratingPlaybook}
              onClick={onGeneratePlaybook}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPlaybook ? 'animate-spin' : ''}`} />
              Regenerate with AI
            </button>
          </div>
        )}
      </div>

      {isGeneratingPlaybook ? (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-white/10 rounded-xl bg-[#0A0A0A]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <div className="space-y-1.5 max-w-sm">
            <p className="text-xs text-gray-200 font-mono uppercase tracking-widest font-semibold">Sensing strategic commitments...</p>
            <p className="text-xs text-gray-450 leading-normal font-light">
              Gemini AI is parsing the ledger decisions and action items to map tech stacks, schedules, governance rules, and runbook streams.
            </p>
          </div>
        </div>
      ) : playbookError ? (
        <div className="p-4 bg-orange-950/10 border border-orange-900/30 rounded-xl text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
            <span>Compilation Interrupted</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed pr-2">{playbookError}</p>
          <button
            onClick={onGeneratePlaybook}
            className="mt-2 text-xs font-mono font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4 cursor-pointer"
          >
            Retry Playbook construction
          </button>
        </div>
      ) : !digest.playbook ? (
        <div className="py-10 px-6 border border-dashed border-white/10 rounded-xl bg-[#0b0b0e]/40 flex flex-col md:flex-row items-center gap-6 justify-between text-left">
          <div className="space-y-2 flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full text-[10px] font-mono border border-indigo-500/15 uppercase tracking-wider font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Ledger Sync Integration
            </div>
            <h3 className="text-sm font-bold text-gray-200 font-sans">{getTranslation('convertPlaybookTitle', language)}</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-light">{getTranslation('convertPlaybookDesc', language)}</p>
          </div>
          <div className="shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={onGeneratePlaybook}
              className="w-full md:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/10 text-white rounded-xl text-xs font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-indigo-500/25 shadow-md font-mono"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {getTranslation('btnCreatePlaybook', language).toUpperCase()}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          {/* Overview card */}
          <div className="p-4 bg-[#0A0A0A] border border-white/5 rounded-xl relative overflow-hidden flex items-start gap-4" id="playbook-overview-card">
            <div className="absolute right-0 bottom-0 pointer-events-none opacity-5">
              <Bookmark className="w-32 h-32 text-indigo-400" />
            </div>
            <span className="p-1 px-1.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-mono border border-indigo-500/15 uppercase tracking-wide font-bold mt-0.5 shrink-0">Overview</span>
            <p className="text-xs md:text-sm text-gray-350 leading-relaxed select-text font-sans">{digest.playbook.overview}</p>
          </div>

          {(!digest.playbook.plays || digest.playbook.plays.length === 0) ? (
            <div className="py-8 text-center border border-white/5 rounded-lg text-gray-500 text-xs bg-[#0A0A0A]">
              No operational plays defined. Click "Add Manual Play" or "Regenerate with AI" to construct them.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5" id="plays-board-main">
              {/* Plays roster sidebar */}
              <div className="md:col-span-4 space-y-2 max-h-[420px] overflow-y-auto pr-1 select-none flex flex-col gap-1.5" id="plays-sidebar-list">
                <div className="text-[9px] uppercase font-mono tracking-widest font-bold px-2 py-1 text-indigo-400 bg-indigo-500/5 rounded border border-indigo-500/10 self-start">
                  Plays Chapters Roster
                </div>
                {(digest.playbook.plays || []).map((play) => {
                  const isActiveBtn = play.id === activePlayId;
                  return (
                    <button
                      key={play.id}
                      type="button"
                      onClick={() => {
                        setActivePlayId(play.id);
                        if (editingPlayId !== play.id) setEditingPlayId(null);
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition-all relative flex flex-col gap-1 cursor-pointer ${
                        isActiveBtn
                          ? 'bg-indigo-950/15 border-indigo-500/35 text-white shadow-xl ring-1 ring-indigo-500/20'
                          : 'bg-[#0A0A0A]/40 border-white/5 text-gray-400 hover:border-white/15 hover:text-gray-200'
                      }`}
                    >
                      <span className={`text-[8px] uppercase tracking-widest font-mono font-bold px-1.5 py-0.5 rounded self-start ${
                        isActiveBtn ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' : 'bg-white/5 text-gray-500 border border-transparent'
                      }`}>
                        {play.category || 'General'}
                      </span>
                      <h4 className="text-xs font-semibold leading-relaxed tracking-wide mt-1.5">{play.title}</h4>
                    </button>
                  );
                })}
              </div>

              {/* Play details board */}
              <div className="md:col-span-8 bg-[#0a0a0d] border border-white/5 rounded-xl p-5 relative min-h-[340px] flex flex-col justify-between" id="plays-details-board">
                {!activePlay ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-xs py-12 font-mono">
                    SELECT A PLAY FROM THE COLUMN ROSTER INDEX
                  </div>
                ) : isEditing ? (
                  <div className="space-y-4 flex-1 text-xs text-left animate-fadeIn">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-[10px] font-mono tracking-widest font-bold text-indigo-400 uppercase">🛠️ Modifying Play Chapter</span>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => setEditingPlayId(null)} className="px-2.5 py-1 font-mono text-[9px] tracking-wide text-gray-400 bg-white/5 border border-white/5 rounded hover:text-white transition-all cursor-pointer">Cancel</button>
                        <button type="button" onClick={handleSavePlayEdit} className="px-2.5 py-1 font-mono text-[9px] tracking-wide text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:text-emerald-300 flex items-center gap-1 transition-all cursor-pointer">
                          <Check className="w-3 h-3" /> Save
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Play Title</label>
                          <input type="text" value={editingPlayTitle} onChange={(e) => setEditingPlayTitle(e.target.value)} className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/50" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Category Tag</label>
                          <input type="text" value={editingPlayCategory} onChange={(e) => setEditingPlayCategory(e.target.value)} className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/50" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Rationale & Action Description</label>
                        <textarea rows={3} value={editingPlayDescription} onChange={(e) => setEditingPlayDescription(e.target.value)} className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500/50 leading-relaxed font-light" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Tactical Steps (one per line)</label>
                          <textarea rows={5} value={editingPlayStepsText} onChange={(e) => setEditingPlayStepsText(e.target.value)} className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-500/50" placeholder={"Step 1\nStep 2\nStep 3"} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 uppercase font-mono pb-1 font-semibold">Strategic Tips (one per line)</label>
                          <textarea rows={5} value={editingPlayTipsText} onChange={(e) => setEditingPlayTipsText(e.target.value)} className="w-full bg-[#030303] border border-white/10 rounded-lg p-2.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-500/50" placeholder={"Pro-Tip 1\nPro-Tip 2"} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-left flex-1 flex flex-col justify-between animate-fadeIn">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2.5">
                        <div>
                          <span className="text-[9px] uppercase tracking-widest font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15">{activePlay.category || 'General'}</span>
                          <h3 className="text-sm md:text-base font-bold text-gray-150 leading-tight mt-1.5 select-text">{activePlay.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => handleStartEditPlay(activePlay)} className="p-1 px-2 text-[10px] font-mono border border-white/10 bg-white/5 rounded text-gray-400 hover:text-white transition-all cursor-pointer" title="Edit Playbook Chapter">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => onDeletePlay(activePlay.id)} className="p-1 px-2 text-[10px] font-mono border border-rose-500/10 bg-rose-500/5 rounded text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer" title="Remove this play">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-light italic select-text pl-3 border-l-2 border-indigo-500/35">"{activePlay.description}"</p>
                      <div className="space-y-4 mt-5">
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase font-mono tracking-widest text-[#a1a1aa] font-bold">🎯 Sequence Execution Steps Checkpoints</p>
                          <div className="space-y-2 pl-1.5">
                            {activePlay.steps?.length > 0 ? activePlay.steps.map((st, sidx) => (
                              <div key={sidx} className="flex items-start gap-2 text-xs group">
                                <span className="text-indigo-400 font-mono text-[10px] font-extrabold bg-indigo-500/10 h-5 w-5 flex items-center justify-center rounded border border-indigo-500/20 shrink-0 mt-0.5 shadow-inner">{sidx + 1}</span>
                                <p className="text-gray-300 leading-normal pt-0.5 select-text font-sans font-light">{st}</p>
                              </div>
                            )) : <span className="text-xs text-gray-500 italic pl-2">No sequence steps defined.</span>}
                          </div>
                        </div>
                        <div className="space-y-2 mt-5 pt-4 border-t border-white/5">
                          <p className="text-[10px] uppercase font-mono tracking-widest text-[#a1a1aa] font-bold">💡 Strategic Architecture Runbook Advice</p>
                          <div className="space-y-2 pl-1">
                            {activePlay.tips?.length > 0 ? activePlay.tips.map((tp, tidx) => (
                              <div key={tidx} className="flex items-start gap-2.5 text-xs text-slate-350 select-text bg-[#030303]/40 p-3 rounded-lg border border-white/5 leading-relaxed font-light">
                                <Sparkles className="w-3.5 h-3.5 text-yellow-500/70 shrink-0 mt-0.5 animate-pulse" />
                                <p className="leading-relaxed">{tp}</p>
                              </div>
                            )) : <span className="text-xs text-gray-500 italic pl-1">No pro tips documented.</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
