#!/usr/bin/env tsx
/**
 * CI-Friendly Schema Check
 * 
 * This script performs basic schema validation that can run in CI
 * environments without requiring a full database connection.
 * 
 * It validates:
 * - Schema file syntax and parsing
 * - Type mapping consistency
 * - Index definitions
 * - Basic structural integrity
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    tables: number;
    columns: number;
    indexes: number;
  };
}

function validateSchemaFile(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    summary: { tables: 0, columns: 0, indexes: 0 }
  };

  try {
    const schemaPath = join(process.cwd(), 'shared/schema.ts');
    const content = readFileSync(schemaPath, 'utf-8');

    // Basic syntax validation
    if (!content.includes('export const') || !content.includes('pgTable')) {
      result.errors.push('Schema file does not contain valid pgTable exports');
      result.success = false;
      return result;
    }

    // Parse tables and validate structure
    const tableRegex = /export const (\w+) = pgTable\s*\(\s*['"`](\w+)['"`]\s*,\s*\{([\s\S]*?)\}/g;
    let tableMatch;
    const tables = new Set<string>();
    const tableNames = new Set<string>();

    while ((tableMatch = tableRegex.exec(content)) !== null) {
      const [, exportName, tableName, columnsBlock] = tableMatch;
      
      // Check for duplicate table names
      if (tables.has(tableName)) {
        result.errors.push(`Duplicate table name: ${tableName}`);
        result.success = false;
      }
      tables.add(tableName);
      tableNames.add(exportName);
      result.summary.tables++;

      // Validate column definitions
      const columnRegex = /(\w+):\s*(\w+)\([^)]*\)([^,}]*)/g;
      let columnMatch;
      const columns = new Set<string>();

      while ((columnMatch = columnRegex.exec(columnsBlock)) !== null) {
        const [, columnName, type, modifiers] = columnMatch;
        
        // Check for duplicate column names within table
        if (columns.has(columnName)) {
          result.errors.push(`Duplicate column in ${tableName}: ${columnName}`);
          result.success = false;
        }
        columns.add(columnName);
        result.summary.columns++;

        // Validate known Drizzle types
        const validTypes = ['serial', 'integer', 'varchar', 'text', 'boolean', 'timestamp', 'date', 'decimal', 'json', 'uuid'];
        if (!validTypes.includes(type)) {
          result.warnings.push(`Unknown Drizzle type in ${tableName}.${columnName}: ${type}`);
        }

        // Check for common issues
        if (type === 'varchar' && !modifiers.includes('length')) {
          result.warnings.push(`VARCHAR without length in ${tableName}.${columnName}`);
        }

        if (type === 'decimal' && (!modifiers.includes('precision') || !modifiers.includes('scale'))) {
          result.warnings.push(`DECIMAL without precision/scale in ${tableName}.${columnName}`);
        }
      }

      // Check for at least one primary key
      if (!columnsBlock.includes('.primaryKey()') && !columnsBlock.includes('serial(')) {
        result.warnings.push(`Table ${tableName} may be missing a primary key`);
      }
    }

    // Validate index definitions
    const indexRegex = /index\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let indexMatch;
    const indexes = new Set<string>();

    while ((indexMatch = indexRegex.exec(content)) !== null) {
      const [, indexName] = indexMatch;
      
      if (indexes.has(indexName)) {
        result.errors.push(`Duplicate index name: ${indexName}`);
        result.success = false;
      }
      indexes.add(indexName);
      result.summary.indexes++;
    }

    // Check for potential naming issues
    for (const tableName of tables) {
      if (tableName.includes('_')) {
        // This is expected for snake_case
      } else if (/[A-Z]/.test(tableName)) {
        result.warnings.push(`Table name uses camelCase, consider snake_case: ${tableName}`);
      }
    }

    // Validate relations are defined
    if (content.includes('relations') && !content.includes('export const') + 'Relations') {
      result.warnings.push('Relations imported but no relation exports found');
    }

    // Check for common schema patterns
    if (result.summary.tables === 0) {
      result.errors.push('No tables found in schema');
      result.success = false;
    }

    if (result.summary.columns === 0) {
      result.errors.push('No columns found in any tables');
      result.success = false;
    }

  } catch (error) {
    result.errors.push(`Failed to parse schema file: ${error instanceof Error ? error.message : String(error)}`);
    result.success = false;
  }

  return result;
}

function formatValidationReport(result: ValidationResult): void {
  console.log('🔍 CI Schema Validation Report');
  console.log('=' .repeat(50));
  
  console.log(`\n📊 Summary:`);
  console.log(`   Tables: ${result.summary.tables}`);
  console.log(`   Columns: ${result.summary.columns}`);
  console.log(`   Indexes: ${result.summary.indexes}`);
  
  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    result.errors.forEach(error => console.log(`   • ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    result.warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  console.log(`\n${result.success ? '✅' : '❌'} Validation ${result.success ? 'passed' : 'failed'}`);
  
  if (result.success && result.errors.length === 0 && result.warnings.length === 0) {
    console.log('💡 Schema structure looks good for CI checks!');
    console.log('   Run full database comparison with: pnpm run schema:check');
  }
}

function main() {
  try {
    const result = validateSchemaFile();
    formatValidationReport(result);
    
    // Exit with appropriate code
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 CI schema validation failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}

main();
