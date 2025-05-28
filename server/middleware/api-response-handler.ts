/**
 * API Response Handler Middleware
 * Provides standardized response formatting for API endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../utils/api-response';

/**
 * Extends Express Response object with standardized response methods
 */
export const apiResponseHandler = (req: Request, res: Response, next: NextFunction): void => {
  /**
   * Send a success response
   * @param data Data to include in the response
   * @param message Optional success message
   * @param statusCode HTTP status code (defaults to 200)
   */
  res.sendSuccess = function<T = any>(
    data: T,
    message?: string,
    statusCode = HttpStatus.OK
  ): Response {
    const response = {
      success: true,
      data,
      ...(message && { message })
    };

    return this.status(statusCode).json(response);
  };

  /**
   * Send a paginated success response
   * @param data Array of items
   * @param total Total count of items (for pagination)
   * @param limit Page size limit
   * @param offset Pagination offset
   * @param message Optional success message
   * @param statusCode HTTP status code (defaults to 200)
   */
  res.sendPaginatedSuccess = function<T = any>(
    data: T[],
    total: number,
    limit: number,
    offset: number,
    message?: string,
    statusCode = HttpStatus.OK
  ): Response {
    const response = {
      success: true,
      data,
      pagination: {
        limit,
        offset,
        total
      },
      ...(message && { message })
    };

    return this.status(statusCode).json(response);
  };

  /**
   * Send an error response
   * @param error Error message or Error object
   * @param statusCode HTTP status code (defaults to 400)
   * @param details Additional error details
   * @param code Optional error code for client-side handling
   */
  res.sendError = function(
    error: string | Error,
    statusCode = HttpStatus.BAD_REQUEST,
    details?: any,
    code?: string
  ): Response {
    const errorMessage = error instanceof Error ? error.message : error;

    const response = {
      success: false,
      error: errorMessage,
      ...(details && { details }),
      ...(code && { code })
    };

    return this.status(statusCode).json(response);
  };

  /**
   * Send a validation error response
   * @param validationErrors Object containing field-level validation errors
   * @param message Optional error message
   */
  res.sendValidationError = function(
    validationErrors: Record<string, string>,
    message = 'Validation failed'
  ): Response {
    const response = {
      success: false,
      error: message,
      details: validationErrors,
      code: 'VALIDATION_ERROR'
    };

    return this.status(HttpStatus.UNPROCESSABLE_ENTITY).json(response);
  };

  /**
   * Send a not found error response
   * @param resourceType Type of resource that wasn't found
   * @param resourceId ID of the resource that wasn't found
   */
  res.sendNotFound = function(
    resourceType: string,
    resourceId?: string | number
  ): Response {
    const response = {
      success: false,
      error: `${resourceType} not found`,
      ...(resourceId && {
        details: { resourceId, resourceType }
      }),
      code: 'RESOURCE_NOT_FOUND'
    };

    return this.status(HttpStatus.NOT_FOUND).json(response);
  };

  next();
};

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      sendSuccess<T = any>(data: T, message?: string, statusCode?: number): Response;
      sendPaginatedSuccess<T = any>(data: T[], total: number, limit: number, offset: number, message?: string, statusCode?: number): Response;
      sendError(error: string | Error, statusCode?: number, details?: any, code?: string): Response;
      sendValidationError(validationErrors: Record<string, string>, message?: string): Response;
      sendNotFound(resourceType: string, resourceId?: string | number): Response;
    }
  }
}