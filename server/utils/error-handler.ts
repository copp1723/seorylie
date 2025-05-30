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

// Global error handler middleware
export function errorHandler(
  err: AppError | Error, // Can be CustomError or any other Error
  req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const customErr = err as AppError; // Type assertion to access custom properties

  const statusCode = customErr.statusCode || 500;
  const message = customErr.userMessage || customErr.message || "Internal ServerError";
  const traceId = customErr.traceId || (req.headers["x-trace-id"] as string) || uuidv4();
  const code = customErr.code;
  const context = customErr.context;

  // Log the error
  logger.error("Error handled:", {
    traceId,
    requestId: req.headers["x-request-id"] as string,
    statusCode,
    message: err.message, // Log the original, more specific error message
    code,
    userMessage: customErr.userMessage,
    isOperational: customErr.isOperational,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    context,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined, // Log stack in dev
  });

  // Set trace ID in response header if not already set by requestIdMiddleware
  if (!res.getHeader("X-Trace-Id")) {
    res.setHeader("X-Trace-Id", traceId);
  }

  const errorResponse: {
    message: string;
    code?: string;
    traceId: string;
    userMessage?: string;
    stack?: string;
  } = {
    message: message, // Send user-friendly message or original message
    traceId: traceId,
  };

  if (code) {
    errorResponse.code = code;
  }

  if (customErr.userMessage && customErr.userMessage !== message) {
    errorResponse.userMessage = customErr.userMessage;
  }

  if (process.env.NODE_ENV === "development" && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json({
    error: errorResponse,
    timestamp: new Date().toISOString(),
  });
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
