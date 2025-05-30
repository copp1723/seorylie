-- Migration: 0011_adf_sms_responses_table_rollback.sql
-- Description: Rollback for ADF SMS responses tracking table
-- ADF-06: SMS Response Sender (Twilio) - Rollback

-- Drop helper functions first
DROP FUNCTION IF EXISTS check_sms_opt_out(INTEGER, TEXT);
DROP FUNCTION IF EXISTS find_leads_by_phone(INTEGER, TEXT);

-- Remove columns from adf_leads table
ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_status;
ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_error;
ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_sent_at;
ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_delivered_at;

-- Drop tables in correct order (respecting foreign key constraints)
-- First drop the tables that reference other tables
DROP TABLE IF EXISTS adf_sms_delivery_events;
-- Then drop the main tables
DROP TABLE IF EXISTS adf_sms_responses;
DROP TABLE IF EXISTS adf_sms_opt_outs;

-- Finally drop the enum type
DROP TYPE IF EXISTS sms_delivery_status;

-- Add a comment to mark successful rollback
DO $$
BEGIN
    RAISE NOTICE 'Successfully rolled back migration 0011_adf_sms_responses_table.sql';
END $$;
