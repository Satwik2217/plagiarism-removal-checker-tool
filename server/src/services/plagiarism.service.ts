import stringSimilarity from 'string-similarity';
import { v4 as uuidv4 } from 'uuid';
import { Match, CheckResult, CorpusPaper } from '../types';

interface NGramMatch {
  ngram: string;
  sourceIndex: number;
  corpusIndex: number;
}

export class PlagiarismService {
  private ngramSize: number;
  private threshold: number;

  constructor(ngramSize: number = 5, threshold: number = 15) {
    this.ngramSize = ngramSize;
    this.threshold = threshold;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private extractSentences(text: string): Array<{ text: string; startIndex: number; endIndex: number }> {
    const results: Array<{ text: string; startIndex: number; endIndex: number }> = [];
    const regex = /[^.!?]+[.!?]+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0].trim();
      if (raw.length >= 40) {
        const startIndex = match.index + match[0].indexOf(raw);
        results.push({
          text: raw,
          startIndex,
          endIndex: startIndex + raw.length
        });
      }
    }
    // If no sentence-ending punctuation found, chunk the text
    if (results.length === 0 && text.length > 60) {
      for (let i = 0; i < text.length; i += 150) {
        const chunk = text.substring(i, Math.min(i + 150, text.length)).trim();
        if (chunk.length >= 50) {
          results.push({ text: chunk, startIndex: i, endIndex: i + chunk.length });
        }
      }
    }
    return results;
  }

  private generateNGrams(tokens: string[], n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * (vecB[i] || 0), 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private createTFVector(tokens: string[], vocabulary: Map<string, number>): number[] {
    const vector = new Array(vocabulary.size).fill(0);
    const freq: Record<string, number> = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    vocabulary.forEach((index, word) => {
      vector[index] = freq[word] || 0;
    });
    return vector;
  }

  private buildVocabulary(texts: string[]): Map<string, number> {
    const vocab = new Map<string, number>();
    texts.forEach(text => {
      this.tokenize(text).forEach(token => {
        if (!vocab.has(token)) {
          vocab.set(token, vocab.size);
        }
      });
    });
    return vocab;
  }

  async checkText(text: string, corpus: CorpusPaper[], checkWeb: boolean = false): Promise<CheckResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for plagiarism check');
    }

    if (text.length < 100) {
      throw new Error('Text is too short. Minimum 100 characters required for meaningful analysis.');
    }

    const matches: Match[] = [];
    const processedText = text.replace(/\s+/g, ' ').trim();
    const tokens = this.tokenize(processedText);

    // Split document into sentences for sentence-level fuzzy matching
    const sentences = this.extractSentences(processedText);

    const sourceNGrams = this.generateNGrams(tokens, this.ngramSize);

    const activeCorpus = corpus.filter(p => p.enabled);

    for (const paper of activeCorpus) {
      const corpusTokens = this.tokenize(paper.content);
      const corpusNGrams = this.generateNGrams(corpusTokens, this.ngramSize);
      const corpusNGramMap = new Map<string, number[]>();
      corpusNGrams.forEach((ngram, index) => {
        const indices = corpusNGramMap.get(ngram);
        if (indices) indices.push(index);
        else corpusNGramMap.set(ngram, [index]);
      });

      const matchingNGrams: NGramMatch[] = [];
      sourceNGrams.forEach((ngram, sourceIndex) => {
        const corpusIndices = corpusNGramMap.get(ngram);
        if (!corpusIndices) return;
        for (const corpusIndex of corpusIndices) {
          matchingNGrams.push({ ngram, sourceIndex, corpusIndex });
        }
      });

      const matchClusters = this.clusterMatches(matchingNGrams, tokens, processedText);

      const allVocab = this.buildVocabulary([processedText, paper.content]);
      const vecA = this.createTFVector(tokens, allVocab);
      const vecB = this.createTFVector(corpusTokens, allVocab);
      const cosine = this.cosineSimilarity(vecA, vecB);

      for (const cluster of matchClusters) {
        if (cluster.tokenLength >= this.ngramSize) {
          const similarity = stringSimilarity.compareTwoStrings(cluster.matchedText.toLowerCase(), processedText.toLowerCase().substring(cluster.startIndex, cluster.endIndex));
          const confidence = Math.min(100, Math.round((similarity * 0.5 + cosine * 0.3 + (cluster.tokenLength / tokens.length) * 0.2) * 100));

          if (confidence >= this.threshold) {
            matches.push({
              id: uuidv4(),
              text: cluster.matchedText,
              source: `corpus/${paper.filename}`,
              startIndex: cluster.startIndex,
              endIndex: cluster.endIndex,
              confidence,
              suggestions: [],
              citations: []
            });
          }
        }
      }

      // Sentence-level fuzzy matching (catches reworded / near-duplicate content
      // that exact n-grams miss — critical for web sources with small differences)
      const sourceSentences = this.extractSentences(paper.content.replace(/\s+/g, ' ').trim());
      for (const sent of sentences) {
        if (sent.text.length < 50) continue;
        let bestSim = 0;
        let bestSourceSent = '';
        for (const srcSent of sourceSentences) {
          if (srcSent.text.length < 50) continue;
          // Quick length filter
          const lenRatio = sent.text.length / srcSent.text.length;
          if (lenRatio < 0.5 || lenRatio > 2) continue;
          const sim = stringSimilarity.compareTwoStrings(sent.text.toLowerCase(), srcSent.text.toLowerCase());
          if (sim > bestSim) {
            bestSim = sim;
            bestSourceSent = srcSent.text;
          }
        }
        // 0.55 = catches heavy overlap / light paraphrase; weight with cosine for confidence
        if (bestSim >= 0.55) {
          const confidence = Math.min(100, Math.round((bestSim * 0.7 + cosine * 0.3) * 100));
          if (confidence >= Math.min(this.threshold, 30)) {
            matches.push({
              id: uuidv4(),
              text: sent.text,
              source: `corpus/${paper.filename}`,
              startIndex: sent.startIndex,
              endIndex: sent.endIndex,
              confidence,
              suggestions: [],
              citations: []
            });
          }
        }
      }
    }

    if (checkWeb) {
      const webMatches = await this.checkWebSources(processedText, tokens);
      matches.push(...webMatches);
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    const mergedMatches = this.mergeOverlappingMatches(matches);

    // Ensure each match's text spans its full startIndex-endIndex range.
    // mergeOverlappingMatches can extend endIndex without updating text
    // (when a lower-confidence match overlaps a higher-confidence one),
    // which would otherwise cause remapToOriginal to shrink the span.
    const normalizedMatches = mergedMatches.map(m => ({
      ...m,
      text: processedText.substring(m.startIndex, m.endIndex)
    }));

    // Remap match text/indices from processedText (whitespace-normalized) back to
    // the original text so client-side highlighting and fix replacement work
    // when the source has newlines/multiple spaces (DOCX, pasted text, etc.)
    const remappedMatches = normalizedMatches.map(m => this.remapToOriginal(m, processedText, text));

    const totalMatchedChars = remappedMatches.reduce((sum, m) => sum + (m.endIndex - m.startIndex), 0);
    const similarity = Math.min(100, Math.round((totalMatchedChars / processedText.length) * 100 * 10) / 10);

    return { similarity, matches: remappedMatches };
  }

  private remapToOriginal(match: Match, processedText: string, originalText: string): Match {
    const spanLength = match.endIndex - match.startIndex;

    // Fast path: exact substring exists in original
    const exactIdx = originalText.indexOf(match.text);
    if (exactIdx >= 0) {
      return {
        ...match,
        text: originalText.substring(exactIdx, exactIdx + match.text.length),
        startIndex: exactIdx,
        endIndex: exactIdx + spanLength
      };
    }

    // Flexible path: match with whitespace differences (newlines vs spaces)
    const pattern = match.text
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    if (pattern.length > 0) {
      try {
        const re = new RegExp(pattern);
        const m = originalText.match(re);
        if (m && m.index !== undefined) {
          return {
            ...match,
            text: m[0],
            startIndex: m.index,
            endIndex: m.index + spanLength
          };
        }
      } catch {
        // fall through
      }
    }

    // Last resort: keep processed indices (may be slightly off for highlighting)
    return match;
  }

  private clusterMatches(
    matching: NGramMatch[],
    sourceTokens: string[],
    sourceText: string
  ): Array<{ startIndex: number; endIndex: number; matchedText: string; tokenLength: number }> {
    if (matching.length === 0) return [];

    const sorted = [...matching].sort((a, b) =>
      a.sourceIndex - b.sourceIndex || a.corpusIndex - b.corpusIndex
    );
    const clusters: NGramMatch[][] = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      const sourceGap = current.sourceIndex - previous.sourceIndex;
      const corpusGap = current.corpusIndex - previous.corpusIndex;
      const lastCluster = clusters[clusters.length - 1];
      const canExtend = sourceGap >= 1 && sourceGap <= 2 && corpusGap >= 1 && corpusGap <= 2;
      const belongsToLast = canExtend && lastCluster[lastCluster.length - 1] === previous;

      if (belongsToLast) lastCluster.push(current);
      else clusters.push([current]);
    }

    return clusters.map(cluster => {
      const firstSourceIdx = Math.min(...cluster.map(match => match.sourceIndex));
      const lastSourceIdx = Math.max(...cluster.map(match => match.sourceIndex)) + this.ngramSize;
      const endTokenIdx = Math.min(lastSourceIdx, sourceTokens.length);

      let charStart = 0;
      for (let i = 0; i < firstSourceIdx && i < sourceTokens.length; i++) {
        const pos = sourceText.toLowerCase().indexOf(sourceTokens[i], charStart);
        if (pos === -1) break;
        charStart = pos + sourceTokens[i].length + 1;
      }

      let charEnd = charStart;
      for (let i = firstSourceIdx; i < endTokenIdx && i < sourceTokens.length; i++) {
        const pos = sourceText.toLowerCase().indexOf(sourceTokens[i], charEnd);
        if (pos === -1) break;
        charEnd = pos + sourceTokens[i].length;
      }

      return {
        startIndex: charStart,
        endIndex: charEnd,
        matchedText: sourceText.substring(charStart, charEnd),
        tokenLength: endTokenIdx - firstSourceIdx
      };
    }).filter(c => c.endIndex > c.startIndex && c.matchedText.length > 20);
  }

  private mergeOverlappingMatches(matches: Match[]): Match[] {
    if (matches.length <= 1) return matches;

    const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
    const merged: Match[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];

      if (current.startIndex <= last.endIndex) {
        if (current.confidence > last.confidence) {
          last.text = current.text;
          last.source = current.source;
          last.endIndex = Math.max(last.endIndex, current.endIndex);
          last.confidence = current.confidence;
          last.startIndex = Math.min(last.startIndex, current.startIndex);
        } else {
          last.endIndex = Math.max(last.endIndex, current.endIndex);
        }
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  private async checkWebSources(text: string, tokens: string[]): Promise<Match[]> {
    const matches: Match[] = [];

    try {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      const sampleSentences = sentences.slice(0, 5).map(s => s.trim()).filter(s => s.length > 50);

      for (const sentence of sampleSentences) {
        try {
          const searchQuery = encodeURIComponent(sentence.substring(0, 100));
          const response = await fetch(`https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1`, {
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            const data = await response.json() as any;
            if (data.AbstractText) {
              const similarity = stringSimilarity.compareTwoStrings(sentence.toLowerCase(), data.AbstractText.toLowerCase());
              if (similarity > 0.3) {
                const idx = text.indexOf(sentence);
                matches.push({
                  id: uuidv4(),
                  text: sentence,
                  source: data.AbstractURL || 'web',
                  startIndex: idx,
                  endIndex: idx + sentence.length,
                  confidence: Math.round(similarity * 100),
                  suggestions: [],
                  citations: []
                });
              }
            }
          }
        } catch (err) {
          console.warn('Web search failed for sentence:', err);
        }
      }
    } catch (err) {
      console.warn('Web check failed, continuing with local checks only:', err);
    }

    return matches;
  }

  async checkFromFile(content: string, corpus: CorpusPaper[], checkWeb: boolean = false): Promise<CheckResult> {
    return this.checkText(content, corpus, checkWeb);
  }
}