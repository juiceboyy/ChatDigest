import React, { useMemo } from 'react';
import { MessageSquare as MsgIcon } from 'lucide-react';
import { MessageItem } from '../../types';

interface MessagesLogProps {
  messages: MessageItem[];
  searchTerm: string;
  filterParticipant: string | null;
  firstParticipant: string;
}

export default function MessagesLog({ messages, searchTerm, filterParticipant, firstParticipant }: MessagesLogProps) {
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      const matchesSearch = searchTerm
        ? msg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          msg.sender.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchesParticipant = filterParticipant ? msg.sender === filterParticipant : true;
      return matchesSearch && matchesParticipant;
    });
  }, [messages, searchTerm, filterParticipant]);

  const totalMessages = messages.length;
  return (
    <div className="p-5 bg-[#121212] rounded-xl border border-white/5 shadow-sm" id="chat-messages-browser">
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-white/5 pb-3"
        id="messages-browser-header"
      >
        <div className="flex items-center gap-2">
          <span className="p-1 px-1.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-mono">
            Filtered view
          </span>
          <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Exchanged Message Logs</h3>
        </div>
        <span className="text-[10px] font-mono text-gray-500">
          Showing {filteredMessages.length} of {totalMessages} messages
        </span>
      </div>

      <div
        className="h-[280px] overflow-y-auto space-y-3.5 pr-2 font-mono bg-[#0A0A0A] p-4 rounded border border-white/10"
        id="messages-scroller-view"
      >
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-650 text-xs italic">
            No matching lines in thread
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const matchesSelf = firstParticipant === msg.sender;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${matchesSelf ? 'ml-auto text-right' : 'text-left'}`}
                id={`message-row-${msg.id}`}
              >
                <div
                  className={`flex items-center gap-2 text-[10px] text-gray-500 mb-1 font-sans ${matchesSelf ? 'justify-end' : ''}`}
                >
                  <span className="font-bold text-gray-300">{msg.sender}</span>
                  <span>•</span>
                  <span>{msg.dateStr}</span>
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
    </div>
  );
}
