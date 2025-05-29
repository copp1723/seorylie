import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { v4 as uuidv4 } from 'uuid';

// Enhanced error codes for better error tracking
export enum ErrorCodes {
  // Database errors
  DATABASE_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DB_QUERY_ERROR',
  DATABASE_TRANSACTION_ERROR = 'DB_TRANSACTION_ERROR',

  // Authentication errors
  AUTHENTICATION_FAILED = 'AUTH_FAILED',
  AUTHORIZATION_FAILED = 'AUTHZ_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_FIELD',

  // Business logic errors
  RESOURCE_NOT_FOUND = 'NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'ALREADY_EXISTS',
  OPERATION_NOT_ALLOWED = 'NOT_ALLOWED',

  // External service errors
  EMAIL_SERVICE_ERROR = 'EMAIL_ERROR',
  CACHE_SERVICE_ERROR = 'CACHE_ERROR',

  // System errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

// Action type for error remediation
export interface ErrorAction {
  label: string;
  url?: string;
  type?: 'retry' | 'navigate' | 'contact' | 'refresh';
}

// Enhanced error interface with user-friendly messaging
export interface AppError extends Error {
  code: ErrorCodes;
  statusCode: number;
  requestId?: string;
  traceId?: string;
  context?: Record<string, any>;
  userMessage?: string;
  docsUrl?: string;
  action?: ErrorAction;
}

export class CustomError extends Error implements AppError {
  public code: ErrorCodes;
  public statusCode: number;
  public requestId?: string;
  public traceId?: string;
  public context?: Record<string, any>;
  public userMessage?: string;
  public docsUrl?: string;
  public action?: ErrorAction;

  constructor(
    message: string,
    code: ErrorCodes,
    statusCode: number = 500,
    options?: {
      context?: Record<string, any>;
      userMessage?: string;
      docsUrl?: string;
      action?: ErrorAction;
    }
  ) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
    this.statusCode = statusCode;
    
    // Generate trace ID for tracking
    this.traceId = uuidv4();
    this.requestId = this.traceId; // For backward compatibility
    
    // Set additional error context and user-friendly info
    if (options) {
      this.context = options.context;
      this.userMessage = options.userMessage;
      this.docsUrl = options.docsUrl;
      this.action = options.action;
    }

    // Ensure the stack trace points to where the error was thrown
    Error.captureStackTrace(this, CustomError);
  }
}

