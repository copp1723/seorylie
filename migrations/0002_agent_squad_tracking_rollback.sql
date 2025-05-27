-- Rollback: Remove Agent Squad tracking and configuration tables
-- Author: Claude Code Agent Squad Integration
-- Date: 2025-05-26

-- Drop view first
DROP VIEW IF EXISTS agent_squad_performance;

-- Drop indexes
DROP INDEX IF EXISTS idx_agent_analytics_created_at;
DROP INDEX IF EXISTS idx_agent_analytics_agent;
DROP INDEX IF EXISTS idx_agent_analytics_dealership;
DROP INDEX IF EXISTS idx_messages_selected_agent;

-- Drop tables (in reverse order of creation)
DROP TABLE IF EXISTS agent_squad_analytics;
DROP TABLE IF EXISTS agent_squad_config;

-- Remove Agent Squad columns from messages table
ALTER TABLE messages 
DROP COLUMN IF EXISTS agent_reasoning,
DROP COLUMN IF EXISTS processing_time_ms,
DROP COLUMN IF EXISTS agent_confidence,
DROP COLUMN IF EXISTS selected_agent;
