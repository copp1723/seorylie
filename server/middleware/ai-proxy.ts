import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/errors';

// AI Proxy Middleware - Anonymizes requests to AI services
export const aiProxyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Log AI proxy request
  logger.debug('AI proxy middleware', { 
    path: req.path, 
    method: req.method,
    hasAuth: !!req.headers.authorization 
  });

  // Add AI proxy headers
  req.headers['x-ai-proxy'] = 'active';
  req.headers['x-anonymized'] = 'true';

  // TODO: Implement actual AI request proxying
  // - Strip PII from requests
  // - Add agency context
  // - Route to appropriate AI service

  next();
};

export default aiProxyMiddleware;