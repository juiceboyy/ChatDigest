import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Calendar, MessageSquare } from 'lucide-react';
import { ParsedMessage } from '../../types';
import { Language } from '../../lib/translations';

interface DayMessagesModalProps {
  dateStr: string | null;
  messages: ParsedMessage[];
  firstParticipant: string;
  onClose: () => void;
  language: Language;
}

export default function DayMessagesModal({
  dateStr,
  messages,
  firstParticipant,
  onClose,
  language,
}: DayMessagesModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (dateStr) {
      setSearchTerm('');
    }
  }, [dateStr]);

  const dayMessages = useMemo(() => {
    if (!dateStr) return [];
    return messages.filter((msg) => msg.dateStr === dateStr);
  }, [messages, dateStr]);

  const filteredMessages = useMemo(() => {
    if (!searchTerm) return dayMessages;
    const lower = searchTerm.toLowerCase();
    return dayMessages.filter(
      (msg) =>
        msg.text.toLowerCase().includes(lower) ||
        msg.sender.toLowerCase().includes(lower)
    );
  }, [dayMessages, searchTerm]);

  if (!dateStr) return null;

  const titleText = language === 'nl' ? `Berichten op ${dateStr}` : `Messages on ${dateStr}`;
  const searchPlaceholder = language === 'nl' ? 'Zoek in berichten...' : 'Search messages...';
  const noMessagesText = language === 'nl' ? 'Geen berichten gevonden voor dit filter.' : 'No messages found for this filter.';
  const totalMessagesText =
    language === 'nl'
      ? `${filteredMessages.length} van ${dayMessages.length} berichten getoond`
      : `Showing ${filteredMessages.length} of ${dayMessages.length} messages`;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
      id="day-messages-modal-overlay"
    >
      <div
        className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-2xl h-[75vh] flex flex-col overflow-hidden text-white shadow-2xl relative animate-slideRight"
        onClick={(e) => e.stopPropagation()}
        id="day-messages-modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0F0F0F] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/40 rounded-lg text-blue-400 border border-blue-900/40">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{titleText}</h3>
              <p className="text-[10px] text-gray-550 font-mono">{totalMessagesText}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-[#161616] border-b border-white/5 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-550 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-gray-250 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0A0A0A]">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500 text-xs italic">
              <MessageSquare className="w-8 h-8 mb-2 text-gray-600 opacity-40" />
              {noMessagesText}
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const matchesSelf = firstParticipant === msg.sender;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${matchesSelf ? 'ml-auto text-right' : 'text-left'}`}
                  id={`day-msg-${msg.id}`}
                >
                  <div
                    className={`flex items-center gap-2 text-[10px] text-gray-500 mb-1 font-sans ${
                      matchesSelf ? 'justify-end' : ''
                    }`}
                  >
                    <span className="font-bold text-gray-300">{msg.sender}</span>
                    <span>•</span>
                    <span>{msg.timeStr}</span>
                  </div>
                  <div
                    className={`p-3 rounded-xl text-xs font-sans leading-relaxed select-text whitespace-pre-wrap text-left inline-block max-w-full ${
                      matchesSelf
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 border border-white/10 text-gray-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0F0F0F] border-t border-white/5 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 hover:text-white border border-white/5 rounded-xl font-semibold text-gray-350 transition-colors text-xs cursor-pointer"
          >
            {language === 'nl' ? 'Sluiten' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
