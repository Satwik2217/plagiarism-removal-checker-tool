import { Match, AppliedFix, CitationStyle } from '../types';

export function generateFallbackFix(text: string): string {
  const synonyms: Record<string, string> = {
    'the': 'a', 'is': 'was', 'are': 'were', 'was': 'is', 'can': 'could',
    'will': 'would', 'this': 'that', 'these': 'those', 'show': 'demonstrate',
    'use': 'utilize', 'make': 'create', 'find': 'discover', 'provide': 'supply',
    'important': 'significant', 'method': 'approach', 'result': 'outcome',
    'data': 'information', 'analysis': 'examination', 'study': 'research',
    'system': 'framework', 'process': 'procedure', 'based': 'grounded',
    'using': 'utilizing', 'from': 'sourced from', 'with': 'alongside',
    'by': 'through', 'also': 'additionally', 'however': 'nevertheless',
    'because': 'since', 'including': 'encompassing', 'significant': 'notable',
    'different': 'distinct', 'similar': 'comparable', 'improve': 'enhance',
    'increase': 'boost', 'decrease': 'reduce', 'effect': 'impact',
    'effectively': 'efficiently', 'currently': 'presently', 'further': 'additional',
    'overall': 'total', 'specifically': 'particularly', 'generally': 'typically',
    'primarily': 'mainly', 'finally': 'ultimately', 'first': 'initially',
    'second': 'subsequently', 'next': 'then', 'last': 'final',
    'new': 'novel', 'old': 'previous', 'good': 'favorable', 'bad': 'unfavorable',
    'large': 'substantial', 'small': 'minor', 'high': 'elevated', 'low': 'reduced',
    'many': 'numerous', 'few': 'limited', 'best': 'optimal', 'well': 'effectively',
    'much': 'considerably', 'very': 'highly', 'too': 'excessively', 'just': 'merely',
    'may': 'might', 'must': 'should', 'be': 'remain', 'have': 'possess',
    'has': 'contains', 'do': 'perform', 'does': 'performs', 'get': 'obtain',
    'give': 'provide', 'go': 'proceed', 'know': 'understand', 'see': 'observe',
    'say': 'state', 'take': 'adopt', 'think': 'consider', 'turn': 'change',
    'work': 'function', 'call': 'name', 'put': 'place', 'keep': 'retain',
    'let': 'allow', 'run': 'operate', 'set': 'establish', 'stop': 'halt',
    'try': 'attempt', 'way': 'method', 'want': 'desire',
    'need': 'require', 'look': 'view', 'come': 'arrive', 'back': 'return',
    'up': 'ascending', 'down': 'descending', 'out': 'outward', 'in': 'inward',
    'on': 'upon', 'off': 'away', 'over': 'above', 'under': 'below',
    'between': 'among', 'through': 'across', 'before': 'prior to', 'after': 'following',
    'above': 'over', 'below': 'under', 'around': 'about', 'near': 'close to',
    'far': 'distant', 'long': 'extended', 'short': 'brief', 'wide': 'broad',
    'narrow': 'limited', 'deep': 'profound', 'shallow': 'superficial',
    'heavy': 'weighty', 'light': 'lightweight', 'hard': 'difficult', 'soft': 'gentle',
    'rough': 'coarse', 'smooth': 'even', 'clean': 'pure', 'dirty': 'contaminated',
    'hot': 'warm', 'cold': 'cool', 'fast': 'rapid', 'slow': 'gradual',
    'early': 'premature', 'late': 'delayed', 'soon': 'shortly', 'now': 'currently',
    'then': 'subsequently', 'today': 'presently', 'always': 'constantly',
    'never': 'not ever', 'sometimes': 'occasionally', 'often': 'frequently',
    'rarely': 'seldom', 'usually': 'typically', 'especially': 'particularly',
    'except': 'excluding', 'only': 'merely', 'even': 'despite', 'though': 'although',
    'although': 'even though', 'since': 'because', 'if': 'whether',
    'unless': 'except if', 'while': 'whereas', 'where': 'in which',
    'when': 'at which time', 'how': 'in what way', 'why': 'for what reason',
    'what': 'which', 'who': 'whom', 'which': 'that', 'that': 'which',
    'here': 'at this place', 'there': 'at that place',
  };

  const words = text.split(/\s+/);
  const result = words.map(word => {
    const lower = word.toLowerCase().replace(/[^a-zA-Z]/g, '');
    if (synonyms[lower]) {
      const replacement = synonyms[lower];
      return word.charAt(0) === word.charAt(0).toUpperCase()
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    }
    return word;
  });

  return result.join(' ');
}

