import { useMemo, useState } from 'react';
import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint } from '../types';

export type DateFilterType = 'all' | 'week' | 'month' | 'custom';

// Standard English stop words to filter out for keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'was', 'were', 'are', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'omitted', 'media', 'message', 'messages', 'chat', 'deleted', 'just', 'like', 'ok', 'okay', 'yeah', 'yes', 'no', 'not', 'so', 'then', 'there', 'here', 'when', 'whic', 'who', 'how', 'why', 'what', 'now', 'any', 'get', 'got', 'go', 'going', 'out', 'all', 'out', 'up', 'some', 'well', 'good'
]);

function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function useDateFilter(digest: ChatDigestData) {
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const filteredDigest = useMemo<ChatDigestData>(() => {
    if (!digest || !digest.messages || digest.messages.length === 0) {
      return digest;
    }

    const messages = digest.messages;

    // 1. Determine reference date (latest message date in the log)
    const timestamps = messages.map((m) => new Date(m.timestamp).getTime()).filter((t) => !isNaN(t));
    if (timestamps.length === 0) return digest;

    const maxTime = Math.max(...timestamps);
    const refDate = new Date(maxTime);

    let startRange: Date | null = null;
    let endRange: Date | null = null;

    if (dateFilterType === 'week') {
      startRange = new Date(refDate);
      startRange.setDate(refDate.getDate() - 7);
      // Set to start of day for inclusive comparison
      startRange.setHours(0, 0, 0, 0);
    } else if (dateFilterType === 'month') {
      startRange = new Date(refDate);
      startRange.setDate(refDate.getDate() - 30);
      startRange.setHours(0, 0, 0, 0);
    } else if (dateFilterType === 'custom') {
      if (customStartDate) {
        startRange = new Date(customStartDate);
        startRange.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        endRange = new Date(customEndDate);
        endRange.setHours(23, 59, 59, 999);
      }
    }

    if (dateFilterType === 'all' || (!startRange && !endRange)) {
      return digest;
    }

    // 2. Filter messages
    const filteredMessages = messages.filter((m) => {
      const t = new Date(m.timestamp).getTime();
      if (isNaN(t)) return true;
      const mDate = new Date(t);
      if (startRange && mDate < startRange) return false;
      if (endRange && mDate > endRange) return false;
      return true;
    });

    // 3. Filter decisions
    const filteredDecisions = (digest.decisions || []).filter((dec) => {
      const dDate = parseDateSafe(dec.dateStr);
      if (!dDate) return true; // keep if parsing fails
      if (startRange && dDate < startRange) return false;
      if (endRange && dDate > endRange) return false;
      return true;
    });

    // 4. Filter action items
    const filteredActionItems = (digest.actionItems || []).filter((act) => {
      const aDate = parseDateSafe(act.dateStr);
      if (!aDate) return true;
      if (startRange && aDate < startRange) return false;
      if (endRange && aDate > endRange) return false;
      return true;
    });

    // 5. Filter timeline points
    const filteredTimeline = (digest.timeline || []).filter((node) => {
      const nDate = parseDateSafe(node.dateStr);
      if (!nDate) return true;
      if (startRange && nDate < startRange) return false;
      if (endRange && nDate > endRange) return false;
      return true;
    });

    // 6. Recalculate participant counts and list
    const participantCounts: Record<string, number> = {};
    filteredMessages.forEach((m) => {
      participantCounts[m.sender] = (participantCounts[m.sender] || 0) + 1;
    });
    const participants = Object.keys(participantCounts).sort((a, b) => participantCounts[b] - participantCounts[a]);

    // 7. Recalculate keywords
    const wordFreq: Record<string, number> = {};
    filteredMessages.forEach((m) => {
      const cleanWords = m.text
        .toLowerCase()
        .replace(/[^a-z0-9'\s]/g, '')
        .split(/\s+/);
      for (const w of cleanWords) {
        if (w.length > 2 && !STOP_WORDS.has(w)) {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
      }
    });
    const keywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    // 8. Recalculate date range strings
    let startDateStr = digest.startDateStr;
    let endDateStr = digest.endDateStr;
    if (filteredMessages.length > 0) {
      startDateStr = filteredMessages[0].dateStr;
      endDateStr = filteredMessages[filteredMessages.length - 1].dateStr;
    }

    // 9. Rebuild local heuristic summary
    const topSpeaker = participants[0] || 'N/A';
    const topSpeakerCount = participantCounts[topSpeaker] || 0;

    let peakDate = 'N/A';
    let peakCount = 0;
    filteredTimeline.forEach((node) => {
      if (node.messageCount > peakCount) {
        peakCount = node.messageCount;
        peakDate = node.dateStr;
      }
    });

    let overallSentimentScore = 0;
    filteredMessages.forEach((m) => (overallSentimentScore += m.sentimentScore));
    const rawAvgOverall = filteredMessages.length > 0 ? overallSentimentScore / filteredMessages.length : 0;
    const avgOverallSentiment = Math.max(-1, Math.min(1, rawAvgOverall * 8.0));
    let netSentimentLabel = 'focused and collaborative';
    if (avgOverallSentiment > 0.15) netSentimentLabel = 'exceptionally positive and productive';
    else if (avgOverallSentiment < -0.15) netSentimentLabel = 'somewhat critical and tense';

    const actionAssigneesSet = new Set(filteredActionItems.map((item) => item.sender));
    const actionAssignees = actionAssigneesSet.size > 0 ? Array.from(actionAssigneesSet).join(', ') : 'the group';

    let summary = '';
    if (filteredMessages.length === 0) {
      summary = 'No messages parsed successfully in the selected period.';
    } else {
      summary = `This conversational thread spans from **${startDateStr}** to **${endDateStr}** for the selected filter, comprising a total of **${filteredMessages.length}** messages exchanged between **${participants.length}** participants. `;
      summary += `The discussion was primarily driven by **${topSpeaker}**, who was responsible for **${topSpeakerCount}** interactions. `;
      summary += `Collaboration saw a notable communication spike on **${peakDate}** (accounting for **${peakCount}** messages). `;
      summary += `Crucial topics concentrated around **${keywords.join(', ')}**, and the conversational atmosphere maintained an **${netSentimentLabel}** tone. `;
      summary += `A total of **${filteredDecisions.length}** critical agreements were finalized, while **${filteredActionItems.length}** key follow-ups were identified, tasking **${actionAssignees}** with immediate next deliverables.`;
    }

    return {
      ...digest,
      participants,
      participantCounts,
      messages: filteredMessages,
      decisions: filteredDecisions,
      actionItems: filteredActionItems,
      summary,
      keywords,
      startDateStr,
      endDateStr,
      timeline: filteredTimeline,
    };
  }, [digest, dateFilterType, customStartDate, customEndDate]);

  return {
    dateFilterType,
    setDateFilterType,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    filteredDigest,
  };
}
