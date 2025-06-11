/**
 * @file Centralized Error Handling System
 * @description Standardized error handling and logging for SEORYLIE
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { config } from '../config';

// Error codes enum for consistent error handling
export enum ErrorCode {
  // Authentication & Authorization
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation & Input
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT_FORMAT = 'INVALID_INPUT_FORMAT',
  
  // Business Logic
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // External Services
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  GA4_API_ERROR = 'GA4_API_ERROR',
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
  SEOWORKS_API_ERROR = 'SEOWORKS_API_ERROR',
  
  // Database & Infrastructure
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // Generic
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

// Custom error class with enhanced context
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly traceId: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.traceId = uuidv4();
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      traceId: this.traceId,
      ...(config.NODE_ENV !== 'production' && {
        context: this.context,
        stack: this.stack
      })
    };
  }
}

// Error factory functions for common error types
export const createAuthError = (message: string = 'Authentication failed') =>
  new AppError(ErrorCode.AUTHENTICATION_FAILED, message, 401);

export const createAuthorizationError = (message: string = 'Insufficient permissions') =>
  new AppError(ErrorCode.AUTHORIZATION_DENIED, message, 403);

export const createValidationError = (message: string, context?: Record<string, any>) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, 400, true, context);

export const createNotFoundError = (resource: string = 'Resource') =>
  new AppError(ErrorCode.RESOURCE_NOT_FOUND, `${resource} not found`, 404);

export const createConflictError = (message: string) =>
  new AppError(ErrorCode.RESOURCE_ALREADY_EXISTS, message, 409);

export const createExternalServiceError = (service: string, originalError?: Error) =>
  new AppError(
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    `External service error: ${service}`,
    502,
    true,
    { service, originalError: originalError?.message }
  );

export const createConfigError = (message: string) =>
  new AppError(ErrorCode.CONFIGURATION_ERROR, message, 500, false);

// Enhanced logger setup
const createLogger = () => {
  const logger = winston.createLogger({
    level: config.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, traceId, userId, tenantId, service, ...meta }) => {
        const logEntry = {
          timestamp,
          level,
          message,
          service: service || 'seorylie-server',
          ...(traceId && { traceId }),
          ...(userId && { userId }),
          ...(tenantId && { tenantId }),
          ...meta
        };
        return JSON.stringify(logEntry);
      })
    ),
    defaultMeta: { service: 'seorylie-server' },
    transports: [
      new winston.transports.Console({
        format: config.NODE_ENV === 'development' 
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          : winston.format.json()
      })
    ],
  });

  // Add file transports in production
  if (config.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));
    
    logger.add(new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }));
  }

  return logger;
};

export const logger = createLogger();

// Context middleware to add trace ID and user context to requests
export const contextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate trace ID for request tracking
  const traceId = uuidv4();
  req.traceId = traceId;
  
  // Set trace ID in response headers for debugging
  res.setHeader('X-Trace-ID', traceId);
  
  // Enhance logger for this request
  req.logger = logger.child({
    traceId,
    ...(req.user && { 
      userId: req.user.id,
      tenantId: req.user.tenantId,
      userRole: req.user.role 
    })
  });
  
  next();
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler for Zod
export const handleZodError = (error: ZodError): AppError => {
  const issues = error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));
  
  return createValidationError('Validation failed', { issues });
};

// Main error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Use request logger if available, otherwise use global logger
  const requestLogger = req.logger || logger;
  
  let appError: AppError;
  
  // Convert different error types to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = handleZodError(error);
  } else {
    // Handle unknown errors
    appError = new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      config.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      500,
      false,
      { originalError: error.message }
    );
  }
  
  // Log error with context
  const logLevel = appError.statusCode >= 500 ? 'error' : 'warn';
  requestLogger[logLevel]('Request error', {
    error: {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      traceId: appError.traceId,
      isOperational: appError.isOperational
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent')
    },
    ...(appError.context && { context: appError.context }),
    ...(config.NODE_ENV !== 'production' && { stack: appError.stack })
  });
  
  // Send error response
  const response = {
    error: {
      code: appError.code,
      message: appError.message,
      traceId: appError.traceId,
      ...(config.NODE_ENV !== 'production' && appError.context && { context: appError.context })
    }
  };
  
  res.status(appError.statusCode).json(response);
};

// Unhandled error handlers
export const setupGlobalErrorHandlers = () => {
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', { reason });
    // Don't exit in production, just log
    if (config.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
  
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    // Exit gracefully
    process.exit(1);
  });
};

// Express request interface extension
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      logger?: winston.Logger;
      user?: {
        id: string;
        tenantId: string;
        role: string;
        [key: string]: any;
      };
    }
  }
}