export function getRiskColor(similarity: number): string {
  if (similarity >= 30) return 'text-red-600';
  if (similarity >= 15) return 'text-yellow-600';
  return 'text-green-600';
}

export function getRiskBg(similarity: number): string {
  if (similarity >= 30) return 'bg-red-500';
  if (similarity >= 15) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getRiskLabel(similarity: number): string {
  if (similarity >= 30) return 'High Risk';
  if (similarity >= 15) return 'Moderate Risk';
  return 'Low Risk';
}

export function getRiskBadge(similarity: number): string {
  if (similarity >= 30) return 'badge-red';
  if (similarity >= 15) return 'badge-yellow';
  return 'badge-green';
}

export function applyFixesToText(originalText: string, appliedFixes: AppliedFix[]): string {
  if (appliedFixes.length === 0) return originalText;

  const positioned = appliedFixes
    .map(fix => ({ fix, pos: originalText.indexOf(fix.originalText) }))
    .filter(x => x.pos >= 0)
    .sort((a, b) => b.pos - a.pos);

  const unmatched = appliedFixes.filter(f => originalText.indexOf(f.originalText) < 0);

  let result = originalText;
  for (const { fix, pos } of positioned) {
    const end = pos + fix.originalText.length;
    result = result.slice(0, pos) + fix.fixedText + result.slice(end);
  }

  for (const fix of unmatched) {
    if (!fix.originalText) continue;
    const pattern = fix.originalText
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    try {
      const re = new RegExp(pattern);
      const m = result.match(re);
      if (m && m.index !== undefined) {
        result = result.slice(0, m.index) + fix.fixedText + result.slice(m.index + m[0].length);
      }
    } catch {
      // skip unmatchable fix
    }
  }

  return result;
}

export function buildHighlightedText(
  originalText: string,
  matches: Match[],
  appliedFixes: AppliedFix[]
): Array<{ text: string; matchId?: string; isApplied?: boolean; confidence?: number }> {
  const appliedMatchIds = new Set(appliedFixes.map(f => f.matchId));
  const sortedMatches = [...matches].sort((a, b) => a.startIndex - b.startIndex);
  const segments: Array<{ text: string; matchId?: string; isApplied?: boolean; confidence?: number }> = [];

  let lastIndex = 0;

  for (const match of sortedMatches) {
    if (match.startIndex > lastIndex) {
      segments.push({ text: originalText.substring(lastIndex, match.startIndex) });
    }

    const isApplied = appliedMatchIds.has(match.id);
    segments.push({
      text: originalText.substring(match.startIndex, match.endIndex),
      matchId: match.id,
      isApplied,
      confidence: match.confidence
    });

    lastIndex = match.endIndex;
  }

  if (lastIndex < originalText.length) {
    segments.push({ text: originalText.substring(lastIndex) });
  }

  return segments;
}

export function formatCitation(match: Match, style: CitationStyle): string {
  if (match.citations && match.citations.length > 0) {
    const inText = match.citations[0];
    const full = match.citations[1] || match.citations[0];
    return `In-text: ${inText}\nFull: ${full}`;
  }
  return `Source: ${match.source}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
