import React, { useState } from 'react';
import { ChatDigestData, ParsedMediaItem } from '../../types';
import { Language } from '../../lib/translations';

async function handleResponseError(response: Response, defaultMessage: string): Promise<never> {
  let errMsg = defaultMessage;
  try {
    const errData = await response.json();
    errMsg = errData.error || errMsg;
  } catch (e) {
    try {
      const errText = await response.text();
      errMsg = errText || response.statusText || errMsg;
    } catch (_) {
      errMsg = response.statusText || errMsg;
    }
  }
  throw new Error(errMsg);
}

interface UseMediaHandlersProps {
  digest: ChatDigestData;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export function useMediaHandlers({ digest, onSaveDigest, language }: UseMediaHandlersProps) {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [parsedMediaResult, setParsedMediaResult] = useState<ParsedMediaItem | null>(null);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaError(null);
      setParsedMediaResult(null);
      const reader = new FileReader();
      reader.onload = () => {
        setMediaBase64((reader.result as string).split(',')[1] || (reader.result as string));
      };
      reader.onerror = () => { setMediaError('Could not read file data.'); };
      reader.readAsDataURL(file);
    }
  };

  const handleSetMediaFromZip = (item: { name: string; mimeType: string; size: number; base64: string }) => {
    setMediaFile({ name: item.name, type: item.mimeType, size: item.size } as any);
    setMediaBase64(item.base64);
  };

  const handleAnalyzeMedia = async () => {
    if (!mediaBase64 || !mediaFile) return;
    setMediaLoading(true);
    setMediaError(null);
    try {
      const response = await fetch('/api/parse-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: mediaFile.name,
          fileMimeType: mediaFile.type,
          fileBase64: mediaBase64,
          chatSummary: digest.summary,
          userPrompt: customPrompt.trim() || undefined,
          language
        }),
      });
      if (!response.ok) await handleResponseError(response, 'Failed to analyze media file using Gemini.');
      const data = await response.json();
      setParsedMediaResult({
        id: `media-${Date.now()}`,
        fileName: mediaFile.name,
        fileMimeType: mediaFile.type,
        parsedAt: Date.now(),
        description: data.description,
        decisions: data.decisions,
        actionItems: data.actionItems
      });
      setMediaFile(null);
      setMediaBase64(null);
      setCustomPrompt('');
    } catch (err: any) {
      setMediaError(err.message || 'An unknown media query error occurred.');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleMergeMediaIntoDigest = (mediaResult: ParsedMediaItem) => {
    if (!mediaResult || !onSaveDigest) return;
    const newDecisions = mediaResult.decisions.map((d, index) => ({
      id: `dec-m-${index}-${Date.now()}`,
      sender: d.sender || 'Group Attachment',
      text: d.text,
      dateStr: d.dateStr || new Date().toISOString().split('T')[0]
    }));
    const newActionItems = mediaResult.actionItems.map((a, index) => ({
      id: `act-m-${index}-${Date.now()}`,
      sender: a.sender || 'The Group',
      text: a.text,
      dateStr: a.dateStr || new Date().toISOString().split('T')[0],
      completed: false
    }));
    const newMediaItem: ParsedMediaItem = {
      ...mediaResult,
      id: `media-${Date.now()}`,
      parsedAt: Date.now(),
      decisions: newDecisions,
      actionItems: newActionItems
    };
    onSaveDigest({
      ...digest,
      decisions: [...digest.decisions, ...newDecisions],
      actionItems: [...digest.actionItems, ...newActionItems],
      parsedMedia: [...(digest.parsedMedia || []), newMediaItem]
    });
    setParsedMediaResult(null);
  };

  const handleDeleteParsedMedia = (mediaId: string) => setDeleteMediaId(mediaId);

  const executeDeleteParsedMedia = (mediaId: string) => {
    setDeleteMediaId(null);
    if (!onSaveDigest) return;
    onSaveDigest({
      ...digest,
      parsedMedia: (digest.parsedMedia || []).filter((m) => m.id !== mediaId)
    });
  };

  return {
    mediaFile,
    mediaBase64,
    mediaLoading,
    mediaError,
    customPrompt,
    parsedMediaResult,
    deleteMediaId,
    setCustomPrompt,
    setMediaFile,
    setMediaBase64,
    setDeleteMediaId,
    handleMediaFileChange,
    handleSetMediaFromZip,
    handleAnalyzeMedia,
    handleMergeMediaIntoDigest,
    handleDeleteParsedMedia,
    executeDeleteParsedMedia
  };
}
