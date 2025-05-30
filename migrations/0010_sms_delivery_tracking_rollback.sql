-- Rollback migration for SMS delivery tracking
-- This undoes changes from 0010_sms_delivery_tracking.sql

-- First drop the view
DROP VIEW IF EXISTS sms_analytics;

-- Drop the functions
DROP FUNCTION IF EXISTS is_phone_opted_out(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS hash_phone_number(VARCHAR);
DROP FUNCTION IF EXISTS mask_phone_number(VARCHAR);

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sms_opt_outs;
DROP TABLE IF EXISTS sms_campaigns;
DROP TABLE IF EXISTS sms_phone_numbers;
DROP TABLE IF EXISTS sms_templates;
DROP TABLE IF EXISTS sms_delivery_events;
DROP TABLE IF EXISTS sms_messages;

-- Drop custom ENUM types
DROP TYPE IF EXISTS sms_direction;
DROP TYPE IF EXISTS sms_status;

-- Remove indexes that may have been created
DROP INDEX IF EXISTS sms_messages_dealership_idx;
DROP INDEX IF EXISTS sms_messages_conversation_idx;
DROP INDEX IF EXISTS sms_messages_lead_idx;
DROP INDEX IF EXISTS sms_messages_twilio_sid_idx;
DROP INDEX IF EXISTS sms_messages_status_idx;
DROP INDEX IF EXISTS sms_messages_direction_idx;
DROP INDEX IF EXISTS sms_messages_to_phone_idx;
DROP INDEX IF EXISTS sms_messages_from_phone_idx;
DROP INDEX IF EXISTS sms_messages_created_at_idx;
DROP INDEX IF EXISTS sms_messages_sent_at_idx;
DROP INDEX IF EXISTS sms_messages_retry_idx;
DROP INDEX IF EXISTS sms_delivery_events_message_idx;
DROP INDEX IF EXISTS sms_delivery_events_type_idx;
DROP INDEX IF EXISTS sms_delivery_events_status_idx;
DROP INDEX IF EXISTS sms_delivery_events_timestamp_idx;
DROP INDEX IF EXISTS sms_templates_dealership_idx;
DROP INDEX IF EXISTS sms_templates_category_idx;
DROP INDEX IF EXISTS sms_templates_active_idx;
DROP INDEX IF EXISTS sms_phone_numbers_dealership_idx;
DROP INDEX IF EXISTS sms_phone_numbers_active_idx;
DROP INDEX IF EXISTS sms_phone_numbers_twilio_sid_idx;
DROP INDEX IF EXISTS sms_campaigns_dealership_idx;
DROP INDEX IF EXISTS sms_campaigns_status_idx;
DROP INDEX IF EXISTS sms_campaigns_scheduled_idx;
DROP INDEX IF EXISTS sms_opt_outs_dealership_idx;
DROP INDEX IF EXISTS sms_opt_outs_customer_idx;
DROP INDEX IF EXISTS sms_opt_outs_hash_idx;
