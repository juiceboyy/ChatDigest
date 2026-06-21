import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="custom-confirm-modal">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="relative bg-[#161616] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scaleIn">
        {/* Close Button */}
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 hover:bg-white/5 text-gray-500 hover:text-white rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-gray-400 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/5 pt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-xs font-semibold text-gray-300 rounded-xl transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl text-white transition-all cursor-pointer shadow-md ${
              isDestructive 
                ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500/20 shadow-rose-500/5' 
                : 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/20 shadow-indigo-500/5'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
