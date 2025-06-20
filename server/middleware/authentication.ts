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
  if (req.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

export function isAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  authenticate(req, res, next);
}