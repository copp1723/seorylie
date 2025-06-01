/**
 * Standardized API response utilities
 * Provides consistent response formatting across all API endpoints
 */

import type { Response } from 'express';
import logger from './logger';

/**
 * Standard success response structure
 * @template T Type of the data being returned
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * Enhanced error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  userMessage?: string; // User-friendly message for UI display
  details?: any;
  code?: string;
  field?: string; // For validation errors
  action?: {
    label: string;
    url?: string;
    type?: 'retry' | 'navigate' | 'contact' | 'refresh';
  };
}

/**
 * Standard error codes for consistent client-side handling
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource Management
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // Business Logic
  INVENTORY_IMPORT_FAILED: 'INVENTORY_IMPORT_FAILED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  CHAT_UNAVAILABLE: 'CHAT_UNAVAILABLE',
  DEALERSHIP_INACTIVE: 'DEALERSHIP_INACTIVE',

  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',

  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
} as const;

/**
 * User-friendly error messages and actions
 */
const ERROR_CONFIGS: Record<string, {
  userMessage: string;
  action?: ErrorResponse['action']
}> = {
  [ERROR_CODES.UNAUTHORIZED]: {
    userMessage: 'Please log in to continue',
    action: { label: 'Log In', type: 'navigate', url: '/auth' }
  },
  [ERROR_CODES.FORBIDDEN]: {
    userMessage: 'You don\'t have permission to perform this action',
  },
  [ERROR_CODES.INVALID_CREDENTIALS]: {
    userMessage: 'Invalid email or password. Please try again.',
  },
  [ERROR_CODES.SESSION_EXPIRED]: {
    userMessage: 'Your session has expired. Please log in again.',
    action: { label: 'Log In', type: 'navigate', url: '/auth' }
  },
  [ERROR_CODES.NOT_FOUND]: {
    userMessage: 'The requested item could not be found',
  },
  [ERROR_CODES.ALREADY_EXISTS]: {
    userMessage: 'This item already exists',
  },
  [ERROR_CODES.INVENTORY_IMPORT_FAILED]: {
    userMessage: 'Failed to import inventory. Please check your file format and try again.',
    action: { label: 'Retry Import', type: 'retry' }
  },
  [ERROR_CODES.EMAIL_SEND_FAILED]: {
    userMessage: 'Unable to send email. Please try again later.',
    action: { label: 'Retry', type: 'retry' }
  },
  [ERROR_CODES.CHAT_UNAVAILABLE]: {
    userMessage: 'Chat is temporarily unavailable. Please try again in a few minutes.',
    action: { label: 'Retry', type: 'retry' }
  },
  [ERROR_CODES.DEALERSHIP_INACTIVE]: {
    userMessage: 'This dealership is currently inactive. Please contact support.',
    action: { label: 'Contact Support', type: 'contact' }
  },
  [ERROR_CODES.INTERNAL_ERROR]: {
    userMessage: 'Something went wrong on our end. Please try again later.',
    action: { label: 'Retry', type: 'retry' }
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    userMessage: 'This service is temporarily unavailable. Please try again later.',
    action: { label: 'Retry', type: 'retry' }
  },
  [ERROR_CODES.RATE_LIMITED]: {
    userMessage: 'Too many requests. Please wait a moment before trying again.',
  },
  [ERROR_CODES.VALIDATION_ERROR]: {
    userMessage: 'Please check the form for errors and try again',
  },
};

/**
 * Send a standardized success response
 * @param res Express response object
 * @param data Data to include in the response
 * @param message Optional success message
 * @param statusCode HTTP status code (defaults to 200)
 * @param pagination Optional pagination information
 */
export function sendSuccess<T = any>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  pagination?: { limit: number; offset: number; total: number }
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(pagination && { pagination })
  };

  res.status(statusCode).json(response);
}

/**
 * Send a standardized error response with enhanced user messaging
 * @param res Express response object
 * @param error Error message, Error object, or error code
 * @param statusCode HTTP status code (defaults to 500)
 * @param details Additional error details
 * @param options Additional options like field for validation errors
 */
export function sendError(
  res: Response,
  error: string | Error | keyof typeof ERROR_CODES,
  statusCode = 500,
  details?: any,
  options?: { field?: string; userMessage?: string; action?: ErrorResponse['action'] }
): void {
  let errorMessage: string;
  let code: string | undefined;
  let userMessage: string | undefined;
  let action: ErrorResponse['action'] | undefined;

  // Handle different error types
  if (error instanceof Error) {
    errorMessage = error.message;
    code = ERROR_CODES.INTERNAL_ERROR;
  } else if (typeof error === 'string' && error in ERROR_CODES) {
    // It's a known error code
    code = error;
    errorMessage = error;
    const config = ERROR_CONFIGS[error];
    if (config) {
      userMessage = config.userMessage;
      action = config.action;
    }
  } else {
    // It's a generic string error
    errorMessage = typeof error === 'string' ? error : 'Unknown error';
    code = ERROR_CODES.INTERNAL_ERROR;
  }

  // Override with provided options
  if (options?.userMessage) {
    userMessage = options.userMessage;
  }
  if (options?.action) {
    action = options.action;
  }

  const response: ErrorResponse = {
    success: false,
    error: errorMessage,
    ...(userMessage && { userMessage }),
    ...(details && { details }),
    ...(code && { code }),
    ...(options?.field && { field: options.field }),
    ...(action && { action })
  };

  // Log error for debugging
  logger.error('API Error Response', {
    statusCode,
    code,
    error: errorMessage,
    details,
    userMessage
  });

  res.status(statusCode).json(response);
}

