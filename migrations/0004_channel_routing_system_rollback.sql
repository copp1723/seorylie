-- Rollback migration for channel routing system
-- This undoes changes from 0004_channel_routing_system.sql

-- Drop the view
DROP VIEW IF EXISTS channel_routing_analytics;

-- Drop triggers
DROP TRIGGER IF EXISTS update_customer_channel_preferences_updated_at ON customer_channel_preferences;
DROP TRIGGER IF EXISTS update_dealership_channel_rules_updated_at ON dealership_channel_rules;

-- Drop the function
DROP FUNCTION IF EXISTS update_channel_routing_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_customer_channel_preferences_customer;
DROP INDEX IF EXISTS idx_customer_channel_preferences_priority;
DROP INDEX IF EXISTS idx_dealership_channel_rules_lookup;
DROP INDEX IF EXISTS idx_message_delivery_customer;
DROP INDEX IF EXISTS idx_message_delivery_conversation;
DROP INDEX IF EXISTS idx_message_delivery_status;
DROP INDEX IF EXISTS idx_message_delivery_timestamp;
DROP INDEX IF EXISTS idx_message_delivery_external_id;
DROP INDEX IF EXISTS idx_channel_availability_lookup;
DROP INDEX IF EXISTS idx_channel_performance_date;
DROP INDEX IF EXISTS idx_fallback_chains_dealership;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS channel_fallback_chains;
DROP TABLE IF EXISTS channel_performance_metrics;
DROP TABLE IF EXISTS channel_availability;
DROP TABLE IF EXISTS message_delivery_attempts;
DROP TABLE IF EXISTS dealership_channel_rules;
DROP TABLE IF EXISTS customer_channel_preferences;

-- Drop custom ENUM types
DROP TYPE IF EXISTS routing_reason;
DROP TYPE IF EXISTS channel_preference_type;
DROP TYPE IF EXISTS delivery_status;
DROP TYPE IF EXISTS communication_channel;