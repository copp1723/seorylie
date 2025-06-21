import { Request, Response, NextFunction } from 'express';

export function apiAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Validate and sanitize the API key
  if (typeof apiKey !== 'string') {
    return res.status(401).json({ error: 'Invalid API key format' });
  }
  
  // Sanitize: trim whitespace and ensure alphanumeric + hyphens only
  const sanitizedApiKey = apiKey.trim();
  if (!/^[a-zA-Z0-9-]+$/.test(sanitizedApiKey)) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }
  
  // Validate against stored API keys (e.g., database, environment variables)
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  if (!validApiKeys.includes(sanitizedApiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  // Add rate limiting and audit logging here
  next();
}