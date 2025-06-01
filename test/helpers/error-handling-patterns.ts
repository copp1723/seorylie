/**
 * Standardized Error Handling Patterns for Tests
 * 
 * This module provides consistent error handling patterns and test utilities
 * to ensure tests match actual service behavior.
 */

import { expect } from 'vitest';

// Standard error types used across the codebase
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

export interface AdfParseResult extends ServiceResult {
  parsedData?: any;
  mappedLead?: any;
  validationDetails?: {
    xsdValidationPassed: boolean;
    partialDataExtracted: boolean;
    minimumFieldsPresent: boolean;
    missingRequiredFields: string[];
  };
  parserUsed: 'v1' | 'v2';
  parseTimeMs: number;
}

// Error handling pattern matchers for different service types
export class ErrorPatternMatchers {
  /**
   * Test that a method returns a result object with success: false
   * Used for: ADF services, validation utilities, business logic
   */
  static expectResultObjectError(
    promise: Promise<ServiceResult>,
    expectedErrors: string[] = []
  ) {
    return expect(promise).resolves.toEqual(
      expect.objectContaining({
        success: false,
        errors: expectedErrors.length > 0 
          ? expect.arrayContaining(expectedErrors)
          : expect.any(Array)
      })
    );
  }

  /**
   * Test that a method throws an Error instance
   * Used for: Infrastructure services, database operations, system failures
   */
  static expectThrownError(
    promise: Promise<any>,
    expectedMessage?: string | RegExp
  ) {
    if (expectedMessage) {
      return expect(promise).rejects.toThrow(expectedMessage);
    }
    return expect(promise).rejects.toThrow();
  }

  /**
   * Test that a method throws a specific Error class
   * Used for: Custom error types, validation errors
   */
  static expectThrownErrorType<T extends Error>(
    promise: Promise<any>,
    ErrorClass: new (...args: any[]) => T,
    expectedMessage?: string
  ) {
    const assertion = expect(promise).rejects.toBeInstanceOf(ErrorClass);
    if (expectedMessage) {
      return assertion.rejects.toThrow(expectedMessage);
    }
    return assertion;
  }

  /**
   * Test ADF parsing results specifically
   */
  static expectAdfParseError(
    promise: Promise<AdfParseResult>,
    expectedErrors: string[] = []
  ) {
    return expect(promise).resolves.toEqual(
      expect.objectContaining({
        success: false,
        errors: expectedErrors.length > 0 
          ? expect.arrayContaining(expectedErrors)
          : expect.any(Array),
        parserUsed: expect.stringMatching(/^v[12]$/),
        parseTimeMs: expect.any(Number)
      })
    );
  }
}

// Mock error generators with proper Error instances
export class MockErrorGenerators {
  /**
   * Create a proper Error instance for mocking
   */
  static createError(message: string, code?: string): Error {
    const error = new Error(message);
    if (code) {
      (error as any).code = code;
    }
    return error;
  }

  /**
   * Create a database connection error
   */
  static createDatabaseError(operation: string = 'query'): Error {
    return this.createError(`Database ${operation} failed`, 'DB_CONNECTION_ERROR');
  }

  /**
   * Create an external API error
   */
  static createApiError(service: string, statusCode: number = 500): Error {
    const error = this.createError(`${service} API request failed`);
    (error as any).statusCode = statusCode;
    return error;
  }

  /**
   * Create a validation error
   */
  static createValidationError(field: string): Error {
    return this.createError(`Validation failed for field: ${field}`, 'VALIDATION_ERROR');
  }

  /**
   * Create a timeout error
   */
  static createTimeoutError(operation: string): Error {
    return this.createError(`Operation timeout: ${operation}`, 'TIMEOUT_ERROR');
  }

  /**
   * Create a circuit breaker error
   */
  static createCircuitBreakerError(): Error {
    return this.createError('Circuit breaker is open', 'CIRCUIT_BREAKER_OPEN');
  }
}

// Service-specific error patterns
export class ServiceErrorPatterns {
  /**
   * ADF Service error patterns
   */
  static adf = {
    expectParseError: (promise: Promise<AdfParseResult>, errors: string[] = []) =>
      ErrorPatternMatchers.expectAdfParseError(promise, errors),
    
    expectProcessingError: (promise: Promise<ServiceResult>, errors: string[] = []) =>
      ErrorPatternMatchers.expectResultObjectError(promise, errors)
  };

  /**
   * Database service error patterns
   */
  static database = {
    expectConnectionError: (promise: Promise<any>) =>
      ErrorPatternMatchers.expectThrownError(promise, /database.*connection/i),
    
    expectQueryError: (promise: Promise<any>) =>
      ErrorPatternMatchers.expectThrownError(promise, /query.*failed/i)
  };

  /**
   * Validation service error patterns
   */
  static validation = {
    expectValidationError: (promise: Promise<ServiceResult>, field?: string) => {
      const errors = field ? [`Validation failed for field: ${field}`] : [];
      return ErrorPatternMatchers.expectResultObjectError(promise, errors);
    }
  };

  /**
   * Infrastructure service error patterns
   */
  static infrastructure = {
    expectSystemError: (promise: Promise<any>, message?: string) =>
      ErrorPatternMatchers.expectThrownError(promise, message),
    
    expectTimeoutError: (promise: Promise<any>) =>
      ErrorPatternMatchers.expectThrownError(promise, /timeout/i)
  };
}

// Test utilities for error simulation
export class ErrorTestUtils {
  /**
   * Create a mock that rejects with proper Error instance
   */
  static createRejectingMock(error: Error) {
    return vi.fn().mockRejectedValue(error);
  }

  /**
   * Create a mock that returns a failed result object
   */
  static createFailingResultMock(errors: string[] = ['Mock error']) {
    return vi.fn().mockResolvedValue({
      success: false,
      errors
    });
  }

  /**
   * Create a mock that sometimes fails (for flaky behavior testing)
   */
  static createFlakyMock(failureRate: number = 0.5, error: Error) {
    return vi.fn().mockImplementation(() => {
      if (Math.random() < failureRate) {
        return Promise.reject(error);
      }
      return Promise.resolve({ success: true });
    });
  }

  /**
   * Simulate network timeout
   */
  static createTimeoutMock(timeoutMs: number = 5000) {
    return vi.fn().mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(MockErrorGenerators.createTimeoutError('network')), timeoutMs)
      )
    );
  }
}

// Export commonly used patterns
export const expectResultError = ErrorPatternMatchers.expectResultObjectError;
export const expectThrownError = ErrorPatternMatchers.expectThrownError;
export const createMockError = MockErrorGenerators.createError;
