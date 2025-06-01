/**
 * Database setup for tests using pg-mem mock
 * 
 * This file provides database mocking for tests using the pg-mem in-memory
 * PostgreSQL database. It handles setup, teardown, and reset operations.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createMockDatabase, getGlobalMockDatabase, resetGlobalMockDatabase, cleanupGlobalMockDatabase } from '../mocks/database';
import type { MockDatabase } from '../mocks/database';

// Global variables for test database
let globalTestDb: any = null;

/**
 * Setup database mocking for tests
 * Call this in test files that need database access
 */
export async function setupTestDatabase(): Promise<MockDatabase> {
  if (!globalTestDb) {
    const mockDb = await createMockDatabase();
    globalTestDb = mockDb.db;
    return mockDb;
  }
  return { db: globalTestDb, cleanup: async () => {}, reset: async () => {} };
}

/**
 * Get the current test database instance
 */
export function getTestDatabase(): MockDatabase | null {
  return globalTestDb;
}

/**
 * Reset the test database between tests
 */
export async function resetTestDatabase(): Promise<void> {
  await resetGlobalMockDatabase();
}

/**
 * Clean up the test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  await cleanupGlobalMockDatabase();
  globalTestDb = null;
}

/**
 * Global database setup hooks for all tests
 * These hooks automatically manage the database lifecycle
 */

// Setup database before all tests
beforeAll(async () => {
  console.log('Setting up test database with pg-mem...');
  await setupTestDatabase();
});

// Reset database before each test to ensure isolation
beforeEach(async () => {
  await resetTestDatabase();
});

// Cleanup database after each test
afterEach(async () => {
  // Optional: Additional cleanup if needed
});

// Final cleanup after all tests
afterAll(async () => {
  console.log('Cleaning up test database...');
  await cleanupTestDatabase();
});

/**
 * Helper function to create service instances with mocked database
 * Usage: const emailService = createServiceWithMockDb(EmailService);
 */
export function createServiceWithMockDb<T>(ServiceClass: new (...args: any[]) => T): T {
  return new ServiceClass(globalTestDb);
}

/**
 * Helper function to get mock database for manual injection
 * Usage: const service = new SomeService(getMockDbForInjection());
 */
export function getMockDbForInjection(): any {
  return globalTestDb;
}

/**
 * Helper function to create EmailService with rate limiting mocks
 * Usage: const emailService = createEmailServiceWithMocks(mockStore, mockNowFn);
 */
export function createEmailServiceWithMocks(rateLimitStore?: any, nowFn?: () => number): any {
  // Import EmailService dynamically to avoid circular dependencies
  const { EmailService } = require('../../server/services/email-service');
  return new EmailService(globalTestDb, rateLimitStore, nowFn);
}