-- Rollback migration for secure credentials storage
-- This undoes changes from 0003_secure_credentials_storage.sql

-- Drop the view
DROP VIEW IF EXISTS active_credentials_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_dealership_credentials_updated_at ON dealership_credentials;

-- Drop the function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Remove added column from sms_messages
ALTER TABLE sms_messages DROP COLUMN IF EXISTS encrypted_phone;

-- Drop indexes
DROP INDEX IF EXISTS idx_dealership_credentials_dealership;
DROP INDEX IF EXISTS idx_dealership_credentials_provider;
DROP INDEX IF EXISTS idx_dealership_credentials_active;
DROP INDEX IF EXISTS idx_credential_log_dealership_provider;
DROP INDEX IF EXISTS idx_credential_log_timestamp;
DROP INDEX IF EXISTS idx_credential_log_action;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS credential_activity_log;
DROP TABLE IF EXISTS dealership_credentials;