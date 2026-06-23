import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint } from '../../types';
import { calculateSentiment } from '../../lib/sentiment';
import { standardizeDateStr } from '../../lib/parserUtils';

export function parseRawMediaMessages(
  rawMessages: Array<{ sender: string; text: string; dateStr: string; timeStr: string }>
): ParsedMessage[] {
  const dutchMonths = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const dutchMonthsShort = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const englishMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const englishMonthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function getMonthFromString(monthStr: string): number | null {
    const m = monthStr.toLowerCase().trim();
    const di = dutchMonths.indexOf(m);
    if (di !== -1) return di + 1;
    const dsi = dutchMonthsShort.indexOf(m);
    if (dsi !== -1) return dsi + 1;
    const ei = englishMonths.indexOf(m);
    if (ei !== -1) return ei + 1;
    const esi = englishMonthsShort.indexOf(m);
    if (esi !== -1) return esi + 1;

    if (m === 'mrt' || m === 'maart') return 3;
    if (m === 'mei' || m === 'may') return 5;
    if (m === 'okt' || m === 'oct' || m === 'oktober' || m === 'october') return 10;
    return null;
  }

  return rawMessages.map((m, idx) => {
    const senderCleaned = m.sender.trim();
    const { score, type } = calculateSentiment(m.text);

    const today = new Date();
    let day = today.getDate();
    let month = today.getMonth() + 1;
    let year = today.getFullYear();
    let hour = 12;
    let min = 0;

    // Estimate ISO timestamp
    let isoTimestamp = today.toISOString();
    let formattedDateStr = m.dateStr;

    try {
      // Parse time
      if (m.timeStr) {
        const tParts = m.timeStr.replace(/\s*[aApP][mM]/, '').split(':');
        hour = parseInt(tParts[0]) || 12;
        min = parseInt(tParts[1] || '0') || 0;
        if (m.timeStr.toLowerCase().includes('pm') && hour < 12) hour += 12;
        if (m.timeStr.toLowerCase().includes('am') && hour === 12) hour = 0;
      }

      // Parse date
      const cleanStr = m.dateStr.toLowerCase().replace(/,/g, ' ').trim();
      if (cleanStr === 'today' || cleanStr === 'vandaag') {
        // use today's date
      } else if (cleanStr === 'yesterday' || cleanStr === 'gisteren') {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        day = yesterday.getDate();
        month = yesterday.getMonth() + 1;
        year = yesterday.getFullYear();
      } else {
        const parts = cleanStr.split(/[\s/\-.]+/).filter(Boolean);
        if (parts.length === 2) {
          const mVal0 = getMonthFromString(parts[0]);
          if (mVal0 !== null) {
            month = mVal0;
            day = parseInt(parts[1]) || today.getDate();
          } else {
            const mVal1 = getMonthFromString(parts[1]);
            if (mVal1 !== null) {
              month = mVal1;
              day = parseInt(parts[0]) || today.getDate();
            } else {
              const p0 = parseInt(parts[0]);
              const p1 = parseInt(parts[1]);
              if (!isNaN(p0) && !isNaN(p1)) {
                if (p0 > 12) {
                  day = p0;
                  month = p1;
                } else if (p1 > 12) {
                  day = p1;
                  month = p0;
                } else {
                  day = p0;
                  month = p1;
                }
              }
            }
          }
        } else if (parts.length === 3) {
          if (parseInt(parts[0]) > 1000) {
            year = parseInt(parts[0]);
            const mVal = getMonthFromString(parts[1]);
            month = mVal !== null ? mVal : (parseInt(parts[1]) || 1);
            day = parseInt(parts[2]) || 1;
          } else {
            let parsedYear = parseInt(parts[2]);
            if (!isNaN(parsedYear)) {
              if (parsedYear < 100) parsedYear += 2000;
              year = parsedYear;
            }
            const mVal = getMonthFromString(parts[1]);
            month = mVal !== null ? mVal : (parseInt(parts[1]) || 1);
            day = parseInt(parts[0]) || 1;
          }
        }
      }

      const dObj = new Date(year, month - 1, day, hour, min, 0);
      if (!isNaN(dObj.getTime())) {
        isoTimestamp = dObj.toISOString();
        const yStr = year.toString();
        const mStr = month.toString().padStart(2, '0');
        const dStr = day.toString().padStart(2, '0');
        formattedDateStr = standardizeDateStr(`${yStr}-${mStr}-${dStr}`);
      }
    } catch (e) {
      // ignore
    }

    return {
      id: `msg-v-${idx}-${Date.now()}`,
      timestamp: isoTimestamp,
      dateStr: formattedDateStr,
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
