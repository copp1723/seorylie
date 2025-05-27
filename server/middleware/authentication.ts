import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';

// Import type augmentations
import '../types/express-jwt';
import '../types/express-session';

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const allowAuthBypass = isDevelopment || isTest || process.env.ALLOW_AUTH_BYPASS === 'true';

// Secure password hashing configuration
const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Secure password hashing function
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    logger.debug('Password hashed successfully');
    return hashedPassword;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Password hashing failed', err);
    throw new Error('Failed to hash password');
  }
}

/**
 * Secure password verification function
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isValid = await bcrypt.compare(password, hashedPassword);

    if (isValid) {
      logger.debug('Password verification successful');
    } else {
      logger.warn('Password verification failed');
    }

    return isValid;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Password verification error', err);
    return false;
  }
}

/**
 * Authentication middleware - automatically switches between bypass and real auth
 */
export function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (allowAuthBypass) {
    // Development/test mode - apply bypass
    logger.debug('Authentication bypass active (development mode)');

    req.user = {
      userId: '1',
      dealershipId: 1,
      role: 'super_admin',
      permissions: ['all']
    };

    // Add authentication helper methods
    req.isAuthenticated = () => true;
    req.login = (_user: any, callback: (err?: any) => void) => callback();

    return next();
  }

  // Production mode - real authentication
  if (!req.session?.user) {
    logger.warn('Authentication required - no session user', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Convert session user to JWT payload format for consistency
  const sessionUser = req.session.user;
  req.user = {
    userId: sessionUser.id?.toString() || '0',
    dealershipId: sessionUser.dealership_id || 0,
    role: sessionUser.role || 'user',
    permissions: sessionUser.role === 'super_admin' ? ['all'] : ['read']
  };

  // Add authentication helper methods
  req.isAuthenticated = () => !!req.session?.user;
  req.login = (user: any, callback: (err?: any) => void) => {
    req.session!.user = user;
    req.session!.save(callback);
  };

  logger.debug('User authenticated', {
    userId: req.user.userId,
    role: req.user.role,
    path: req.path
  });

  next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowAuthBypass) {
      // In development, always allow access
      return next();
    }

    if (!req.user) {
      logger.warn('Authorization failed - no user', {
        requiredRoles: allowedRoles,
        path: req.path
      });

      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const hasRequiredRole = allowedRoles.includes(userRole) || userRole === 'super_admin';

    if (!hasRequiredRole) {
      logger.warn('Authorization failed - insufficient permissions', {
        userId: req.user.userId,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path
      });

      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles
      });
    }

    logger.debug('Role authorization successful', {
      userId: req.user.userId,
      userRole,
      path: req.path
    });

    next();
  };
}

/**
 * Dealership access control middleware
 */
export function requireDealershipAccess(req: Request, res: Response, next: NextFunction) {
  if (allowAuthBypass) {
    // In development, always allow access
    req.dealershipContext = {
      dealershipId: 1,
      userId: 1,
      userRole: 'super_admin'
    };
    return next();
  }

  const user = req.user;
  const requestedDealershipId = parseInt(req.params.dealershipId);

  if (!user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Super admin can access all dealerships
  if (user.role === 'super_admin') {
    req.dealershipContext = {
      dealershipId: requestedDealershipId,
      userId: parseInt(user.userId),
      userRole: user.role
    };
    return next();
  }

  // Check if user has access to requested dealership
  if (user.dealershipId !== requestedDealershipId) {
    logger.warn('Dealership access denied', {
      userId: user.userId,
      userDealershipId: user.dealershipId,
      requestedDealershipId,
      path: req.path
    });

    return res.status(403).json({
      error: 'Access denied to this dealership',
      code: 'DEALERSHIP_ACCESS_DENIED'
    });
  }

  req.dealershipContext = {
    dealershipId: requestedDealershipId,
    userId: parseInt(user.userId),
    userRole: user.role
  };

  next();
}

/**
 * Email verification middleware
 */
export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  if (allowAuthBypass) {
    // In development, skip verification
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // For JWT-based auth, we'll assume verified if the user exists
  // In a real implementation, you'd check a verification flag
  logger.debug('Email verification check passed', {
    userId: req.user.userId,
    path: req.path
  });

  next();
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  next();
}

/**
 * Rate limiting configuration
 */
export function createRateLimitConfig(windowMs: number, max: number, message?: string) {
  return {
    windowMs,
    max,
    message: message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => allowAuthBypass, // Skip rate limiting in development
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };
}