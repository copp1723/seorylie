import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/errors';
import jwt from 'jsonwebtoken';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId?: string;
      };
    }
  }
}

// Auth Middleware - Validates JWT tokens
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    // Allow unauthenticated access to certain endpoints
    const publicPaths = ['/health', '/api/seoworks'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-jwt-secret-change-in-production') as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId
    };
    
    logger.debug('User authenticated', { userId: decoded.id, role: decoded.role });
    next();
  } catch (error) {
    logger.warn('Invalid token', { error });
    return res.status(401).json({ 
      error: 'Invalid token',
      code: 'INVALID_TOKEN' 
    });
  }
};

export default authMiddleware;