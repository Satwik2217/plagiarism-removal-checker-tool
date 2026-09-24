import { Request, Response } from 'express';
import { queryAll, run } from '../db/init';

export class SettingsController {
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const rows = queryAll('SELECT key, value FROM settings');
      const settings: Record<string, string> = {};
      rows.forEach(row => { settings[row.key as string] = row.value as string; });

      res.json({
        settings: {
          plagiarismThreshold: parseInt(settings.plagiarism_threshold || '15'),
          ngramSize: parseInt(settings.ngram_size || '5'),
          enableWebCheck: settings.enable_web_check === 'true',
          llmProvider: settings.llm_provider || 'openai',
          llmModel: settings.llm_model || 'gpt-3.5-turbo'
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { plagiarismThreshold, ngramSize, enableWebCheck, llmProvider, llmModel } = req.body;

      const updates: Array<[string, string]> = [];
      if (plagiarismThreshold !== undefined) updates.push(['plagiarism_threshold', String(plagiarismThreshold)]);
      if (ngramSize !== undefined) updates.push(['ngram_size', String(ngramSize)]);
      if (enableWebCheck !== undefined) updates.push(['enable_web_check', String(enableWebCheck)]);
      if (llmProvider !== undefined) updates.push(['llm_provider', llmProvider]);
      if (llmModel !== undefined) updates.push(['llm_model', llmModel]);

      for (const [key, value] of updates) {
        run(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [key, value]
        );
      }

      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
  }
}