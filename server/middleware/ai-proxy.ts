/**
 * @file AI Proxy Middleware - Core anonymization and routing layer
 * @description Ensures complete separation between clients and agencies
 * All communication passes through this middleware for anonymization and branding
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Logger for audit trail
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-proxy' },
  transports: [
    new winston.transports.File({ filename: 'ai-proxy-audit.log' }),
    new winston.transports.Console()
  ],
});

interface AuthenticatedUser {
  id: string;
  role: 'client' | 'agency' | 'admin';
  tenantId?: string;
  agencyId?: string;
}

interface AugmentedRequest extends Request {
  user?: AuthenticatedUser;
  processedByAI?: boolean;
  isAnonymized?: boolean;
  originalData?: any;
  tenantBranding?: {
    companyName: string;
    logo?: string;
    primaryColor?: string;
  };
}

/**
 * Main AI Proxy Middleware
 * Routes and transforms all client-agency communications
 * Enforces white-labeling and anonymization rules
 */
export const aiProxyMiddleware = (
  req: AugmentedRequest,
  res: Response,
  next: NextFunction
): void => {
  const { user } = req;
  const { method, path, body, query } = req;

  // Log every action for comprehensive audit trail
  logger.info('AI Proxy Action', {
    method,
    path,
    userRole: user?.role || 'unknown',
    userId: user?.id || 'anonymous',
    tenantId: user?.tenantId,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Skip proxy processing for health checks and admin routes
  if (path === '/health' || path.startsWith('/api/admin')) {
    return next();
  }

  // Ensure user is authenticated for API routes
  if (path.startsWith('/api/') && !user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Access denied - please authenticate'
    });
  }

  // Process based on user role
  switch (user?.role) {
    case 'client':
      processClientRequest(req, res, next);
      break;
    case 'agency':
      processAgencyRequest(req, res, next);
      break;
    case 'admin':
      processAdminRequest(req, res, next);
      break;
    default:
      logger.warn('Unknown user role attempting access', { 
        role: user?.role, 
        path, 
        userId: user?.id 
      });
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Invalid user role'
      });
  }
};

/**
 * Process client requests - Apply branding and prepare for agency routing
 */
const processClientRequest = (
  req: AugmentedRequest,
  res: Response,
  next: NextFunction
): void => {
  const { user, body } = req;

  // Apply tenant branding to all client interactions
  req.tenantBranding = {
    companyName: process.env.DEFAULT_BRAND_NAME || 'Rylie SEO',
    primaryColor: process.env.DEFAULT_BRAND_COLOR || '#2563eb'
  };

  // Brand all outgoing messages from client
  if (body && body.message) {
    req.originalData = { ...body };
    body.message = `${body.message}`;
    body.brandedSource = req.tenantBranding.companyName;
  }

  // Store client context for agency anonymization
  if (body) {
    body.clientContext = {
      tenantId: user?.tenantId,
      anonymizedId: `client_${Buffer.from(user?.id || '').toString('base64').slice(0, 8)}`,
      requestTimestamp: new Date().toISOString()
    };
  }

  // Mark as processed by AI proxy
  req.processedByAI = true;

  logger.info('Client request processed', {
    userId: user?.id,
    tenantId: user?.tenantId,
    branding: req.tenantBranding.companyName,
    hasMessage: !!body?.message
  });

  next();
};

/**
 * Process agency requests - Strip PII and anonymize client data
 */
const processAgencyRequest = (
  req: AugmentedRequest,
  res: Response,
  next: NextFunction
): void => {
  const { user, body } = req;

  // Anonymize all client references in agency requests
  if (body) {
    // Remove any potential client PII
    delete body.clientEmail;
    delete body.clientName;
    delete body.clientPhone;
    
    // Replace with anonymized references
    if (body.clientId) {
      body.anonymizedClientRef = `task_${Buffer.from(body.clientId).toString('base64').slice(0, 8)}`;
      delete body.clientId;
    }

    // Brand agency responses to appear from white-label system
    if (body.message) {
      req.originalData = { ...body };
      body.message = body.message; // Keep original message but log it
      body.responseType = 'agency_update';
      body.processingTimestamp = new Date().toISOString();
    }
  }

  // Mark as anonymized
  req.isAnonymized = true;
  req.processedByAI = true;

  logger.info('Agency request processed and anonymized', {
    agencyId: user?.id,
    hasMessage: !!body?.message,
    anonymizedRefs: body?.anonymizedClientRef ? 1 : 0
  });

  next();
};

/**
 * Process admin requests - Full access with audit logging
 */
const processAdminRequest = (
  req: AugmentedRequest,
  res: Response,
  next: NextFunction
): void => {
  const { user } = req;

  // Admin gets full access but everything is logged
  req.processedByAI = true;

  logger.info('Admin request processed', {
    adminId: user?.id,
    path: req.path,
    method: req.method
  });

  next();
};

/**
 * Response interceptor to ensure branding on outgoing data
 */
export const responseInterceptor = (
  req: AugmentedRequest,
  res: Response,
  next: NextFunction
): void => {
  const originalSend = res.send;

  res.send = function(data: any) {
    if (req.user?.role === 'client' && req.tenantBranding) {
      // Ensure all client responses are branded
      if (typeof data === 'object' && data !== null) {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        parsedData.branding = req.tenantBranding;
        parsedData.source = req.tenantBranding.companyName;
        data = JSON.stringify(parsedData);
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

export default aiProxyMiddleware;