/**
 * Centralized SendGrid Mock Helper
 * 
 * This file provides a standardized SendGrid mock that works consistently
 * across all test files, supporting both CommonJS and ES6 import patterns.
 */

interface SendGridResponse {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
}

interface SendGridError extends Error {
  code?: number;
  response?: {
    statusCode: number;
    body: any;
  };
}

interface MockSendGridClient {
  send: jest.Mock;
  setApiKey: jest.Mock;
}

/**
 * Creates a standardized SendGrid mock with configurable behavior
 */
export function createSendGridMock(options: {
  shouldSucceed?: boolean;
  shouldRateLimit?: boolean;
  shouldTimeout?: boolean;
  customError?: string;
  responseDelay?: number;
} = {}): MockSendGridClient {
  const {
    shouldSucceed = true,
    shouldRateLimit = false,
    shouldTimeout = false,
    customError,
    responseDelay = 0
  } = options;

  const sendMock = jest.fn().mockImplementation(async (msg: any) => {
    // Add response delay if specified
    if (responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, responseDelay));
    }

    // Handle rate limiting
    if (shouldRateLimit) {
      const error: SendGridError = new Error('Too many requests');
      error.code = 429;
      error.response = {
        statusCode: 429,
        body: { errors: [{ message: 'Too many requests' }] }
      };
      throw error;
    }

    // Handle timeout
    if (shouldTimeout) {
      const error: SendGridError = new Error('Request timeout');
      error.code = 408;
      throw error;
    }

    // Handle custom error
    if (customError) {
      const error: SendGridError = new Error(customError);
      error.code = 400;
      error.response = {
        statusCode: 400,
        body: { errors: [{ message: customError }] }
      };
      throw error;
    }

    // Handle failure
    if (!shouldSucceed) {
      const error: SendGridError = new Error('SendGrid API error');
      error.code = 500;
      error.response = {
        statusCode: 500,
        body: { errors: [{ message: 'Internal server error' }] }
      };
      throw error;
    }

    // Success response
    const messageId = `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const response: SendGridResponse = {
      statusCode: 202,
      body: '',
      headers: {
        'x-message-id': messageId
      }
    };

    return [response, {}];
  });

  return {
    send: sendMock,
    setApiKey: jest.fn()
  };
}

/**
 * Gets a standard SendGrid mock for successful operations
 */
export function getSuccessfulSendGridMock(): MockSendGridClient {
  return createSendGridMock({ shouldSucceed: true });
}

/**
 * Gets a SendGrid mock that simulates rate limiting
 */
export function getRateLimitedSendGridMock(): MockSendGridClient {
  return createSendGridMock({ shouldRateLimit: true });
}

/**
 * Gets a SendGrid mock that simulates API errors
 */
export function getFailingSendGridMock(errorMessage?: string): MockSendGridClient {
  return createSendGridMock({ 
    shouldSucceed: false, 
    customError: errorMessage 
  });
}

/**
 * Gets a SendGrid mock with custom configuration
 */
export function getCustomSendGridMock(config: {
  shouldSucceed?: boolean;
  shouldRateLimit?: boolean;
  shouldTimeout?: boolean;
  customError?: string;
  responseDelay?: number;
}): MockSendGridClient {
  return createSendGridMock(config);
}

/**
 * Default SendGrid mock for general use
 */
export const defaultSendGridMock = getSuccessfulSendGridMock();

/**
 * Mock factory for different scenarios
 */
export const SendGridMockFactory = {
  success: getSuccessfulSendGridMock,
  rateLimited: getRateLimitedSendGridMock,
  failing: getFailingSendGridMock,
  custom: getCustomSendGridMock,
  default: defaultSendGridMock
};

// Export for CommonJS compatibility
module.exports = {
  createSendGridMock,
  getSuccessfulSendGridMock,
  getRateLimitedSendGridMock,
  getFailingSendGridMock,
  getCustomSendGridMock,
  defaultSendGridMock,
  SendGridMockFactory
};
