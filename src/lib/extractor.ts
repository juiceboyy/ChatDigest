import { ActionItem, ChatDecision } from '../types';

/**
 * Extracts action items from a message based on language structures
 */
export function extractActionItem(sender: string, text: string, dateStr: string, index: number): ActionItem | null {
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
export function extractDecision(sender: string, text: string, dateStr: string, index: number): ChatDecision | null {
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
