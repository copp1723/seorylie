-- Rollback Migration: 0021_ga4_integration_tables_rollback.sql
-- Description: Rollback script for 0021_ga4_integration_tables.sql
-- Date: 2025-01-28

-- Drop policies
DROP POLICY IF EXISTS ga4_service_accounts_tenant_access ON ga4_service_accounts;
DROP POLICY IF EXISTS ga4_properties_tenant_access ON ga4_properties;
DROP POLICY IF EXISTS ga4_report_cache_property_access ON ga4_report_cache;
DROP POLICY IF EXISTS ga4_api_usage_tenant_access ON ga4_api_usage;
DROP POLICY IF EXISTS ga4_data_streams_property_access ON ga4_data_streams;

-- Drop triggers
DROP TRIGGER IF EXISTS update_ga4_service_accounts_updated_at ON ga4_service_accounts;
DROP TRIGGER IF EXISTS update_ga4_properties_updated_at ON ga4_properties;
DROP TRIGGER IF EXISTS update_ga4_api_usage_updated_at ON ga4_api_usage;
DROP TRIGGER IF EXISTS update_ga4_data_streams_updated_at ON ga4_data_streams;

-- Drop indexes
DROP INDEX IF EXISTS idx_ga4_service_accounts_tenant_id;
DROP INDEX IF EXISTS idx_ga4_service_accounts_email;
DROP INDEX IF EXISTS idx_ga4_service_accounts_key_hash;
DROP INDEX IF EXISTS idx_ga4_properties_tenant_id;
DROP INDEX IF EXISTS idx_ga4_properties_service_account_id;
DROP INDEX IF EXISTS idx_ga4_properties_measurement_id;
DROP INDEX IF EXISTS idx_ga4_report_cache_property_id;
DROP INDEX IF EXISTS idx_ga4_report_cache_data_hash;
DROP INDEX IF EXISTS idx_ga4_report_cache_expires_at;
DROP INDEX IF EXISTS idx_ga4_api_usage_tenant_id;
DROP INDEX IF EXISTS idx_ga4_api_usage_property_id;
DROP INDEX IF EXISTS idx_ga4_api_usage_request_date;
DROP INDEX IF EXISTS idx_ga4_data_streams_property_id;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS ga4_data_streams;
DROP TABLE IF EXISTS ga4_api_usage;
DROP TABLE IF EXISTS ga4_report_cache;
DROP TABLE IF EXISTS ga4_properties;
DROP TABLE IF EXISTS ga4_service_accounts;

-- Revoke permissions
-- REVOKE ALL ON ga4_service_accounts FROM authenticated;
-- REVOKE ALL ON ga4_properties FROM authenticated;
-- REVOKE ALL ON ga4_report_cache FROM authenticated;
-- REVOKE ALL ON ga4_api_usage FROM authenticated;
-- REVOKE ALL ON ga4_data_streams FROM authenticated;