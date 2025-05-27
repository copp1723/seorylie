/**
 * Common test utilities and helper functions
 * 
 * This file contains shared functionality for test suites.
 */

import { Request, Response } from 'express';

/**
 * Create a mock Express request object
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  path?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  user?: any;
  apiKey?: any;
} = {}): Partial<Request> {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    path: options.path || '/',
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {},
    get: (header: string) => {
      const normalizedHeader = header.toLowerCase();
      return Object.keys(options.headers || {})
        .find(key => key.toLowerCase() === normalizedHeader)
        ? options.headers?.[normalizedHeader]
        : undefined;
    },
    user: options.user,
    apiKey: options.apiKey
  };
}

/**
 * Create a mock Express response object
 */
export function createMockResponse(): Partial<Response> & {
  json: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
  end: jest.Mock;
  setHeader: jest.Mock;
  getHeader: jest.Mock;
  locals: Record<string, any>;
} {
  const res: any = {
    statusCode: 200,
    headers: {},
    locals: {},
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockImplementation((key, value) => {
      res.headers[key] = value;
      return res;
    }),
    getHeader: jest.fn().mockImplementation((key) => res.headers[key]),
    on: jest.fn()
  };
  return res;
}

/**
 * Create a mock next function for middleware testing
 */
export function createMockNext(): jest.Mock {
  return jest.fn();
}

/**
 * Wait for a specified time (in milliseconds)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random API key for testing
 */
export function generateTestApiKey(): string {
  return 'test_api_key_' + Math.random().toString(36).substring(2, 15);
}

/**
 * Generate a random email for testing
 */
export function generateTestEmail(): string {
  return `test-${Math.random().toString(36).substring(2, 10)}@example.com`;
}

/**
 * Mock logger wrapper to prevent logging during tests
 */
export function mockLogger(): jest.Mocked<any> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn()
  };
}