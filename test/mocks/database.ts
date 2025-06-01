/**
 * In-memory database mock using pg-mem for testing
 *
 * This file provides a pg-mem adapter that creates an in-memory PostgreSQL database
 * compatible with Drizzle ORM for testing purposes.
 */

import { newDb, DataType } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/index';

// Type definitions for our mock database
export type MockDatabase = NodePgDatabase<typeof schema>;

interface DatabaseMock {
  db: MockDatabase;
  client: any;
  cleanup: () => Promise<void>;
  reset: () => Promise<void>;
}

// Enhanced mock database interface that supports method chaining
interface MockQueryBuilder {
  select: () => MockQueryBuilder;
  from: (table: any) => MockQueryBuilder;
  where: (condition: any) => MockQueryBuilder;
  limit: (count: number) => MockQueryBuilder;
  orderBy: (column: any) => MockQueryBuilder;
  insert: (table: any) => MockInsertBuilder;
  update: (table: any) => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  values: (data: any) => MockInsertBuilder;
  returning: (columns?: any) => Promise<any[]>;
  execute: () => Promise<any>;
  then: (callback: (result: any) => any) => Promise<any>;
}

interface MockInsertBuilder {
  values: (data: any) => MockInsertBuilder;
  returning: (columns?: any) => Promise<any[]>;
  execute: () => Promise<any>;
  then: (callback: (result: any) => any) => Promise<any>;
}

interface MockTransaction {
  select: () => MockQueryBuilder;
  insert: (table: any) => MockInsertBuilder;
  update: (table: any) => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
}

/**
 * Creates enhanced mock query builder with method chaining support
 */
function createMockQueryBuilder(client: any, mockData: any[] = []): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: () => builder,
    from: (table: any) => builder,
    where: (condition: any) => builder,
    limit: (count: number) => builder,
    orderBy: (column: any) => builder,
    insert: (table: any) => createMockInsertBuilder(client, table),
    update: (table: any) => builder,
    delete: () => builder,
    values: (data: any) => createMockInsertBuilder(client, null, data),
    returning: async (columns?: any) => {
      // Return mock data with generated IDs
      return mockData.length > 0 ? mockData : [
        { id: Math.floor(Math.random() * 1000), externalId: 'test-123', dealershipId: 1 }
      ];
    },
    execute: async () => ({ rows: mockData, rowCount: mockData.length }),
    then: async (callback: (result: any) => any) => {
      const result = mockData.length > 0 ? mockData : [
        { id: Math.floor(Math.random() * 1000), externalId: 'test-123', dealershipId: 1 }
      ];
      return callback(result);
    }
  };
  return builder;
}

/**
 * Creates enhanced mock insert builder with returning support
 */
