import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PlagiarismService } from '../services/plagiarism.service';
import { LLMService } from '../services/llm.service';
import { extractTopic, TopicResult } from '../services/topic.service';
import { gatherSourcesAutomatically, } from '../services/auto-source.service';
import { queryAll } from '../db/init';
import { CorpusPaper, Match } from '../types';
import { PDFParseUtil } from '../utils/pdf-parser';
import { DocxParseUtil } from '../utils/docx-parser';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.doc', '.docx', '.pdf'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file format. Allowed: .txt, .doc, .docx, .pdf'));
  }
});

const router = Router();
const llmService = new LLMService();

function getLocalCorpus(): CorpusPaper[] {
  try {
    const rows = queryAll(
      'SELECT id, filename, content, added_at, enabled FROM corpus_papers WHERE enabled = 1'
    );
    return rows.map(r => ({
      id: r.id as string,
      filename: r.filename as string,
      content: r.content as string,
      addedAt: r.added_at as string,
      enabled: !!r.enabled
    }));
  } catch {
    return [];
  }
}

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let text = req.body.text || '';
    const threshold = parseInt(req.body.threshold) || 15;
    // AUTO mode is default: detect topic + search arXiv + optional web
    const auto = req.body.auto !== 'false';
    const enableWeb = req.body.checkWeb === 'true' || req.body.checkWeb === true || req.body.autoWeb === 'true';
    const ngramSize = parseInt(req.body.ngramSize) || 5;

    // ---- Parse input ----
    if (req.file) {
      const ext = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
      try {
        if (ext === '.pdf') text = await PDFParseUtil.parse(req.file.buffer);
        else if (ext === '.docx' || ext === '.doc') text = await DocxParseUtil.parse(req.file.buffer);
        else if (ext === '.txt') text = req.file.buffer.toString('utf-8');
        else {
          res.status(400).json({ success: false, error: 'Unsupported file format' });
          return;
        }
      } catch (parseError: any) {
        res.status(400).json({ success: false, error: `Failed to parse file: ${parseError.message}` });
        return;
      }
    }

    if (!text || text.trim().length === 0) {
      res.status(400).json({ success: false, error: 'No text provided. Please enter text or upload a file.' });
      return;
    }
    if (text.trim().length < 100) {
      res.status(400).json({ success: false, error: 'Text is too short. Minimum 100 characters required for analysis.' });
      return;
    }
    if (text.length > 500000) {
      res.status(400).json({ success: false, error: 'Text is too large (max 500,000 characters).' });
      return;
    }

    // ---- Step 1: detect topic ----
    const topic: TopicResult = extractTopic(text);
    const localCorpus = getLocalCorpus();

    // ---- Step 2: gather sources automatically ----
    let sources: Awaited<ReturnType<typeof gatherSourcesAutomatically>> = [];
    if (auto) {
      sources = await gatherSourcesAutomatically(text, topic, localCorpus, {
        enableWeb,
        arxivCount: 5,
        log: (msg: string) => console.log(`[auto-source] ${msg}`)
      });
    } else {
      // Legacy: local corpus only
      sources = localCorpus.map(p => ({
        id: p.id, filename: p.filename, content: p.content, origin: 'local' as const
      }));
    }

    // Convert to CorpusPaper shape for the detection engine
    const corpusForCheck: CorpusPaper[] = sources.map(s => ({
      id: s.id,
      filename: s.filename,
      content: s.content,
      addedAt: new Date().toISOString(),
      enabled: true
    }));

    if (corpusForCheck.length === 0) {
      // Still return a valid response so UI can explain
      res.json({
        success: true,
        similarity: 0,
        matches: [],
        originalText: text,
        topic,
        sourcesChecked: [],
        corpusCount: 0,
        checkWeb: enableWeb,
        message: 'No sources could be gathered automatically. Check your internet connection and try again.'
      });
      return;
    }

    // ---- Step 3: detect plagiarism ----
    const plagiarismService = new PlagiarismService(ngramSize, threshold);
    const result = await plagiarismService.checkText(text, corpusForCheck, false);

    // ---- Step 4: return matches without blocking on LLM enrichment ----
    // Fix suggestions are fetched on-demand via /api/suggest-fix when user clicks "Fix"
    const sourceList = sources.map(s => ({
      name: s.filename,
      origin: s.origin,
      url: s.url || null
    }));

    res.json({
      success: true,
      similarity: result.similarity,
      matches: result.matches,
      originalText: text,
      topic,
      sourcesChecked: sourceList,
      corpusCount: sources.length,
      checkWeb: enableWeb,
      message: `Compared against ${sources.length} automatically-gathered source${sources.length !== 1 ? 's' : ''}. ${result.matches.length} match${result.matches.length !== 1 ? 'es' : ''} found.`
    });
  } catch (error: any) {
    console.error('Check failed:', error);
    const statusCode = error.message?.includes('too short') || error.message?.includes('required') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: error.message || 'Plagiarism check failed' });
  }
});

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { matches, citationStyle } = req.body;
    if (!Array.isArray(matches) || matches.length === 0) {
      res.status(400).json({ success: false, error: 'Matches array is required' });
      return;
    }
    const enriched: Match[] = [];
    for (const match of matches) {
      try {
        const result = await llmService.suggestFix({
          text: match.text,
          context: `Source: ${match.source}. Confidence: ${match.confidence}%.`,
          citationStyle: citationStyle || 'APA'
        });
        enriched.push({ ...match, suggestions: result.suggestions, citations: result.citations });
      } catch {
        enrichedMatches_push(enriched, match);
      }
    }
    res.json({ success: true, matches: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed' });
  }
});

function enrichedMatches_push(arr: Match[], m: Match) { arr.push(m); }

export default router;
