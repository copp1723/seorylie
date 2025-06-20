-- Migration: Patch Drizzle Schema Alignment
-- Description: Add missing columns, indexes, and constraints to align with updated Drizzle schema definitions
-- Date: $(date +%Y-%m-%d)

BEGIN;

-- ================================================================
-- 1. USERS TABLE - Add missing name column and constraints
-- ================================================================

-- Add name column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name'
    ) THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(100);
        -- Update existing users with a default name based on username/email
        UPDATE users SET name = COALESCE(username, SPLIT_PART(email, '@', 1)) WHERE name IS NULL;
        -- Make it non-nullable after data is populated
        ALTER TABLE users ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- Ensure is_active column is properly configured
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    ELSE
        -- Update existing column to be non-nullable with default
        UPDATE users SET is_active = true WHERE is_active IS NULL;
        ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;
        ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;
    END IF;
END $$;

-- Add missing indexes for users table
CREATE INDEX IF NOT EXISTS name_idx ON users(name);
CREATE INDEX IF NOT EXISTS is_active_idx ON users(is_active);

-- Ensure email is unique
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_email_unique UNIQUE(email);

-- Add proper foreign key constraint for dealership_id
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_dealership_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE SET NULL;

-- ================================================================
-- 2. DEALERSHIPS TABLE - Add missing constraints and indexes
-- ================================================================

-- Ensure subdomain is unique
ALTER TABLE dealerships ADD CONSTRAINT IF NOT EXISTS dealerships_subdomain_unique UNIQUE(subdomain);

-- Add missing indexes for dealerships
CREATE INDEX IF NOT EXISTS dealership_is_active_idx ON dealerships(is_active);
CREATE INDEX IF NOT EXISTS dealership_contact_email_idx ON dealerships(contact_email);

-- ================================================================
-- 3. TASKS TABLE - Add missing columns and indexes
-- ================================================================

-- Add name column to tasks table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'name'
    ) THEN
        ALTER TABLE tasks ADD COLUMN name VARCHAR(255);
        -- Update existing tasks with a default name based on type
        UPDATE tasks SET name = CONCAT(UPPER(SUBSTRING(type, 1, 1)), SUBSTRING(type, 2), ' Task') WHERE name IS NULL;
        -- Make it non-nullable after data is populated
        ALTER TABLE tasks ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- Add category column to tasks table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'category'
    ) THEN
        ALTER TABLE tasks ADD COLUMN category VARCHAR(50);
    END IF;
END $$;

-- Add is_active column to tasks table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE tasks ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
END $$;

-- Ensure updated_at has a default value
ALTER TABLE tasks ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add missing indexes for tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_name ON tasks(name);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_dealership_id ON tasks(dealership_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- ================================================================
-- 4. TOOLS TABLE - Add missing category index
-- ================================================================

-- Add category index for tools table (column already exists)
CREATE INDEX IF NOT EXISTS tool_category_idx ON tools(category);

-- ================================================================
-- 5. AUDIT_LOGS TABLE - Add missing columns and indexes
-- ================================================================

-- Add category column to audit_logs table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'category'
    ) THEN
        ALTER TABLE audit_logs ADD COLUMN category TEXT;
    END IF;
END $$;

-- Add is_active column to audit_logs table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE audit_logs ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
END $$;

-- Add missing indexes for audit_logs table
CREATE INDEX IF NOT EXISTS audit_logs_category_idx ON audit_logs(category);
CREATE INDEX IF NOT EXISTS audit_logs_is_active_idx ON audit_logs(is_active);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

-- ================================================================
-- 6. FOREIGN KEY CONSTRAINTS - Ensure proper relationships
-- ================================================================

-- Add proper foreign key constraints with ON DELETE actions
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_dealership_id_fkey;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE;

ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_dealership_id_fkey;
ALTER TABLE personas ADD CONSTRAINT personas_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_dealership_id_fkey;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_dealership_id_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_customer_id_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_assigned_agent_id_fkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_assigned_agent_id_fkey 
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_dealership_id_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_dealership_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_dealership_id_fkey 
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_agent_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_assigned_agent_id_fkey 
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_conversation_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;

-- ================================================================
-- 7. PERFORMANCE INDEXES - Add indexes for common query patterns
-- ================================================================

