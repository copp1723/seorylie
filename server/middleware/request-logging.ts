/**
 * Request/Response Logging Middleware
 * 
 * Provides comprehensive logging of HTTP requests and responses with correlation IDs,
 * performance metrics, and sensitive data redaction.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface RequestLogContext {
  requestId: string;
  traceId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  dealershipId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
  error?: any;
}

export interface LoggingOptions {
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  includeHeaders?: boolean;
  excludePaths?: string[];
  excludeHeaders?: string[];
  maxBodySize?: number;
  sensitiveFields?: string[];
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_OPTIONS: LoggingOptions = {
  includeRequestBody: false,
  includeResponseBody: false,
  includeHeaders: false,
  excludePaths: ['/health', '/metrics', '/favicon.ico'],
  excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
  maxBodySize: 1024, // 1KB
  sensitiveFields: ['password', 'token', 'secret', 'key', 'auth'],
  logLevel: 'info'
};

/**
 * Create request logging middleware
 */
export function createRequestLoggingMiddleware(options: LoggingOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (config.excludePaths?.some(path => req.path.includes(path))) {
      return next();
    }

    // Generate correlation IDs
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const traceId = req.headers['x-trace-id'] as string || uuidv4();

    // Add correlation IDs to request
    req.requestId = requestId;
    req.traceId = traceId;

    // Add correlation IDs to response headers
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Trace-Id', traceId);

    const startTime = Date.now();

    // Create log context
    const logContext: RequestLogContext = {
      requestId,
      traceId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: getClientIP(req),
      userId: req.user?.id,
      dealershipId: req.dealershipId,
      startTime
    };

    // Log request start
    logRequest(req, logContext, config);

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    let responseBody: any;
    let responseSent = false;

    // Override response methods to capture response data
    res.send = function(body: any) {
      if (!responseSent) {
        responseBody = body;
        logResponse(req, res, logContext, config, body);
        responseSent = true;
      }
      return originalSend.call(this, body);
    };

    res.json = function(obj: any) {
      if (!responseSent) {
        responseBody = obj;
        logResponse(req, res, logContext, config, obj);
        responseSent = true;
      }
      return originalJson.call(this, obj);
    };

    res.end = function(chunk?: any, encoding?: any) {
      if (!responseSent) {
        responseBody = chunk;
        logResponse(req, res, logContext, config, chunk);
        responseSent = true;
      }
      return originalEnd.call(this, chunk, encoding);
    };

    // Handle response finish event
    res.on('finish', () => {
      if (!responseSent) {
        logResponse(req, res, logContext, config);
        responseSent = true;
      }
    });

    // Handle errors
    res.on('error', (error) => {
      logContext.error = error;
      logger.error('Response error', error, logContext);
    });

    next();
  };
}

/**
 * Log incoming request
 */
function logRequest(req: Request, context: RequestLogContext, config: LoggingOptions) {
  const logData: any = {
    type: 'request',
    ...context
  };

  // Include headers if configured
  if (config.includeHeaders) {
    logData.headers = sanitizeHeaders(req.headers, config.excludeHeaders || []);
  }

  // Include request body if configured
  if (config.includeRequestBody && req.body) {
    logData.body = sanitizeBody(req.body, config.sensitiveFields || [], config.maxBodySize || 1024);
  }

  // Include query parameters
  if (Object.keys(req.query).length > 0) {
    logData.query = sanitizeObject(req.query, config.sensitiveFields || []);
  }

  // Include route parameters
  if (Object.keys(req.params).length > 0) {
    logData.params = sanitizeObject(req.params, config.sensitiveFields || []);
  }

  logger[config.logLevel || 'info']('HTTP Request', logData);
}

/**
 * Log outgoing response
 */
function logResponse(
  req: Request, 
  res: Response, 
  context: RequestLogContext, 
  config: LoggingOptions,
  body?: any
) {
  const endTime = Date.now();
  const duration = endTime - context.startTime;

  const logData: any = {
    type: 'response',
    ...context,
    endTime,
    duration,
    statusCode: res.statusCode,
    contentLength: res.get('Content-Length')
  };

  // Include response headers if configured
  if (config.includeHeaders) {
    logData.responseHeaders = sanitizeHeaders(res.getHeaders(), config.excludeHeaders || []);
  }

  // Include response body if configured
  if (config.includeResponseBody && body) {
    logData.responseBody = sanitizeBody(body, config.sensitiveFields || [], config.maxBodySize || 1024);
  }

  // Determine log level based on status code
  let logLevel = config.logLevel || 'info';
  if (res.statusCode >= 500) {
    logLevel = 'error';
  } else if (res.statusCode >= 400) {
    logLevel = 'warn';
  }

  // Add performance warnings
  if (duration > 5000) { // 5 seconds
    logData.performanceWarning = 'Slow response time';
    logLevel = 'warn';
  }

  logger[logLevel]('HTTP Response', logData);
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Sanitize headers by removing sensitive information
 */
function sanitizeHeaders(headers: any, excludeHeaders: string[]): any {
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (excludeHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize request/response body
 */
function sanitizeBody(body: any, sensitiveFields: string[], maxSize: number): any {
  try {
    let sanitized = sanitizeObject(body, sensitiveFields);
    
    // Truncate if too large
    const serialized = JSON.stringify(sanitized);
    if (serialized.length > maxSize) {
      return {
        _truncated: true,
        _originalSize: serialized.length,
        _maxSize: maxSize,
        data: serialized.substring(0, maxSize) + '...'
      };
    }
    
    return sanitized;
  } catch (error) {
    return {
      _error: 'Failed to serialize body',
      _type: typeof body
    };
  }
}

/**
 * Sanitize object by redacting sensitive fields
 */
function sanitizeObject(obj: any, sensitiveFields: string[]): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sensitiveFields));
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Express middleware for adding correlation IDs
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const traceId = req.headers['x-trace-id'] as string || uuidv4();

  req.requestId = requestId;
  req.traceId = traceId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Trace-Id', traceId);

  next();
}

/**
 * Express middleware for performance monitoring
 */
export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log slow requests
    if (duration > 1000) { // 1 second
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: res.statusCode,
        requestId: req.requestId,
        traceId: req.traceId
      });
    }

    // Add performance header
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      traceId?: string;
      dealershipId?: string;
      user?: {
        id: string;
        [key: string]: any;
      };
    }
  }
}
