// Lightweight keyword/topic extraction from research text — no ML deps needed.

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by
   can did do does doing down during each few for from further had has have having he her here hers herself him himself
   his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our
   ours ourselves out over own same she should so some such than that the their theirs them themselves then there these
   they this those through to too under until up very was we were what when where which while who whom why with you
   your yours yourself yourselves also may might must shall will would could thereof thus upon within without etc
   figure table section chapter paper study research method results conclusion abstract keywords index et al
   using used use based proposed approach analysis data new novel present work work work`
    .split(/\s+/).filter(Boolean)
);

export interface TopicResult {
  title: string;
  keywords: string[];
  keySentences: string[];
}

export function extractTopic(text: string): TopicResult {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];

  // Title heuristic: first line/sentence that looks like a title
  // (3–15 words, or before first period if short)
  const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 10) || sentences[0] || '';
  const titleWords = firstLine.split(/\s+/).filter(w => w.length > 1);
  const title = titleWords.length <= 18
    ? firstLine.replace(/\.$/, '')
    : titleWords.slice(0, 12).join(' ') + '...';

  // Word frequency with stopword removal
  const freq = new Map<string, number>();
  const words = clean.toLowerCase().match(/[a-z][a-z-]{2,}/g) || [];
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Bigrams for better topic phrases
  const bigramFreq = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i], b = words[i + 1];
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    const bg = `${a} ${b}`;
    bigramFreq.set(bg, (bigramFreq.get(bg) || 0) + 1);
  }

  const topUnigrams = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);

  const topBigrams = [...bigramFreq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([bg]) => bg);

  // Prefer bigrams (phrases) then unigrams for keywords
  const keywords = [...topBigrams, ...topUnigrams].slice(0, 12);

  // Key sentences: longest/most informative sentences for web search
  const keySentences = sentences
    .map(s => s.trim())
    .filter(s => s.length > 60 && s.length < 300)
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);

  // If no good sentences, take chunks of ~150 chars
  if (keySentences.length === 0 && clean.length > 150) {
    for (let i = 0; i < clean.length && keySentences.length < 3; i += 200) {
      keySentences.push(clean.substring(i, i + 150));
    }
  }

  return { title, keywords, keySentences };
}

// Build a compact arXiv-style query from keywords
export function buildSearchQuery(topic: TopicResult): string {
  // Use top bigrams first (most specific), fall back to unigrams
  const phrases = topic.keywords.slice(0, 6);
  if (phrases.length === 0) return topic.title.substring(0, 100);
  return phrases.join(' ');
}
