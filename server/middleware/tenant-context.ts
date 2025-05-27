/**
 * Tenant Context Middleware
 * 
 * This middleware establishes the dealership context for each request
 * and sets the appropriate PostgreSQL session variables to enforce RLS policies.
 */

import { Request, Response, NextFunction } from 'express';
import db from "../db";
import logger from '../utils/logger';

// Extend Express Request interface to include dealership context
declare global {
  namespace Express {
    interface Request {
      dealershipContext?: {
        dealershipId: number | null;
        userId: number;
        userRole: string;
      };
    }
  }
}

/**
 * Middleware to establish dealership context for the current request
 * This version bypasses authentication for development purposes
 */
export const tenantContextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip for public routes that don't require authentication
    if (isPublicRoute(req.path)) {
      return next();
    }

    // Skip authentication check - always proceed to next middleware
    // The auth-bypass middleware handles adding mock user data
    return next();

    // The code below is unreachable due to the return statement above
    // It's kept for reference in case we need to re-enable it later
    
    // Set PostgreSQL session variables to enforce RLS policies
    // This code is unreachable but keeping it for future reference
    // We're fixing the TypeScript errors to maintain code quality
    if (req.method !== 'GET' && req.dealershipContext) {
      const context = req.dealershipContext;
      
      // This code is unreachable, so we're adding a type assertion
      // to prevent TypeScript errors. In a real scenario, proper null
      // checking would be implemented.
      
      // Only set for write operations to improve performance
      await db.execute(`
        SELECT set_tenant_context(
          ${context!.userId}, 
          '${context!.userRole}', 
          ${context!.dealershipId || 'NULL'}
        );
      `);
      
      logger.debug('Tenant context set for database session', {
        userId: context!.userId,
        userRole: context!.userRole,
        dealershipId: context!.dealershipId,
      });
    }

    // Add dealership information to response headers for debugging (in development)
    if (process.env.NODE_ENV === 'development' && req.dealershipContext) {
      // Using non-null assertion since we already checked the condition
      const context = req.dealershipContext!;
      res.setHeader('X-Dealership-ID', context.dealershipId?.toString() || 'none');
      res.setHeader('X-User-Role', context.userRole);
    }

    next();
  } catch (error) {
    logger.error('Error establishing tenant context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Determines if a route is public (doesn't require authentication)
 */
function isPublicRoute(path: string): boolean {
  const publicRoutes = [
    '/api/login',
    '/api/register',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/magic-link/verify',
    '/api/health',
    '/api/status',
  ];

  // Check if the route matches any public routes
  return publicRoutes.some(route => path.startsWith(route));
}

/**
 * Middleware to enforce dealership-specific access to resources
 * This version bypasses dealership checks for development purposes
 */
export const enforceDealershipAccess = (resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // AUTHENTICATION BYPASS - Always allow access regardless of dealership
    return next();

    /* Original dealership access check code (commented out for bypass)
    try {
      const { dealershipContext } = req;
      
      // Skip for super_admin role
      if (dealershipContext?.userRole === 'super_admin') {
        return next();
      }
      
      // For resource-specific routes, ensure the resource belongs to the user's dealership
      if (req.params.id) {
        const resourceId = parseInt(req.params.id);
        
        // Query structure will vary based on resource type
        let query = '';
        let params: any[] = [];
        
        switch (resourceType) {
          case 'systemPrompt':
            query = 'SELECT dealership_id FROM system_prompts WHERE id = $1';
            params = [resourceId];
            break;
          case 'vehicle':
            query = 'SELECT dealership_id FROM vehicles WHERE id = $1';
            params = [resourceId];
            break;
          case 'customer':
            query = 'SELECT dealership_id FROM customers WHERE id = $1';
            params = [resourceId];
            break;
          case 'conversation':
            query = 'SELECT dealership_id FROM conversations WHERE id = $1';
            params = [resourceId];
            break;
          // Add more resource types as needed
          default:
            return next();
        }
        
        // Execute the query
        const result = await db.execute(query, params);
        const rows = result as any[];
        
        if (rows.length === 0) {
          return res.status(404).json({ error: 'Resource not found' });
        }
        
        const resourceDealershipId = rows[0].dealership_id;
        
        // Ensure the resource belongs to the user's dealership
        if (resourceDealershipId !== dealershipContext?.dealershipId) {
          logger.warn('Unauthorized access attempt to resource from different dealership', {
            userId: dealershipContext?.userId,
            userDealershipId: dealershipContext?.dealershipId,
            resourceDealershipId,
            resourceType,
            resourceId,
          });
          
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      next();
    } catch (error) {
      logger.error('Error enforcing dealership access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
    */
  };
};

/**
 * Middleware to ensure only specific roles can access certain routes
 * This version bypasses role checks for development purposes
 */
export const enforceRoleAccess = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // AUTHENTICATION BYPASS - Always allow access regardless of role
    return next();
    
    /* Original role check code (commented out for bypass)
    const { dealershipContext } = req;
    
    if (!dealershipContext) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(dealershipContext.userRole)) {
      logger.warn('Unauthorized role access attempt', {
        userId: dealershipContext.userId,
        userRole: dealershipContext.userRole,
        requiredRoles: allowedRoles,
        path: req.path,
      });
      
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
    */
  };
};