function createMockInsertBuilder(client: any, table?: any, initialData?: any): MockInsertBuilder {
  let insertData = initialData || {};

  const builder: MockInsertBuilder = {
    values: (data: any) => {
      insertData = { ...insertData, ...data };
      return builder;
    },
    returning: async (columns?: any) => {
      // Return mock data with generated ID
      const result = {
        id: Math.floor(Math.random() * 1000),
        ...insertData,
        externalId: insertData.externalId || 'test-123',
        dealershipId: insertData.dealershipId || 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return [result];
    },
    execute: async () => {
      const result = {
        id: Math.floor(Math.random() * 1000),
        ...insertData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return { rows: [result], rowCount: 1 };
    },
    then: async (callback: (result: any) => any) => {
      const result = {
        id: Math.floor(Math.random() * 1000),
        ...insertData,
        externalId: insertData.externalId || 'test-123',
        dealershipId: insertData.dealershipId || 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return callback([result]);
    }
  };
  return builder;
}

/**
 * Creates a new in-memory database instance for testing
 */
export async function createMockDatabase(): Promise<DatabaseMock> {
  // Create new in-memory database
  const mem = newDb();

  // Add common PostgreSQL extensions and types that Drizzle might use
  mem.public.registerFunction({
    name: 'now',
    implementation: () => new Date(),
    returns: DataType.timestamptz,
  });

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => {
      // Simple UUID v4 generator
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    returns: DataType.uuid,
  });

  // Get node-postgres compatible adapter from pg-mem
  const { Client } = mem.adapters.createPg();
  const client = new Client();

  // Create Drizzle instance with schema and enhanced mock methods
  const db = drizzle(client, { schema }) as MockDatabase;

  // Add enhanced mock methods to support method chaining
  (db as any).transaction = async (callback: (tx: MockTransaction) => Promise<any>) => {
    const mockTx: MockTransaction = {
      select: () => createMockQueryBuilder(client),
      insert: (table: any) => createMockInsertBuilder(client, table),
      update: (table: any) => createMockQueryBuilder(client),
      delete: () => createMockQueryBuilder(client),
      rollback: async () => {},
      commit: async () => {}
    };
    return await callback(mockTx);
  };

  // Override default methods to support method chaining
  (db as any).select = () => createMockQueryBuilder(client);
  (db as any).insert = (table: any) => createMockInsertBuilder(client, table);
  (db as any).update = (table: any) => createMockQueryBuilder(client);
  (db as any).delete = () => createMockQueryBuilder(client);

  // Create all tables based on schema
  await createTables(client);

  return {
    db,
    client,
    cleanup: async () => {
      // Close any connections
      if (client && typeof client.end === 'function') {
        await client.end();
      }
    },
    reset: async () => {
      // Clear all data from tables
      await clearAllTables(client);
    }
  };
}

/**
 * Creates all necessary tables in the mock database
 */
async function createTables(client: any): Promise<void> {
  // Create tables using direct SQL execution on the pg-mem client
  // This creates the basic tables needed for testing
  
  // Users and dealerships first (no dependencies)
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL,
      password VARCHAR(100) NOT NULL,
      role VARCHAR(50) DEFAULT 'user' NOT NULL,
      dealership_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS dealerships (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      address TEXT,
      phone VARCHAR(20),
      email VARCHAR(100),
      website VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Create email messages table (matches schema.ts exactly)
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_messages (
      id SERIAL PRIMARY KEY,
      "from" VARCHAR(255) NOT NULL,
      "to" VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      is_html BOOLEAN DEFAULT true NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' NOT NULL,
      external_id VARCHAR(100),
      conversation_id INTEGER,
      dealership_id INTEGER NOT NULL,
      metadata JSONB,
      sent_at TIMESTAMP,
      delivered_at TIMESTAMP,
      failed_at TIMESTAMP,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Add other essential tables for testing
  await client.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dealership_id INTEGER NOT NULL,
      lead_id UUID,
      customer_id UUID,
      assigned_user_id INTEGER,
      subject VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      channel VARCHAR(50),
      is_ai_assisted BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      content TEXT NOT NULL,
      content_type VARCHAR(50) DEFAULT 'text',
      type VARCHAR(50) NOT NULL,
      sender VARCHAR(20) NOT NULL,
      sender_user_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
}

/**
 * Clears all data from test tables
 */
async function clearAllTables(client: any): Promise<void> {
  // Clear tables in reverse dependency order
  const tables = [
    'messages',
    'conversations', 
    'email_messages',
    'users',
    'dealerships'
  ];

  for (const table of tables) {
    try {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      // Ignore errors if table doesn't exist
      console.warn(`Could not truncate table ${table}:`, error);
    }
  }
}

/**
 * Global database mock instance for tests
 */
let globalMockDb: DatabaseMock | null = null;

/**
 * Gets or creates a global mock database instance
 */
export async function getGlobalMockDatabase(): Promise<DatabaseMock> {
  if (!globalMockDb) {
    globalMockDb = await createMockDatabase();
  }
  return globalMockDb;
}

/**
 * Resets the global mock database
 */
export async function resetGlobalMockDatabase(): Promise<void> {
  if (globalMockDb) {
    await globalMockDb.reset();
  }
}

/**
 * Cleans up the global mock database
 */
export async function cleanupGlobalMockDatabase(): Promise<void> {
  if (globalMockDb) {
    await globalMockDb.cleanup();
    globalMockDb = null;
  }
}

// Note: Using direct SQL queries with pg-mem client for table operations

export default createMockDatabase;