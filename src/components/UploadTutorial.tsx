import React from 'react';
import { FileText } from 'lucide-react';
import { Language, getTranslation } from '../lib/translations';

interface UploadTutorialProps {
  language: Language;
}

export default function UploadTutorial({ language }: UploadTutorialProps) {
  return (
    <div className="mt-8 p-5 bg-[#121212] rounded-xl border border-white/5 text-left" id="whatsapp-tutorial">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-3">
        <FileText className="w-3.5 h-3.5 text-blue-400" />
        {getTranslation('howExport', language)}
      </h4>
      <ol className="list-decimal list-inside space-y-2 text-xs text-gray-500 leading-relaxed font-light">
        <li>{getTranslation('step1', language)}</li>
        <li>{getTranslation('step2', language)}</li>
        <li>{getTranslation('step3', language)}</li>
        <li>{getTranslation('step4', language)}</li>
      </ol>
    </div>
  );
}
