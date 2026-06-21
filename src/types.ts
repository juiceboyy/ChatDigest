export interface ParsedMessage {
  id: string;
  timestamp: string; // ISO string
  dateStr: string;   // e.g., "2026-06-20" or "20/06/2026"
  timeStr: string;   // e.g., "14:32"
  sender: string;    // Participant name
  text: string;      // Trimmed clean message body
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // Valuation from -1 (negative) to 1 (positive)
}

export interface ChatDecision {
  id: string;
  sender: string;
  text: string;
  dateStr: string;
}

export interface ActionItem {
  id: string;
  sender: string;
  text: string;
  dateStr: string;
  completed: boolean;
}

export interface TimelineDataPoint {
  dateStr: string;
  messageCount: number;
  avgSentiment: number;
  senderDistribution: Record<string, number>;
  topSender: string;
}

export interface ParsedMediaItem {
  id: string;
  fileName: string;
  fileMimeType: string;
  parsedAt: number;
  description: string;
  decisions: ChatDecision[];
  actionItems: ActionItem[];
}

export interface ZipAttachmentItem {
  name: string;
  mimeType: string;
  base64: string;
  size: number;
}

export interface ChatDigestData {
  id: string;
  fileName: string;
  fileSize: number; // in bytes
  parsedAt: number; // Epoc timestamp
  participants: string[];
  participantCounts: Record<string, number>;
  messages: ParsedMessage[];
  decisions: ChatDecision[];
  actionItems: ActionItem[];
  summary: string;
  executiveSummary?: string;
  keywords: string[];
  startDateStr: string;
  endDateStr: string;
  timeline: TimelineDataPoint[];
  parsedMedia?: ParsedMediaItem[];
  zipAttachments?: ZipAttachmentItem[];
  playbook?: PlaybookData;
  isFullyLoaded?: boolean;
}

export interface PlaybookPlay {
  id: string;
  title: string;
  category: string; // e.g., 'Technical', 'Process', 'Logistics'
  description: string;
  steps: string[];
  tips: string[];
}

export interface PlaybookData {
  generatedAt: string;
  overview: string;
  plays: PlaybookPlay[];
}

