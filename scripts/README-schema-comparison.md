# Schema Comparison Tool

The enhanced schema comparison script (`scripts/compare-schema.ts`) provides comprehensive analysis between your live PostgreSQL database and Drizzle schema definitions in `shared/schema.ts`.

## Features

- **Database Introspection**: Analyzes live PostgreSQL schema using `information_schema`
- **Drizzle Schema Parsing**: Extracts metadata from pgTable definitions with type information
- **Comprehensive Analysis**: Detects missing columns, type mismatches, naming conflicts, constraints, and indexes
- **Detailed Reporting**: Generates actionable reports with severity levels and recommendations
- **CI/CD Integration**: Exit codes and JSON output for automated validation
- **Multiple Output Formats**: Human-readable table format or JSON for tooling

## Usage

### Basic Usage
```bash
# Run schema comparison with table output
tsx scripts/compare-schema.ts

# Run via npm script (recommended)
pnpm run schema:check
```

### Advanced Options
```bash
# Output as JSON
tsx scripts/compare-schema.ts --format=json

# Save detailed report to file
tsx scripts/compare-schema.ts --format=json --output=schema-report.json

# Show help
tsx scripts/compare-schema.ts --help
```

### CI/CD Integration
```bash
# Exit codes for automation
# 0 = Schema synchronized
# 1 = Schema issues found
# 2 = Error during comparison

# Example in GitHub Actions
- name: Validate Schema
  run: pnpm run schema:check
```

## Configuration

### Environment Variables
- `DATABASE_URL` or `POSTGRES_URL` - PostgreSQL connection string

### Package.json Scripts
- `schema:check` - Run schema comparison
- `schema:validate` - Run schema check + circular dependency check
- `precommit` - Includes schema validation in pre-commit hooks

## Report Sections

### 1. Summary
- Table/column/index counts for both database and schema
- Total issue count

### 2. Missing Tables
- Tables defined in schema but missing in database
- Tables in database but not in schema

### 3. Missing Columns
- Columns defined in schema but missing in database
- Columns in database but not in schema

### 4. Type Mismatches
- **Critical Errors**: Type differences that may cause runtime issues
- **Warnings**: Type differences that are probably safe

### 5. Nullability Mismatches
- Columns with different NULL/NOT NULL constraints

### 6. Naming Conflicts
- snake_case vs camelCase inconsistencies

### 7. Constraint Mismatches
- Primary key differences
- Foreign key differences

### 8. Index Mismatches
- Missing indexes in database or schema

### 9. Recommendations
- Actionable suggestions based on findings

## Type Compatibility

The script understands type compatibility between Drizzle and PostgreSQL:

| Drizzle Type | PostgreSQL Type | Compatible With |
|--------------|-----------------|-----------------|
| `serial` | `integer` | `int4`, `serial` |
| `varchar` | `character varying` | `text`, `varchar` |
| `text` | `text` | `varchar`, `character varying` |
| `boolean` | `boolean` | `bool` |
| `timestamp` | `timestamp without time zone` | `timestamp` |
| `decimal` | `numeric` | `decimal`, `numeric` |
| `json` | `json` | `jsonb` |
| `uuid` | `uuid` | - |

## Examples

### Schema Synchronized
```
📊 DATABASE SCHEMA COMPARISON REPORT
================================================================================

📈 SUMMARY:
   Tables:  DB=39 | Schema=39
   Columns: DB=487 | Schema=487
   Indexes: DB=156 | Schema=89
   Issues:  0 total

💡 RECOMMENDATIONS:
   1. ✨ Schema is perfectly synchronized! Consider setting up automated monitoring.

✅ Schema is perfectly synchronized!
```

### Schema Issues Found
```
📊 DATABASE SCHEMA COMPARISON REPORT
================================================================================

📈 SUMMARY:
   Tables:  DB=38 | Schema=39
   Columns: DB=485 | Schema=487
   Issues:  4 total

🏗️  MISSING TABLES:
   Missing in Database:
     ❌ new_feature_table

🔗 MISSING COLUMNS:
   Missing in Database:
     ❌ users.new_column (varchar)
     ❌ settings.feature_flag (boolean)

🎯 TYPE MISMATCHES:
   Critical Errors:
     🚨 vehicles.price: money ≠ numeric

💡 RECOMMENDATIONS:
   1. 🏗️  Create missing tables in database: new_feature_table
   2. ➕ Run database migration to add 2 missing columns
   3. ⚠️  Fix critical type mismatches that may cause runtime errors

❌ Found 4 schema issues
```

## Integration with Development Workflow

### Pre-commit Hooks
The script is integrated into pre-commit hooks via Husky:
```json
{
  "scripts": {
    "precommit": "pnpm run test && pnpm run schema:validate"
  }
}
```

### CI/CD Pipeline
Example GitHub Actions integration:
```yaml
- name: Install dependencies
  run: pnpm install

- name: Validate Schema
  run: pnpm run schema:check
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Generate Schema Report
  run: pnpm run schema:check --format=json --output=schema-report.json
  if: failure()

- name: Upload Schema Report
  uses: actions/upload-artifact@v3
  if: failure()
  with:
    name: schema-report
    path: schema-report.json
```

### Database Migrations
Use the script to validate migrations:
```bash
# Before creating migration
pnpm run schema:check

# After applying migration
pnpm run db:migrate
pnpm run schema:check  # Should show no issues
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```
   💡 TIP: Make sure your database is running and DATABASE_URL is set correctly.
   ```

2. **Schema File Not Found**
   ```
   💡 TIP: Make sure the schema file exists at shared/schema.ts
   ```

3. **Authentication Failed**
   - Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
   - Check database credentials and permissions

### Running in Different Environments

**Development**:
```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/seorylie_dev"
pnpm run schema:check
```

**Staging**:
```bash
export DATABASE_URL="postgresql://user:pass@staging-db:5432/seorylie_staging"
pnpm run schema:check
```

**Production** (read-only checks):
```bash
export DATABASE_URL="postgresql://readonly_user:pass@prod-db:5432/seorylie"
pnpm run schema:check --format=json --output=prod-schema-report.json
```

## Testing

### Test Schema Parsing Only
```bash
# Test without database connection
tsx scripts/test-schema-parsing.ts
```

### Validate Sample Output
```bash
# Check parsing results
tsx scripts/test-schema-parsing.ts | grep "Tables found"
```

## Maintenance

### Updating Type Mappings
Edit the `mapDrizzleTypeToPg()` function to add new type mappings:
```typescript
const typeMap: Record<string, string> = {
  'serial': 'integer',
  'your_new_type': 'postgresql_type',
  // ...
};
```

### Adding New Checks
Extend the `generateReport()` function to add new validation rules:
```typescript
// Add new validation logic
if (/* your condition */) {
  report.yourNewSection.push(/* issue */);
}
```

### Performance Optimization
For large schemas, consider:
- Adding table filtering options
- Implementing parallel analysis
- Caching introspection results

---

## Related Files
- `shared/schema.ts` - Drizzle schema definitions
- `scripts/test-schema-parsing.ts` - Schema parsing test utility
- `scripts/run-migrations.ts` - Database migration runner
- `package.json` - NPM scripts and dependencies
