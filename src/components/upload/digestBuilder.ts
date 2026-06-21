import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint } from '../../types';

const POSITIVE_WORDS = new Set([
  'agree', 'agreed', 'perfect', 'awesome', 'love', 'great', 'happy', 'thanks', 'thank', 'deal', 'excellent', 'good', 'correct', 'yes', 'absolutely', 'definitely', 'super', 'cool', 'nice', 'brilliant', 'sure', 'fine', 'completed', 'resolved', 'perfectly', 'done', 'approved', 'success'
]);

const NEGATIVE_WORDS = new Set([
  'disagree', 'sad', 'wrong', 'fail', 'bad', 'unhappy', 'delay', 'cancel', 'unfortunately', 'error', 'issue', 'problem', 'wait', 'cannot', "can't", "don't", 'no', 'difficult', 'struggle', 'hard', 'concerned', 'concern', 'threat', 'danger', 'risk', 'disappointed', 'stuck', 'blocking', 'refuse'
]);

function calculateSentiment(text: string): { score: number; type: 'positive' | 'negative' | 'neutral' } {
  const words = text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/);
  let score = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) score += 0.3;
    if (NEGATIVE_WORDS.has(word)) score -= 0.3;
  }

  score = Math.max(-1, Math.min(1, score));

  let type: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.1) type = 'positive';
  else if (score < -0.1) type = 'negative';

  return { score, type };
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
  const participantsSet = new Set<string>();
  const participantCounts: Record<string, number> = {};

  // 1. Process Messages
  const messages: ParsedMessage[] = geminiData.messages.map((m, idx) => {
    const senderCleaned = m.sender.trim();
    participantsSet.add(senderCleaned);
    participantCounts[senderCleaned] = (participantCounts[senderCleaned] || 0) + 1;

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
    const stretchedAvg = Math.max(-1, Math.min(1, rawAvg * 8.0));

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
    completed: false
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
