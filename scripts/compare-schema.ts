#!/usr/bin/env tsx
/**
 * Enhanced Schema Comparison Tool
 * 
 * This script provides comprehensive comparison between live PostgreSQL database
 * and Drizzle schema definitions in shared/schema.ts.
 * 
 * Features:
 * - Introspects database using information_schema
 * - Parses Drizzle pgTable metadata with type information
 * - Detects missing columns, type mismatches, naming conflicts
 * - Compares constraints, indexes, and foreign keys
 * - Generates detailed reports for CI/CD integration
 * 
 * Usage:
 *   tsx scripts/compare-schema.ts [--format=json|table] [--output=file.json]
 */

import { Client } from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Enhanced interfaces for comprehensive comparison
interface DbColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_primary_key: boolean;
  foreign_key_table: string | null;
  foreign_key_column: string | null;
}

interface DbIndex {
  table_name: string;
  index_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

interface SchemaColumn {
  table: string;
  column: string;
  drizzleType: string;
  pgType: string;
  nullable: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  references?: {
    table: string;
    column: string;
  };
}

interface SchemaIndex {
  table: string;
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

interface ComparisonReport {
  summary: {
    tablesInDb: number;
    tablesInSchema: number;
    columnsInDb: number;
    columnsInSchema: number;
    indexesInDb: number;
    indexesInSchema: number;
    totalIssues: number;
  };
  missingTables: {
    inDb: string[];
    inSchema: string[];
  };
  missingColumns: {
    inDb: Array<{ table: string; column: string; type: string }>;
    inSchema: Array<{ table: string; column: string; type: string }>;
  };
  typeMismatches: Array<{
    table: string;
    column: string;
    dbType: string;
    schemaType: string;
    severity: 'error' | 'warning';
  }>;
  nullabilityMismatches: Array<{
    table: string;
    column: string;
    dbNullable: boolean;
    schemaNullable: boolean;
  }>;
  namingConflicts: Array<{
    table: string;
    dbColumn: string;
    schemaColumn: string;
  }>;
  constraintMismatches: Array<{
    table: string;
    column: string;
    type: 'primary_key' | 'foreign_key';
    dbValue: any;
    schemaValue: any;
  }>;
  indexMismatches: {
    missingInDb: SchemaIndex[];
    missingInSchema: DbIndex[];
  };
  recommendations: string[];
}

/**
 * Introspect live PostgreSQL database structure
 */
async function introspectDatabase(): Promise<{
  columns: DbColumn[];
  indexes: DbIndex[];
  tables: string[];
}> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
  });
  
  await client.connect();
  
  try {
    // Get all tables in public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    // Get detailed column information with constraints
    const columnsResult = await client.query(`
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        fk.foreign_table_name as foreign_key_table,
        fk.foreign_column_name as foreign_key_column
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT 
          ku.table_name,
          ku.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `);
    
    // Get index information
    const indexesResult = await client.query(`
      SELECT 
        t.relname as table_name,
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary
      FROM 
        pg_class t,
        pg_class i,
        pg_index ix,
        pg_attribute a,
        pg_namespace n
      WHERE 
        t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
        AND n.oid = t.relnamespace
        AND n.nspname = 'public'
      ORDER BY t.relname, i.relname
    `);
    
    return {
      tables: tablesResult.rows.map(row => row.table_name),
      columns: columnsResult.rows,
      indexes: indexesResult.rows
    };
  } finally {
    await client.end();
  }
}

/**
 * Parse Drizzle schema file with enhanced type extraction
 */
