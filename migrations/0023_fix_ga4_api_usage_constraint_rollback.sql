-- Rollback Migration: 0023_fix_ga4_api_usage_constraint_rollback.sql
-- Description: Rollback script for 0023_fix_ga4_api_usage_constraint.sql
-- Date: 2025-01-28

-- Drop the unique constraint
ALTER TABLE ga4_api_usage DROP CONSTRAINT IF EXISTS ga4_api_usage_unique_tracking;

-- Note: We don't recreate the duplicate PRIMARY KEY as it was an error in the original migration