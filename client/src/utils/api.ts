import axios from 'axios';
import { Match, CheckResult, HistoryItem, CorpusPaper, Settings, FixSuggestion, CitationStyle } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000
});

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export async function checkPlagiarism(
  text: string,
  options: {
    threshold?: number;
    checkWeb?: boolean;
    ngramSize?: number;
    citationStyle?: CitationStyle;
    file?: File;
    auto?: boolean;
    onProgress?: (progress: { stage: string; progress: number }) => void;
  } = {}
): Promise<CheckResult> {
  const { threshold = 15, checkWeb = false, ngramSize = 5, citationStyle = 'APA', file, auto = true, onProgress } = options;

  if (onProgress) {
    onProgress({ stage: 'Preparing text...', progress: 10 });
  }

  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else {
    formData.append('text', text);
  }
  formData.append('threshold', String(threshold));
  formData.append('checkWeb', String(checkWeb));
  formData.append('ngramSize', String(ngramSize));
  formData.append('citationStyle', citationStyle);
  formData.append('auto', String(auto));

  if (onProgress) {
    onProgress({ stage: checkWeb ? 'Checking web sources...' : 'Analyzing against corpus...', progress: 30 });
  }

  const response = await api.post('/check-plagiarism', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000
  });

  if (onProgress) {
    onProgress({ stage: 'Generating fix suggestions...', progress: 80 });
  }

  const data = response.data;
  if (!data.success) {
    throw new Error(data.error || 'Check failed');
  }

  if (onProgress) {
    onProgress({ stage: 'Complete', progress: 100 });
  }

  return {
    similarity: data.similarity,
    matches: data.matches,
    originalText: data.originalText,
    message: data.message,
    corpusCount: data.corpusCount,
    checkWeb: data.checkWeb,
    topic: data.topic,
    sourcesChecked: data.sourcesChecked
  };
}

export async function suggestFix(
  text: string,
  context: string,
  citationStyle: CitationStyle = 'APA'
): Promise<FixSuggestion> {
  const response = await api.post('/suggest-fix', { text, context, citationStyle });
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get suggestions');
  }
  return { suggestions: response.data.suggestions, citations: response.data.citations };
}

export async function getCorpus(): Promise<{ papers: CorpusPaper[] }> {
  const response = await api.get('/corpus');
  return response.data;
}

export async function uploadCorpusFile(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/corpus/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export async function uploadCorpusText(filename: string, content: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/corpus', { filename, content });
  return response.data;
}

export async function deleteCorpus(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/corpus/${id}`);
  return response.data;
}

export async function toggleCorpus(id: string): Promise<{ success: boolean }> {
  const response = await api.patch(`/corpus/${id}/toggle`);
  return response.data;
}

export interface ArxivResult {
  arxivId: string;
  title: string;
  summary: string;
  published: string;
  authors: string[];
  pdfUrl: string;
  absUrl: string;
}

export async function searchArxiv(query: string, max: number = 10): Promise<ArxivResult[]> {
  const response = await api.get('/corpus/arxiv-search', { params: { q: query, max } });
  if (!response.data.success) throw new Error(response.data.error);
  return response.data.results;
}

export async function importArxiv(item: ArxivResult): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/corpus/arxiv-import', {
    pdfUrl: item.pdfUrl,
    title: item.title,
    arxivId: item.arxivId
  }, { timeout: 60000 });
  if (!response.data.success) throw new Error(response.data.error);
  return response.data;
}

export async function importUrl(url: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/corpus/url-import', { url }, { timeout: 60000 });
  if (!response.data.success) throw new Error(response.data.error);
  return response.data;
}

export async function getHistory(): Promise<{ checks: HistoryItem[] }> {
  const response = await api.get('/history');
  return response.data;
}

export async function saveCheck(
  filename: string,
  originalText: string,
  similarity: number,
  matches: Match[],
  saveHistory: boolean
): Promise<{ success: boolean; saved: boolean }> {
  const response = await api.post('/history/save', {
    filename,
    originalText,
    similarity,
    matches,
    saveHistory
  });
  return response.data;
}

export async function deleteHistoryItem(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/history/${id}`);
  return response.data;
}

export async function getSettings(): Promise<{ settings: Settings }> {
  const response = await api.get('/settings');
  return response.data;
}

export async function updateSettings(settings: Partial<Settings>): Promise<{ success: boolean }> {
  const response = await api.put('/settings', settings);
  return response.data;
}

export async function exportDocument(
  type: 'pdf' | 'docx',
  content: string,
  filename?: string,
  includeReport?: boolean,
  matches?: Match[],
  fixedContent?: string,
  originalText?: string
): Promise<Blob> {
  const response = await api.post('/export', {
    type,
    content,
    filename,
    includeReport,
    matches,
    fixedContent,
    originalText
  }, { responseType: 'blob' });
  return response.data;
}

export async function exportReport(
  filename: string,
  similarity: number,
  matches: Match[],
  originalText: string,
  fixedContent: string,
  changesApplied: number
): Promise<Blob> {
  const response = await api.post('/export/report', {
    filename,
    similarity,
    matches,
    originalText,
    fixedContent,
    changesApplied
  }, { responseType: 'blob' });
  return response.data;
}