/**
 * @file Database Test Helpers
 * @description Async test helpers for database operations and connection management
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'seorylie_test',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
};

// Test connection instances
let testConnection: ReturnType<typeof postgres> | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

/**
 * Database Test Helper Class
 */
export class DatabaseTestHelper {
  private static instance: DatabaseTestHelper;
  private connection: ReturnType<typeof postgres> | null = null;
  private db: ReturnType<typeof drizzle> | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseTestHelper {
    if (!DatabaseTestHelper.instance) {
      DatabaseTestHelper.instance = new DatabaseTestHelper();
    }
    return DatabaseTestHelper.instance;
  }

  /**
   * Connect to test database
   */
  async connect(): Promise<void> {
    if (this.connection) {
      return; // Already connected
    }

    try {
      const connectionUrl = `postgresql://${TEST_DB_CONFIG.username}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/${TEST_DB_CONFIG.database}`;
      
      this.connection = postgres(connectionUrl, {
        max: 1, // Single connection for tests
        idle_timeout: 5,
        connect_timeout: 5,
        prepare: false // Disable prepared statements in tests
      });

      this.db = drizzle(this.connection);

      // Test the connection
      await this.connection`SELECT 1`;
    } catch (error) {
      console.warn('Test database connection failed, using mock:', error);
      this.setupMockDatabase();
    }
  }

  /**
   * Setup mock database for environments without PostgreSQL
   */
  private setupMockDatabase(): void {
    // Mock connection and database for tests without real DB
    this.connection = {
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    } as any;

    this.db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: '1', email: 'test@test.com' }])
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '1' }])
          })
        })
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    } as any;
  }

  /**
   * Get database instance
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get connection instance
   */
  getConnection() {
    return this.connection;
  }

  /**
   * Check if using real database
   */
  isRealDatabase(): boolean {
    return this.connection && !vi.isMockFunction(this.connection.query);
  }

  /**
   * Disconnect from test database
   */
  async disconnect(): Promise<void> {
    if (this.connection && this.isRealDatabase()) {
      await this.connection.end();
    }
    this.connection = null;
    this.db = null;
  }

  /**
   * Clean up test data (only for real database)
   */
  async cleanup(): Promise<void> {
    if (!this.isRealDatabase() || !this.connection) {
      return;
    }

    try {
      // Clean up test data - add table names as needed
      const tables = ['users', 'tenants', 'audit_logs'];
      
      for (const table of tables) {
        await this.connection`DELETE FROM ${this.connection(table)} WHERE created_at > NOW() - INTERVAL '1 hour'`;
      }
    } catch (error) {
      console.warn('Database cleanup failed:', error);
    }
  }

  /**
   * Create test user
   */
  async createTestUser(overrides: Partial<any> = {}): Promise<any> {
    const defaultUser = {
      id: `test-user-${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      name: 'Test User',
      role: 'agency',
      tenantId: 'test-tenant',
      isActive: true,
      ...overrides
    };

    if (this.isRealDatabase()) {
      // Insert real test user
      const [user] = await this.db!.insert(this.getUsersTable()).values(defaultUser).returning();
      return user;
    } else {
      // Return mock user
      return defaultUser;
    }
  }

  /**
   * Create test tenant
   */
  async createTestTenant(overrides: Partial<any> = {}): Promise<any> {
    const defaultTenant = {
      id: `test-tenant-${Date.now()}`,
      name: 'Test Agency',
      slug: `test-agency-${Date.now()}`,
      brand: { companyName: 'Test Agency' },
      ...overrides
    };

    if (this.isRealDatabase()) {
      // Insert real test tenant
      const [tenant] = await this.db!.insert(this.getTenantsTable()).values(defaultTenant).returning();
      return tenant;
    } else {
      // Return mock tenant
      return defaultTenant;
    }
  }

  /**
   * Get users table reference (mock for now, replace with actual schema)
   */
  private getUsersTable(): any {
    return { name: 'users' }; // Replace with actual schema import
  }

  /**
   * Get tenants table reference (mock for now, replace with actual schema)
   */
  private getTenantsTable(): any {
    return { name: 'tenants' }; // Replace with actual schema import
  }
}

/**
 * Setup test database hooks
 */
export function setupTestDatabase() {
  const dbHelper = DatabaseTestHelper.getInstance();

  beforeAll(async () => {
    await dbHelper.connect();
  });

  afterAll(async () => {
    await dbHelper.disconnect();
  });

  beforeEach(async () => {
    // Setup for each test
  });

  afterEach(async () => {
    await dbHelper.cleanup();
  });

  return dbHelper;
}

/**
 * Async test utilities
 */
export const testUtils = {
  /**
   * Wait for condition to be true
   */
  waitFor: async (condition: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Create mock request object
   */
  createMockRequest: (overrides: any = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    traceId: 'test-trace-id',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides
  }),

  /**
   * Create mock response object
   */
  createMockResponse: () => {
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
    return res;
  },

  /**
   * Create mock next function
   */
  createMockNext: () => vi.fn(),

  /**
   * Sleep utility for async tests
   */
  sleep: (ms: number): Promise<void> => 
    new Promise(resolve => setTimeout(resolve, ms)),
};

// Export default helper instance
export default DatabaseTestHelper.getInstance();

