export interface Match {
  id: string;
  text: string;
  source: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  suggestions: string[];
  citations: string[];
}

export interface DetectedTopic {
  title: string;
  keywords: string[];
  keySentences: string[];
}

export interface SourceInfo {
  name: string;
  origin: 'arxiv' | 'web' | 'local';
  url: string | null;
}

export interface CheckResult {
  similarity: number;
  matches: Match[];
  originalText: string;
  message?: string;
  corpusCount?: number;
  checkWeb?: boolean;
  topic?: DetectedTopic;
  sourcesChecked?: SourceInfo[];
}

export interface HistoryItem {
  id: string;
  date: string;
  filename: string;
  similarity: number;
  matches: Match[];
  exported: boolean;
}

export interface CorpusPaper {
  id: string;
  filename: string;
  added_at?: string;
  addedAt?: string;
  enabled: boolean;
}

export interface Settings {
  plagiarismThreshold: number;
  ngramSize: number;
  enableWebCheck: boolean;
  llmProvider: string;
  llmModel: string;
}

export interface FixSuggestion {
  suggestions: string[];
  citations: string[];
}

export interface AppliedFix {
  matchId: string;
  originalText: string;
  fixedText: string;
  suggestionIndex: number;
}

export type CitationStyle = 'APA' | 'IEEE' | 'MLA';

export type ExportType = 'pdf' | 'docx';

export interface ScanProgress {
  stage: string;
  progress: number;
  detail?: string;
}