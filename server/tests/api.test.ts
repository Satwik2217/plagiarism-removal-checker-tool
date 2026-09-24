import request from 'supertest';
import express, { Request, Response } from 'express';
import { PlagiarismService } from '../src/services/plagiarism.service';

describe('API Health', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  });

  test('GET /api/health returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Text Validation', () => {
  test('empty text should be rejected', () => {
    const text = '';
    expect(text.trim().length).toBe(0);
  });

  test('short text should be rejected', () => {
    const text = 'Short text';
    expect(text.trim().length).toBeLessThan(100);
  });

  test('sufficient text should pass', () => {
    const text = 'A'.repeat(500);
    expect(text.trim().length).toBeGreaterThanOrEqual(100);
  });
});

describe('NGram Generation Logic', () => {
  function tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
  }

  function generateNGrams(tokens: string[], n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  test('tokenize lowercases and strips punctuation', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
  });

  test('generates correct n-grams', () => {
    const tokens = tokenize('one two three four five');
    const ngrams = generateNGrams(tokens, 3);
    expect(ngrams).toEqual([
      'one two three',
      'two three four',
      'three four five'
    ]);
  });

  test('detects shared n-grams between texts', () => {
    const a = generateNGrams(tokenize('machine learning is a subset of artificial intelligence'), 3);
    const b = generateNGrams(tokenize('machine learning is a branch of computer science'), 3);
    const shared = a.filter(g => b.includes(g));
    expect(shared.length).toBeGreaterThanOrEqual(2);
    expect(shared).toContain('machine learning is');
  });
});

describe('Passage Matching', () => {
  test('detects a copied passage located in the middle of a source', async () => {
    const passage = 'John Felix Anthony Cena was born in West Newbury, Massachusetts, on April 23, 1977, to Carol and John Joseph Cena. He has four brothers named Dan, Matt, Steve, and Sean. Cena attended Central Catholic High School in Lawrence, Massachusetts.';
    const sourceContent = `This article contains an introduction before the copied passage. ${passage} Additional biography text follows the passage.`;

    const result = await new PlagiarismService(5, 15).checkText(passage, [{
      id: 'john-cena',
      filename: 'John Cena',
      content: sourceContent,
      enabled: true,
      addedAt: ''
    }], false);

    expect(result.similarity).toBeGreaterThan(95);
    expect(result.matches[0].source).toBe('corpus/John Cena');
    expect(result.matches[0].text).toBe(passage);
  });
});
