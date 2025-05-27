-- Rollback migration for agent dashboard system
-- This undoes changes from 0005_agent_dashboard_system.sql

-- Drop the view
DROP VIEW IF EXISTS agent_dashboard_summary;

-- Drop triggers
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
DROP TRIGGER IF EXISTS update_conversation_handovers_updated_at ON conversation_handovers;
DROP TRIGGER IF EXISTS update_agent_quick_responses_updated_at ON agent_quick_responses;
DROP TRIGGER IF EXISTS update_conversation_agent_notes_updated_at ON conversation_agent_notes;

-- Drop the function
DROP FUNCTION IF EXISTS update_agent_dashboard_updated_at();

-- Drop indexes (they'll be dropped with tables, but listing for completeness)
DROP INDEX IF EXISTS idx_agents_dealership;
DROP INDEX IF EXISTS idx_agents_status;
DROP INDEX IF EXISTS idx_agents_email;
DROP INDEX IF EXISTS idx_agents_role;
DROP INDEX IF EXISTS idx_agent_sessions_agent;
DROP INDEX IF EXISTS idx_agent_sessions_token;
DROP INDEX IF EXISTS idx_agent_sessions_expires;
DROP INDEX IF EXISTS idx_handovers_conversation;
DROP INDEX IF EXISTS idx_handovers_status;
DROP INDEX IF EXISTS idx_handovers_priority;
DROP INDEX IF EXISTS idx_handovers_claimed_by;
DROP INDEX IF EXISTS idx_handovers_requested_at;
DROP INDEX IF EXISTS idx_agent_assignments_agent;
DROP INDEX IF EXISTS idx_agent_assignments_conversation;
DROP INDEX IF EXISTS idx_agent_assignments_handover;
DROP INDEX IF EXISTS idx_agent_performance_date;
DROP INDEX IF EXISTS idx_agent_notifications_agent;
DROP INDEX IF EXISTS idx_agent_notifications_type;
DROP INDEX IF EXISTS idx_agent_notifications_priority;
DROP INDEX IF EXISTS idx_quick_responses_agent;
DROP INDEX IF EXISTS idx_quick_responses_dealership;
DROP INDEX IF EXISTS idx_quick_responses_category;
DROP INDEX IF EXISTS idx_conversation_notes_conversation;
DROP INDEX IF EXISTS idx_conversation_notes_agent;
DROP INDEX IF EXISTS idx_conversation_notes_type;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS conversation_agent_notes;
DROP TABLE IF EXISTS agent_quick_responses;
DROP TABLE IF EXISTS agent_notifications;
DROP TABLE IF EXISTS agent_performance_metrics;
DROP TABLE IF EXISTS agent_conversation_assignments;
DROP TABLE IF EXISTS conversation_handovers;
DROP TABLE IF EXISTS agent_sessions;
DROP TABLE IF EXISTS agents;

-- Drop custom ENUM types
DROP TYPE IF EXISTS conversation_priority;
DROP TYPE IF EXISTS handover_reason;
DROP TYPE IF EXISTS handover_status;
DROP TYPE IF EXISTS agent_status;
DROP TYPE IF EXISTS agent_role;