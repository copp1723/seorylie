-- Rollback Migration: 0012_intent_detection_system_rollback.sql
-- Description: Rolls back intent detection system tables and functions for ADF-07
-- Author: ADF Development Team
-- Date: 2025-05-29

-- Start transaction
BEGIN;

-- Enable error handling
DO $$
BEGIN
    -- Add version info to migrations table for rollback
    INSERT INTO migrations (name, applied_at)
    VALUES ('0012_intent_detection_system_rollback', NOW());
    
    -- =============================================
    -- 1. Drop helper functions (drop in reverse order of creation)
    -- =============================================
    
    -- Drop engagement metrics function
    DROP FUNCTION IF EXISTS update_engagement_metrics(INTEGER, INTEGER);
    
    -- Drop intent metrics function
    DROP FUNCTION IF EXISTS update_intent_metrics(INTEGER, VARCHAR, VARCHAR, INTEGER);
    
    -- Drop intent trigger record function
    DROP FUNCTION IF EXISTS record_intent_trigger(INTEGER, INTEGER, VARCHAR, VARCHAR, DECIMAL, JSONB, INTEGER);
    
    -- Drop latest intent trigger function
    DROP FUNCTION IF EXISTS get_latest_intent_trigger(INTEGER);
    
    -- Drop has intent triggers function
    DROP FUNCTION IF EXISTS has_intent_triggers(INTEGER);
    
    -- =============================================
    -- 2. Drop tables (drop in reverse order of creation to avoid foreign key issues)
    -- =============================================
    
    -- First drop indexes (not strictly necessary as dropping tables drops their indexes)
    DROP INDEX IF EXISTS idx_engagement_conversation_id;
    DROP INDEX IF EXISTS idx_engagement_dealership_id;
    DROP INDEX IF EXISTS idx_engagement_score;
    DROP INDEX IF EXISTS idx_engagement_level;
    DROP INDEX IF EXISTS idx_last_customer_message;
    
    DROP INDEX IF EXISTS idx_intent_metrics_dealership_id;
    DROP INDEX IF EXISTS idx_intent_metrics_date;
    DROP INDEX IF EXISTS idx_intent_metrics_trigger_type;
    
    DROP INDEX IF EXISTS idx_intent_rules_rule_id;
    DROP INDEX IF EXISTS idx_intent_rules_is_active;
    DROP INDEX IF EXISTS idx_intent_rules_priority;
    DROP INDEX IF EXISTS idx_intent_rules_category;
    
    DROP INDEX IF EXISTS idx_intent_events_conversation_id;
    DROP INDEX IF EXISTS idx_intent_events_dealership_id;
    DROP INDEX IF EXISTS idx_intent_events_trigger_type;
    DROP INDEX IF EXISTS idx_intent_events_triggered_at;
    DROP INDEX IF EXISTS idx_intent_events_processed;
    
    -- Drop tables in correct order (child tables first to avoid FK constraints)
    DROP TABLE IF EXISTS conversation_engagement_metrics;
    DROP TABLE IF EXISTS intent_detection_metrics;
    DROP TABLE IF EXISTS intent_detection_events;
    DROP TABLE IF EXISTS intent_detection_rules;
    
    -- =============================================
    -- 3. Remove columns from conversations table
    -- =============================================
    
    -- Drop index on handover_triggered_at
    DROP INDEX IF EXISTS idx_conversations_handover_triggered_at;
    
    -- Remove columns from conversations table
    ALTER TABLE conversations DROP COLUMN IF EXISTS handover_trigger_details;
    ALTER TABLE conversations DROP COLUMN IF EXISTS handover_trigger_type;
    ALTER TABLE conversations DROP COLUMN IF EXISTS handover_triggered_at;
    
    -- =============================================
    -- 4. Remove version info from migrations table
    -- =============================================
    
    DELETE FROM migrations WHERE name = '0012_intent_detection_system';
    
    RAISE NOTICE 'Intent detection system rollback completed successfully';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Rollback migration failed: %', SQLERRM;
        ROLLBACK;
END $$;

COMMIT;
