/**
 * @file Authentication Middleware
 * @description JWT-based authentication with role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth' },
  transports: [
    new winston.transports.Console()
  ],
});

interface AuthenticatedUser {
  id: string;
  role: 'client' | 'agency' | 'admin';
  tenantId?: string;
  agencyId?: string;
  email?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * JWT Authentication Middleware
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip auth for health check and public routes
  if (req.path === '/health' || req.path.startsWith('/api/public')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // For development, allow a mock user
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_MOCK_AUTH === 'true') {
      req.user = {
        id: 'mock-user-id',
        role: 'client',
        tenantId: 'mock-tenant-id',
        email: 'mock@example.com'
      };
      logger.info('Mock authentication applied for development');
      return next();
    }

    return res.status(401).json({
      error: 'Access token required',
      message: 'Please provide a valid authentication token'
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Validate required fields
    if (!decoded.id || !decoded.role) {
      throw new Error('Invalid token payload');
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      tenantId: decoded.tenantId,
      agencyId: decoded.agencyId,
      email: decoded.email
    };

    logger.info('User authenticated', {
      userId: decoded.id,
      role: decoded.role,
      tenantId: decoded.tenantId
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      token: token.substring(0, 20) + '...'
    });

    return res.status(403).json({
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }
};

/**
 * Role-based access control middleware factory
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Access denied - insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions for this resource'
      });
    }

    next();
  };
};

export default authMiddleware;