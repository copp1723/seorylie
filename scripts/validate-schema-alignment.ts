#!/usr/bin/env tsx

/**
 * Schema Validation Script
 * 
 * This script validates that the Drizzle schema definitions are properly aligned
 * with the expected production database structure after applying the migration.
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import logger from "../server/utils/logger";

// Load environment variables
config();

interface ValidationIssue {
  table: string;
  column?: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  recommendation?: string;
}

interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  summary: {
    totalTables: number;
    tablesChecked: number;
    errors: number;
    warnings: number;
  };
}

// Required schema structure based on our Drizzle definitions
const REQUIRED_STRUCTURE = {
  users: {
    columns: ['id', 'username', 'name', 'email', 'password', 'role', 'dealership_id', 'is_active', 'created_at', 'updated_at'],
    indexes: ['email_idx', 'username_idx', 'dealership_id_idx', 'is_active_idx', 'name_idx'],
    constraints: ['users_email_unique', 'users_dealership_id_fkey']
  },
  dealerships: {
    columns: ['id', 'name', 'subdomain', 'contact_email', 'contact_phone', 'address', 'city', 'state', 'zip', 'country', 'timezone', 'is_active', 'settings', 'created_at', 'updated_at'],
    indexes: ['subdomain_idx', 'name_idx', 'dealership_is_active_idx', 'dealership_contact_email_idx'],
    constraints: ['dealerships_subdomain_unique']
  },
  tasks: {
    columns: ['id', 'name', 'type', 'category', 'status', 'parameters', 'agency_id', 'dealership_id', 'priority', 'due_date', 'assigned_to', 'deliverable_url', 'is_active', 'created_at', 'updated_at'],
    indexes: ['idx_tasks_status', 'idx_tasks_name', 'idx_tasks_category', 'idx_tasks_type', 'idx_tasks_dealership_id', 'idx_tasks_priority', 'idx_tasks_assigned_to', 'idx_tasks_is_active', 'idx_tasks_due_date'],
    constraints: []
  },
  tools: {
    columns: ['id', 'name', 'description', 'category', 'type', 'service', 'endpoint', 'input_schema', 'output_schema', 'is_active', 'created_at', 'updated_at'],
    indexes: ['tool_name_idx', 'service_idx', 'tool_type_idx', 'tool_category_idx', 'tool_is_active_idx'],
    constraints: []
  },
  audit_logs: {
    columns: ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'dealership_id', 'ip_address', 'user_agent', 'details', 'category', 'is_active', 'created_at'],
    indexes: ['audit_user_id_idx', 'action_idx', 'entity_type_idx', 'entity_id_idx', 'audit_dealership_id_idx', 'audit_created_at_idx', 'audit_logs_category_idx', 'audit_logs_is_active_idx'],
    constraints: []
  }
};

async function validateSchema(): Promise<ValidationResult> {
  const client = postgres(process.env.DATABASE_URL!, { ssl: "require" });
  const db = drizzle(client);
  
  const issues: ValidationIssue[] = [];
  let tablesChecked = 0;
  
  try {
    logger.info("🔍 Starting schema validation...");
    
    for (const [tableName, expectedStructure] of Object.entries(REQUIRED_STRUCTURE)) {
      tablesChecked++;
      logger.info(`📋 Validating table: ${tableName}`);
      
      // Check if table exists
      const tableExists = await client`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = ${tableName}
        ) as exists
      `;
      
      if (!tableExists[0]?.exists) {
        issues.push({
          table: tableName,
          issue: 'Table does not exist',
          severity: 'error',
          recommendation: `Run CREATE TABLE migration for ${tableName}`
        });
        continue;
      }
      
      // Check columns
      const existingColumns = await client`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `;
      
      const existingColumnNames = existingColumns.map(col => col.column_name);
      
      for (const requiredColumn of expectedStructure.columns) {
        if (!existingColumnNames.includes(requiredColumn)) {
          issues.push({
            table: tableName,
            column: requiredColumn,
            issue: 'Required column is missing',
            severity: 'error',
            recommendation: `ALTER TABLE ${tableName} ADD COLUMN ${requiredColumn}`
          });
        }
      }
      
      // Check for extra columns (informational)
      for (const existingColumn of existingColumnNames) {
        if (!expectedStructure.columns.includes(existingColumn)) {
          issues.push({
            table: tableName,
            column: existingColumn,
            issue: 'Extra column found (not in Drizzle schema)',
            severity: 'warning',
            recommendation: `Consider adding ${existingColumn} to Drizzle schema or removing from database`
          });
        }
      }
      
      // Check indexes
      const existingIndexes = await client`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = ${tableName}
        AND indexname NOT LIKE '%_pkey'
      `;
      
      const existingIndexNames = existingIndexes.map(idx => idx.indexname);
      
      for (const requiredIndex of expectedStructure.indexes) {
        if (!existingIndexNames.includes(requiredIndex)) {
          issues.push({
            table: tableName,
            issue: `Missing index: ${requiredIndex}`,
            severity: 'warning',
            recommendation: `CREATE INDEX ${requiredIndex} ON ${tableName}(...)`
          });
        }
      }
      
      // Check constraints
      const existingConstraints = await client`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = ${tableName}
        AND constraint_type IN ('UNIQUE', 'FOREIGN KEY', 'CHECK')
      `;
      
      const existingConstraintNames = existingConstraints.map(con => con.constraint_name);
      
      for (const requiredConstraint of expectedStructure.constraints) {
        if (!existingConstraintNames.includes(requiredConstraint)) {
          issues.push({
            table: tableName,
            issue: `Missing constraint: ${requiredConstraint}`,
            severity: 'warning',
            recommendation: `ALTER TABLE ${tableName} ADD CONSTRAINT ${requiredConstraint}...`
          });
        }
      }
      
      // Validate specific column properties for critical columns
      if (tableName === 'users') {
        const nameColumn = existingColumns.find(col => col.column_name === 'name');
        if (nameColumn && nameColumn.is_nullable === 'YES') {
          issues.push({
            table: tableName,
            column: 'name',
            issue: 'Name column should be NOT NULL',
            severity: 'error',
            recommendation: 'ALTER TABLE users ALTER COLUMN name SET NOT NULL'
          });
        }
        
        const isActiveColumn = existingColumns.find(col => col.column_name === 'is_active');
        if (isActiveColumn && isActiveColumn.is_nullable === 'YES') {
          issues.push({
            table: tableName,
            column: 'is_active',
            issue: 'is_active column should be NOT NULL with default',
            severity: 'error',
            recommendation: 'ALTER TABLE users ALTER COLUMN is_active SET NOT NULL'
          });
        }
      }
    }
    
    // Check for foreign key relationships
    logger.info("🔗 Validating foreign key relationships...");
    const foreignKeys = await client`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.table_name, tc.constraint_name
    `;
    
    logger.info(`📊 Found ${foreignKeys.length} foreign key relationships`);
    
    // Validate critical foreign key relationships
    const criticalForeignKeys = [
      { table: 'users', column: 'dealership_id', references: 'dealerships', onDelete: 'SET NULL' },
      { table: 'conversations', column: 'dealership_id', references: 'dealerships', onDelete: 'CASCADE' },
      { table: 'api_keys', column: 'user_id', references: 'users', onDelete: 'CASCADE' },
      { table: 'api_keys', column: 'dealership_id', references: 'dealerships', onDelete: 'CASCADE' }
    ];
    
    for (const expectedFK of criticalForeignKeys) {
      const actualFK = foreignKeys.find(fk => 
        fk.table_name === expectedFK.table && 
        fk.column_name === expectedFK.column &&
        fk.foreign_table_name === expectedFK.references
      );
      
      if (!actualFK) {
        issues.push({
          table: expectedFK.table,
          column: expectedFK.column,
          issue: `Missing foreign key to ${expectedFK.references}`,
          severity: 'error',
          recommendation: `ADD CONSTRAINT FOREIGN KEY (${expectedFK.column}) REFERENCES ${expectedFK.references}(id)`
        });
      } else if (actualFK.delete_rule.toUpperCase() !== expectedFK.onDelete.replace(' ', '_')) {
        issues.push({
          table: expectedFK.table,
          column: expectedFK.column,
          issue: `Incorrect ON DELETE rule: expected ${expectedFK.onDelete}, got ${actualFK.delete_rule}`,
          severity: 'warning',
          recommendation: `Update foreign key constraint with ON DELETE ${expectedFK.onDelete}`
        });
      }
    }
    
  } catch (error) {
    logger.error("❌ Schema validation failed:", error);
    issues.push({
      table: 'system',
      issue: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error'
    });
  } finally {
    await client.end();
  }
  
  const errors = issues.filter(issue => issue.severity === 'error').length;
  const warnings = issues.filter(issue => issue.severity === 'warning').length;
  
  const result: ValidationResult = {
    passed: errors === 0,
    issues,
    summary: {
      totalTables: Object.keys(REQUIRED_STRUCTURE).length,
      tablesChecked,
      errors,
      warnings
    }
  };
  
  return result;
}

function generateReport(result: ValidationResult): string {
  const { passed, issues, summary } = result;
  
  let report = `
# Drizzle Schema Validation Report
Generated: ${new Date().toISOString()}

## Summary
- **Status**: ${passed ? '✅ PASSED' : '❌ FAILED'}
- **Tables Checked**: ${summary.tablesChecked}/${summary.totalTables}
- **Errors**: ${summary.errors}
- **Warnings**: ${summary.warnings}

`;

  if (issues.length === 0) {
    report += "## ✅ No Issues Found\nAll schema definitions are properly aligned!\n";
  } else {
    report += "## Issues Found\n\n";
    
    const errorIssues = issues.filter(issue => issue.severity === 'error');
    const warningIssues = issues.filter(issue => issue.severity === 'warning');
    const infoIssues = issues.filter(issue => issue.severity === 'info');
    
    if (errorIssues.length > 0) {
      report += "### ❌ Errors (Must Fix)\n";
      errorIssues.forEach(issue => {
        report += `- **${issue.table}${issue.column ? `.${issue.column}` : ''}**: ${issue.issue}\n`;
        if (issue.recommendation) {
          report += `  - *Recommendation*: ${issue.recommendation}\n`;
        }
      });
      report += "\n";
    }
    
    if (warningIssues.length > 0) {
      report += "### ⚠️ Warnings (Should Fix)\n";
      warningIssues.forEach(issue => {
        report += `- **${issue.table}${issue.column ? `.${issue.column}` : ''}**: ${issue.issue}\n`;
        if (issue.recommendation) {
          report += `  - *Recommendation*: ${issue.recommendation}\n`;
        }
      });
      report += "\n";
    }
    
    if (infoIssues.length > 0) {
      report += "### ℹ️ Information\n";
      infoIssues.forEach(issue => {
        report += `- **${issue.table}${issue.column ? `.${issue.column}` : ''}**: ${issue.issue}\n`;
        if (issue.recommendation) {
          report += `  - *Recommendation*: ${issue.recommendation}\n`;
        }
      });
      report += "\n";
    }
  }
  
  report += `
## Next Steps

${passed ? 
  "✅ Your schema is properly aligned! No action required." :
  `❌ Please address the ${summary.errors} error(s) before proceeding:

1. Apply the migration script: \`migrations/patch_drizzle_schema_alignment.sql\`
2. Run this validation script again to confirm fixes
3. Update any missing Drizzle schema definitions
4. Regenerate types if needed: \`npm run db:generate\``
}

## Migration Commands

To apply the fixes automatically:

\`\`\`bash
# Apply the migration
psql $DATABASE_URL -f migrations/patch_drizzle_schema_alignment.sql

# Validate the changes
npm run validate:schema

# Generate fresh types (if needed)
npm run db:generate
\`\`\`
`;

  return report;
}

async function main() {
  try {
    console.log("🚀 Drizzle Schema Validation");
    console.log("=======================================\n");
    
    if (!process.env.DATABASE_URL) {
      logger.error("❌ DATABASE_URL environment variable is required");
      process.exit(1);
    }
    
    const result = await validateSchema();
    const report = generateReport(result);
    
    console.log(report);
    
    // Save report to file
    const fs = await import("fs");
    const reportPath = "./schema-validation-report.md";
    fs.writeFileSync(reportPath, report);
    
    logger.info(`📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    if (result.passed) {
      logger.info("✅ Schema validation passed!");
      process.exit(0);
    } else {
      logger.error(`❌ Schema validation failed with ${result.summary.errors} errors`);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error("💥 Schema validation crashed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateSchema, generateReport };
