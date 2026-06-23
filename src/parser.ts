import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint } from './types';
import { STOP_WORDS, stripEmojis, standardizeDateStr } from './lib/parserUtils';
import { calculateSentiment } from './lib/sentiment';
import { extractActionItem, extractDecision } from './lib/extractor';

export function parseWhatsAppFile(rawText: string, fileName: string, fileSize: number): ChatDigestData {
  const lines = rawText.split(/\r?\n/);
  const messages: ParsedMessage[] = [];
  const participantsSet = new Set<string>();
  const participantCounts: Record<string, number> = {};

  // Regex definitions
  // 1. Bracket mode: [15/06/2026, 14:32:00] Sender: Message
  const bracketRegex = /^\[(\d{1,4}[.\/\-]\d{1,12}[.\/\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?)\]\s+([^:]+):\s*(.*)$/;
  // 2. Dash mode: 15/06/2026, 14:32 - Sender: Message
  const dashRegex = /^(\d{1,4}[.\/\-]\d{1,12}[.\/\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?)\s+-\s+([^:]+):\s*(.*)$/;
  // 3. Simple colon mode: 15/06/2026, 14:32: Jane: Message
  const colonRegex = /^(\d{1,4}[.\/\-]\d{1,12}[.\/\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[aApP][mM])?):\s+([^:]+):\s*(.*)$/;

  let lastMessage: ParsedMessage | null = null;
  let parsedIndex = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    let matched = false;
    let rawDate = '';
    let rawTime = '';
    let sender = '';
    let text = '';

    // Test bracket mode
    let match = line.match(bracketRegex);
    if (match) {
      [, rawDate, rawTime, sender, text] = match;
      matched = true;
    } else {
      // Test dash mode
      match = line.match(dashRegex);
      if (match) {
        [, rawDate, rawTime, sender, text] = match;
        matched = true;
      } else {
        // Test colon mode
        match = line.match(colonRegex);
        if (match) {
          [, rawDate, rawTime, sender, text] = match;
          matched = true;
        }
      }
    }

    if (matched) {
      // Filter out system events and media omissions
      let cleanedText = text
        .replace(/<Media omitted>/gi, '')
        .replace(/\[Media omitted\]/gi, '')
        .replace(/<Photo omitted>/gi, '')
        .replace(/<Video omitted>/gi, '')
        .replace(/<Sticker omitted>/gi, '')
        .replace(/<Audio omitted>/gi, '')
        .replace(/image omitted/gi, '')
        .replace(/sticker omitted/gi, '')
        .replace(/video omitted/gi, '')
        .trim();

      // Clean emojis
      cleanedText = stripEmojis(cleanedText);

      // If nothing is left in text after stripping media, make it a simple note
      if (!cleanedText) {
        cleanedText = "[Image / Media attachment]";
      }

      const senderCleaned = sender.trim();
      const friendlyDate = standardizeDateStr(rawDate.trim());

      // Only count valid human actors (filter out system instructions)
      if (senderCleaned.toLowerCase().includes('changed the icon') || 
          senderCleaned.toLowerCase().includes('joined using') ||
          senderCleaned.toLowerCase().includes('changed the description') ||
          senderCleaned.toLowerCase().includes('created group') ||
          senderCleaned.length > 50) {
        continue;
      }

      // Add participant
      participantsSet.add(senderCleaned);
      participantCounts[senderCleaned] = (participantCounts[senderCleaned] || 0) + 1;

      const { score, type } = calculateSentiment(cleanedText);

      // Unique ISO string estimation for timestamp
      let isoTimestamp = new Date().toISOString();
      try {
        const dParts = rawDate.replace(/[.\-]/g, '/').split('/');
        const tParts = rawTime.replace(/\s*[aApP][mM]/, '').split(':');
        let hour = parseInt(tParts[0]);
        const min = parseInt(tParts[1] || '0');
        const sec = parseInt(tParts[2] || '0');

        // Handle PM conversion
        if (rawTime.toLowerCase().includes('pm') && hour < 12) hour += 12;
        if (rawTime.toLowerCase().includes('am') && hour === 12) hour = 0;

        if (dParts.length === 3) {
          let day = parseInt(dParts[0]);
          let month = parseInt(dParts[1]);
          let year = parseInt(dParts[2]);
          if (year < 100) year += 2000;
          
          const dObj = new Date(year, month - 1, day, hour, min, sec);
          if (!isNaN(dObj.getTime())) {
            isoTimestamp = dObj.toISOString();
          }
        }
      } catch {
        // Safe ISO string fallback
      }

      const parsedMsg: ParsedMessage = {
        id: `msg-${parsedIndex++}-${Date.now()}`,
        timestamp: isoTimestamp,
        dateStr: friendlyDate,
        timeStr: rawTime.trim(),
        sender: senderCleaned,
        text: cleanedText,
        sentiment: type,
        sentimentScore: score,
      };

      messages.push(parsedMsg);
      lastMessage = parsedMsg;
    } else {
      // Continuation line or multi-line message
      if (lastMessage) {
        let continuationText = line.trim();
        continuationText = stripEmojis(continuationText);
        if (continuationText) {
          lastMessage.text += '\n' + continuationText;
          // Refresh sentiment scoring with complete body
          const { score, type } = calculateSentiment(lastMessage.text);
          lastMessage.sentiment = type;
          lastMessage.sentimentScore = score;
        }
      }
    }
  }

  // Segment by date to build Timeline
  const timelineMap: Record<string, {
    msgCount: number;
    sentimentSum: number;
    senderFreq: Record<string, number>;
  }> = {};

  const decisions: ChatDecision[] = [];
  const actionItems: ActionItem[] = [];

  messages.forEach((msg, idx) => {
    // 1. Build chronology
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

    // 2. Extract decisions
    const dec = extractDecision(msg.sender, msg.text, msg.dateStr, idx);
    if (dec) decisions.push(dec);

    // 3. Extract action items
    const act = extractActionItem(msg.sender, msg.text, msg.dateStr, idx);
    if (act) actionItems.push(act);
  });

  // Convert timeline record/map to list sorted chronologically
  const timeline: TimelineDataPoint[] = Object.entries(timelineMap).map(([dateStr, detail]) => {
    // Determine top sender for this date node
    let topSender = 'N/A';
    let maxMsgValue = 0;
    Object.entries(detail.senderFreq).forEach(([name, count]) => {
      if (count > maxMsgValue) {
        maxMsgValue = count;
        topSender = name;
      }
    });

    // Average sentiment is stretched to make trends visually clear and combat dilution from logistics/neutral messages
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

  // Extract Keywords
  const wordFreq: Record<string, number> = {};
  messages.forEach((msg) => {
    const cleanWords = msg.text
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

  // Participant list sorted by contribution
  const participants = Object.keys(participantCounts).sort((a, b) => participantCounts[b] - participantCounts[a]);

  // Date ranges
  let startDateStr = 'N/A';
  let endDateStr = 'N/A';
  if (messages.length > 0) {
    startDateStr = messages[0].dateStr;
    endDateStr = messages[messages.length - 1].dateStr;
  }

  // Top Speaker statistics
  const topSpeaker = participants[0] || 'N/A';
  const topSpeakerCount = participantCounts[topSpeaker] || 0;

  // Determine Peak Date
  let peakDate = 'N/A';
  let peakCount = 0;
  timeline.forEach((node) => {
    if (node.messageCount > peakCount) {
      peakCount = node.messageCount;
      peakDate = node.dateStr;
    }
  });

  // Calculate generic sentiment score bounds
  let overallSentimentScore = 0;
  messages.forEach(msg => overallSentimentScore += msg.sentimentScore);
  const rawAvgOverall = messages.length > 0 ? overallSentimentScore / messages.length : 0;
  const avgOverallSentiment = Math.max(-1, Math.min(1, rawAvgOverall * 12.0));
  let netSentimentLabel = 'focused and collaborative';
  if (avgOverallSentiment > 0.15) netSentimentLabel = 'exceptionally positive and productive';
  else if (avgOverallSentiment < -0.15) netSentimentLabel = 'somewhat critical and tense';

  // Extract unique action assignees
  const actionAssigneesSet = new Set(actionItems.map(item => item.sender));
  const actionAssignees = actionAssigneesSet.size > 0 ? Array.from(actionAssigneesSet).join(', ') : 'the group';

  // Construct Heuristic Summary Text
  let summary = 'This conversational thread spans from ';
  if (messages.length === 0) {
    summary = 'No messages parsed successfully in the selected file. Please review formatting styles.';
  } else {
    summary += `**${startDateStr}** to **${endDateStr}**, comprising a total of **${messages.length}** messages exchanged between **${participants.length}** participants. `;
    summary += `The discussion was primarily driven by **${topSpeaker}**, who was responsible for **${topSpeakerCount}** interactions. `;
    summary += `Collaboration saw a notable communication spike on **${peakDate}** (accounting for **${peakCount}** messages). `;
    summary += `Crucial topics concentrated around **${keywords.join(', ')}**, and the conversational atmosphere maintained an **${netSentimentLabel}** tone. `;
    summary += `A total of **${decisions.length}** critical agreements were finalized, while **${actionItems.length}** key follow-ups were identified, tasking **${actionAssignees}** with immediate next deliverables.`;
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
    summary,
    keywords,
    startDateStr,
    endDateStr,
    timeline,
  };
}
