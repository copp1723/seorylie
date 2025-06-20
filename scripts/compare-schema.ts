#!/usr/bin/env tsx
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

interface DbColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface SchemaColumn {
  table: string;
  column: string;
  type: string;
  nullable: boolean;
}

async function introspectDatabase(): Promise<DbColumn[]> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
  });
  
  await client.connect();
  
  const result = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  
  await client.end();
  return result.rows;
}

function parseSchemaFile(): SchemaColumn[] {
  const schemaPath = join(process.cwd(), 'shared/schema.ts');
  const content = readFileSync(schemaPath, 'utf-8');
  
  // Simple regex parsing - could be enhanced with AST
  const tableMatches = content.match(/export const (\w+) = pgTable\(['"`](\w+)['"`]/g) || [];
  const columns: SchemaColumn[] = [];
  
  tableMatches.forEach(match => {
    const [, tsName, dbName] = match.match(/export const (\w+) = pgTable\(['"`](\w+)['"`]/) || [];
    if (!tsName || !dbName) return;
    
    // Extract column definitions (simplified)
    const tableStart = content.indexOf(match);
    const tableEnd = content.indexOf('});', tableStart);
    const tableContent = content.slice(tableStart, tableEnd);
    
    const columnMatches = tableContent.match(/(\w+):\s*pg\w+\(/g) || [];
    columnMatches.forEach(colMatch => {
      const [, colName] = colMatch.match(/(\w+):/) || [];
      if (colName) {
        columns.push({
          table: dbName,
          column: colName,
          type: 'unknown', // Would need more sophisticated parsing
          nullable: false
        });
      }
    });
  });
  
  return columns;
}

function generateReport(dbCols: DbColumn[], schemaCols: SchemaColumn[]) {
  const report = {
    missingInSchema: [] as string[],
    missingInDb: [] as string[],
    namingMismatches: [] as string[],
    summary: { total: 0, issues: 0 }
  };
  
  const dbMap = new Map<string, DbColumn>();
  dbCols.forEach(col => dbMap.set(`${col.table_name}.${col.column_name}`, col));
  
  const schemaMap = new Map<string, SchemaColumn>();
  schemaCols.forEach(col => schemaMap.set(`${col.table}.${col.column}`, col));
  
  // Find missing columns
  dbCols.forEach(dbCol => {
    const key = `${dbCol.table_name}.${dbCol.column_name}`;
    const camelKey = `${dbCol.table_name}.${toCamelCase(dbCol.column_name)}`;
    
    if (!schemaMap.has(key) && !schemaMap.has(camelKey)) {
      report.missingInSchema.push(`${dbCol.table_name}.${dbCol.column_name}`);
    }
  });
  
  schemaCols.forEach(schemaCol => {
    const key = `${schemaCol.table}.${schemaCol.column}`;
    const snakeKey = `${schemaCol.table}.${toSnakeCase(schemaCol.column)}`;
    
    if (!dbMap.has(key) && !dbMap.has(snakeKey)) {
      report.missingInDb.push(`${schemaCol.table}.${schemaCol.column}`);
    }
  });
  
  // Find naming mismatches
  dbCols.forEach(dbCol => {
    const camelCase = toCamelCase(dbCol.column_name);
    const schemaKey = `${dbCol.table_name}.${camelCase}`;
    
    if (schemaMap.has(schemaKey) && dbCol.column_name !== camelCase) {
      report.namingMismatches.push(`${dbCol.table_name}: ${dbCol.column_name} ↔ ${camelCase}`);
    }
  });
  
  report.summary.total = dbCols.length + schemaCols.length;
  report.summary.issues = report.missingInSchema.length + report.missingInDb.length + report.namingMismatches.length;
  
  return report;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

async function main() {
  try {
    console.log('🔍 Comparing database schema with TypeScript definitions...\n');
    
    const [dbColumns, schemaColumns] = await Promise.all([
      introspectDatabase(),
      Promise.resolve(parseSchemaFile())
    ]);
    
    const report = generateReport(dbColumns, schemaColumns);
    
    console.log('📊 SCHEMA COMPARISON REPORT');
    console.log('=' .repeat(50));
    console.log(`Total columns analyzed: ${report.summary.total}`);
    console.log(`Issues found: ${report.summary.issues}\n`);
    
    if (report.missingInSchema.length > 0) {
      console.log('❌ Missing in TypeScript Schema:');
      report.missingInSchema.forEach(col => console.log(`  - ${col}`));
      console.log();
    }
    
    if (report.missingInDb.length > 0) {
      console.log('❌ Missing in Database:');
      report.missingInDb.forEach(col => console.log(`  - ${col}`));
      console.log();
    }
    
    if (report.namingMismatches.length > 0) {
      console.log('⚠️  Naming Mismatches:');
      report.namingMismatches.forEach(mismatch => console.log(`  - ${mismatch}`));
      console.log();
    }
    
    if (report.summary.issues === 0) {
      console.log('✅ Schema is in sync!');
      process.exit(0);
    } else {
      console.log(`❌ Found ${report.summary.issues} schema issues`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Schema comparison failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}