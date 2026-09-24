import OpenAI from 'openai';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FixSuggestionRequest, FixSuggestionResponse, Match } from '../types';

export class LLMService {
  private provider: 'openai' | 'anthropic' | 'ollama' | 'gemini';
  private model: string;
  private openai?: OpenAI;
  private anthropicKey?: string;
  private ollamaUrl: string;
  private geminiGenAI?: ReturnType<typeof GoogleGenerativeAI>;

  constructor() {
    this.provider = (process.env.LLM_PROVIDER as any) || 'fallback';
    this.model = process.env.LLM_MODEL || 'gpt-3.5-turbo';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

    console.log('LLM Provider:', this.provider);
    console.log('LLM Model:', this.model);
    console.log('OpenAI key present:', !!process.env.OPENAI_API_KEY);
    console.log('Gemini key present:', !!process.env.GEMINI_API_KEY);

    if (this.provider === 'openai' && process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });
    }

    if (this.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    }

    if (this.provider === 'gemini' && process.env.GEMINI_API_KEY) {
      this.geminiGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  private getFallbackSuggestions(text: string): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    const synonyms: Record<string, string> = {
      'important': 'crucial', 'significant': 'notable', 'demonstrate': 'illustrate',
      'indicate': 'suggest', 'show': 'reveal', 'find': 'discover', 'use': 'utilize',
      'help': 'assist', 'create': 'generate', 'begin': 'commence',
      'end': 'conclude', 'large': 'substantial', 'small': 'minimal', 'many': 'numerous',
      'also': 'additionally', 'however': 'nevertheless', 'therefore': 'consequently',
      'because': 'since', 'but': 'however', 'and': 'furthermore', 'or': 'alternatively',
      'study': 'investigation', 'research': 'inquiry', 'result': 'outcome',
      'method': 'approach', 'data': 'evidence', 'analysis': 'examination'
    };

    const paraphrased = sentences.map(sentence => {
      let result = sentence;
      for (const [original, replacement] of Object.entries(synonyms)) {
        const regex = new RegExp(`\\b${original}\\b`, 'gi');
        result = result.replace(regex, replacement);
      }
      if (result === sentence && sentence.length > 20) {
        const words = sentence.split(' ');
        if (words.length > 4) {
          const mid = Math.floor(words.length / 2);
          result = [...words.slice(0, 2), ...words.slice(mid, mid + 2), ...words.slice(2, mid), ...words.slice(mid + 2)].join(' ');
        }
      }
      return result;
    });

    return [
      paraphrased.join(' '),
      this.restructureSentences(sentences).join(' '),
      this.addHedging(paraphrased.join(' '))
    ].filter(s => s.trim().length > 0);
  }

  private restructureSentences(sentences: string[]): string[] {
    if (sentences.length < 2) return sentences;
    const result = [...sentences];
    if (result.length >= 3) {
      [result[0], result[1]] = [result[1], result[0]];
    }
    return result;
  }

  private addHedging(text: string): string {
    const hedges = ['It appears that ', 'One might argue that ', 'Evidence suggests that ', 'It seems that '];
    const hedge = hedges[Math.floor(Math.random() * hedges.length)];
    return hedge + text.charAt(0).toLowerCase() + text.slice(1);
  }

  private generateCitations(text: string, source: string, style: string): string[] {
    const year = new Date().getFullYear();
    const isUrl = source.startsWith('http') || source.includes('corpus/');

    const title = isUrl ? source.split('/').pop() || 'Unknown Source' : source.replace('corpus/', '').replace(/\.[^.]+$/, '');
    const cleanTitle = title.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const citations: string[] = [];

    if (style === 'APA') {
      citations.push(`(${isUrl ? 'n.d.' : year}, para. 1)`);
      citations.push(`Author. (${year}). ${cleanTitle}. ${isUrl ? source : 'Local Corpus'}.`);
    } else if (style === 'IEEE') {
      citations.push(`[${Math.floor(Math.random() * 20) + 1}]`);
      citations.push(`[${Math.floor(Math.random() * 20) + 1}] A. Author, "${cleanTitle}," ${isUrl ? source : 'Local Corpus'}, ${year}.`);
    } else if (style === 'MLA') {
      citations.push(`(${title.substring(0, 30)})`);
      citations.push(`Author. "${cleanTitle}." ${isUrl ? source : 'Local Corpus'}, ${year}.`);
    } else {
      citations.push(`(${isUrl ? 'n.d.' : year})`);
      citations.push(`Author. (${year}). ${cleanTitle}.`);
    }

    return citations;
  }

  async suggestFix(request: FixSuggestionRequest, matches: Match[] = []): Promise<FixSuggestionResponse> {
    const { text, context, citationStyle = 'APA' } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for fix suggestions');
    }

    try {
      const suggestions = await this.callLLM(text, context);
      const relatedMatch = matches.find(m => text.includes(m.text) || m.text.includes(text.substring(0, 50)));
      const source = relatedMatch?.source || context || 'Unknown source';
      const citations = this.generateCitations(text, source, citationStyle);

      return { suggestions, citations };
    } catch (error) {
      console.warn('LLM API failed, using fallback suggestions:', error);
      const suggestions = this.getFallbackSuggestions(text);
      const relatedMatch = matches.find(m => text.includes(m.text));
      const source = relatedMatch?.source || context || 'Unknown source';
      const citations = this.generateCitations(text, source, citationStyle);

      return { suggestions, citations };
    }
  }

  private async callLLM(text: string, context: string): Promise<string[]> {
    const prompt = `Rewrite the following text in 2-3 different ways while preserving the academic tone and meaning. Make it sufficiently different from the original to pass plagiarism checks. Return ONLY the rewritten versions, one per line, numbered.

Original text: "${text}"

Context: ${context || 'Academic writing'}`;

    if (this.provider === 'openai' && this.openai) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an academic writing assistant that helps rewrite text to avoid plagiarism while maintaining academic integrity. Provide 2-3 alternative versions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseSuggestions(content);
    }

    if (this.provider === 'anthropic' && this.anthropicKey) {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 15000
      });

      const content = response.data.content?.[0]?.text || '';
      return this.parseSuggestions(content);
    }

    if (this.provider === 'gemini' && this.geminiGenAI) {
      const model = this.geminiGenAI.getGenerativeModel({ model: this.model || 'gemini-1.5-flash' });
      const response = await model.generateContent(prompt);
      const content = response.response.text();
      return this.parseSuggestions(content);
    }

    if (this.provider === 'ollama') {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false
      }, { timeout: 30000 });

      const content = response.data.response || '';
      return this.parseSuggestions(content);
    }

    throw new Error('No LLM provider configured');
  }

  private parseSuggestions(content: string): string[] {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const suggestions = lines
      .filter(l => !l.match(/^\d+[\.\)]\s*$/) && l.length > 20)
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(l => l.length > 20);

    if (suggestions.length === 0 && content.trim().length > 20) {
      return [content.trim()];
    }

    return suggestions.slice(0, 3);
  }

  async suggestFixForMatch(match: Match, fullText: string, citationStyle: string = 'APA'): Promise<Match> {
    try {
      const result = await this.suggestFix({
        text: match.text,
        context: `Source: ${match.source}. Confidence: ${match.confidence}%.`,
        citationStyle: citationStyle as any
      });

      return {
        ...match,
        suggestions: result.suggestions,
        citations: result.citations
      };
    } catch (error) {
      const suggestions = this.getFallbackSuggestions(match.text);
      const citations = this.generateCitations(match.text, match.source, citationStyle);
      return { ...match, suggestions, citations };
    }
  }
}
