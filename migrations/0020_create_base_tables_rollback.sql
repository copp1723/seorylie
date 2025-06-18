-- Rollback Migration: 0020_create_base_tables_rollback.sql
-- Description: Rollback script for 0020_create_base_tables.sql
-- Date: 2025-01-28

-- Drop policies
DROP POLICY IF EXISTS users_read_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS tenants_read_by_members ON tenants;
DROP POLICY IF EXISTS user_tenants_read_own ON user_tenants;

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;

-- Drop function if no other tables use it
-- Note: Only drop if you're sure no other tables depend on this function
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_tenants_slug;
DROP INDEX IF EXISTS idx_tenants_owner_id;
DROP INDEX IF EXISTS idx_tenants_status;
DROP INDEX IF EXISTS idx_user_tenants_user_id;
DROP INDEX IF EXISTS idx_user_tenants_tenant_id;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS user_tenants;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS users;

-- Revoke permissions (if needed)
-- REVOKE SELECT ON users FROM authenticated;
-- REVOKE UPDATE ON users FROM authenticated;
-- REVOKE SELECT ON tenants FROM authenticated;
-- REVOKE SELECT ON user_tenants FROM authenticated;