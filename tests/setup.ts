/**
 * @file Test Setup
 * @description Global test setup for Vitest with environment configuration
 */

import { config } from 'dotenv';
import { beforeAll, afterAll, vi } from 'vitest';

// Load test environment variables
config({ path: '.env.test' });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

// Mock console methods in test environment to reduce noise
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
};

beforeAll(() => {
  // Suppress console output in tests unless specifically needed
  console.log = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();
  
  // Keep error and warn for important test debugging
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  const testUtils: {
    mockEnv: (key: string, value: string) => void;
    restoreEnv: () => void;
  };
}

// Environment mocking utilities
const originalEnv = { ...process.env };

globalThis.testUtils = {
  mockEnv: (key: string, value: string) => {
    process.env[key] = value;
  },
  restoreEnv: () => {
    process.env = { ...originalEnv };
  }
};

