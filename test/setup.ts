/**
 * Jest test setup file for the Rylie AI platform
 *
 * This file runs before each test and configures the testing environment.
 */

import { beforeAll, afterAll, beforeEach, jest } from "@jest/globals";

// Set testing environment variables
process.env.NODE_ENV = "test";
// Use a separate test database if needed
// process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/rylie_test';

// Global beforeAll, beforeEach, afterAll, and afterEach hooks
beforeAll(async () => {
  // Setup code that runs once before all tests
  console.log("Starting test suite");
});

afterAll(async () => {
  // Cleanup code that runs once after all tests
  console.log("Test suite completed");
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

// Global variables and helper functions for testing
(globalThis as any).testHelpers = {
  // Helper to create test requests with auth tokens
  createTestRequest: (token: string) => {
    return {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
  },

  // Generate a valid test API key
  generateTestApiKey: () => {
    return "test_api_key_" + Math.random().toString(36).substring(2, 15);
  },
};
