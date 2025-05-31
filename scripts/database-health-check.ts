#!/usr/bin/env npx tsx

import db, { executeQuery, checkDatabaseConnection } from '../server/db';
import { sql, eq } from 'drizzle-orm';
import logger from '../server/utils/logger';

// Import all tables from schemas
import * as mainSchema from '../shared/schema';
import * as leadSchema from '../shared/lead-management-schema';
import * as extSchema from '../shared/schema-extensions';

interface TableInfo {
  name: string;
  exists: boolean;
  count: number;
  indexes?: string[];
  foreignKeys?: string[];
  error?: string;
}

interface HealthCheckResults {
  connectionStatus: boolean;
  totalTables: number;
  tablesFound: number;
  tableDetails: TableInfo[];
  errors: string[];
  summary: {
    coreTablesHealthy: boolean;
    relationshipsHealthy: boolean;
    dataIntegrityHealthy: boolean;
  };
}

// Define all tables from the schemas
const ALL_TABLES = {
  // Main schema tables
  dealerships: mainSchema.dealerships,
  users: mainSchema.users,
  vehicles: mainSchema.vehicles,
  personas: mainSchema.personas,
  apiKeys: mainSchema.apiKeys,
  magicLinkInvitations: mainSchema.magicLinkInvitations,
  sessions: mainSchema.sessions,
  reportSchedules: mainSchema.reportSchedules,
  promptExperiments: mainSchema.promptExperiments,
  promptVariants: mainSchema.promptVariants,
  experimentVariants: mainSchema.experimentVariants,
  promptMetrics: mainSchema.promptMetrics,
  
  // Lead management schema tables
  leadSources: leadSchema.leadSourcesTable,
  customers: leadSchema.customers,
  vehicleInterests: leadSchema.vehicleInterests,
  leads: leadSchema.leads,
  conversations: leadSchema.conversations,
  messages: leadSchema.messages,
  handovers: leadSchema.handovers,
  leadActivities: leadSchema.leadActivities,
  
  // Extension schema tables
  escalationTriggers: extSchema.escalationTriggers,
  leadScores: extSchema.leadScores,
  followUps: extSchema.followUps,
  userInvitations: extSchema.userInvitations,
  auditLogs: extSchema.auditLogs,
  customerProfiles: extSchema.customerProfiles,
  customerInteractions: extSchema.customerInteractions,
  customerInsights: extSchema.customerInsights,
  responseSuggestions: extSchema.responseSuggestions,
};

