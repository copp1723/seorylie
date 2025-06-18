# Database Migrations

This directory contains all database migration scripts for the Seorylie platform.

## Migration Order

Migrations should be applied in numerical order. Each migration file has a corresponding rollback script.

### Core Migrations (0001-0019)
- Initial schema setup
- SEO tables
- GA4 integration
- Security features
- Multi-tenancy support

### New Migrations (0020+)
- **0020**: Base tables (users, tenants)
- **0021**: GA4 integration tables
- **0022**: Reports and audit logs
- **0023**: Fix GA4 API usage constraint

## Running Migrations

### Automatic Verification
```bash
./scripts/verify-migrations.sh
```

### Manual Application
```bash
psql -U postgres -d seorylie -f migrations/0020_create_base_tables.sql
```

### Rollback
```bash
psql -U postgres -d seorylie -f migrations/0020_create_base_tables_rollback.sql
```

## Important Notes

1. **Dependencies**: Some tables reference others, so order matters
2. **RLS Policies**: Row Level Security is enabled on most tables
3. **Triggers**: Updated_at columns are automatically maintained
4. **Indexes**: Performance indexes are included in each migration

## Troubleshooting

If a migration fails:
1. Check for existing tables/constraints
2. Verify foreign key dependencies
3. Ensure the auth.uid() function exists (Supabase)
4. Review the error message for constraint violations