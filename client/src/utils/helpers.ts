import { Match, AppliedFix, CitationStyle } from '../types';

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

  // Sort by position descending so replacements don't shift earlier indices
  const positioned = appliedFixes
    .map(fix => ({ fix, pos: originalText.indexOf(fix.originalText) }))
    .filter(x => x.pos >= 0)
    .sort((a, b) => b.pos - a.pos);

  // Fallback for whitespace-mismatched fixes (normalized vs raw text)
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