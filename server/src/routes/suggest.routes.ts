import { Router, Request, Response } from 'express';
import { LLMService } from '../services/llm.service';

const router = Router();
const llmService = new LLMService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, context, citationStyle, tone } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Text is required' });
      return;
    }

    const result = await llmService.suggestFix({ text, context, citationStyle, tone });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to generate suggestions' });
  }
});

export default router;