/**
 * Send a validation error response
 * @param res Express response object
 * @param errors Array of validation errors
 * @param message Optional custom message
 */
export function sendValidationError(
  res: Response,
  errors: Array<{ field: string; message: string; code?: string }>,
  message = 'Validation failed'
): void {
  const response: ErrorResponse = {
    success: false,
    error: message,
    userMessage: ERROR_CONFIGS[ERROR_CODES.VALIDATION_ERROR]?.userMessage || 'Please check your input and try again',
    code: ERROR_CODES.VALIDATION_ERROR,
    details: {
      validation_errors: errors
    }
  };

  logger.warn('Validation Error', { errors });
  res.status(HttpStatus.UNPROCESSABLE_ENTITY).json(response);
}

/**
 * Send a not found error response
 * @param res Express response object
 * @param resource Name of the resource that wasn't found
 */
export function sendNotFound(
  res: Response,
  resource = 'Resource'
): void {
  sendError(
    res,
    ERROR_CODES.NOT_FOUND,
    HttpStatus.NOT_FOUND,
    { resource },
    { userMessage: `The requested ${resource.toLowerCase()} could not be found` }
  );
}

/**
 * Send an unauthorized error response
 * @param res Express response object
 * @param message Optional custom message
 */
export function sendUnauthorized(
  res: Response,
  message?: string
): void {
  sendError(
    res,
    ERROR_CODES.UNAUTHORIZED,
    HttpStatus.UNAUTHORIZED,
    undefined,
    { userMessage: message || ERROR_CONFIGS[ERROR_CODES.UNAUTHORIZED]?.userMessage || 'Authentication required' }
  );
}

/**
 * Send a forbidden error response
 * @param res Express response object
 * @param message Optional custom message
 */
export function sendForbidden(
  res: Response,
  message?: string
): void {
  sendError(
    res,
    ERROR_CODES.FORBIDDEN,
    HttpStatus.FORBIDDEN,
    undefined,
    { userMessage: message || ERROR_CONFIGS[ERROR_CODES.FORBIDDEN]?.userMessage || 'Access denied' }
  );
}

/**
 * Format a standardized API response without sending it
 * @param data Data to include in the response
 * @param success Whether the operation was successful (defaults to true)
 * @param message Optional success or error message
 * @param pagination Optional pagination information
 * @returns Formatted API response object
 */
export function formatApiResponse<T = any>(
  data: T,
  success: boolean = true,
  message?: string,
  pagination?: { limit: number; offset: number; total: number }
): SuccessResponse<T> | ErrorResponse {
  if (success) {
    return {
      success: true,
      data,
      ...(message && { message }),
      ...(pagination && { pagination })
    };
  } else {
    return {
      success: false,
      error: typeof data === 'string' ? data : message || 'An error occurred',
      ...(typeof data !== 'string' && { details: data })
    };
  }
}

/**
 * HTTP status codes with descriptions
 * For consistent status code usage across the API
 */
export const HttpStatus = {
  // Success responses
  OK: 200,                    // Standard success response
  CREATED: 201,               // Resource created successfully
  ACCEPTED: 202,              // Request accepted but not yet completed
  NO_CONTENT: 204,            // Success with no content to return

  // Client error responses
  BAD_REQUEST: 400,           // Invalid request format or parameters
  UNAUTHORIZED: 401,          // Authentication required
  FORBIDDEN: 403,             // Authenticated but insufficient permissions
  NOT_FOUND: 404,             // Resource not found
  METHOD_NOT_ALLOWED: 405,    // HTTP method not allowed for this resource
  CONFLICT: 409,              // Request conflicts with current state
  GONE: 410,                  // Resource no longer available
  UNPROCESSABLE_ENTITY: 422,  // Validation errors
  TOO_MANY_REQUESTS: 429,     // Rate limit exceeded

  // Server error responses
  INTERNAL_SERVER_ERROR: 500, // Unexpected server error
  NOT_IMPLEMENTED: 501,       // Endpoint not yet implemented
  SERVICE_UNAVAILABLE: 503    // Service temporarily unavailable
};
