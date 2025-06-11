import { AxiosError } from 'axios';
import { ApiError } from '../types/api';

// Helper to extract error message from API response
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
};

// Helper to check if error is an API error
export const isApiError = (error: unknown): error is AxiosError<ApiError> => {
  return error instanceof Error && 'isAxiosError' in error;
};

// Helper to get user-friendly error message
export const getFriendlyErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    const status = error.response?.status;
    const apiError = error.response?.data;
    
    switch (status) {
      case 400:
        return apiError?.message || 'Invalid request. Please check your input.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service is temporarily unavailable. Please try again later.';
      default:
        return apiError?.message || 'An unexpected error occurred.';
    }
  }
  
  return getErrorMessage(error);
};

// Helper to determine if error is retryable
export const isRetryableError = (error: unknown): boolean => {
  if (isApiError(error)) {
    const status = error.response?.status;
    // Retry on 5xx errors and network errors
    return !status || status >= 500;
  }
  
  // Retry on network errors
  return error instanceof Error && error.message.includes('Network');
};

// Helper to log errors for debugging
export const logError = (error: unknown, context?: string) => {
  console.error(`Error${context ? ` in ${context}` : ''}:`, {
    error,
    message: getErrorMessage(error),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  });
  
  // In production, you might want to send this to an error reporting service
  // Example: Sentry.captureException(error, { extra: { context } });
};

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}