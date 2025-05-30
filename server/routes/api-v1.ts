/**
 * API v1 Routes
 * Main router for external API v1 endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import conversationRoutes from './conversation-api';
import handoverRoutes from './handover-api';
import { apiAuth } from '../middleware/api-auth';
import logger from '../utils/logger';

const router = Router();

// CORS configuration for API endpoints
router.use(cors({
  origin: process.env.API_CORS_ORIGINS ? 
    process.env.API_CORS_ORIGINS.split(',') : 
    '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// API request logging middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('API request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      clientId: req.apiClient?.clientId || 'unknown'
    });
  });
  
  next();
});

// Health check endpoint (no auth required)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API key validation endpoint
router.get('/validate', apiAuth(), (req: Request, res: Response) => {
  res.json({
    valid: true,
    clientId: req.apiClient?.clientId,
    clientName: req.apiClient?.clientName,
    scopes: req.apiClient?.scopes
  });
});

// Mount API routes
router.use('/conversation', conversationRoutes);
router.use('/handover', handoverRoutes);

// Catch-all 404 handler for API routes
router.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'not_found',
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// API error handler
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('API error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl
  });
  
  res.status(500).json({
    error: 'server_error',
    message: 'An unexpected error occurred'
  });
});

export default router;
