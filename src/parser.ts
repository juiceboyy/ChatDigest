import { ChatDigestData, ParsedMessage, ChatDecision, ActionItem, TimelineDataPoint } from './types';

// Standard English stop words to filter out for keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'was', 'were', 'are', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'omitted', 'media', 'message', 'messages', 'chat', 'deleted', 'just', 'like', 'ok', 'okay', 'yeah', 'yes', 'no', 'not', 'so', 'then', 'there', 'here', 'when', 'whic', 'who', 'how', 'why', 'what', 'now', 'any', 'get', 'got', 'go', 'going', 'out', 'all', 'out', 'up', 'some', 'well', 'good'
]);

const POSITIVE_WORDS = new Set([
  'agree', 'agreed', 'perfect', 'awesome', 'love', 'great', 'happy', 'thanks', 'thank', 'deal', 'excellent', 'good', 'correct', 'yes', 'absolutely', 'definitely', 'super', 'cool', 'nice', 'brilliant', 'sure', 'fine', 'completed', 'resolved', 'perfectly', 'done', 'approved', 'success'
]);

const NEGATIVE_WORDS = new Set([
  'disagree', 'sad', 'wrong', 'fail', 'bad', 'unhappy', 'delay', 'cancel', 'unfortunately', 'error', 'issue', 'problem', 'wait', 'cannot', "can't", "don't", 'no', 'difficult', 'struggle', 'hard', 'concerned', 'concern', 'threat', 'danger', 'risk', 'disappointed', 'stuck', 'blocking', 'refuse'
]);

/**
 * Strips common emojis from string to clean up presentation
 */
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F6DF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
}

/**
 * Calculates a local heuristics sentiment score for a message
 */
function calculateSentiment(text: string): { score: number; type: 'positive' | 'negative' | 'neutral' } {
  const words = text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/);
  let score = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) score += 0.3;
    if (NEGATIVE_WORDS.has(word)) score -= 0.3;
  }

  // Bound between -1 and 1
  score = Math.max(-1, Math.min(1, score));

  let type: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.1) type = 'positive';
  else if (score < -0.1) type = 'negative';

  return { score, type };
}

/**
 * Extracts action items from a message based on language structures
 */
function extractActionItem(sender: string, text: string, dateStr: string, index: number): ActionItem | null {
  const textLower = text.toLowerCase();

  // Common markers for personal assignments
  const iWillMatches = [
    /\bi\s+will\s+([a-z\s']{5,80})/i,
    /\bi'll\s+([a-z\s']{5,80})/i,
    /\bi\s+am\s+going\s+to\s+([a-z\s']{5,80})/i,
    /\bi'm\s+going\s+to\s+([a-z\s']{5,80})/i,
    /\bwill\s+take\s+care\s+of\s+([a-z\s']{5,80})/i,
  ];

  for (const regex of iWillMatches) {
    const match = text.match(regex);
    if (match && match[1]) {
      let task = match[1].trim();
      // Cut off trailing phrases or long explanations if too wordy
      const firstPeriod = task.indexOf('.');
      if (firstPeriod !== -1) task = task.substring(0, firstPeriod);
      const firstComma = task.indexOf(',');
      if (firstComma !== -1) task = task.substring(0, firstComma);

      // Capitalize first letter
      task = task.charAt(0).toUpperCase() + task.slice(1);

      return {
        id: `ai-${index}-${Date.now()}`,
        sender,
        text: task,
        dateStr,
        completed: false
      };
    }
  }

  // Markers for manual direct instructions or request tags
  if (textLower.startsWith('todo:') || textLower.startsWith('task:')) {
    const taskText = text.slice(5).trim();
    return {
      id: `ai-${index}-${Date.now()}`,
      sender,
      text: taskText.charAt(0).toUpperCase() + taskText.slice(1),
      dateStr,
      completed: false
    };
  }

  // Matches assignments like "todo Jane: write report"
  const todoAssignMatch = text.match(/(?:todo|task)\s+([a-z0-9\s]+):\s*(.*)/i);
  if (todoAssignMatch && todoAssignMatch[1] && todoAssignMatch[2]) {
    const assigned = todoAssignMatch[1].trim();
    const task = todoAssignMatch[2].trim();
    return {
      id: `ai-${index}-${Date.now()}`,
      sender: assigned,
      text: task.charAt(0).toUpperCase() + task.slice(1),
      dateStr,
      completed: false
    };
  }

  return null;
}

/**
 * Checks if a message represents a decision
 */
function extractDecision(sender: string, text: string, dateStr: string, index: number): ChatDecision | null {
  const textLower = text.toLowerCase();
  
  const triggers = [
    /\bagreed\b/i,
    /\bconfirmed\b/i,
    /\blet's\s+do\s+this\b/i,
    /\blet's\s+go\s+with\b/i,
    /\bdeal\s+done\b/i,
    /\bdeal\b/i,
    /\bapproved\b/i,
    /\bwe\s+should\s+proceed\b/i,
    /\bwe\s+agree\s+on\b/i,
    /\bsigned\s+off\b/i,
    /\bi\s+agree\b/i,
  ];

  for (const regex of triggers) {
    if (regex.test(textLower)) {
      // Clean target display text - cap message if extremely long
      let cleanText = text;
      if (cleanText.length > 120) {
        cleanText = cleanText.substring(0, 117) + '...';
      }

      return {
        id: `dec-${index}-${Date.now()}`,
        sender,
        text: cleanText,
        dateStr
      };
    }
  }

  return null;
}

/**
 * Standardizes raw date strings we pull from regexes into a readable date format
 */
function standardizeDateStr(rawDate: string): string {
  // Replace symbols like dots or dashes with forward slashes
  let sanitized = rawDate.replace(/[.\-]/g, '/');
  
  // Try to parse format 15/06/2026 or 06/15/2026
  const parts = sanitized.split('/');
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];

    // Handle year 2 digits
    if (year.length === 2) {
      year = '20' + year;
    }

    // Standardize to YYYY-MM-DD
    const yStr = year;
    const mStr = month.padStart(2, '0');
    const dStr = day.padStart(2, '0');

    // Return friendly form e.g. "Jun 15, 2026"
    try {
      const parsedDate = new Date(`${yStr}-${mStr}-${dStr}T00:00:00`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch {
      // fallback
    }
  }

  return rawDate; // Fallback to raw match
}

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
      // Filter out system events (e.g. "Jane created group", "John left", "Messages are end-to-end encrypted")
      // These generally don't have ":" separating sender unless sender contains it, but regex filters sender correctly.
      // If messages has media omissions, strip them.
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

      // Clean emojis as requested
      cleanedText = stripEmojis(cleanedText);

      // If nothing is left in text after stripping media, make it a simple note
      if (!cleanedText) {
        cleanedText = "[Image / Media attachment]";
      }

      const senderCleaned = sender.trim();
      const friendlyDate = standardizeDateStr(rawDate.trim());

      // Only count valid human actors (filter out system instructions if any slipped through)
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
        // Safe ISO string
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
    const stretchedAvg = Math.max(-1, Math.min(1, rawAvg * 8.0));

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
  const avgOverallSentiment = Math.max(-1, Math.min(1, rawAvgOverall * 8.0));
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
