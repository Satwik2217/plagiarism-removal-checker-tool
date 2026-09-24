import { Router, Request, Response } from 'express';
import multer from 'multer';
import { queryAll, run } from '../db/init';
import { PDFParseUtil } from '../utils/pdf-parser';
import { DocxParseUtil } from '../utils/docx-parser';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const rows = queryAll(
      'SELECT id, filename, enabled, added_at FROM corpus_papers ORDER BY added_at DESC'
    );
    res.json({ papers: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch corpus papers' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { filename, content } = req.body;

    if (!filename || !content) {
      res.status(400).json({ success: false, error: 'Filename and content are required' });
      return;
    }

    const id = `cor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    run('INSERT INTO corpus_papers (id, filename, content) VALUES (?, ?, ?)', [id, filename, content]);

    res.json({ success: true, message: `Corpus paper "${filename}" uploaded successfully`, id });
  } catch (error: any) {
    console.error('Corpus upload error:', error);
    res.status(500).json({ success: false, error: `Failed to upload corpus paper: ${error.message}` });
  }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const ext = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
    let content = '';

    if (ext === '.pdf') {
      content = await PDFParseUtil.parse(req.file.buffer);
    } else if (ext === '.docx' || ext === '.doc') {
      content = await DocxParseUtil.parse(req.file.buffer);
    } else if (ext === '.txt') {
      content = req.file.buffer.toString('utf-8');
    } else {
      res.status(400).json({ success: false, error: 'Unsupported file format. Allowed: .txt, .doc, .docx, .pdf' });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Could not extract text from file' });
      return;
    }

    const id = `cor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    run('INSERT INTO corpus_papers (id, filename, content) VALUES (?, ?, ?)', [id, req.file.originalname, content]);

    res.json({ success: true, message: `Corpus paper "${req.file.originalname}" uploaded successfully`, id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: `Failed to upload file: ${error.message}` });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    run('DELETE FROM corpus_papers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Paper deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete paper' });
  }
});

router.patch('/:id/toggle', (req: Request, res: Response) => {
  try {
    run('UPDATE corpus_papers SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Paper toggled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle paper' });
  }
});

export default router;