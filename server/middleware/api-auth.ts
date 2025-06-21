import { Request, Response, NextFunction } from 'express';

export function apiAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Validate against stored API keys (e.g., database, environment variables)
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  if (!validApiKeys.includes(apiKey as string)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // Add rate limiting and audit logging here
  next();
}