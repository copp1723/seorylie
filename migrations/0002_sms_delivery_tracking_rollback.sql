-- Rollback migration for SMS delivery tracking
-- This undoes changes from 0002_sms_delivery_tracking.sql

-- Drop the masking functions
DROP FUNCTION IF EXISTS mask_phone_number(text);
DROP FUNCTION IF EXISTS unmask_phone_number(text, text);

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sms_opt_outs;
DROP TABLE IF EXISTS sms_campaigns;
DROP TABLE IF EXISTS sms_phone_numbers;
DROP TABLE IF EXISTS sms_templates;
DROP TABLE IF EXISTS sms_delivery_events;
DROP TABLE IF EXISTS sms_messages;

-- Drop custom ENUM types
DROP TYPE IF EXISTS sms_status;
DROP TYPE IF EXISTS sms_delivery_status;
DROP TYPE IF EXISTS sms_template_type;
DROP TYPE IF EXISTS sms_opt_out_reason;

-- Remove indexes that may have been created
DROP INDEX IF EXISTS idx_sms_messages_dealership;
DROP INDEX IF EXISTS idx_sms_messages_status;
DROP INDEX IF EXISTS idx_sms_messages_created;
DROP INDEX IF EXISTS idx_sms_delivery_events_message;
DROP INDEX IF EXISTS idx_sms_delivery_events_status_created;
DROP INDEX IF EXISTS idx_sms_opt_outs_phone;
DROP INDEX IF EXISTS idx_sms_opt_outs_dealership;