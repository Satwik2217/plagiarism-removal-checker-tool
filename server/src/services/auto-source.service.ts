// Automatic source gathering: arXiv (academic) + Semantic Scholar + web pages — no manual corpus needed.
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { CorpusPaper, Match } from '../types';
import { PDFParseUtil } from '../utils/pdf-parser';
import { TopicResult, buildSearchQuery } from './topic.service';
import { searchWebAll, fetchWikipediaArticle, WebResult } from './web-search.service';
import { searchSemanticScholarAll } from './semantic-scholar.service';

const http = axios.create({
  timeout: 20000,
  maxRedirects: 5,
  headers: { 'User-Agent': 'PCFA-AutoCheck/1.0 (research plagiarism checker)' }
});

interface FetchedSource {
  id: string;
  filename: string;
  content: string;
  origin: 'arxiv' | 'web' | 'local' | 'semantic-scholar';
  url?: string;
}

// ---------- arXiv ----------
async function searchArxiv(query: string, max: number): Promise<Array<{ title: string; pdfUrl: string; id: string; summary: string }>> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${max}&sortBy=relevance`;
  const { data: xml } = await http.get(url, { responseType: 'text', timeout: 15000 });
  const $ = cheerio.load(xml, { xmlMode: true });
  const results: Array<{ title: string; pdfUrl: string; id: string; summary: string }> = [];

  $('entry').each((_, el) => {
    const id = $(el).find('id').text().trim();
    const title = $(el).find('title').text().replace(/\s+/g, ' ').trim();
    const summary = $(el).find('summary').text().replace(/\s+/g, ' ').trim();
    if (!id || !title) return;
    const pdfUrl = $(el).find('link[title="pdf"]').attr('href') || id.replace('/abs/', '/pdf/');
    results.push({
      id: id.split('/abs/').pop() || id,
      title,
      pdfUrl: pdfUrl.endsWith('.pdf') ? pdfUrl : `${pdfUrl}.pdf`,
      summary
    });
  });
  return results;
}

async function fetchArxivPaper(item: { title: string; pdfUrl: string; id: string; summary: string }): Promise<FetchedSource | null> {
  try {
    // Use the abstract from the arXiv API instead of downloading the full PDF (much faster)
    const content = item.summary || item.title;
    if (!content || content.trim().length < 200) return null;
    return {
      id: uuidv4(),
      filename: `arxiv:${item.id} — ${item.title.substring(0, 60)}`,
      content,
      origin: 'arxiv',
      url: item.pdfUrl.replace('/pdf/', '/abs/')
    };
  } catch {
    return null;
  }
}

// ---------- Web (Wikipedia + OpenAlex via web-search.service) ----------
async function fetchWebResult(result: WebResult): Promise<FetchedSource | null> {
  if (result.url.includes('wikipedia.org/wiki/')) {
    const article = await fetchWikipediaArticle(result.url);
    if (article && article.text.trim().length >= 300) {
      return {
        id: uuidv4(),
        filename: `web: Wikipedia — ${article.title.substring(0, 60)}`,
        content: article.text,
        origin: 'web',
        url: article.url
      };
    }
    return null;
  }
  return fetchWebPage(result.url);
}

async function fetchWebPage(url: string): Promise<FetchedSource | null> {
  try {
    const res = await http.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' }
    });
    const buf = Buffer.from(res.data);
    const ct = String(res.headers['content-type'] || '');

    let content = '';
    if (ct.includes('pdf') || buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      content = await PDFParseUtil.parse(buf);
    } else {
      const html = buf.toString('utf-8');
      const $ = cheerio.load(html);
      $('script, style, nav, header, footer, noscript, iframe, svg').remove();
      const main = $('article, main, [role=main], .article-body, .content, #content, body').first();
      content = main.text().replace(/\s+/g, ' ').trim();
      const title = $('title').text().trim() || url;
      return content.length >= 300
        ? { id: uuidv4(), filename: `web: ${title.substring(0, 70)}`, content, origin: 'web', url }
        : null;
    }
    if (content.trim().length < 300) return null;
    const host = new URL(url).hostname;
    return { id: uuidv4(), filename: `web: ${host}`, content, origin: 'web', url };
  } catch {
    return null;
  }
}

// ---------- Orchestration ----------
export async function gatherSourcesAutomatically(
  text: string,
  topic: TopicResult,
  localCorpus: CorpusPaper[],
  opts: { enableWeb: boolean; arxivCount?: number; log?: (msg: string) => void }
): Promise<FetchedSource[]> {
  const log = opts.log || (() => {});
  const sources: FetchedSource[] = [];

  // 1. Local corpus papers (if user has any — bonus, not required)
  for (const p of localCorpus.filter(c => c.enabled)) {
    sources.push({
      id: p.id,
      filename: p.filename,
      content: p.content,
      origin: 'local'
    });
  }
  if (localCorpus.length > 0) log(`Loaded ${sources.length} local paper(s)`);

  // 2. arXiv auto-search (always — free, perfect for research papers)
  try {
    log('Searching arXiv for related papers...');
    const query = buildSearchQuery(topic);
    const results = await searchArxiv(query, opts.arxivCount ?? 5);
    log(`Found ${results.length} arXiv papers — downloading...`);

    const fetched = await Promise.allSettled(results.map(fetchArxivPaper));
    for (const f of fetched) {
      if (f.status === 'fulfilled' && f.value) {
        sources.push(f.value);
      }
    }
    log(`Downloaded ${fetched.filter(f => f.status === 'fulfilled' && f.value).length} arXiv papers`);
  } catch (err: any) {
    log(`arXiv search failed (${err.message}) — continuing...`);
  }

  // 3. Semantic Scholar search (always — free, covers IEEE/ACM/Springer)
  try {
    log('Searching Semantic Scholar for related papers...');
    const queries = [
      topic.title,
      ...topic.keywords.slice(0, 3),
      ...topic.keySentences.map(s => s.substring(0, 80))
    ].filter(Boolean);
    const semanticSources = await searchSemanticScholarAll(queries, 5);
    for (const source of semanticSources) {
      sources.push(source);
    }
    log(`Found ${semanticSources.length} Semantic Scholar papers`);
  } catch (err: any) {
    log(`Semantic Scholar search failed (${err.message}) — continuing...`);
  }

  // 4. Web search — Wikipedia + OpenAlex (free, keyless APIs) for related content
  if (opts.enableWeb && (topic.keySentences.length > 0 || topic.keywords.length > 0)) {
    try {
      log('Searching Wikipedia + OpenAlex for related sources...');
      const queries = [
        topic.title,
        ...topic.keywords.slice(0, 3),
        ...topic.keySentences.map(s => s.substring(0, 80))
      ].filter(Boolean);
      const results = await searchWebAll(queries, 8);
      log(`Found ${results.length} web sources — fetching...`);
      const fetched = await Promise.allSettled(results.map(fetchWebResult));
      let webCount = 0;
      for (const f of fetched) {
        if (f.status === 'fulfilled' && f.value) {
          sources.push(f.value);
          webCount++;
        }
      }
      log(`Fetched ${webCount} web sources`);
    } catch (err: any) {
      log(`Web search failed (${err.message}) — continuing...`);
    }
  }

  return sources;
}
