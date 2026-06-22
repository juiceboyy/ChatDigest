import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint, ZipAttachmentItem } from '../types';

export function getMsgKey(m: { timestamp: string; sender: string; text: string }): string {
  const cleanText = m.text.trim().toLowerCase();
  return `${m.timestamp}_${m.sender.trim()}_${cleanText}`;
}

export function identifyNewMessages(existing: ParsedMessage[], incoming: ParsedMessage[]): ParsedMessage[] {
  const existingKeys = new Set(existing.map(getMsgKey));
  return incoming.filter(m => !existingKeys.has(getMsgKey(m)));
}

export function mergeMessages(existing: ParsedMessage[], incoming: ParsedMessage[]): ParsedMessage[] {
  const existingKeys = new Set(existing.map(getMsgKey));
  const newMessages = incoming.filter(m => !existingKeys.has(getMsgKey(m)));
  return [...existing, ...newMessages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function mergeActionItems(existing: ActionItem[], incoming: any[]): ActionItem[] {
  const existingTexts = new Map<string, ActionItem>();
  existing.forEach(item => existingTexts.set(item.text.trim().toLowerCase(), item));
  
  const merged = [...existing];
  
  incoming.forEach((item, index) => {
    const cleanText = item.text.trim();
    const key = cleanText.toLowerCase();
    
    if (existingTexts.has(key)) {
      const existingItem = existingTexts.get(key)!;
      if (!existingItem.completed && item.completed) {
        const idx = merged.findIndex(x => x.id === existingItem.id);
        if (idx !== -1) {
          merged[idx] = {
            ...merged[idx],
            completed: true,
            completedBy: item.completedBy || undefined,
            completedMessage: item.completedMessage || undefined
          };
        }
      }
    } else {
      merged.push({
        id: `act-g-merged-${index}-${Date.now()}`,
        sender: item.sender || 'The Group',
        text: cleanText,
        dateStr: item.dateStr,
        completed: item.completed || false,
        completedBy: item.completedBy || undefined,
        completedMessage: item.completedMessage || undefined
      });
      existingTexts.set(key, merged[merged.length - 1]);
    }
  });
  
  return merged;
}

export function mergeDecisions(existing: ChatDecision[], incoming: any[]): ChatDecision[] {
  const existingTexts = new Set(existing.map(item => item.text.trim().toLowerCase()));
  const merged = [...existing];
  
  incoming.forEach((item, index) => {
    const cleanText = item.text.trim();
    if (!existingTexts.has(cleanText.toLowerCase())) {
      merged.push({
        id: `dec-g-merged-${index}-${Date.now()}`,
        sender: item.sender || 'The Group',
        text: cleanText,
        dateStr: item.dateStr
      });
      existingTexts.add(cleanText.toLowerCase());
    }
  });
  
  return merged;
}

export function mergeZipAttachments(existing: ZipAttachmentItem[] = [], incoming: ZipAttachmentItem[] = []): ZipAttachmentItem[] {
  const attachmentMap = new Map<string, ZipAttachmentItem>();
  existing.forEach(att => attachmentMap.set(att.name, att));
  incoming.forEach(att => attachmentMap.set(att.name, att));
  return Array.from(attachmentMap.values());
}

export function recalculateDigestStats(
  existingDigest: ChatDigestData,
  mergedMessages: ParsedMessage[],
  newFileName: string,
  newFileSize: number,
  newZipAttachments?: ZipAttachmentItem[]
): ChatDigestData {
  const participantCounts: Record<string, number> = {};
  mergedMessages.forEach(m => {
    participantCounts[m.sender] = (participantCounts[m.sender] || 0) + 1;
  });
  
  const participants = Object.keys(participantCounts).sort((a, b) => participantCounts[b] - participantCounts[a]);
  
  let startDateStr = 'N/A';
  let endDateStr = 'N/A';
  if (mergedMessages.length > 0) {
    startDateStr = mergedMessages[0].dateStr;
    endDateStr = mergedMessages[mergedMessages.length - 1].dateStr;
  }
  
  // Build Timeline Data Points
  const timelineMap: Record<string, {
    msgCount: number;
    sentimentSum: number;
    senderFreq: Record<string, number>;
  }> = {};

  mergedMessages.forEach(msg => {
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

  const zipAttachments = mergeZipAttachments(existingDigest.zipAttachments, newZipAttachments);

  return {
    ...existingDigest,
    fileName: newFileName,
    fileSize: newFileSize,
    parsedAt: Date.now(),
    participants,
    participantCounts,
    messages: mergedMessages,
    startDateStr,
    endDateStr,
    timeline,
    zipAttachments,
    isFullyLoaded: true
  };
}
