// Jest setup file
import './set-env-vars';
import './unit-test-setup';

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};