-- Composite indexes for common multi-column queries
CREATE INDEX IF NOT EXISTS users_dealership_active_idx ON users(dealership_id, is_active);
CREATE INDEX IF NOT EXISTS conversations_dealership_status_idx ON conversations(dealership_id, status);
CREATE INDEX IF NOT EXISTS leads_dealership_status_idx ON leads(dealership_id, status);
CREATE INDEX IF NOT EXISTS vehicles_dealership_status_idx ON vehicles(dealership_id, status);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_dealership_action_idx ON audit_logs(dealership_id, action);

-- Partial indexes for active records (performance optimization)
CREATE INDEX IF NOT EXISTS users_active_email_idx ON users(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS dealerships_active_subdomain_idx ON dealerships(subdomain) WHERE is_active = true;

-- ================================================================
-- 8. DATA VALIDATION AND CLEANUP
-- ================================================================

-- Ensure all boolean fields have proper defaults
UPDATE users SET is_active = true WHERE is_active IS NULL;
UPDATE dealerships SET is_active = true WHERE is_active IS NULL;
UPDATE personas SET is_active = true WHERE is_active IS NULL;
UPDATE api_keys SET is_active = true WHERE is_active IS NULL;

-- Clean up any orphaned records (optional - be careful in production)
-- DELETE FROM users WHERE dealership_id IS NOT NULL AND dealership_id NOT IN (SELECT id FROM dealerships);
-- DELETE FROM conversations WHERE dealership_id NOT IN (SELECT id FROM dealerships);
-- DELETE FROM customers WHERE dealership_id NOT IN (SELECT id FROM dealerships);
-- DELETE FROM leads WHERE dealership_id NOT IN (SELECT id FROM dealerships);
-- DELETE FROM vehicles WHERE dealership_id NOT IN (SELECT id FROM dealerships);

-- ================================================================
-- 9. UPDATE SCHEMA VERSION (if using version tracking)
-- ================================================================

-- Update schema version tracking table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_versions') THEN
        INSERT INTO schema_versions (version, description, applied_at) 
        VALUES ('2024.01.drizzle-alignment', 'Drizzle schema alignment patch', NOW())
        ON CONFLICT (version) DO NOTHING;
    END IF;
END $$;

-- ================================================================
-- 10. VERIFY CHANGES
-- ================================================================

-- Output verification summary
DO $$
DECLARE
    missing_columns INTEGER := 0;
    missing_indexes INTEGER := 0;
    missing_constraints INTEGER := 0;
BEGIN
    -- Check for required columns
    SELECT COUNT(*) INTO missing_columns FROM (
        SELECT 'users.name' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'name'
        )
        UNION ALL
        SELECT 'users.is_active' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_active'
        )
        UNION ALL
        SELECT 'tasks.name' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tasks' AND column_name = 'name'
        )
        UNION ALL
        SELECT 'tasks.category' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tasks' AND column_name = 'category'
        )
        UNION ALL
        SELECT 'audit_logs.category' WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' AND column_name = 'category'
        )
    ) AS missing;

    -- Output results
    IF missing_columns = 0 THEN
        RAISE NOTICE 'SUCCESS: All required columns are present';
    ELSE
        RAISE NOTICE 'WARNING: % missing columns detected', missing_columns;
    END IF;

    RAISE NOTICE 'Migration completed successfully at %', NOW();
END $$;

COMMIT;

-- ================================================================
-- ROLLBACK SCRIPT (for emergency use)
-- ================================================================

/*
-- ROLLBACK SCRIPT - USE WITH EXTREME CAUTION
-- This script removes the changes made by this migration

BEGIN;

-- Remove added columns (WARNING: This will delete data!)
-- ALTER TABLE users DROP COLUMN IF EXISTS name;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS name;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS category;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS category;
-- ALTER TABLE audit_logs DROP COLUMN IF EXISTS is_active;

-- Remove added indexes
-- DROP INDEX IF EXISTS name_idx;
-- DROP INDEX IF EXISTS is_active_idx;
-- DROP INDEX IF EXISTS idx_tasks_name;
-- DROP INDEX IF EXISTS idx_tasks_category;
-- DROP INDEX IF EXISTS tool_category_idx;
-- DROP INDEX IF EXISTS audit_logs_category_idx;
-- DROP INDEX IF EXISTS audit_logs_is_active_idx;

-- Remove constraints
-- ALTER TABLE dealerships DROP CONSTRAINT IF EXISTS dealerships_subdomain_unique;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

ROLLBACK; -- Uncomment to execute rollback
*/