const CORE_ENTITIES = ['dealerships', 'users', 'vehicles', 'conversations'];

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await executeQuery(async () => {
      return await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `);
    });
    return result[0]?.exists || false;
  } catch (error) {
    logger.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

async function getTableCount(table: any, tableName: string): Promise<number> {
  try {
    const result = await executeQuery(async () => {
      return await db.select({ count: sql`COUNT(*)` }).from(table);
    });
    return result[0]?.count || 0;
  } catch (error) {
    logger.error(`Error getting count for ${tableName}:`, error);
    return -1;
  }
}

async function checkTableIndexes(tableName: string): Promise<string[]> {
  try {
    const result = await executeQuery(async () => {
      return await db.execute(sql`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = ${tableName}
        AND schemaname = 'public'
      `);
    });
    return result.map((row: any) => row.indexname);
  } catch (error) {
    logger.error(`Error checking indexes for ${tableName}:`, error);
    return [];
  }
}

async function checkTableForeignKeys(tableName: string): Promise<string[]> {
  try {
    const result = await executeQuery(async () => {
      return await db.execute(sql`
        SELECT
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ${tableName}
        AND tc.table_schema = 'public'
      `);
    });
    return result.map((row: any) => row.constraint_name);
  } catch (error) {
    logger.error(`Error checking foreign keys for ${tableName}:`, error);
    return [];
  }
}

async function testCRUDOperations(): Promise<boolean> {
  try {
    // Test dealership CRUD
    logger.info('Testing CRUD operations on core entities...');
    
    // Create test dealership
    const testDealership = await executeQuery(async () => {
      return await db.insert(mainSchema.dealerships).values({
        name: 'Health Check Test Dealership',
        subdomain: `test-${Date.now()}`,
        contact_email: 'test@healthcheck.com',
        active: false // Mark as inactive so it doesn't interfere
      }).returning({ id: mainSchema.dealerships.id });
    });

    const dealershipId = testDealership[0].id;
    logger.info(`Created test dealership with ID: ${dealershipId}`);

    // Read operation
    const readResult = await executeQuery(async () => {
      return await db.select().from(mainSchema.dealerships)
        .where(eq(mainSchema.dealerships.id, dealershipId));
    });
    
    if (readResult.length !== 1) {
      throw new Error('Read operation failed');
    }

    // Update operation
    await executeQuery(async () => {
      return await db.update(mainSchema.dealerships)
        .set({ description: 'Updated by health check' })
        .where(eq(mainSchema.dealerships.id, dealershipId));
    });

    // Verify update
    const updatedResult = await executeQuery(async () => {
      return await db.select().from(mainSchema.dealerships)
        .where(eq(mainSchema.dealerships.id, dealershipId));
    });

    if (updatedResult[0].description !== 'Updated by health check') {
      throw new Error('Update operation failed');
    }

    // Delete operation
    await executeQuery(async () => {
      return await db.delete(mainSchema.dealerships)
        .where(eq(mainSchema.dealerships.id, dealershipId));
    });

    // Verify deletion
    const deletedResult = await executeQuery(async () => {
      return await db.select().from(mainSchema.dealerships)
        .where(eq(mainSchema.dealerships.id, dealershipId));
    });

    if (deletedResult.length !== 0) {
      throw new Error('Delete operation failed');
    }

    logger.info('CRUD operations test passed');
    return true;
  } catch (error) {
    logger.error('CRUD operations test failed:', error);
    return false;
  }
}

async function testForeignKeyConstraints(): Promise<boolean> {
  try {
    logger.info('Testing foreign key constraints...');
    
    // Try to insert a user with invalid dealership_id
    try {
      await executeQuery(async () => {
        return await db.insert(mainSchema.users).values({
          username: 'test-invalid-fk',
          email: 'test@invalid.com',
          dealership_id: 99999, // Non-existent dealership ID
        });
      });
      
      // If we get here, foreign key constraint failed
      logger.error('Foreign key constraint not enforced - should have failed');
      return false;
    } catch (error) {
      // This should fail due to foreign key constraint
      logger.info('Foreign key constraint properly enforced');
      return true;
    }
  } catch (error) {
    logger.error('Foreign key constraint test failed:', error);
    return false;
  }
}

async function testConnectionPooling(): Promise<boolean> {
  try {
    logger.info('Testing database connection pooling under load...');
    
    const concurrentQueries = 20;
    const queries = Array(concurrentQueries).fill(null).map(async (_, index) => {
      return executeQuery(async () => {
        const result = await db.execute(sql`SELECT ${index} as query_id, NOW() as timestamp`);
        return result[0];
      });
    });

    const startTime = Date.now();
    const results = await Promise.all(queries);
    const endTime = Date.now();

    logger.info(`Executed ${concurrentQueries} concurrent queries in ${endTime - startTime}ms`);
    
    if (results.length !== concurrentQueries) {
      throw new Error('Not all queries completed successfully');
    }

    return true;
  } catch (error) {
    logger.error('Connection pooling test failed:', error);
    return false;
  }
}

async function performHealthCheck(): Promise<HealthCheckResults> {
  const results: HealthCheckResults = {
    connectionStatus: false,
    totalTables: Object.keys(ALL_TABLES).length,
    tablesFound: 0,
    tableDetails: [],
    errors: [],
    summary: {
      coreTablesHealthy: false,
      relationshipsHealthy: false,
      dataIntegrityHealthy: false,
    }
  };

  logger.info('Starting comprehensive database health check...');

  // Check database connection
  results.connectionStatus = await checkDatabaseConnection();
  if (!results.connectionStatus) {
    results.errors.push('Database connection failed');
    return results;
  }

  logger.info('Database connection: ✅ HEALTHY');

  // Check each table
  for (const [tableName, table] of Object.entries(ALL_TABLES)) {
    const tableInfo: TableInfo = {
      name: tableName,
      exists: false,
      count: 0,
    };

    try {
      // Check if table exists
      tableInfo.exists = await checkTableExists(tableName);
      
      if (tableInfo.exists) {
        results.tablesFound++;
        
        // Get row count
        tableInfo.count = await getTableCount(table, tableName);
        
        // Get indexes
        tableInfo.indexes = await checkTableIndexes(tableName);
        
        // Get foreign keys
        tableInfo.foreignKeys = await checkTableForeignKeys(tableName);
        
        logger.info(`Table ${tableName}: ✅ EXISTS (${tableInfo.count} rows, ${tableInfo.indexes?.length || 0} indexes, ${tableInfo.foreignKeys?.length || 0} FK constraints)`);
      } else {
        logger.warn(`Table ${tableName}: ❌ MISSING`);
        results.errors.push(`Table ${tableName} does not exist`);
      }
    } catch (error) {
      tableInfo.error = error instanceof Error ? error.message : String(error);
      logger.error(`Table ${tableName}: ❌ ERROR - ${tableInfo.error}`);
      results.errors.push(`Error checking table ${tableName}: ${tableInfo.error}`);
    }

    results.tableDetails.push(tableInfo);
  }

  // Test CRUD operations
  const crudTest = await testCRUDOperations();
  results.summary.coreTablesHealthy = crudTest;

  // Test foreign key constraints
  const fkTest = await testForeignKeyConstraints();
  results.summary.relationshipsHealthy = fkTest;

  // Test connection pooling
  const poolingTest = await testConnectionPooling();
  results.summary.dataIntegrityHealthy = poolingTest;

  logger.info('Database health check completed');
  return results;
}

async function generateHealthReport(results: HealthCheckResults): Promise<string> {
  const report = `
# Database Health Check Report
Generated: ${new Date().toISOString()}

## Connection Status
${results.connectionStatus ? '✅ HEALTHY' : '❌ FAILED'}

## Table Summary
- Total Expected Tables: ${results.totalTables}
- Tables Found: ${results.tablesFound}
- Missing Tables: ${results.totalTables - results.tablesFound}

## Core Systems Health
- Core Tables: ${results.summary.coreTablesHealthy ? '✅ HEALTHY' : '❌ FAILED'}
- Foreign Key Relationships: ${results.summary.relationshipsHealthy ? '✅ HEALTHY' : '❌ FAILED'}
- Connection Pooling: ${results.summary.dataIntegrityHealthy ? '✅ HEALTHY' : '❌ FAILED'}

## Table Details
${results.tableDetails.map(table => `
### ${table.name}
- Exists: ${table.exists ? '✅' : '❌'}
- Row Count: ${table.count >= 0 ? table.count : 'Error'}
- Indexes: ${table.indexes?.length || 0}
- Foreign Keys: ${table.foreignKeys?.length || 0}
${table.error ? `- Error: ${table.error}` : ''}
`).join('')}

## Errors
${results.errors.length > 0 ? results.errors.map(error => `- ${error}`).join('\n') : 'No errors detected'}

## Recommendations
${results.tablesFound < results.totalTables ? '- Run database migrations to create missing tables' : ''}
${!results.summary.coreTablesHealthy ? '- Investigate CRUD operation failures' : ''}
${!results.summary.relationshipsHealthy ? '- Check foreign key constraint configuration' : ''}
${!results.summary.dataIntegrityHealthy ? '- Review database connection pool settings' : ''}
${results.errors.length === 0 && results.tablesFound === results.totalTables ? '✅ Database is healthy and ready for production use' : ''}
`;

  return report;
}

async function main() {
  try {
    const results = await performHealthCheck();
    const report = await generateHealthReport(results);
    
    console.log(report);
    
    // Save report to file
    const fs = await import('fs');
    const reportPath = './database-health-report.md';
    fs.writeFileSync(reportPath, report);
    
    logger.info(`Health check report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    const allHealthy = results.connectionStatus && 
                      results.tablesFound === results.totalTables && 
                      results.summary.coreTablesHealthy && 
                      results.summary.relationshipsHealthy && 
                      results.summary.dataIntegrityHealthy;
    
    process.exit(allHealthy ? 0 : 1);
  } catch (error) {
    logger.error('Health check failed:', error);
    process.exit(1);
  }
}

// Check if this is the main module by checking import.meta.url
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { performHealthCheck, generateHealthReport, testCRUDOperations, testForeignKeyConstraints, testConnectionPooling };