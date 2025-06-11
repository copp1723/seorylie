/**
 * Jest Setup File
 * @description Global test setup and configuration for SEORYLIE test suite
 */

// Extend Jest matchers
import 'jest-extended';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DB_NAME = 'rylie_seo_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock external services by default
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI response' } }]
        })
      }
    }
  }))
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

jest.mock('twilio', () => jest.fn().mockImplementation(() => ({
  messages: {
    create: jest.fn().mockResolvedValue({ sid: 'mock-message-sid' })
  }
})));

// Mock Winston logger to avoid console spam
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Global test utilities
global.testUtils = {
  // Mock request with trace ID
  mockRequest: (overrides = {}) => ({
    traceId: 'test-trace-id',
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    },
    user: {
      id: 'test-user-id',
      tenantId: 'test-tenant-id',
      role: 'test-role'
    },
    ...overrides
  }),

  // Mock response object
  mockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    };
    return res;
  },

  // Mock next function
  mockNext: () => jest.fn(),

  // Create test database URL
  getTestDatabaseUrl: () => 
    `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,

  // Wait utility for async tests
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
};

// Increase timeout for integration tests
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Setup and teardown for database tests
let testDbSetup = false;

beforeAll(async () => {
  // Only run database setup once
  if (!testDbSetup) {
    try {
      // Add any global test database setup here
      testDbSetup = true;
    } catch (error) {
      console.warn('Test database setup failed:', error.message);
    }
  }
});

afterAll(async () => {
  // Clean up database connections, etc.
  try {
    // Add any global cleanup here
  } catch (error) {
    console.warn('Test cleanup failed:', error.message);
  }
});

// Handle unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Silence console.log in tests unless explicitly needed
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error // Keep errors visible
  };
}

console.info('✅ Jest test environment setup complete');