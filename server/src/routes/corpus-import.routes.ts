import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { run } from '../db/init';
import { PDFParseUtil } from '../utils/pdf-parser';
import { DocxParseUtil } from '../utils/docx-parser';

const router = Router();

const http = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'PCFA-CorpusBot/1.0 (academic plagiarism checker; local use)'
  }
});

function makeId(): string {
  return `cor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function savePaper(filename: string, content: string): string {
  const id = makeId();
  run('INSERT INTO corpus_papers (id, filename, content) VALUES (?, ?, ?)', [id, filename, content]);
  return id;
}

// ---------- arXiv search ----------
router.get('/arxiv-search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    const max = Math.min(parseInt(req.query.max as string) || 10, 25);

    if (!query) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${max}&sortBy=relevance`;
    const { data: xml } = await http.get(url, { responseType: 'text' });

    const $ = cheerio.load(xml, { xmlMode: true });
    const entries: any[] = [];

    $('entry').each((_, el) => {
      const id = $(el).find('id').text().trim();
      const title = $(el).find('title').text().replace(/\s+/g, ' ').trim();
      const summary = $(el).find('summary').text().replace(/\s+/g, ' ').trim();
      const published = $(el).find('published').text().trim().substring(0, 10);
      const authors = $(el).find('author name').map((_, a) => $(a).text().trim()).get();
      const pdfLink = $(el).find('link[title="pdf"]').attr('href')
        || id.replace('/abs/', '/pdf/');
      const absLink = id;

      if (id && title) {
        entries.push({
          arxivId: id.split('/abs/').pop() || id,
          title,
          summary: summary.substring(0, 400),
          published,
          authors: authors.slice(0, 6),
          pdfUrl: pdfLink,
          absUrl: absLink
        });
      }
    });

    res.json({ success: true, results: entries });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: `arXiv search failed: ${error.message}. Check your internet connection.`
    });
  }
});

// ---------- arXiv import (fetch PDF, extract, save) ----------
router.post('/arxiv-import', async (req: Request, res: Response) => {
  try {
    const { pdfUrl, title, arxivId } = req.body;

    if (!pdfUrl && !arxivId) {
      res.status(400).json({ success: false, error: 'pdfUrl or arxivId is required' });
      return;
    }

    const url = pdfUrl || `https://arxiv.org/pdf/${arxivId}`;
    const cleanUrl = url.includes('/pdf/') && !url.endsWith('.pdf')
      ? (url.endsWith('/') ? `${url}.pdf` : `${url}.pdf`)
      : url;

    const response = await http.get(cleanUrl, { responseType: 'arraybuffer', maxContentLength: 20 * 1024 * 1024 });
    const buffer = Buffer.from(response.data);

    const content = await PDFParseUtil.parse(buffer);

    if (!content || content.trim().length < 100) {
      res.status(422).json({
        success: false,
        error: 'Could not extract enough text from this PDF (may be scanned/image-only).'
      });
      return;
    }

    const filename = `${(title || arxivId || 'arxiv-paper').replace(/[^\w\s-]/g, '').substring(0, 80)}.pdf`;
    const id = savePaper(filename, content);

    res.json({
      success: true,
      id,
      message: `Imported "${title || filename}" (${content.length.toLocaleString()} chars)`,
      chars: content.length
    });
  } catch (error: any) {
    const msg = error.response?.status === 404
      ? 'Paper not found on arXiv (404).'
      : error.message || 'Import failed';
    res.status(502).json({ success: false, error: `arXiv import failed: ${msg}` });
  }
});

// ---------- Generic URL / DOI import ----------
function resolveDoi(doi: string): string {
  const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  return `https://doi.org/${clean}`;
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, noscript, iframe, svg').remove();

  // Prefer semantic content containers
  const candidates = [
    'article', '[role=main]', 'main',
    '.article-body', '.paper-text', '.fulltext',
    '#content', '.content', '.post-content'
  ];
  for (const sel of candidates) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 200) {
      return el.text().replace(/\s+/g, ' ').trim();
    }
  }
  return $('body').text().replace(/\s+/g, ' ').trim();
}

router.post('/url-import', async (req: Request, res: Response) => {
  try {
    let { url } = req.body;
    if (!url || !url.trim()) {
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }
    url = url.trim();

    // Treat bare DOIs as doi.org links
    if (/^10\.\d{4,}\//.test(url) || url.toLowerCase().startsWith('doi:')) {
      url = resolveDoi(url.replace(/^doi:\s*/i, ''));
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const response = await http.get(url, {
      responseType: 'arraybuffer',
      maxContentLength: 20 * 1024 * 1024,
      // Some publishers block non-browser agents; still try
      headers: { Accept: 'text/html,application/pdf,*/*' }
    });

    const contentType = String(response.headers['content-type'] || '');
    const buf = Buffer.from(response.data);
    let content = '';
    let filename = '';

    const isPdf = contentType.includes('pdf') || buf.subarray(0, 5).toString('latin1') === '%PDF-';
    const isDocx = contentType.includes('wordprocessingml') ||
      (contentType.includes('msword')) ||
      url.toLowerCase().endsWith('.docx');

    if (isPdf) {
      content = await PDFParseUtil.parse(buf);
      filename = decodeURIComponent(url.split('/').pop() || 'imported.pdf').substring(0, 80);
      if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
    } else if (isDocx) {
      content = await DocxParseUtil.parse(buf);
      filename = decodeURIComponent(url.split('/').pop() || 'imported.docx').substring(0, 80);
    } else {
      const html = buf.toString('utf-8');
      content = extractTextFromHtml(html);
      // Title from <title>
      const $ = cheerio.load(html);
      filename = ($('title').text() || url).replace(/\s+/g, ' ').substring(0, 80);
      if (!/\.(pdf|docx?|txt)$/i.test(filename)) filename += ' (web)';
    }

    if (!content || content.trim().length < 100) {
      res.status(422).json({
        success: false,
        error: 'Could not extract enough text from this URL. The page may require login, be a paywall, or contain only images.'
      });
      return;
    }

    const id = savePaper(filename, content);
    res.json({
      success: true,
      id,
      message: `Imported "${filename}" (${content.length.toLocaleString()} chars) from ${new URL(url).hostname}`,
      chars: content.length
    });
  } catch (error: any) {
    const status = error.response?.status;
    let msg = error.message || 'Import failed';
    if (status === 403 || status === 401) {
      msg = 'Access denied (403) — the site may block automated downloads or require login.';
    } else if (status === 404) {
      msg = 'Page not found (404).';
    } else if (error.code === 'ENOTFOUND') {
      msg = 'Could not resolve the domain — check the URL.';
    }
    res.status(502).json({ success: false, error: `URL import failed: ${msg}` });
  }
});

export default router;