function parseSchemaFile(): {
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  tables: string[];
} {
  const schemaPath = join(process.cwd(), 'shared/schema.ts');
  const content = readFileSync(schemaPath, 'utf-8');
  
  const columns: SchemaColumn[] = [];
  const indexes: SchemaIndex[] = [];
  const tables: string[] = [];
  
  // Enhanced regex to match pgTable definitions with their complete structure
  const tableRegex = /export const (\w+) = pgTable\s*\(\s*['"`](\w+)['"`]\s*,\s*\{([\s\S]*?)\}(?:\s*,\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\})?\s*\)/g;
  
  let tableMatch;
  while ((tableMatch = tableRegex.exec(content)) !== null) {
    const [, tsName, dbName, columnsBlock, indexesBlock] = tableMatch;
    tables.push(dbName);
    
    // Parse column definitions
    parseTableColumns(dbName, columnsBlock, columns);
    
    // Parse indexes if present
    if (indexesBlock) {
      parseTableIndexes(dbName, indexesBlock, indexes);
    }
  }
  
  return { columns, indexes, tables };
}

/**
 * Parse column definitions from a table block
 */
function parseTableColumns(tableName: string, columnsBlock: string, columns: SchemaColumn[]): void {
  // Match column definitions with their types and modifiers
  const columnRegex = /(\w+):\s*(\w+)\([^)]*\)([^,}]*)/g;
  
  let columnMatch;
  while ((columnMatch = columnRegex.exec(columnsBlock)) !== null) {
    const [, columnName, drizzleType, modifiers] = columnMatch;
    
    const column: SchemaColumn = {
      table: tableName,
      column: columnName,
      drizzleType,
      pgType: mapDrizzleTypeToPg(drizzleType, modifiers),
      nullable: !modifiers.includes('.notNull()'),
      hasDefault: modifiers.includes('.default(') || modifiers.includes('.defaultNow()'),
      isPrimaryKey: modifiers.includes('.primaryKey()')
    };
    
    // Extract length constraints
    const lengthMatch = modifiers.match(/length:\s*(\d+)/);
    if (lengthMatch) {
      column.length = parseInt(lengthMatch[1]);
    }
    
    // Extract precision and scale for decimals
    const precisionMatch = modifiers.match(/precision:\s*(\d+)/);
    const scaleMatch = modifiers.match(/scale:\s*(\d+)/);
    if (precisionMatch) {
      column.precision = parseInt(precisionMatch[1]);
    }
    if (scaleMatch) {
      column.scale = parseInt(scaleMatch[1]);
    }
    
    columns.push(column);
  }
}

/**
 * Parse index definitions from table index block
 */
