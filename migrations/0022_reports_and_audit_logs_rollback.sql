-- Rollback Migration: 0022_reports_and_audit_logs_rollback.sql
-- Description: Rollback script for 0022_reports_and_audit_logs.sql
-- Date: 2025-01-28

-- Drop policies
DROP POLICY IF EXISTS reports_tenant_access ON reports;
DROP POLICY IF EXISTS audit_logs_admin_read ON audit_logs;
DROP POLICY IF EXISTS activity_logs_tenant_read ON activity_logs;
DROP POLICY IF EXISTS system_logs_super_admin_read ON system_logs;
DROP POLICY IF EXISTS security_events_admin_read ON security_events;

-- Drop triggers
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_old_logs();

-- Drop indexes
DROP INDEX IF EXISTS idx_reports_tenant_id;
DROP INDEX IF EXISTS idx_reports_user_id;
DROP INDEX IF EXISTS idx_reports_status;
DROP INDEX IF EXISTS idx_reports_report_type;
DROP INDEX IF EXISTS idx_reports_created_at;
DROP INDEX IF EXISTS idx_reports_expires_at;

DROP INDEX IF EXISTS idx_audit_logs_tenant_id;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_resource_type;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_request_id;

DROP INDEX IF EXISTS idx_activity_logs_tenant_id;
DROP INDEX IF EXISTS idx_activity_logs_user_id;
DROP INDEX IF EXISTS idx_activity_logs_activity_type;
DROP INDEX IF EXISTS idx_activity_logs_created_at;

DROP INDEX IF EXISTS idx_system_logs_log_level;
DROP INDEX IF EXISTS idx_system_logs_created_at;
DROP INDEX IF EXISTS idx_system_logs_request_id;

DROP INDEX IF EXISTS idx_security_events_event_type;
DROP INDEX IF EXISTS idx_security_events_severity;
DROP INDEX IF EXISTS idx_security_events_created_at;
DROP INDEX IF EXISTS idx_security_events_resolved;

-- Drop tables
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS reports;

-- Revoke permissions
-- REVOKE ALL ON reports FROM authenticated;
-- REVOKE SELECT ON audit_logs FROM authenticated;
-- REVOKE SELECT ON activity_logs FROM authenticated;
-- REVOKE SELECT ON system_logs FROM authenticated;
-- REVOKE SELECT ON security_events FROM authenticated;