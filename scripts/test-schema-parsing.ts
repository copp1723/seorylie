#!/usr/bin/env tsx
/**
 * Test Schema Parsing Only
 * 
 * This script tests only the schema file parsing functionality
 * without requiring a database connection.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

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
}

interface SchemaIndex {
  table: string;
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

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
  
  // Enhanced regex to match pgTable definitions
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

function parseTableColumns(tableName: string, columnsBlock: string, columns: SchemaColumn[]): void {
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
    
    const lengthMatch = modifiers.match(/length:\s*(\d+)/);
    if (lengthMatch) {
      column.length = parseInt(lengthMatch[1]);
    }
    
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

function parseTableIndexes(tableName: string, indexesBlock: string, indexes: SchemaIndex[]): void {
  const indexRegex = /(\w+):\s*(?:unique\()?index\(['"`]([^'"`]+)['"`]\)\.on\(([^)]+)\)/g;
  
  let indexMatch;
  while ((indexMatch = indexRegex.exec(indexesBlock)) !== null) {
    const [, indexVar, indexName, columnsExpr] = indexMatch;
    
    const columnMatches = columnsExpr.match(/table\.(\w+)/g) || [];
    const columnNames = columnMatches.map(match => match.replace('table.', ''));
    
    indexes.push({
      table: tableName,
      name: indexName,
      columns: columnNames,
      unique: indexesBlock.includes('unique('),
      primary: false
    });
  }
}

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

function main() {
  try {
    console.log('🔍 Testing schema file parsing...\n');
    
    const { columns, indexes, tables } = parseSchemaFile();
    
    console.log('📊 PARSING RESULTS:');
    console.log(`   Tables found: ${tables.length}`);
    console.log(`   Columns found: ${columns.length}`);
    console.log(`   Indexes found: ${indexes.length}\n`);
    
    console.log('🏗️  TABLES:');
    tables.forEach(table => console.log(`   - ${table}`));
    
    console.log('\n📋 SAMPLE COLUMNS (first 10):');
    columns.slice(0, 10).forEach(col => {
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      const pk = col.isPrimaryKey ? ' PK' : '';
      const def = col.hasDefault ? ' DEFAULT' : '';
      console.log(`   - ${col.table}.${col.column}: ${col.drizzleType} -> ${col.pgType} ${nullable}${pk}${def}`);
    });
    
    if (indexes.length > 0) {
      console.log('\n🗂️  SAMPLE INDEXES (first 5):');
      indexes.slice(0, 5).forEach(idx => {
        const unique = idx.unique ? 'UNIQUE ' : '';
        console.log(`   - ${unique}${idx.table}.${idx.name} ON [${idx.columns.join(', ')}]`);
      });
    }
    
    console.log('\n✅ Schema parsing completed successfully!');
    
  } catch (error) {
    console.error('💥 Schema parsing failed:');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
