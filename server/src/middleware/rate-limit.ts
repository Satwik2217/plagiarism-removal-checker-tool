import { Request, Response, NextFunction } from 'express';

let requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(windowMs: number = 60000, maxRequests: number = 30) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.'
      });
      return;
    }

    record.count++;
    next();
  };
}

export function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}

setInterval(cleanupOldEntries, 60000);