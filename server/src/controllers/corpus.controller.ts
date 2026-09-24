import { Request, Response } from 'express';
import { queryAll, run } from '../db/init';

export class CorpusController {
  async uploadCorpus(req: Request, res: Response): Promise<void> {
    try {
      const { filename, content } = req.body;

      if (!filename || !content) {
        res.status(400).json({ success: false, error: 'Filename and content are required' });
        return;
      }

      const id = `cor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      run('INSERT INTO corpus_papers (id, filename, content) VALUES (?, ?, ?)', [id, filename, content]);

      res.json({ success: true, message: `Corpus paper "${filename}" uploaded successfully`, id });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to upload corpus paper' });
    }
  }

  async getCorpus(req: Request, res: Response): Promise<void> {
    try {
      const papers = queryAll('SELECT id, filename, enabled, added_at FROM corpus_papers ORDER BY added_at DESC');
      res.json({ papers });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch corpus papers' });
    }
  }

  async deleteCorpus(req: Request, res: Response): Promise<void> {
    try {
      run('DELETE FROM corpus_papers WHERE id = ?', [req.params.id]);
      res.json({ success: true, message: 'Paper deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to delete paper' });
    }
  }

  async toggleCorpus(req: Request, res: Response): Promise<void> {
    try {
      run('UPDATE corpus_papers SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?', [req.params.id]);
      res.json({ success: true, message: 'Paper toggled successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to toggle paper' });
    }
  }
}