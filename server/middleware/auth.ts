/**
 * Authentication Middleware
 * 
 * This is a compatibility layer that uses the unified authentication module
 * to maintain backward compatibility with existing code
 */

import type { Request, Response, NextFunction } from 'express';
import { authMiddleware as unifiedAuthMiddleware } from './unified-auth';

// Re-export the unified auth middleware for backward compatibility
export const authMiddleware = unifiedAuthMiddleware;

// Also export as default
export default authMiddleware;