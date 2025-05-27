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

export interface AppError extends Error {
  code: ErrorCodes;
  statusCode: number;
  requestId?: string;
  context?: Record<string, any>;
}

export class CustomError extends Error implements AppError {
  public code: ErrorCodes;
  public statusCode: number;
  public requestId?: string;
  public context?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCodes,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.requestId = uuidv4();

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
    
    const errorResponse = {
      success: false,
      error: {
        message: error.message,
        code,
        requestId: isAppError ? error.requestId : requestId || uuidv4(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      timestamp: new Date().toISOString()
    };

    // Log the error with context
    logger.error('API Error Response', {
      requestId: errorResponse.error.requestId,
      code,
      message: error.message,
      statusCode,
      stack: error.stack,
      ...(isAppError && error.context ? { context: error.context } : {})
    });

    return res.status(statusCode).json(errorResponse);
  }

  static notFound(res: Response, resource: string = 'Resource'): Response {
    const error = new CustomError(
      `${resource} not found`,
      ErrorCodes.RESOURCE_NOT_FOUND,
      404
    );
    return ResponseHelper.error(res, error);
  }

  static badRequest(res: Response, message: string = 'Bad request'): Response {
    const error = new CustomError(
      message,
      ErrorCodes.INVALID_INPUT,
      400
    );
    return ResponseHelper.error(res, error);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): Response {
    const error = new CustomError(
      message,
      ErrorCodes.AUTHENTICATION_FAILED,
      401
    );
    return ResponseHelper.error(res, error);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): Response {
    const error = new CustomError(
      message,
      ErrorCodes.AUTHORIZATION_FAILED,
      403
    );
    return ResponseHelper.error(res, error);
  }
}

// Async handler wrapper to catch async errors
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
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
            originalError: lastError.message, 
            attempts: retries 
          }
        );
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
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

  // Handle different types of errors
  if (error instanceof CustomError) {
    ResponseHelper.error(res, error, requestId);
  } else if (error.name === 'ValidationError') {
    const customError = new CustomError(
      error.message,
      ErrorCodes.VALIDATION_ERROR,
      400
    );
    ResponseHelper.error(res, customError, requestId);
  } else if (error.name === 'CastError') {
    const customError = new CustomError(
      'Invalid ID format',
      ErrorCodes.INVALID_INPUT,
      400
    );
    ResponseHelper.error(res, customError, requestId);
  } else {
    // Unknown error - log it and return generic error
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      requestId,
      url: req.url,
      method: req.method
    });

    const customError = new CustomError(
      'An unexpected error occurred',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500
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
  next();
}