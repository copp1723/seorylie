import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import logger from "./logger"; // Assuming logger is in the same directory or adjust path

// Interface for application errors
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string; // Application-specific error code
  context?: Record<string, any>; // Additional context for logging
  userMessage?: string; // User-friendly message
  traceId?: string; // For tracking the error across services/logs
}

// Custom error class
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public context?: Record<string, any>;
  public userMessage?: string;
  public traceId: string;

  constructor(
    message: string,
    statusCode: number = 500,
    options?: {
      isOperational?: boolean;
      code?: string;
      context?: Record<string, any>;
      userMessage?: string;
      traceId?: string;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options?.isOperational ?? true; // Default to operational for known errors
    this.code = options?.code;
    this.context = options?.context;
    this.userMessage = options?.userMessage;
    this.traceId = options?.traceId || uuidv4();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }

    // Set the name of the error class
    this.name = this.constructor.name;
  }
}

// Alias for compatibility
export class ApiError extends CustomError {}

// Middleware to add request ID and trace ID
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  const traceId = (req.headers["x-trace-id"] as string) || requestId; // Use requestId if traceId not present

  req.headers["x-request-id"] = requestId;
  req.headers["x-trace-id"] = traceId;

  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Trace-Id", traceId);
  next();
}

// Enhanced global error handler middleware
export function errorHandler(
  err: AppError | Error, // Can be CustomError or any other Error
  req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const customErr = err as AppError; // Type assertion to access custom properties

  const statusCode = customErr.statusCode || 500;
  const message = customErr.userMessage || customErr.message || "Internal Server Error";
  const traceId = customErr.traceId || req.traceId || (req.headers["x-trace-id"] as string) || uuidv4();
  const requestId = req.requestId || (req.headers["x-request-id"] as string) || uuidv4();
  const code = customErr.code;
  const context = customErr.context;

  // Enhanced error logging with more context
  const errorLogContext = {
    traceId,
    requestId,
    statusCode,
    message: err.message, // Log the original, more specific error message
    code,
    userMessage: customErr.userMessage,
    isOperational: customErr.isOperational,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    dealershipId: req.dealershipId,
    context,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    timestamp: new Date().toISOString()
  };

  // Log the error with appropriate level
  if (statusCode >= 500) {
    logger.error("Server error handled", err, errorLogContext);
  } else if (statusCode >= 400) {
    logger.warn("Client error handled", errorLogContext);
  } else {
    logger.info("Error handled", errorLogContext);
  }

  // Set correlation headers if not already set
  if (!res.getHeader("X-Trace-Id")) {
    res.setHeader("X-Trace-Id", traceId);
  }
  if (!res.getHeader("X-Request-Id")) {
    res.setHeader("X-Request-Id", requestId);
  }

  // Standardized error response format
  const errorResponse: StandardErrorResponse = {
    success: false,
    error: {
      message: message, // Send user-friendly message or original message
      code: code || getDefaultErrorCode(statusCode),
      traceId: traceId,
      requestId: requestId,
      timestamp: new Date().toISOString()
    }
  };

  // Add user message if different from main message
  if (customErr.userMessage && customErr.userMessage !== message) {
    errorResponse.error.userMessage = customErr.userMessage;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Add context in development
  if (process.env.NODE_ENV === "development" && context) {
    errorResponse.error.context = context;
  }

  res.status(statusCode).json(errorResponse);
}

// Standardized error response interface
export interface StandardErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    traceId: string;
    requestId: string;
    timestamp: string;
    userMessage?: string;
    stack?: string;
    context?: any;
  };
}

// Get default error code based on status code
function getDefaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 500:
      return 'INTERNAL_SERVER_ERROR';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 504:
      return 'GATEWAY_TIMEOUT';
    default:
      return 'UNKNOWN_ERROR';
  }
}

// Wrapper for async route handlers to catch errors
export function asyncHandler<
  P = any, // ParamsDictionary
  ResBody = any, // ResponseBody
  ReqBody = any, // RequestBody
  ReqQuery = any // Query
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction
  ) => Promise<any>
): (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => void {
  return (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction
  ): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
