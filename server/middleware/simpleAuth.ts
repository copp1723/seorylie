import { Request, Response, NextFunction } from 'express';

// Simple authentication middleware for development
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Check for authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  // For now, accept any token that's not empty
  // In production, this should validate against real auth service
  if (token.length > 0) {
    // Add mock user data to request
    (req as any).user = {
      id: '1',
      email: 'admin@agency.com',
      role: 'admin'
    };
    next();
  } else {
    res.status(403).json({
      error: 'Invalid token'
    });
  }
};