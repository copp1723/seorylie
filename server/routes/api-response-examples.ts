/**
 * API Response Examples
 *
 * This file contains standardized examples of API responses for documentation
 * and reference. These examples should be followed for all API endpoints.
 */

/**
 * Standard Success Response Example
 *
 * All successful API responses should follow this format:
 * - success: true
 * - data: contains the actual response data
 * - message: optional success message
 * - pagination: optional pagination information
 */
export const successResponseExample = {
  success: true,
  data: {
    // Response data goes here
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Example Resource",
    createdAt: "2023-04-15T14:32:21Z",
  },
  message: "Operation completed successfully",
  pagination: {
    limit: 10,
    offset: 0,
    total: 42,
  },
};

/**
 * Standard Error Response Example
 *
 * All error responses should follow this format:
 * - success: false
 * - error: main error message
 * - details: optional detailed error information
 * - code: optional error code for client-side handling
 */
export const errorResponseExample = {
  success: false,
  error: "Resource not found",
  message: "The requested resource could not be found",
  details: {
    resourceId: "123e4567-e89b-12d3-a456-426614174000",
    resourceType: "user",
  },
  code: "RESOURCE_NOT_FOUND",
};

/**
 * Validation Error Response Example
 *
 * For validation errors, include detailed field-level errors:
 */
export const validationErrorExample = {
  success: false,
  error: "Validation failed",
  details: {
    email: "Invalid email format",
    password: "Password must be at least 8 characters",
  },
  code: "VALIDATION_ERROR",
};

/**
 * Collection Response Example
 *
 * For endpoints returning collections/arrays:
 */
export const collectionResponseExample = {
  success: true,
  data: [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Item 1",
    },
    {
      id: "223e4567-e89b-12d3-a456-426614174001",
      name: "Item 2",
    },
  ],
  pagination: {
    limit: 10,
    offset: 0,
    total: 42,
  },
};

/**
 * Standard HTTP Status Codes
 *
 * Use these status codes consistently across all API endpoints:
 *
 * 200 OK - Standard success response
 * 201 Created - Resource created successfully
 * 204 No Content - Success with no content to return
 *
 * 400 Bad Request - Invalid request format or parameters
 * 401 Unauthorized - Authentication required
 * 403 Forbidden - Authenticated but insufficient permissions
 * 404 Not Found - Resource not found
 * 409 Conflict - Request conflicts with current state (e.g., duplicate)
 * 422 Unprocessable Entity - Validation errors
 * 429 Too Many Requests - Rate limit exceeded
 *
 * 500 Internal Server Error - Unexpected server error
 * 503 Service Unavailable - Service temporarily unavailable
 */
