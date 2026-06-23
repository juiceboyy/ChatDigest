import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint } from '../../types';

import { calculateSentiment } from '../../lib/sentiment';

export function parseRawMediaMessages(
  rawMessages: Array<{ sender: string; text: string; dateStr: string; timeStr: string }>
): ParsedMessage[] {
  return rawMessages.map((m, idx) => {
    const senderCleaned = m.sender.trim();
    const { score, type } = calculateSentiment(m.text);

    // Estimate ISO timestamp
    let isoTimestamp = new Date().toISOString();
    try {
      const dParts = m.dateStr.replace(/[.\-]/g, '/').split('/');
      const tParts = m.timeStr.replace(/\s*[aApP][mM]/, '').split(':');
      let hour = parseInt(tParts[0]);
      const min = parseInt(tParts[1] || '0');
      
      if (m.timeStr.toLowerCase().includes('pm') && hour < 12) hour += 12;
      if (m.timeStr.toLowerCase().includes('am') && hour === 12) hour = 0;

      if (dParts.length === 3) {
        let day = parseInt(dParts[0]);
        let month = parseInt(dParts[1]);
        let year = parseInt(dParts[2]);
        if (year < 100) year += 2000;
        
        // WhatsApp dates could be YYYY-MM-DD or DD/MM/YYYY. Let's make a safe fallback.
        // If year is the first element
        if (parseInt(dParts[0]) > 1000) {
          year = parseInt(dParts[0]);
          month = parseInt(dParts[1]);
          day = parseInt(dParts[2]);
        }
        
        const dObj = new Date(year, month - 1, day, hour, min, 0);
        if (!isNaN(dObj.getTime())) {
          isoTimestamp = dObj.toISOString();
        }
      }
    } catch (e) {
      // ignore
    }

    return {
      id: `msg-v-${idx}-${Date.now()}`,
      timestamp: isoTimestamp,
      dateStr: m.dateStr,
      timeStr: m.timeStr,
      sender: senderCleaned,
      text: m.text,
      sentiment: type,
      sentimentScore: score,
    };
  });
}

export function buildDigestFromMediaData(
  geminiData: {
    messages: Array<{ sender: string; text: string; dateStr: string; timeStr: string }>;
    summary: string;
    executiveSummary: string;
    keywords: string[];
    decisions: Array<{ sender: string; text: string; dateStr: string }>;
    actionItems: Array<{ sender: string; text: string; dateStr: string }>;
  },
  fileName: string,
  fileSize: number
): ChatDigestData {
  const participantCounts: Record<string, number> = {};

  // 1. Process Messages
  const messages: ParsedMessage[] = parseRawMediaMessages(geminiData.messages);
  messages.forEach((m) => {
    participantCounts[m.sender] = (participantCounts[m.sender] || 0) + 1;
  });

  // 2. Compute Timeline
  const timelineMap: Record<string, {
    msgCount: number;
    sentimentSum: number;
    senderFreq: Record<string, number>;
  }> = {};

  messages.forEach((msg) => {
    if (!timelineMap[msg.dateStr]) {
      timelineMap[msg.dateStr] = {
        msgCount: 0,
        sentimentSum: 0,
        senderFreq: {},
      };
    }

    const tObj = timelineMap[msg.dateStr];
    tObj.msgCount++;
    tObj.sentimentSum += msg.sentimentScore;
    tObj.senderFreq[msg.sender] = (tObj.senderFreq[msg.sender] || 0) + 1;
  });

  const timeline: TimelineDataPoint[] = Object.entries(timelineMap).map(([dateStr, detail]) => {
    let topSender = 'N/A';
    let maxMsgValue = 0;
    Object.entries(detail.senderFreq).forEach(([name, count]) => {
      if (count > maxMsgValue) {
        maxMsgValue = count;
        topSender = name;
      }
    });

    const rawAvg = detail.msgCount > 0 ? (detail.sentimentSum / detail.msgCount) : 0;
    const stretchedAvg = Math.max(-1, Math.min(1, rawAvg * 12.0));

    return {
      dateStr,
      messageCount: detail.msgCount,
      avgSentiment: parseFloat(stretchedAvg.toFixed(2)) || 0,
      senderDistribution: detail.senderFreq,
      topSender,
    };
  });

  // 3. Decisions & Action Items mapping with IDs
  const decisions: ChatDecision[] = geminiData.decisions.map((d, idx) => ({
    id: `dec-v-${idx}-${Date.now()}`,
    sender: d.sender || 'Group Attachment',
    text: d.text,
    dateStr: d.dateStr || new Date().toISOString().split('T')[0]
  }));

  const actionItems: ActionItem[] = geminiData.actionItems.map((a, idx) => ({
    id: `act-v-${idx}-${Date.now()}`,
    sender: a.sender || 'The Group',
    text: a.text,
    dateStr: a.dateStr || new Date().toISOString().split('T')[0],
    completed: (a as any).completed || false,
    completedBy: (a as any).completedBy || undefined,
    completedMessage: (a as any).completedMessage || undefined
  }));

  const participants = Object.keys(participantCounts).sort((a, b) => participantCounts[b] - participantCounts[a]);

  let startDateStr = 'N/A';
  let endDateStr = 'N/A';
  if (messages.length > 0) {
    startDateStr = messages[0].dateStr;
    endDateStr = messages[messages.length - 1].dateStr;
  }

  return {
    id: `digest-${Date.now()}`,
    fileName,
    fileSize,
    parsedAt: Date.now(),
    participants,
    participantCounts,
    messages,
    decisions,
    actionItems,
    summary: geminiData.summary,
    executiveSummary: geminiData.executiveSummary,
    keywords: geminiData.keywords,
    startDateStr,
    endDateStr,
    timeline,
  };
}

// Evenly samples N elements from an array (always keeping the first and last elements)
export function sampleEvenly<T>(array: T[], n: number): T[] {
  if (array.length <= n) return array;
  const result: T[] = [];
  const step = (array.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) {
    const index = Math.round(i * step);
    result.push(array[index]);
  }
  return result;
}

// Deduplicates message segments parsed from overlapping screenshots
export function deduplicateMessages(messages: any[]): any[] {
  const result: any[] = [];
  for (const msg of messages) {
    const isDuplicate = result.some(item => {
      const sameSender = item.sender.trim().toLowerCase() === msg.sender.trim().toLowerCase();
      const sameText = item.text.trim().toLowerCase() === msg.text.trim().toLowerCase();
      const sameTime = !item.timeStr || !msg.timeStr || item.timeStr.trim() === msg.timeStr.trim();
      const sameDate = !item.dateStr || !msg.dateStr || item.dateStr.trim() === msg.dateStr.trim();
      return sameSender && sameText && sameTime && sameDate;
    });
    if (!isDuplicate) {
      result.push(msg);
    }
  }
  return result;
}