// Utility class for standardized API responses
export class ResponseHelper {
  static success<T>(res: Response, data: T, message: string = 'Success'): Response {
    return res.json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(
    res: Response,
    error: AppError | Error,
    requestId?: string
  ): Response {
    const isAppError = error instanceof CustomError;
    const statusCode = isAppError ? error.statusCode : 500;
    const code = isAppError ? error.code : ErrorCodes.INTERNAL_SERVER_ERROR;
    const traceId = isAppError ? error.traceId : requestId || uuidv4();
    
    // Include trace ID in response headers
    res.setHeader('X-Trace-Id', traceId);

    const errorResponse = {
      success: false,
      error: {
        message: error.message,
        code,
        traceId,
        ...(isAppError && error.userMessage && { userMessage: error.userMessage }),
        ...(isAppError && error.docsUrl && { docsUrl: error.docsUrl }),
        ...(isAppError && error.action && { action: error.action }),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    };

    // Log the error with context
    logger.error('API Error Response', {
      requestId: traceId,
      code,
      message: error.message,
      userMessage: isAppError ? error.userMessage : undefined,
      statusCode,
      stack: error.stack,
      ...(isAppError && error.context ? { context: error.context } : {})
    });

    return res.status(statusCode).json(errorResponse);
  }

  static notFound(
    res: Response, 
    resource: string = 'Resource',
    options?: {
      userMessage?: string;
      docsUrl?: string;
      action?: ErrorAction;
    }
  ): Response {
    const error = new CustomError(
      `${resource} not found`,
      ErrorCodes.RESOURCE_NOT_FOUND,
      404,
      {
        userMessage: options?.userMessage || `The requested ${resource.toLowerCase()} could not be found.`,
        docsUrl: options?.docsUrl,
        action: options?.action
      }
    );
    return ResponseHelper.error(res, error);
  }

  static badRequest(
    res: Response, 
    message: string = 'Bad request',
    options?: {
      userMessage?: string;
      docsUrl?: string;
      action?: ErrorAction;
    }
  ): Response {
    const error = new CustomError(
      message,
      ErrorCodes.INVALID_INPUT,
      400,
      {
        userMessage: options?.userMessage || 'Please check your input and try again.',
        docsUrl: options?.docsUrl,
        action: options?.action
      }
    );
    return ResponseHelper.error(res, error);
  }

  static unauthorized(
    res: Response, 
    message: string = 'Unauthorized',
    options?: {
      userMessage?: string;
      docsUrl?: string;
      action?: ErrorAction;
    }
  ): Response {
    const error = new CustomError(
      message,
      ErrorCodes.AUTHENTICATION_FAILED,
      401,
      {
        userMessage: options?.userMessage || 'Please log in to continue.',
        docsUrl: options?.docsUrl,
        action: options?.action || {
          label: 'Log In',
          type: 'navigate',
          url: '/auth'
        }
      }
    );
    return ResponseHelper.error(res, error);
  }

  static forbidden(
    res: Response, 
    message: string = 'Forbidden',
    options?: {
      userMessage?: string;
      docsUrl?: string;
      action?: ErrorAction;
    }
  ): Response {
    const error = new CustomError(
      message,
      ErrorCodes.AUTHORIZATION_FAILED,
      403,
      {
        userMessage: options?.userMessage || 'You don\'t have permission to perform this action.',
        docsUrl: options?.docsUrl,
        action: options?.action
      }
    );
    return ResponseHelper.error(res, error);
  }
}

// Async handler wrapper to catch async errors
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Database operation wrapper with retry logic
export async function dbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Database operation failed',
  retries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === retries) {
        logger.error(`Database operation failed after ${retries} attempts`, {
          error: lastError.message,
          stack: lastError.stack,
          attempt
        });

        throw new CustomError(
          errorMessage,
          ErrorCodes.DATABASE_QUERY_ERROR,
          500,
          {
            context: {
              originalError: lastError.message,
              attempts: retries
            },
            userMessage: 'We encountered a problem accessing the database. Please try again later.',
            action: {
              label: 'Retry',
              type: 'retry'
            }
          }
        );
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise<void>((resolve: () => void) => setTimeout(resolve, delay));

      logger.warn(`Database operation failed, retrying...`, {
        error: lastError.message,
        attempt,
        retryAfter: delay
      });
    }
  }

  throw lastError!;
}

// Global error handler middleware
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Add request ID for tracking
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const traceId = requestId; // Use request ID as trace ID for consistency
  
  // Set trace ID in response headers
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Request-ID', requestId);

  // Handle different types of errors
  if (error instanceof CustomError) {
    // For custom errors, use the trace ID already set
    ResponseHelper.error(res, error, requestId);
  } else if (error.name === 'ValidationError') {
    const customError = new CustomError(
      error.message,
      ErrorCodes.VALIDATION_ERROR,
      400,
      {
        userMessage: 'Please check the form for errors and try again.',
        action: {
          label: 'Review Form',
          type: 'refresh'
        }
      }
    );
    ResponseHelper.error(res, customError, requestId);
  } else if (error.name === 'CastError') {
    const customError = new CustomError(
      'Invalid ID format',
      ErrorCodes.INVALID_INPUT,
      400,
      {
        userMessage: 'The ID format provided is invalid.',
        action: {
          label: 'Go Back',
          type: 'navigate',
          url: req.headers.referer || '/'
        }
      }
    );
    ResponseHelper.error(res, customError, requestId);
  } else {
    // Unknown error - log it and return generic error
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      requestId,
      traceId,
      url: req.url,
      method: req.method
    });

    const customError = new CustomError(
      'An unexpected error occurred',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      {
        userMessage: 'Something went wrong on our end. Please try again later.',
        action: {
          label: 'Retry',
          type: 'retry'
        }
      }
    );
    ResponseHelper.error(res, customError, requestId);
  }
}

// Request ID middleware
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Trace-Id', requestId); // Use the same ID for trace ID
  next();
}
