/**
 * Standardized API response utilities
 * Provides consistent response formatting across all API endpoints
 */

import { Response } from 'express';

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
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
  code?: string;
}

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
 * Send a standardized error response
 * @param res Express response object
 * @param error Error message or Error object
 * @param statusCode HTTP status code (defaults to 500)
 * @param details Additional error details
 * @param code Optional error code for client-side handling
 */
export function sendError(
  res: Response,
  error: string | Error,
  statusCode = 500,
  details?: any,
  code?: string
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  
  const response: ErrorResponse = {
    success: false,
    error: errorMessage,
    ...(details && { details }),
    ...(code && { code })
  };

  res.status(statusCode).json(response);
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