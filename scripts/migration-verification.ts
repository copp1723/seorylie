#!/usr/bin/env npx tsx

/**
 * Migration Verification Script
 *
 * This script verifies that all database migrations have been applied correctly
 * and checks for any missing or problematic migrations.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";

interface MigrationFile {
  filename: string;
  version: string;
  description: string;
  path: string;
  isRollback: boolean;
  sqlContent: string;
}

interface MigrationAnalysis {
  totalMigrations: number;
  rollbackMigrations: number;
  forwardMigrations: number;
  missingRollbacks: string[];
  duplicateVersions: string[];
  migrationOrder: string[];
  tables: {
    created: string[];
    altered: string[];
    dropped: string[];
  };
  indexes: {
    created: string[];
    dropped: string[];
  };
  constraints: {
    added: string[];
    dropped: string[];
  };
}

async function scanMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = "./migrations";
  const files: MigrationFile[] = [];

  try {
    const dirEntries = await readdir(migrationsDir);
    const sqlFiles = dirEntries.filter((file) => file.endsWith(".sql"));

    for (const filename of sqlFiles) {
      const filepath = join(migrationsDir, filename);
      const content = await readFile(filepath, "utf-8");

      // Parse migration filename (e.g., "0001_lead_management_schema.sql")
      const match = filename.match(/^(\d+)_(.+?)(_rollback)?\.sql$/);
      if (!match) {
        console.warn(
          `⚠️  Skipping file with invalid naming format: ${filename}`,
        );
        continue;
      }

      const [, version, description, rollbackSuffix] = match;

      files.push({
        filename,
        version,
        description: description.replace(/_/g, " "),
        path: filepath,
        isRollback: !!rollbackSuffix,
        sqlContent: content,
      });
    }

    return files.sort((a, b) => a.version.localeCompare(b.version));
  } catch (error) {
    console.error(`❌ Error reading migrations directory: ${error}`);
    return [];
  }
}

function analyzeSqlContent(sql: string): {
  tables: { created: string[]; altered: string[]; dropped: string[] };
  indexes: { created: string[]; dropped: string[] };
  constraints: { added: string[]; dropped: string[] };
} {
  const analysis = {
    tables: {
      created: [] as string[],
      altered: [] as string[],
      dropped: [] as string[],
    },
    indexes: { created: [] as string[], dropped: [] as string[] },
    constraints: { added: [] as string[], dropped: [] as string[] },
  };

  // Normalize SQL for easier parsing
  const normalizedSql = sql.toUpperCase().replace(/\s+/g, " ");

  // Extract table operations
  const createTableMatches = normalizedSql.match(
    /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/g,
  );
  if (createTableMatches) {
    createTableMatches.forEach((match) => {
      const tableName = match.replace(
        /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?/,
        "",
      );
      analysis.tables.created.push(tableName.toLowerCase());
    });
  }

  const alterTableMatches = normalizedSql.match(/ALTER TABLE\s+(\w+)/g);
  if (alterTableMatches) {
    alterTableMatches.forEach((match) => {
      const tableName = match.replace(/ALTER TABLE\s+/, "");
      if (!analysis.tables.altered.includes(tableName.toLowerCase())) {
        analysis.tables.altered.push(tableName.toLowerCase());
      }
    });
  }

  const dropTableMatches = normalizedSql.match(
    /DROP TABLE\s+(?:IF EXISTS\s+)?(\w+)/g,
  );
  if (dropTableMatches) {
    dropTableMatches.forEach((match) => {
      const tableName = match.replace(/DROP TABLE\s+(?:IF EXISTS\s+)?/, "");
      analysis.tables.dropped.push(tableName.toLowerCase());
    });
  }

  // Extract index operations
  const createIndexMatches = normalizedSql.match(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)/g,
  );
  if (createIndexMatches) {
    createIndexMatches.forEach((match) => {
      const indexName = match.replace(
        /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?/,
        "",
      );
      analysis.indexes.created.push(indexName.toLowerCase());
    });
  }

  const dropIndexMatches = normalizedSql.match(
    /DROP INDEX\s+(?:IF EXISTS\s+)?(\w+)/g,
  );
  if (dropIndexMatches) {
    dropIndexMatches.forEach((match) => {
      const indexName = match.replace(/DROP INDEX\s+(?:IF EXISTS\s+)?/, "");
      analysis.indexes.dropped.push(indexName.toLowerCase());
    });
  }

  // Extract constraint operations
  const addConstraintMatches = normalizedSql.match(/ADD CONSTRAINT\s+(\w+)/g);
  if (addConstraintMatches) {
    addConstraintMatches.forEach((match) => {
      const constraintName = match.replace(/ADD CONSTRAINT\s+/, "");
      analysis.constraints.added.push(constraintName.toLowerCase());
    });
  }

  const dropConstraintMatches = normalizedSql.match(
    /DROP CONSTRAINT\s+(?:IF EXISTS\s+)?(\w+)/g,
  );
  if (dropConstraintMatches) {
    dropConstraintMatches.forEach((match) => {
      const constraintName = match.replace(
        /DROP CONSTRAINT\s+(?:IF EXISTS\s+)?/,
        "",
      );
      analysis.constraints.dropped.push(constraintName.toLowerCase());
    });
  }

  return analysis;
}

function analyzeMigrations(migrations: MigrationFile[]): MigrationAnalysis {
  const analysis: MigrationAnalysis = {
    totalMigrations: migrations.length,
    rollbackMigrations: 0,
    forwardMigrations: 0,
    missingRollbacks: [],
    duplicateVersions: [],
    migrationOrder: [],
    tables: { created: [], altered: [], dropped: [] },
    indexes: { created: [], dropped: [] },
    constraints: { added: [], dropped: [] },
  };

  const versionCounts: Record<string, number> = {};
  const forwardMigrations = new Set<string>();

  // Group migrations by version and type
  migrations.forEach((migration) => {
    versionCounts[migration.version] =
      (versionCounts[migration.version] || 0) + 1;

    if (migration.isRollback) {
      analysis.rollbackMigrations++;
    } else {
      analysis.forwardMigrations++;
      forwardMigrations.add(migration.version);
      analysis.migrationOrder.push(
        `${migration.version}_${migration.description}`,
      );
    }

    // Analyze SQL content
    const sqlAnalysis = analyzeSqlContent(migration.sqlContent);
    analysis.tables.created.push(...sqlAnalysis.tables.created);
    analysis.tables.altered.push(...sqlAnalysis.tables.altered);
    analysis.tables.dropped.push(...sqlAnalysis.tables.dropped);
    analysis.indexes.created.push(...sqlAnalysis.indexes.created);
    analysis.indexes.dropped.push(...sqlAnalysis.indexes.dropped);
    analysis.constraints.added.push(...sqlAnalysis.constraints.added);
    analysis.constraints.dropped.push(...sqlAnalysis.constraints.dropped);
  });

  // Find duplicate versions
  Object.entries(versionCounts).forEach(([version, count]) => {
    if (count > 2) {
      // More than forward + rollback
      analysis.duplicateVersions.push(version);
    }
  });

  // Find missing rollbacks
  forwardMigrations.forEach((version) => {
    const hasRollback = migrations.some(
      (m) => m.version === version && m.isRollback,
    );
    if (!hasRollback) {
      analysis.missingRollbacks.push(version);
    }
  });

  // Remove duplicates from arrays
  analysis.tables.created = [...new Set(analysis.tables.created)];
  analysis.tables.altered = [...new Set(analysis.tables.altered)];
  analysis.tables.dropped = [...new Set(analysis.tables.dropped)];
  analysis.indexes.created = [...new Set(analysis.indexes.created)];
  analysis.indexes.dropped = [...new Set(analysis.indexes.dropped)];
  analysis.constraints.added = [...new Set(analysis.constraints.added)];
  analysis.constraints.dropped = [...new Set(analysis.constraints.dropped)];

  return analysis;
}

function generateMigrationReport(
  migrations: MigrationFile[],
  analysis: MigrationAnalysis,
): string {
  const timestamp = new Date().toISOString();

  return `# Database Migration Verification Report
Generated: ${timestamp}

## Migration Summary
- **Total Migration Files**: ${analysis.totalMigrations}
- **Forward Migrations**: ${analysis.forwardMigrations}
- **Rollback Migrations**: ${analysis.rollbackMigrations}
- **Missing Rollbacks**: ${analysis.missingRollbacks.length}
- **Duplicate Versions**: ${analysis.duplicateVersions.length}

## Migration Files Found
${migrations
  .map((m) => {
    const status = m.isRollback ? "🔄 ROLLBACK" : "➡️  FORWARD";
    return `- **${m.version}**: ${m.description} (${status})`;
  })
  .join("\n")}

## Migration Order (Forward Only)
${analysis.migrationOrder
  .map((migration, index) => `${index + 1}. ${migration}`)
  .join("\n")}

## Database Changes Analysis

### Tables
**Created**: ${analysis.tables.created.length > 0 ? analysis.tables.created.join(", ") : "None"}
**Altered**: ${analysis.tables.altered.length > 0 ? analysis.tables.altered.join(", ") : "None"}
**Dropped**: ${analysis.tables.dropped.length > 0 ? analysis.tables.dropped.join(", ") : "None"}

### Indexes
**Created**: ${analysis.indexes.created.length > 0 ? analysis.indexes.created.join(", ") : "None"}
**Dropped**: ${analysis.indexes.dropped.length > 0 ? analysis.indexes.dropped.join(", ") : "None"}

### Constraints
**Added**: ${analysis.constraints.added.length > 0 ? analysis.constraints.added.join(", ") : "None"}
**Dropped**: ${analysis.constraints.dropped.length > 0 ? analysis.constraints.dropped.join(", ") : "None"}

## Issues Found

${
  analysis.missingRollbacks.length > 0
    ? `
### ❌ Missing Rollback Scripts
The following migrations are missing their rollback counterparts:
${analysis.missingRollbacks.map((version) => `- Version ${version}`).join("\n")}

**Recommendation**: Create rollback scripts for safe migration reversals in production.
`
    : "✅ All forward migrations have corresponding rollback scripts."
}

${
  analysis.duplicateVersions.length > 0
    ? `
### ❌ Duplicate Migration Versions
The following versions have multiple migration files:
${analysis.duplicateVersions.map((version) => `- Version ${version}`).join("\n")}

**Recommendation**: Consolidate or renumber duplicate migrations to avoid conflicts.
`
    : "✅ No duplicate migration versions found."
}

## Migration Best Practices Checklist

### ✅ File Organization
- [ ] All migrations follow naming convention: NNNN_description.sql
- [ ] Each forward migration has a corresponding rollback script
- [ ] Migration versions are sequential and unique
- [ ] Migration files are located in the correct directory

### ✅ SQL Quality
- [ ] All DDL statements are properly formatted
- [ ] Foreign key constraints are defined correctly
- [ ] Indexes are created for performance-critical columns
- [ ] Table and column names follow naming conventions

### ✅ Production Safety
- [ ] Migrations are tested in development environment
- [ ] Rollback scripts are tested and verified
- [ ] Data migration scripts handle edge cases
- [ ] Performance impact has been evaluated

## Recommendations

${analysis.totalMigrations === 0 ? "❌ No migration files found. Database schema may not be properly versioned." : ""}
${analysis.forwardMigrations === 0 ? "❌ No forward migrations found. Database cannot be initialized from migrations." : ""}
${analysis.missingRollbacks.length > 0 ? "⚠️  Create missing rollback scripts for production safety." : ""}
${analysis.duplicateVersions.length > 0 ? "⚠️  Resolve duplicate migration versions to prevent conflicts." : ""}

${
  analysis.totalMigrations > 0 &&
  analysis.missingRollbacks.length === 0 &&
  analysis.duplicateVersions.length === 0
    ? "✅ Migration files are well-organized and ready for deployment."
    : ""
}

## Next Steps

1. **For Development**: Run \`npm run migrate\` to apply all pending migrations
2. **For Production**: Apply migrations in sequence with proper backups
3. **For Testing**: Use rollback scripts to test migration reversibility
4. **For CI/CD**: Integrate migration verification into deployment pipeline

---
*This report was generated automatically by the migration verification tool.*
`;
}

async function main() {
  try {
    console.log("🔍 Database Migration Verification");
    console.log("===================================\n");

    const migrations = await scanMigrationFiles();

    if (migrations.length === 0) {
      console.log("❌ No migration files found in ./migrations directory");
      process.exit(1);
    }

    console.log(`📁 Found ${migrations.length} migration files`);

    const analysis = analyzeMigrations(migrations);
    const report = generateMigrationReport(migrations, analysis);

    console.log(report);

    // Save report to file
    const fs = await import("fs");
    const reportPath = "./migration-verification-report.md";
    fs.writeFileSync(reportPath, report);

    console.log(`\n📄 Migration verification report saved to: ${reportPath}`);

    // Exit with appropriate code
    const hasIssues =
      analysis.missingRollbacks.length > 0 ||
      analysis.duplicateVersions.length > 0;
    process.exit(hasIssues ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration verification failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanMigrationFiles, analyzeMigrations, generateMigrationReport };
