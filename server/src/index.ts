import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { initializeDatabase } from './db/init';
import checkRoutes from './routes/check.routes';
import suggestRoutes from './routes/suggest.routes';
import corpusRoutes from './routes/corpus.routes';
import corpusImportRoutes from './routes/corpus-import.routes';
import historyRoutes from './routes/history.routes';
import exportRoutes from './routes/export.routes';
import settingsRoutes from './routes/settings.routes';
import { rateLimit } from './middleware/rate-limit';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(rateLimit(60000, 60));

app.use('/api/check-plagiarism', checkRoutes);
app.use('/api/suggest-fix', suggestRoutes);
app.use('/api/upload-corpus', corpusRoutes);
app.use('/api/corpus', corpusRoutes);
app.use('/api/corpus', corpusImportRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from the React app in production
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PCFA Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });