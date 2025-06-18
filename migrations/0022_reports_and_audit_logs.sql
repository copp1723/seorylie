-- Migration: 0022_reports_and_audit_logs.sql
-- Description: Creates reports and audit logging tables
-- Date: 2025-01-28

-- Create reports table for storing generated reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    report_type VARCHAR(100) NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    format VARCHAR(50) DEFAULT 'json',
    parameters JSONB DEFAULT '{}',
    data JSONB,
    file_url TEXT,
    file_size_bytes BIGINT,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_format CHECK (format IN ('json', 'csv', 'xlsx', 'pdf', 'html'))
);

-- Create audit logs table for tracking system activities
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    resource_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    session_id UUID,
    changes JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'success',
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_audit_status CHECK (status IN ('success', 'failure', 'error'))
);

-- Create activity logs table for user activity tracking
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create system logs table for application-level logging
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_level VARCHAR(20) NOT NULL,
    logger_name VARCHAR(255),
    message TEXT NOT NULL,
    error_stack TEXT,
    context JSONB DEFAULT '{}',
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_log_level CHECK (log_level IN ('debug', 'info', 'warn', 'error', 'fatal'))
);

-- Create security events table for security-related activities
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_tenant_id ON reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_report_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_expires_at ON reports(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_log_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);

-- Add updated_at trigger for reports
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create partitioning for high-volume log tables (optional, for PostgreSQL 11+)
-- Partition audit_logs by month
-- ALTER TABLE audit_logs PARTITION BY RANGE (created_at);
-- CREATE TABLE audit_logs_y2025m01 PARTITION OF audit_logs
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Add RLS policies
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Reports accessible by tenant members
CREATE POLICY reports_tenant_access ON reports
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = reports.tenant_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- Audit logs readable by tenant admins only
CREATE POLICY audit_logs_admin_read ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = audit_logs.tenant_id
            AND user_tenants.user_id = auth.uid()
            AND user_tenants.role IN ('owner', 'admin')
        )
    );

-- Activity logs readable by tenant members
CREATE POLICY activity_logs_tenant_read ON activity_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = activity_logs.tenant_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- System logs readable by super admins only
CREATE POLICY system_logs_super_admin_read ON system_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'super_admin'
        )
    );

-- Security events readable by tenant admins and super admins
CREATE POLICY security_events_admin_read ON security_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'super_admin'
        )
        OR EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = security_events.tenant_id
            AND user_tenants.user_id = auth.uid()
            AND user_tenants.role IN ('owner', 'admin')
        )
    );

-- Grant permissions
GRANT ALL ON reports TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON activity_logs TO authenticated;
GRANT SELECT ON system_logs TO authenticated;
GRANT SELECT ON security_events TO authenticated;

-- Create cleanup function for old logs (optional)
CREATE OR REPLACE FUNCTION cleanup_old_logs() RETURNS void AS $$
BEGIN
    -- Delete audit logs older than 90 days
    DELETE FROM audit_logs WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
    
    -- Delete activity logs older than 30 days
    DELETE FROM activity_logs WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
    
    -- Delete system logs older than 7 days
    DELETE FROM system_logs WHERE created_at < CURRENT_DATE - INTERVAL '7 days';
    
    -- Delete expired reports
    DELETE FROM reports WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE reports IS 'Stores generated reports with their data and metadata';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system actions';
COMMENT ON TABLE activity_logs IS 'User activity tracking for analytics and monitoring';
COMMENT ON TABLE system_logs IS 'Application-level logging for debugging and monitoring';
COMMENT ON TABLE security_events IS 'Security-related events requiring attention';
COMMENT ON COLUMN reports.format IS 'Output format: json, csv, xlsx, pdf, html';
COMMENT ON COLUMN audit_logs.changes IS 'JSON diff of before/after values for updates';
COMMENT ON COLUMN security_events.severity IS 'Event severity: low, medium, high, critical';