import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId: string;
    dealershipId: number;
    role: string;
    permissions: string[];
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user && req.user.userId && req.user.role) {
    next();
  } else {
    // Log authentication failure for security monitoring
    console.warn('Authentication failed: Invalid or missing user data');
    res.status(401).json({ error: 'Authentication required' });
  }
}

export function isAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  authenticate(req, res, next);
}