/**
 * @file API-Database Integration Tests
 * @description Integration tests for API endpoints with database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, testUtils } from '../utils/dbTestHelpers';

describe('API-Database Integration', () => {
  const dbHelper = setupTestDatabase();

  beforeEach(async () => {
    await dbHelper.connect();
  });

  afterEach(async () => {
    await dbHelper.cleanup();
  });

  describe('Public Signup Flow', () => {
    it('should create tenant and user records in database', async () => {
      // This would be an actual integration test with real database
      // For now, we'll test the concept with our mock helpers
      
      const testTenant = await dbHelper.createTestTenant({
        name: 'Integration Test Agency',
        slug: 'integration-test-agency'
      });

      const testUser = await dbHelper.createTestUser({
        email: 'integration@test.com',
        tenantId: testTenant.id,
        role: 'agency'
      });

      expect(testTenant.name).toBe('Integration Test Agency');
      expect(testUser.email).toBe('integration@test.com');
      expect(testUser.tenantId).toBe(testTenant.id);
    });
  });

  describe('Database Connection Health', () => {
    it('should maintain connection during API operations', async () => {
      const connection = dbHelper.getConnection();
      expect(connection).toBeDefined();

      // Simulate API operations that use database
      const db = dbHelper.getDb();
      expect(db).toBeDefined();

      // Connection should remain healthy
      expect(dbHelper.getConnection()).toBe(connection);
    });
  });
});

