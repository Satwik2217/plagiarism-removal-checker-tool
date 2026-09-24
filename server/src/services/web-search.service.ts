// Free, keyless web/academic search via public APIs (no scraping fragile SERPs).
import axios from 'axios';
import * as cheerio from 'cheerio';

const http = axios.create({
  timeout: 15000,
  headers: { 'User-Agent': 'PCFA-AutoCheck/1.0 (research plagiarism checker; contact: local)' }
});

export interface WebResult {
  title: string;
  url: string;
  snippet?: string;
}

// ---------- Wikipedia ----------
export async function searchWikipedia(query: string, limit: number = 5): Promise<WebResult[]> {
  try {
    const { data } = await http.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: query,
        format: 'json',
        srlimit: limit,
        origin: '*'
      }
    });
    const hits = data?.query?.search || [];
    return hits.map((h: any) => ({
      title: h.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
      snippet: (h.snippet || '').replace(/<[^>]+>/g, '')
    }));
  } catch {
    return [];
  }
}

// Fetch full Wikipedia article text for comparison
export async function fetchWikipediaArticle(titleOrUrl: string): Promise<{ title: string; text: string; url: string } | null> {
  try {
    let title = titleOrUrl;
    if (titleOrUrl.includes('wikipedia.org/wiki/')) {
      title = decodeURIComponent(titleOrUrl.split('/wiki/').pop() || '').replace(/_/g, ' ');
    }
    const { data } = await http.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'parse',
        page: title,
        prop: 'text',
        format: 'json',
        origin: '*'
      }
    });
    const html = data?.parse?.text?.['*'] || data?.parse?.text || '';
    if (!html) return null;

    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, noscript, iframe, svg, sup, table, .infobox, .navbox, .mw-editsection, .reflist, .references, .noprint, .mw-empty-elt').remove();
    const root = $('.mw-parser-output').first();
    const text = (root.length > 0 ? root.text() : $('body').text()).replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const pageTitle = data?.parse?.title || title;
    return {
      title: pageTitle,
      text,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`
    };
  } catch {
    return null;
  }
}

// ---------- OpenAlex (free academic works search) ----------
export async function searchOpenAlex(query: string, limit: number = 5): Promise<WebResult[]> {
  try {
    const { data } = await http.get('https://api.openalex.org/works', {
      params: {
        search: query,
        per_page: limit,
        mail: 'pcfa-local@example.com',
        filter: 'is_oa:true' // open access only — we can actually fetch full text
      }
    });
    const results = data?.results || [];
    return results.map((w: any) => {
      // Prefer PDF URL from open access
      const pdfUrl =
        w.best_oa_location?.pdf_url ||
        w.best_oa_location?.landing_page_url ||
        w.open_access?.oa_url ||
        `https://doi.org/${w.doi?.replace('https://doi.org/', '') || ''}`;
      return {
        title: w.title || w.display_name || 'Untitled',
        url: pdfUrl,
        snippet: (w.abstract_inverted_index
          ? Object.keys(w.abstract_inverted_index).slice(0, 30).join(' ')
          : '') as string
      };
    }).filter((r: WebResult) => r.url && r.url.startsWith('http'));
  } catch {
    return [];
  }
}

// ---------- Combined multi-source search ----------
export async function searchWebAll(queries: string[], maxResults: number = 10): Promise<WebResult[]> {
  const seen = new Set<string>();
  const results: WebResult[] = [];

  for (const query of queries.slice(0, 4)) {
    if (results.length >= maxResults) break;

    // Wikipedia first (fast, reliable, great for general/technical topics)
    const wiki = await searchWikipedia(query, 4);
    for (const r of wiki) {
      if (!seen.has(r.url) && results.length < maxResults) {
        seen.add(r.url);
        results.push(r);
      }
    }

    // OpenAlex for academic papers (open access only)
    const oa = await searchOpenAlex(query, 4);
    for (const r of oa) {
      if (!seen.has(r.url) && results.length < maxResults) {
        seen.add(r.url);
        results.push(r);
      }
    }
  }

  return results;
}
