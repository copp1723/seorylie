#!/bin/bash

# Script to verify database migrations
# This script checks if migrations can be applied successfully

set -e

echo "================================"
echo "Database Migration Verification"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection settings (update these as needed)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-seorylie_test}"
DB_USER="${DB_USER:-postgres}"

echo -e "${YELLOW}Using database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME${NC}"
echo ""

# Function to execute SQL and check result
execute_sql() {
    local sql_file=$1
    local description=$2
    
    echo -n "Applying $description... "
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ SUCCESS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Error output:"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file"
        return 1
    fi
}

# Create test database
echo "Creating test database..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || echo "Database already exists"

# Apply migrations in order
echo ""
echo "Applying migrations..."
echo "===================="

MIGRATION_DIR="$(dirname "$0")/../migrations"

# List of migrations to apply in order
MIGRATIONS=(
    "0001_initial_schema.sql"
    "0001_seo_tables.sql"
    "0002_add_ga4_integration.sql"
    "0003_secure_credentials_storage.sql"
    "0006_jwt_and_prompt_templates.sql"
    "0007_add_opt_out_fields.sql"
    "0009_tool_registry.sql"
    "0010_sandboxes_and_rate_limiting.sql"
    "0011_enable_row_level_security.sql"
    "0011_pii_encryption_consent.sql"
    "0012_daily_spend_logs.sql"
    "0012_intent_detection_system.sql"
    "0013_rls_security_policies.sql"
    "0015_add_dual_mode_schema.sql"
    "0016_dual_mode_schema.sql"
    "0017_seoworks_onboarding.sql"
    "0018_seowerks_queue_tables.sql"
    "0019_activity_logs.sql"
    "0019_agency_branding.sql"
    "0020_create_base_tables.sql"
    "0021_ga4_integration_tables.sql"
    "0022_reports_and_audit_logs.sql"
    "0023_fix_ga4_api_usage_constraint.sql"
    "2025-01-27-create-tasks-and-queue-tables.sql"
    "create_notification_logs.sql"
)

FAILED=0

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$MIGRATION_DIR/$migration" ]; then
        if ! execute_sql "$MIGRATION_DIR/$migration" "$migration"; then
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "Skipping $migration... ${YELLOW}FILE NOT FOUND${NC}"
    fi
done

echo ""
echo "================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All migrations applied successfully!${NC}"
    
    # Show table count
    echo ""
    echo "Database statistics:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"
else
    echo -e "${RED}$FAILED migrations failed!${NC}"
    exit 1
fi

# Optional: Test rollback
echo ""
echo -e "${YELLOW}Testing rollback scripts...${NC}"
echo "=========================="

ROLLBACK_MIGRATIONS=(
    "0023_fix_ga4_api_usage_constraint_rollback.sql"
    "0022_reports_and_audit_logs_rollback.sql"
    "0021_ga4_integration_tables_rollback.sql"
    "0020_create_base_tables_rollback.sql"
)

for rollback in "${ROLLBACK_MIGRATIONS[@]}"; do
    if [ -f "$MIGRATION_DIR/$rollback" ]; then
        execute_sql "$MIGRATION_DIR/$rollback" "$rollback"
    fi
done

# Cleanup test database (optional)
echo ""
read -p "Drop test database? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    echo "Test database dropped."
fi

echo ""
echo "Migration verification complete!"