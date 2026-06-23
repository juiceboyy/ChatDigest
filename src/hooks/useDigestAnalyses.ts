import { useState, useEffect } from 'react';
import { ChatDigestData } from '../types';

export function useDigestAnalyses(
  digest: ChatDigestData,
  onSaveDigest?: (data: ChatDigestData) => void
) {
  const [dayAnalyses, setDayAnalyses] = useState<Record<string, any>>(digest.dayAnalyses || {});
  const [periodAnalyses, setPeriodAnalyses] = useState<Record<string, any>>(digest.periodAnalyses || {});
  const [metaAnalysis, setMetaAnalysis] = useState<any>(digest.metaAnalysis || null);

  useEffect(() => {
    setDayAnalyses(digest.dayAnalyses || {});
    setPeriodAnalyses(digest.periodAnalyses || {});
    setMetaAnalysis(digest.metaAnalysis || null);
  }, [digest.id]);

  useEffect(() => {
    const hasDayChanges = JSON.stringify(dayAnalyses) !== JSON.stringify(digest.dayAnalyses || {});
    const hasPeriodChanges = JSON.stringify(periodAnalyses) !== JSON.stringify(digest.periodAnalyses || {});
    const hasMetaChanges = JSON.stringify(metaAnalysis) !== JSON.stringify(digest.metaAnalysis || null);
    if (hasDayChanges || hasPeriodChanges || hasMetaChanges) {
      onSaveDigest?.({ ...digest, dayAnalyses, periodAnalyses, metaAnalysis });
    }
  }, [dayAnalyses, periodAnalyses, metaAnalysis, digest, onSaveDigest]);

  return {
    dayAnalyses,
    setDayAnalyses,
    periodAnalyses,
    setPeriodAnalyses,
    metaAnalysis,
    setMetaAnalysis,
  };
}
