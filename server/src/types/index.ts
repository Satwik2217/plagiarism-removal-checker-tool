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

export interface CheckResult {
  similarity: number;
  matches: Match[];
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
  content: string;
  addedAt: string;
  enabled: boolean;
}

export interface Settings {
  plagiarismThreshold: number;
  ngramSize: number;
  enableWebCheck: boolean;
  llmProvider: 'openai' | 'anthropic' | 'ollama';
  llmModel: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  ollamaUrl?: string;
}

export interface PlagiarismCheckRequest {
  text?: string;
  file?: Express.Multer.File;
  threshold?: number;
  checkWeb?: boolean;
  corpusIds?: string[];
}

export interface FixSuggestionRequest {
  text: string;
  context: string;
  tone?: 'academic' | 'casual' | 'formal';
  citationStyle?: 'APA' | 'IEEE' | 'MLA';
}

export interface FixSuggestionResponse {
  suggestions: string[];
  citations: string[];
}

export interface ExportRequest {
  type: 'pdf' | 'docx';
  content: string;
  filename?: string;
  includeReport?: boolean;
  matches?: Match[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}