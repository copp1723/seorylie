// Auth middleware - wrapper around authentication middleware
import { authenticationMiddleware } from './authentication.js';

// Export authenticateSession as an alias for authenticationMiddleware
export const authenticateSession = authenticationMiddleware;

// Export all authentication functions for convenience
export { 
  authenticationMiddleware,
  requireRole, 
  requireDealershipAccess,
  requireVerifiedEmail,
  hashPassword,
  verifyPassword 
} from './authentication.js';