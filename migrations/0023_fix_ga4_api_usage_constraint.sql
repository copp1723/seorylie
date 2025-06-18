-- Migration: 0023_fix_ga4_api_usage_constraint.sql
-- Description: Fixes duplicate PRIMARY KEY constraint in ga4_api_usage table
-- Date: 2025-01-28

-- Drop the incorrect duplicate PRIMARY KEY constraint from 0021_ga4_integration_tables.sql
-- The table already has id as PRIMARY KEY, so we need to create a unique constraint instead
ALTER TABLE ga4_api_usage DROP CONSTRAINT IF EXISTS ga4_api_usage_pkey1;

-- Create a unique constraint for the composite key
ALTER TABLE ga4_api_usage 
ADD CONSTRAINT ga4_api_usage_unique_tracking 
UNIQUE (tenant_id, property_id, api_method, request_date);

-- Comment for documentation
COMMENT ON CONSTRAINT ga4_api_usage_unique_tracking ON ga4_api_usage 
IS 'Ensures one record per tenant/property/method/date combination for accurate usage tracking';