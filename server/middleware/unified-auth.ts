/**
 * Unified Authentication Middleware
 * 
 * Consolidates all authentication functionality into a single module
 * using JWT-based authentication with role-based access control
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/errors';

// Re-export the comprehensive JWT auth service
export { 
  JWTAuthService, 
  jwtAuthService,
  JWTPayload,
  AuthenticatedRequest 
} from './jwt-auth';

// Import specific middleware functions
import { 
  jwtAuthMiddleware as jwtMiddleware,
  requireRole as jwtRequireRole,
  requirePermission as jwtRequirePermission
} from './jwt-auth';

/**
 * Main authentication middleware
 * Verifies JWT tokens and attaches user to request
 */
export const authMiddleware = jwtMiddleware;

/**
 * Role-based access control middleware
 */
export const requireRole = jwtRequireRole;

/**
 * Permission-based access control middleware
 */
export const requirePermission = jwtRequirePermission;

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no token
 */
export const optionalAuth = jwtMiddleware(false);

/**
 * API Key authentication for service-to-service calls
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY' 
    });
  }

  // Validate against known API keys
  const validApiKeys = [
    process.env.SEO_WORKS_API_KEY,
    process.env.INTERNAL_API_KEY,
    // Add more service API keys as needed
  ].filter(Boolean);

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', { 
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip 
    });
    
    return res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY' 
    });
  }

  // Attach service info to request
  (req as any).isServiceAuth = true;
  (req as any).serviceApiKey = apiKey;
  
  next();
};

/**
 * Combined auth middleware that accepts either JWT or API key
 */
export const flexibleAuth = (req: Request, res: Response, next: NextFunction) => {
  const hasApiKey = req.headers['x-api-key'];
  const hasAuthHeader = req.headers.authorization;
  
  if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  } else if (hasAuthHeader) {
    return authMiddleware(req, res, next);
  } else {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NO_AUTH',
      message: 'Provide either JWT token or API key' 
    });
  }
};

// Export convenience middleware combinations
export const adminOnly = [authMiddleware, requireRole(['admin'])];
export const agencyOnly = [authMiddleware, requireRole(['agency', 'admin'])];
export const clientOrAgency = [authMiddleware, requireRole(['client', 'agency', 'admin'])];