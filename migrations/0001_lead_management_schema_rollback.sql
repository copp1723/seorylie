-- Rollback Migration 0001: Lead Management Schema
-- Safely removes all lead management tables and functions
-- WARNING: This will permanently delete all lead and conversation data

-- Drop views first
DROP VIEW IF EXISTS conversation_metrics;
DROP VIEW IF EXISTS lead_pipeline_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_handovers_updated_at ON handovers;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_vehicle_interests_updated_at ON vehicle_interests;
DROP TRIGGER IF EXISTS update_lead_sources_updated_at ON lead_sources;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS lead_activities CASCADE;
DROP TABLE IF EXISTS handovers CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS vehicle_interests CASCADE;
DROP TABLE IF EXISTS lead_sources CASCADE;

-- Drop custom functions
DROP FUNCTION IF EXISTS generate_lead_dedup_hash(UUID, VARCHAR(50), INTEGER, VARCHAR(100), VARCHAR(100));
DROP FUNCTION IF EXISTS generate_customer_dedup_hash(VARCHAR(255), VARCHAR(50), VARCHAR(255));
DROP FUNCTION IF EXISTS generate_lead_number(INTEGER);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Note: We don't drop the uuid-ossp extension as other parts of the system may use it