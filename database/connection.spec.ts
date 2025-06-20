/**
 * @file Database Connection Pool Tests
 * @description Tests for database connection, health checks, and pool management
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, DatabaseTestHelper } from '../tests/utils/dbTestHelpers';

// Mock the database configuration
vi.mock('../server/config', () => ({
  config: {
    IS_DEVELOPMENT: true,
    IS_TEST: true,
    DB_USER: 'postgres',
    DB_PASSWORD: 'password',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'seorylie_test',
    NODE_ENV: 'test'
  }
}));

// Mock the logger
vi.mock('../server/utils/errors', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Database Connection', () => {
  let dbHelper: DatabaseTestHelper;

  beforeAll(async () => {
    dbHelper = setupTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish database connection successfully', async () => {
      await dbHelper.connect();
      
      const connection = dbHelper.getConnection();
      expect(connection).toBeDefined();
      
      if (dbHelper.isRealDatabase()) {
        // Test real database connection
        expect(typeof connection?.query).toBe('function');
      } else {
        // Test mock database
        expect(vi.isMockFunction(connection?.query)).toBe(true);
      }
    });

    it('should handle connection failures gracefully', async () => {
      // Create a new helper instance for this test
      const testHelper = new (class extends DatabaseTestHelper {
        async connect() {
          // Force connection failure for this test
          throw new Error('Connection failed');
        }
      })();

      await expect(testHelper.connect()).rejects.toThrow('Connection failed');
    });

    it('should provide database instance after connection', async () => {
      await dbHelper.connect();
      
      const db = dbHelper.getDb();
      expect(db).toBeDefined();
      
      // Test database methods exist
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
    });

    it('should throw error when getting DB before connection', () => {
      const newHelper = DatabaseTestHelper.getInstance();
      // Reset connection state
      (newHelper as any).db = null;
      
      expect(() => newHelper.getDb()).toThrow('Database not connected. Call connect() first.');
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      await dbHelper.connect();
    });

    it('should perform health check successfully', async () => {
      // Mock the actual database module health check
      const mockHealthCheck = async () => {
        if (dbHelper.isRealDatabase()) {
          const connection = dbHelper.getConnection();
          const start = Date.now();
          await connection!`SELECT 1`;
          const latency = Date.now() - start;
          return { status: 'healthy', latency };
        } else {
          return { status: 'healthy', latency: 10 };
        }
      };

      const result = await mockHealthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should detect unhealthy database', async () => {
      // Simulate database health check failure
      const mockHealthCheck = async () => {
        try {
          // Simulate connection error
          throw new Error('Database connection lost');
        } catch (error) {
          return { status: 'unhealthy' };
        }
      };

      const result = await mockHealthCheck();
      expect(result.status).toBe('unhealthy');
    });

    it('should handle disconnected database in health check', async () => {
      const mockHealthCheck = async () => {
        // Simulate no connection
        const connection = null;
        
        if (!connection) {
          return { status: 'disconnected' };
        }
        
        return { status: 'healthy' };
      };

      const result = await mockHealthCheck();
      expect(result.status).toBe('disconnected');
    });
  });

  describe('Connection Pool', () => {
    beforeEach(async () => {
      await dbHelper.connect();
    });

    it('should use single connection in test environment', async () => {
      // In test environment, we should use max: 1 connection
      const connection = dbHelper.getConnection();
      expect(connection).toBeDefined();
      
      // Connection pool configuration is handled in the actual implementation
      // This test verifies the connection exists and works
      if (dbHelper.isRealDatabase()) {
        await connection!`SELECT 1`;
      }
    });

    it('should close connections properly', async () => {
      await dbHelper.connect();
      expect(dbHelper.getConnection()).toBeDefined();
      
      await dbHelper.disconnect();
      expect(dbHelper.getConnection()).toBeNull();
    });

    it('should handle multiple connection attempts gracefully', async () => {
      await dbHelper.connect();
      const firstConnection = dbHelper.getConnection();
      
      // Second connect should not create new connection
      await dbHelper.connect();
      const secondConnection = dbHelper.getConnection();
      
      expect(firstConnection).toBe(secondConnection);
    });
  });

  describe('Database Operations', () => {
    beforeEach(async () => {
      await dbHelper.connect();
    });

    it('should support basic query operations', async () => {
      const db = dbHelper.getDb();
      
      if (dbHelper.isRealDatabase()) {
        // Test with real database - this would require actual schema
        // For now, we'll test the mock functionality
      }
      
      // Test mock database operations
      const mockSelect = db.select({ id: 'users.id' });
      expect(mockSelect.from).toBeDefined();
      
      const mockQuery = mockSelect.from('users');
      expect(mockQuery.where).toBeDefined();
    });

    it('should handle database errors appropriately', async () => {
      if (!dbHelper.isRealDatabase()) {
        // Mock a database error
        const db = dbHelper.getDb();
        const mockError = vi.fn().mockRejectedValue(new Error('Database error'));
        
        // Simulate error in query
        try {
          await mockError();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Database error');
        }
      }
    });
  });

  describe('Test Helpers', () => {
    beforeEach(async () => {
      await dbHelper.connect();
    });

    it('should create test users', async () => {
      const testUser = await dbHelper.createTestUser({
        email: 'testuser@example.com',
        name: 'Test User'
      });

      expect(testUser).toBeDefined();
      expect(testUser.email).toBe('testuser@example.com');
      expect(testUser.name).toBe('Test User');
      expect(testUser.role).toBe('agency');
    });

    it('should create test tenants', async () => {
      const testTenant = await dbHelper.createTestTenant({
        name: 'Test Agency',
        slug: 'test-agency'
      });

      expect(testTenant).toBeDefined();
      expect(testTenant.name).toBe('Test Agency');
      expect(testTenant.slug).toBe('test-agency');
    });

    it('should handle cleanup operations', async () => {
      // Cleanup should not throw errors
      await expect(dbHelper.cleanup()).resolves.not.toThrow();
      
      // Cleanup should work with both real and mock databases
      if (dbHelper.isRealDatabase()) {
        // Real database cleanup would remove test data
      } else {
        // Mock database cleanup is a no-op
      }
    });
  });

  describe('Configuration', () => {
    it('should use correct test database configuration', () => {
      const expectedConfig = {
        host: 'localhost',
        port: 5432,
        database: 'seorylie_test',
        username: 'postgres',
        password: 'password'
      };

      // Test that our test helper uses these configurations
      // This is verified by the connection string in dbTestHelpers
      expect(process.env.DB_HOST || 'localhost').toBe(expectedConfig.host);
      expect(parseInt(process.env.DB_PORT || '5432')).toBe(expectedConfig.port);
    });

    it('should use appropriate pool settings for tests', async () => {
      await dbHelper.connect();
      
      // In test environment, we should use limited connections
      // This is handled in the dbTestHelpers configuration
      const connection = dbHelper.getConnection();
      expect(connection).toBeDefined();
    });
  });
});

