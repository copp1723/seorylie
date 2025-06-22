import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// Rate limiting for API key endpoints
const apiKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each API key to 100 requests per windowMs
  message: 'Too many requests from this API key',
  standardHeaders: true,
  legacyHeaders: false,
});

export function apiAuth(req: Request, res: Response, next: NextFunction) {
  // Apply rate limiting first
  apiKeyLimiter(req, res, (err) => {
    if (err) return;

    const apiKey = req.headers['x-api-key'];

    // Validate API key format
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      console.warn('API request without API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      return res.status(401).json({ error: 'API key required' });
    }

    // Sanitize API key (remove whitespace, validate format)
    const sanitizedApiKey = apiKey.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedApiKey)) {
      console.warn('Invalid API key format attempted', {
        ip: req.ip,
        keyLength: apiKey.length,
        path: req.path
      });
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    // Validate against stored API keys (e.g., database, environment variables)
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (!validApiKeys.includes(sanitizedApiKey)) {
      console.warn('Invalid API key attempted', {
        ip: req.ip,
        apiKey: sanitizedApiKey.slice(0, 8) + '...',
        path: req.path
      });
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Audit logging for successful authentication
    console.info('API key authentication successful', {
      apiKey: sanitizedApiKey.slice(0, 8) + '...',
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    next();
  });
}