function parseTableIndexes(tableName: string, indexesBlock: string, indexes: SchemaIndex[]): void {
  // Match index definitions
  const indexRegex = /(\w+):\s*(?:unique\()?index\(['"`]([^'"`]+)['"`]\)\.on\(([^)]+)\)/g;
  
  let indexMatch;
  while ((indexMatch = indexRegex.exec(indexesBlock)) !== null) {
    const [, indexVar, indexName, columnsExpr] = indexMatch;
    
    // Extract column names from the .on() expression
    const columnMatches = columnsExpr.match(/table\.(\w+)/g) || [];
    const columnNames = columnMatches.map(match => match.replace('table.', ''));
    
    indexes.push({
      table: tableName,
      name: indexName,
      columns: columnNames,
      unique: indexesBlock.includes('unique('),
      primary: false // Primary keys are handled separately
    });
  }
}

/**
 * Map Drizzle column types to PostgreSQL types
 */
function mapDrizzleTypeToPg(drizzleType: string, modifiers: string): string {
  const typeMap: Record<string, string> = {
    'serial': 'integer',
    'integer': 'integer',
    'varchar': 'character varying',
    'text': 'text',
    'boolean': 'boolean',
    'timestamp': 'timestamp without time zone',
    'date': 'date',
    'decimal': 'numeric',
    'json': 'json',
    'uuid': 'uuid'
  };
  
  return typeMap[drizzleType] || drizzleType;
}

/**
 * Generate comprehensive comparison report
 */
function generateReport(
  dbData: { columns: DbColumn[]; indexes: DbIndex[]; tables: string[] },
  schemaData: { columns: SchemaColumn[]; indexes: SchemaIndex[]; tables: string[] }
): ComparisonReport {
  const report: ComparisonReport = {
    summary: {
      tablesInDb: dbData.tables.length,
      tablesInSchema: schemaData.tables.length,
      columnsInDb: dbData.columns.length,
      columnsInSchema: schemaData.columns.length,
      indexesInDb: dbData.indexes.length,
      indexesInSchema: schemaData.indexes.length,
      totalIssues: 0
    },
    missingTables: {
      inDb: [],
      inSchema: []
    },
    missingColumns: {
      inDb: [],
      inSchema: []
    },
    typeMismatches: [],
    nullabilityMismatches: [],
    namingConflicts: [],
    constraintMismatches: [],
    indexMismatches: {
      missingInDb: [],
      missingInSchema: []
    },
    recommendations: []
  };
  
  // Compare tables
  const dbTables = new Set(dbData.tables);
  const schemaTables = new Set(schemaData.tables);
  
  for (const table of schemaTables) {
    if (!dbTables.has(table)) {
      report.missingTables.inDb.push(table);
    }
  }
  
  for (const table of dbTables) {
    if (!schemaTables.has(table)) {
      report.missingTables.inSchema.push(table);
    }
  }
  
  // Create lookup maps for columns
  const dbColumnMap = new Map<string, DbColumn>();
  const schemaColumnMap = new Map<string, SchemaColumn>();
  
  dbData.columns.forEach(col => {
    const key = `${col.table_name}.${col.column_name}`;
    const camelKey = `${col.table_name}.${toCamelCase(col.column_name)}`;
    dbColumnMap.set(key, col);
    dbColumnMap.set(camelKey, col);
  });
  
  schemaData.columns.forEach(col => {
    const key = `${col.table}.${col.column}`;
    const snakeKey = `${col.table}.${toSnakeCase(col.column)}`;
    schemaColumnMap.set(key, col);
    schemaColumnMap.set(snakeKey, col);
  });
  
  // Compare columns
  for (const schemaCol of schemaData.columns) {
    const key = `${schemaCol.table}.${schemaCol.column}`;
    const snakeKey = `${schemaCol.table}.${toSnakeCase(schemaCol.column)}`;
    
    const dbCol = dbColumnMap.get(key) || dbColumnMap.get(snakeKey);
    
    if (!dbCol) {
      report.missingColumns.inDb.push({
        table: schemaCol.table,
        column: schemaCol.column,
        type: schemaCol.drizzleType
      });
      continue;
    }
    
    // Check for naming conflicts (snake_case vs camelCase)
    if (dbCol.column_name !== schemaCol.column) {
      const expectedSnakeCase = toSnakeCase(schemaCol.column);
      if (dbCol.column_name === expectedSnakeCase) {
        report.namingConflicts.push({
          table: schemaCol.table,
          dbColumn: dbCol.column_name,
          schemaColumn: schemaCol.column
        });
      }
    }
    
    // Check type compatibility
    if (!areTypesCompatible(dbCol.data_type, schemaCol.pgType)) {
      report.typeMismatches.push({
        table: schemaCol.table,
        column: schemaCol.column,
        dbType: dbCol.data_type,
        schemaType: schemaCol.pgType,
        severity: getTypeMismatchSeverity(dbCol.data_type, schemaCol.pgType)
      });
    }
    
    // Check nullability
    const dbNullable = dbCol.is_nullable === 'YES';
    if (dbNullable !== schemaCol.nullable) {
      report.nullabilityMismatches.push({
        table: schemaCol.table,
        column: schemaCol.column,
        dbNullable,
        schemaNullable: schemaCol.nullable
      });
    }
    
    // Check primary key constraints
    if (dbCol.is_primary_key !== schemaCol.isPrimaryKey) {
      report.constraintMismatches.push({
        table: schemaCol.table,
        column: schemaCol.column,
        type: 'primary_key',
        dbValue: dbCol.is_primary_key,
        schemaValue: schemaCol.isPrimaryKey
      });
    }
  }
  
  // Find columns in DB but not in schema
  for (const dbCol of dbData.columns) {
    const key = `${dbCol.table_name}.${dbCol.column_name}`;
    const camelKey = `${dbCol.table_name}.${toCamelCase(dbCol.column_name)}`;
    
    if (!schemaColumnMap.has(key) && !schemaColumnMap.has(camelKey)) {
      report.missingColumns.inSchema.push({
        table: dbCol.table_name,
        column: dbCol.column_name,
        type: dbCol.data_type
      });
    }
  }
  
  // Compare indexes (simplified - focusing on named indexes from schema)
  const dbIndexMap = new Map<string, DbIndex[]>();
  dbData.indexes.forEach(idx => {
    const key = idx.table_name;
    if (!dbIndexMap.has(key)) dbIndexMap.set(key, []);
    dbIndexMap.get(key)!.push(idx);
  });
  
  for (const schemaIdx of schemaData.indexes) {
    const dbIndexes = dbIndexMap.get(schemaIdx.table) || [];
    const found = dbIndexes.some(dbIdx => 
      dbIdx.index_name === schemaIdx.name || 
      dbIdx.index_name === `${schemaIdx.table}_${schemaIdx.name}`
    );
    
    if (!found) {
      report.indexMismatches.missingInDb.push(schemaIdx);
    }
  }
  
  // Generate recommendations
  generateRecommendations(report);
  
  // Calculate total issues
  report.summary.totalIssues = 
    report.missingTables.inDb.length +
    report.missingTables.inSchema.length +
    report.missingColumns.inDb.length +
    report.missingColumns.inSchema.length +
    report.typeMismatches.length +
    report.nullabilityMismatches.length +
    report.constraintMismatches.length +
    report.indexMismatches.missingInDb.length +
    report.indexMismatches.missingInSchema.length;
  
  return report;
}

/**
 * Check if database and schema types are compatible
 */
function areTypesCompatible(dbType: string, schemaType: string): boolean {
  // Normalize types for comparison
  const normalizedDbType = dbType.toLowerCase().replace(/\([^)]*\)/g, '');
  const normalizedSchemaType = schemaType.toLowerCase().replace(/\([^)]*\)/g, '');
  
  // Define compatibility rules
  const compatibilityMap: Record<string, string[]> = {
    'integer': ['integer', 'int4', 'serial'],
    'character varying': ['varchar', 'character varying', 'text'],
    'text': ['text', 'varchar', 'character varying'],
    'boolean': ['boolean', 'bool'],
    'timestamp without time zone': ['timestamp', 'timestamp without time zone'],
    'timestamp with time zone': ['timestamptz', 'timestamp with time zone'],
    'numeric': ['decimal', 'numeric'],
    'json': ['json', 'jsonb'],
    'uuid': ['uuid']
  };
  
  return normalizedDbType === normalizedSchemaType ||
    compatibilityMap[normalizedDbType]?.includes(normalizedSchemaType) ||
    compatibilityMap[normalizedSchemaType]?.includes(normalizedDbType) ||
    false;
}

/**
 * Determine severity of type mismatch
 */
function getTypeMismatchSeverity(dbType: string, schemaType: string): 'error' | 'warning' {
  // Some type differences are more critical than others
  const criticalMismatches = [
    ['integer', 'text'],
    ['boolean', 'integer'],
    ['timestamp', 'text'],
    ['json', 'text']
  ];
  
  const isCritical = criticalMismatches.some(([type1, type2]) => 
    (dbType.includes(type1) && schemaType.includes(type2)) ||
    (dbType.includes(type2) && schemaType.includes(type1))
  );
  
  return isCritical ? 'error' : 'warning';
}

/**
 * Generate actionable recommendations based on findings
 */
function generateRecommendations(report: ComparisonReport): void {
  const recommendations = report.recommendations;
  
  if (report.missingTables.inDb.length > 0) {
    recommendations.push(
      `🏗️  Create missing tables in database: ${report.missingTables.inDb.join(', ')}`
    );
  }
  
  if (report.missingTables.inSchema.length > 0) {
    recommendations.push(
      `📝 Add missing table definitions to schema: ${report.missingTables.inSchema.join(', ')}`
    );
  }
  
  if (report.missingColumns.inDb.length > 0) {
    recommendations.push(
      `➕ Run database migration to add ${report.missingColumns.inDb.length} missing columns`
    );
  }
  
  if (report.missingColumns.inSchema.length > 0) {
    recommendations.push(
      `📋 Update schema to include ${report.missingColumns.inSchema.length} database columns or mark as legacy`
    );
  }
  
  if (report.typeMismatches.filter(m => m.severity === 'error').length > 0) {
    recommendations.push(
      `⚠️  Fix critical type mismatches that may cause runtime errors`
    );
  }
  
  if (report.namingConflicts.length > 0) {
    recommendations.push(
      `🔄 Consider standardizing column naming (snake_case vs camelCase) for consistency`
    );
  }
  
  if (report.indexMismatches.missingInDb.length > 0) {
    recommendations.push(
      `🚀 Create missing indexes for better query performance`
    );
  }
  
  if (report.summary.totalIssues === 0) {
    recommendations.push(
      `✨ Schema is perfectly synchronized! Consider setting up automated monitoring.`
    );
  }
}

/**
 * Utility functions for case conversion
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Format and display the comparison report
 */
function displayReport(report: ComparisonReport, format: 'table' | 'json' = 'table'): void {
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 DATABASE SCHEMA COMPARISON REPORT');
  console.log('='.repeat(80));
  
  // Summary section
  console.log('\n📈 SUMMARY:');
  console.log(`   Tables:  DB=${report.summary.tablesInDb} | Schema=${report.summary.tablesInSchema}`);
  console.log(`   Columns: DB=${report.summary.columnsInDb} | Schema=${report.summary.columnsInSchema}`);
  console.log(`   Indexes: DB=${report.summary.indexesInDb} | Schema=${report.summary.indexesInSchema}`);
  console.log(`   Issues:  ${report.summary.totalIssues} total`);
  
  // Missing tables
  if (report.missingTables.inDb.length > 0 || report.missingTables.inSchema.length > 0) {
    console.log('\n🏗️  MISSING TABLES:');
    if (report.missingTables.inDb.length > 0) {
      console.log('   Missing in Database:');
      report.missingTables.inDb.forEach(table => console.log(`     ❌ ${table}`));
    }
    if (report.missingTables.inSchema.length > 0) {
      console.log('   Missing in Schema:');
      report.missingTables.inSchema.forEach(table => console.log(`     ❌ ${table}`));
    }
  }
  
  // Missing columns
  if (report.missingColumns.inDb.length > 0 || report.missingColumns.inSchema.length > 0) {
    console.log('\n🔗 MISSING COLUMNS:');
    if (report.missingColumns.inDb.length > 0) {
      console.log('   Missing in Database:');
      report.missingColumns.inDb.forEach(col => 
        console.log(`     ❌ ${col.table}.${col.column} (${col.type})`)
      );
    }
    if (report.missingColumns.inSchema.length > 0) {
      console.log('   Missing in Schema:');
      report.missingColumns.inSchema.forEach(col => 
        console.log(`     ❌ ${col.table}.${col.column} (${col.type})`)
      );
    }
  }
  
  // Type mismatches
  if (report.typeMismatches.length > 0) {
    console.log('\n🎯 TYPE MISMATCHES:');
    const errors = report.typeMismatches.filter(m => m.severity === 'error');
    const warnings = report.typeMismatches.filter(m => m.severity === 'warning');
    
    if (errors.length > 0) {
      console.log('   Critical Errors:');
      errors.forEach(mismatch => 
        console.log(`     🚨 ${mismatch.table}.${mismatch.column}: ${mismatch.dbType} ≠ ${mismatch.schemaType}`)
      );
    }
    
    if (warnings.length > 0) {
      console.log('   Warnings:');
      warnings.forEach(mismatch => 
        console.log(`     ⚠️  ${mismatch.table}.${mismatch.column}: ${mismatch.dbType} ≠ ${mismatch.schemaType}`)
      );
    }
  }
  
  // Nullability mismatches
  if (report.nullabilityMismatches.length > 0) {
    console.log('\n🔒 NULLABILITY MISMATCHES:');
    report.nullabilityMismatches.forEach(mismatch => {
      const dbStatus = mismatch.dbNullable ? 'NULL' : 'NOT NULL';
      const schemaStatus = mismatch.schemaNullable ? 'NULL' : 'NOT NULL';
      console.log(`     ⚠️  ${mismatch.table}.${mismatch.column}: DB=${dbStatus} | Schema=${schemaStatus}`);
    });
  }
  
  // Naming conflicts
  if (report.namingConflicts.length > 0) {
    console.log('\n📝 NAMING CONFLICTS:');
    report.namingConflicts.forEach(conflict => 
      console.log(`     🔄 ${conflict.table}: DB="${conflict.dbColumn}" | Schema="${conflict.schemaColumn}"`)
    );
  }
  
  // Constraint mismatches
  if (report.constraintMismatches.length > 0) {
    console.log('\n🔑 CONSTRAINT MISMATCHES:');
    report.constraintMismatches.forEach(constraint => 
      console.log(`     ❗ ${constraint.table}.${constraint.column} (${constraint.type}): DB=${constraint.dbValue} | Schema=${constraint.schemaValue}`)
    );
  }
  
  // Index mismatches
  if (report.indexMismatches.missingInDb.length > 0 || report.indexMismatches.missingInSchema.length > 0) {
    console.log('\n📇 INDEX MISMATCHES:');
    if (report.indexMismatches.missingInDb.length > 0) {
      console.log('   Missing in Database:');
      report.indexMismatches.missingInDb.forEach(idx => 
        console.log(`     ❌ ${idx.table}.${idx.name} on [${idx.columns.join(', ')}]`)
      );
    }
    if (report.indexMismatches.missingInSchema.length > 0) {
      console.log('   Missing in Schema:');
      report.indexMismatches.missingInSchema.forEach(idx => 
        console.log(`     ❌ ${idx.table_name}.${idx.index_name}`)
      );
    }
  }
  
  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => 
      console.log(`   ${index + 1}. ${rec}`)
    );
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Final status
  if (report.summary.totalIssues === 0) {
    console.log('✅ Schema is perfectly synchronized!');
  } else {
    console.log(`❌ Found ${report.summary.totalIssues} schema issue${report.summary.totalIssues !== 1 ? 's' : ''}`);
  }
  
  console.log('='.repeat(80) + '\n');
}

/**
 * Parse command line arguments
 */
function parseArgs(): { format: 'table' | 'json'; output?: string; help: boolean } {
  const args = process.argv.slice(2);
  const result = { format: 'table' as 'table' | 'json', output: undefined as string | undefined, help: false };
  
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1];
      if (format === 'json' || format === 'table') {
        result.format = format;
      }
    } else if (arg.startsWith('--output=')) {
      result.output = arg.split('=')[1];
    }
  }
  
  return result;
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
📊 Schema Comparison Tool

USAGE:
  tsx scripts/compare-schema.ts [OPTIONS]

OPTIONS:
  --format=table|json    Output format (default: table)
  --output=FILE         Save JSON report to file
  --help, -h            Show this help message

EXAMPLES:
  tsx scripts/compare-schema.ts
  tsx scripts/compare-schema.ts --format=json
  tsx scripts/compare-schema.ts --format=json --output=schema-report.json

ENVIRONMENT VARIABLES:
  DATABASE_URL or POSTGRES_URL - PostgreSQL connection string

EXIT CODES:
  0 - Schema is synchronized
  1 - Schema issues found
  2 - Error during comparison
`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const args = parseArgs();
  
  if (args.help) {
    displayHelp();
    return;
  }
  
  const startTime = Date.now();
  
  try {
    console.log('🔍 Starting schema comparison...');
    console.log('📊 Introspecting database...');
    
    const [dbData, schemaData] = await Promise.all([
      introspectDatabase(),
      Promise.resolve(parseSchemaFile())
    ]);
    
    console.log('⚙️  Analyzing differences...');
    const report = generateReport(dbData, schemaData);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${duration}ms`);
    
    // Save to file if requested
    if (args.output) {
      writeFileSync(args.output, JSON.stringify(report, null, 2));
      console.log(`💾 Report saved to ${args.output}`);
    }
    
    // Display report
    displayReport(report, args.format);
    
    // Set exit code based on findings
    if (report.summary.totalIssues === 0) {
      process.exit(0);
    } else {
      console.log(`\n🚨 Schema validation failed: ${report.summary.totalIssues} issues found`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Schema comparison failed:');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    } else {
      console.error(`   Unknown error: ${String(error)}`);
    }
    
    // Check for common issues
    if (String(error).includes('ECONNREFUSED') || String(error).includes('ENOTFOUND')) {
      console.error('\n💡 TIP: Make sure your database is running and DATABASE_URL is set correctly.');
    } else if (String(error).includes('shared/schema.ts')) {
      console.error('\n💡 TIP: Make sure the schema file exists at shared/schema.ts');
    }
    
    process.exit(2);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
