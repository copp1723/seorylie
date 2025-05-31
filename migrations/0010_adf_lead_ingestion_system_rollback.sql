-- Rollback Migration: 0010_adf_lead_ingestion_system_rollback.sql
-- Description: Rollback ADF (Auto Data Format) lead ingestion system tables
-- Author: Josh Copp
-- Date: 2025-01-20

BEGIN;

-- Drop foreign key constraints first (if they exist)
ALTER TABLE adf_processing_logs DROP CONSTRAINT IF EXISTS fk_adf_processing_logs_lead;
ALTER TABLE adf_processing_logs DROP CONSTRAINT IF EXISTS fk_adf_processing_logs_queue;
ALTER TABLE adf_email_queue DROP CONSTRAINT IF EXISTS fk_adf_email_queue_lead;
ALTER TABLE adf_leads DROP CONSTRAINT IF EXISTS fk_adf_leads_dealership;

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS adf_processing_logs;
DROP TABLE IF EXISTS adf_email_queue;
DROP TABLE IF EXISTS adf_leads;

-- Drop custom types
DROP TYPE IF EXISTS adf_lead_status;
DROP TYPE IF EXISTS adf_processing_status;

COMMIT;
