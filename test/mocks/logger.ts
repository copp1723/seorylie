/**
 * Centralized Logger Mock
 * 
 * This file provides a standardized logger mock that exports all required
 * logger functions for consistent testing across the codebase.
 */

// Mock logger implementation
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn(() => mockLogger),
  level: 'info',
  silent: false
};

// Export named logger for ES6 imports
export const logger = mockLogger;

// Export default logger
export default mockLogger;

// Export for CommonJS compatibility
module.exports = {
  logger: mockLogger,
  default: mockLogger,
  ...mockLogger
};

// Additional utility functions for test setup
export function resetLoggerMocks() {
  Object.values(mockLogger).forEach(mock => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
}

export function getLoggerCallCount(level: keyof typeof mockLogger) {
  const mock = mockLogger[level];
  return typeof mock === 'function' && mock.mock ? mock.mock.calls.length : 0;
}

export function getLoggerCalls(level: keyof typeof mockLogger) {
  const mock = mockLogger[level];
  return typeof mock === 'function' && mock.mock ? mock.mock.calls : [];
}

export { mockLogger };
