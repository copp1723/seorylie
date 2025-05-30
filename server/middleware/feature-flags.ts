/**
 * Feature Flag Middleware
 * 
 * Injects feature flag information into Express requests
 * 
 * @file server/middleware/feature-flags.ts
 */

import { Request, Response, NextFunction } from 'express';
import { featureFlags, getFeatureFlagFromEnv } from '../services/feature-flags.js';

// Extend Express Request type to include feature flags
declare global {
  namespace Express {
    interface Request {
      featureFlags: {
        isEnabled: (flagName: string) => boolean;
        getAll: () => Record<string, boolean>;
      };
      user?: {
        id?: string;
        role?: string;
        permissions?: string[];
      };
    }
    interface Session {
      userId?: string;
    }
  }
}

/**
 * Feature flag middleware that adds feature flag utilities to the request object
 */
export function featureFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get user ID from request (could be from JWT, session, etc.)
  const userId = req.user?.id || (req.session as any)?.userId || req.headers['x-user-id'] as string;

  // Add feature flag utilities to request
  req.featureFlags = {
    isEnabled: (flagName: string): boolean => {
      // Check environment variable override first
      const envOverride = getFeatureFlagFromEnv(flagName);
      if (envOverride !== null) {
        return envOverride;
      }

      // Use feature flag service
      return featureFlags.isEnabled(flagName, userId);
    },

    getAll: (): Record<string, boolean> => {
      const allFlags = featureFlags.getAllFlags();
      
      // Apply environment variable overrides
      Object.keys(allFlags).forEach(flagName => {
        const envOverride = getFeatureFlagFromEnv(flagName);
        if (envOverride !== null) {
          allFlags[flagName] = envOverride;
        }
      });

      return allFlags;
    }
  };

  next();
}

/**
 * Feature flag response middleware that adds feature flags to API responses
 */
export function featureFlagResponseMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to include feature flags
  res.json = function(data: any) {
    // Only add feature flags to successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Add feature flags to response if it's an object
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data._featureFlags = req.featureFlags.getAll();
      }
    }

    return originalJson(data);
  };

  next();
}

/**
 * Admin-only feature flag management middleware
 */
export function adminFeatureFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check if user is admin (customize this based on your auth system)
  const isAdmin = req.user?.role === 'admin' || 
                  req.user?.permissions?.includes('manage-feature-flags') ||
                  req.headers['x-admin-key'] === process.env.ADMIN_API_KEY;

  if (!isAdmin) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required for feature flag management'
    });
    return;
  }

  next();
}

/**
 * Feature flag guard middleware - blocks requests if feature is disabled
 */
export function requireFeatureFlag(flagName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.featureFlags.isEnabled(flagName)) {
      res.status(404).json({
        error: 'Feature Not Available',
        message: `The requested feature '${flagName}' is currently disabled`,
        feature: flagName
      });
      return;
    }

    next();
  };
}

/**
 * Conditional feature flag middleware - executes different middleware based on flag
 */
export function conditionalFeatureFlag(
  flagName: string,
  enabledMiddleware: (req: Request, res: Response, next: NextFunction) => void,
  disabledMiddleware?: (req: Request, res: Response, next: NextFunction) => void
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.featureFlags.isEnabled(flagName)) {
      enabledMiddleware(req, res, next);
    } else if (disabledMiddleware) {
      disabledMiddleware(req, res, next);
    } else {
      next();
    }
  };
}