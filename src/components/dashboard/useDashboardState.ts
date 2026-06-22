import { ChatDigestData } from '../../types';
import { Language } from '../../lib/translations';
import { useDashboard } from './useDashboard';
import { useMediaHandlers } from './useMediaHandlers';
import { useChatHandlers } from './useChatHandlers';

interface UseDashboardStateProps {
  digest: ChatDigestData;
  onSaveDigest?: (data: ChatDigestData) => void;
  language: Language;
}

export function useDashboardState({ digest, onSaveDigest, language }: UseDashboardStateProps) {
  const dashboard = useDashboard({ digest, onSaveDigest, language });
  const media = useMediaHandlers({ digest, onSaveDigest, language });
  const chat = useChatHandlers({ digest, onSaveDigest, language });

  return {
    dashboard,
    media,
    chat,
  };
}
export type DashboardState = ReturnType<typeof useDashboardState>;
