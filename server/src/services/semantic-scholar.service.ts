import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { PDFParseUtil } from '../utils/pdf-parser';
import { CorpusPaper, Match } from '../types';

const http = axios.create({
  timeout: 20000,
  maxRedirects: 5,
  headers: { 'User-Agent': 'PCFA-AutoCheck/1.0 (research plagiarism checker)' }
});

interface SemanticPaper {
  paperId: string;
  title: string;
  abstract: string;
  pdfUrl?: string;
  year?: number;
  authors?: string[];
  venue?: string;
}

interface FetchedSource {
  id: string;
  filename: string;
  content: string;
  origin: 'arxiv' | 'web' | 'local' | 'semantic-scholar';
  url?: string;
}

async function searchSemanticScholar(query: string, limit: number = 5): Promise<SemanticPaper[]> {
  try {
    const { data } = await http.get('https://api.semanticscholar.org/graph/v1/paper/search', {
      params: {
        query,
        limit,
        fields: 'title,abstract,year,authors,venue,externalIds,pdfUrl'
      }
    });
    const results = data?.data || [];
    return results.map((paper: any) => ({
      paperId: paper.paperId || '',
      title: paper.title || 'Untitled',
      abstract: paper.abstract || '',
      pdfUrl: paper.externalIds?.['ArXiv'] ? `https://arxiv.org/pdf/${paper.externalIds['ArXiv']}` : paper.pdfUrl,
      year: paper.year,
      authors: paper.authors?.map((a: any) => a.name) || [],
      venue: paper.venue
    }));
  } catch {
    return [];
  }
}

async function fetchSemanticPaper(paper: SemanticPaper): Promise<FetchedSource | null> {
  try {
    if (!paper.abstract) return null;

    const content = paper.abstract;
    if (content.trim().length < 100) return null;

    const authorsStr = paper.authors?.slice(0, 3).join(', ') || '';
    const venueStr = paper.venue ? ` — ${paper.venue}` : '';
    const yearStr = paper.year ? ` (${paper.year})` : '';

    return {
      id: uuidv4(),
      filename: `Semantic Scholar: ${paper.title.substring(0, 60)}`,
      content,
      origin: 'semantic-scholar',
      url: `https://api.semanticscholar.org/paper/${paper.paperId}`
    };
  } catch {
    return null;
  }
}

export async function searchSemanticScholarAll(
  queries: string[],
  limitPerQuery: number = 5
): Promise<FetchedSource[]> {
  const sources: FetchedSource[] = [];
  const seen = new Set<string>();

  for (const query of queries.slice(0, 4)) {
    if (sources.length >= 20) break;
    const papers = await searchSemanticScholar(query, limitPerQuery);
    for (const paper of papers) {
      if (seen.has(paper.paperId)) continue;
      seen.add(paper.paperId);
      const source = await fetchSemanticPaper(paper);
      if (source) sources.push(source);
    }
  }

  return sources;
}
