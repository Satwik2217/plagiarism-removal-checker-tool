import { Router, Request, Response } from 'express';
import { queryAll, run } from '../db/init';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const rows = queryAll(
      'SELECT id, date, filename, similarity, matches, exported FROM checks ORDER BY date DESC LIMIT 100'
    );

    const checks = rows.map(row => ({
      id: row.id,
      date: row.date,
      filename: row.filename,
      similarity: row.similarity,
      matches: JSON.parse(row.matches as string),
      exported: !!row.exported
    }));

    res.json({ checks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.post('/save', (req: Request, res: Response) => {
  try {
    const { filename, originalText, similarity, matches, saveHistory } = req.body;

    if (!saveHistory) {
      res.json({ success: true, saved: false, message: 'History saving disabled' });
      return;
    }

    const id = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const date = new Date().toISOString();

    run(
      'INSERT INTO checks (id, date, filename, original_text, similarity, matches) VALUES (?, ?, ?, ?, ?, ?)',
      [id, date, filename || 'Untitled', originalText || '', similarity, JSON.stringify(matches || [])]
    );

    res.json({ success: true, saved: true, id });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save check' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    run('DELETE FROM checks WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Check deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete check' });
  }
});

export default router;