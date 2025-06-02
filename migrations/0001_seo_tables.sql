-- Migration: 0001_seo_tables.sql
-- Description: Initial schema for Rylie SEO white-label platform
-- Creates tables for SEO requests, vendor reports, installation profiles, and GA4 reports
-- with proper sandbox isolation via foreign keys

-- Enable Row-Level Security for multi-tenant isolation
ALTER DATABASE CURRENT SET row_security = on;

-- Up Migration
-- =============================================================================

-- Create SEO requests table
CREATE TABLE IF NOT EXISTS seo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('page', 'blog', 'gbp', 'maintenance')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT,
    template TEXT,
    seo_title TEXT,
    meta_description TEXT,
    target_keywords TEXT[],
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    deadline DATE,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'needs_info')),
    category TEXT,
    word_count INTEGER,
    update_type TEXT,
    business_name TEXT,
    location_id TEXT,
    content TEXT,
    maintenance_type TEXT,
    urls TEXT[],
    issue TEXT,
    current_state TEXT,
    desired_state TEXT,
    request_data JSONB NOT NULL, -- Full request data as JSON
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create vendor reports table (white-labeled)
CREATE TABLE IF NOT EXISTS vendor_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES seo_requests(id) ON DELETE CASCADE,
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    original_report_url TEXT,
    original_report_s3_key TEXT,
    transformed_report_url TEXT,
    transformed_report_s3_key TEXT,
    report_type TEXT NOT NULL,
    report_data JSONB,
    vendor_name TEXT NOT NULL DEFAULT 'Rylie SEO', -- Always white-labeled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create installation profiles table
CREATE TABLE IF NOT EXISTS install_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    website TEXT NOT NULL,
    industry TEXT NOT NULL,
    primary_location JSONB NOT NULL,
    additional_locations JSONB[],
    contact_person JSONB NOT NULL,
    social_profiles JSONB,
    business_hours JSONB,
    google_business_profile JSONB,
    seo_goals TEXT[] NOT NULL,
    target_keywords TEXT[] NOT NULL,
    competitors TEXT[],
    analytics_setup JSONB NOT NULL,
    additional_notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create GA4 reports table
CREATE TABLE IF NOT EXISTS ga4_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metrics JSONB NOT NULL,
    top_pages JSONB,
    top_keywords JSONB,
    device_breakdown JSONB,
    report_summary TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create table for vendor communication (HMAC secured)
CREATE TABLE IF NOT EXISTS vendor_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES seo_requests(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    hmac_signature TEXT,
    ip_address TEXT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create table for real-time publish notifications
CREATE TABLE IF NOT EXISTS publish_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES seo_requests(id) ON DELETE CASCADE,
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    publish_type TEXT NOT NULL CHECK (publish_type IN ('page', 'blog', 'gbp', 'maintenance')),
    published_url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_seo_requests_sandbox ON seo_requests(sandbox_id);
CREATE INDEX idx_seo_requests_type ON seo_requests(type);
CREATE INDEX idx_seo_requests_status ON seo_requests(status);
CREATE INDEX idx_vendor_reports_request ON vendor_reports(request_id);
CREATE INDEX idx_vendor_reports_sandbox ON vendor_reports(sandbox_id);
CREATE INDEX idx_install_profiles_sandbox ON install_profiles(sandbox_id);
CREATE INDEX idx_ga4_reports_sandbox ON ga4_reports(sandbox_id);
CREATE INDEX idx_ga4_reports_period ON ga4_reports(period_start, period_end);
CREATE INDEX idx_publish_notifications_sandbox ON publish_notifications(sandbox_id);
CREATE INDEX idx_publish_notifications_request ON publish_notifications(request_id);

-- Create Row-Level Security policies for tenant isolation
ALTER TABLE seo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE install_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies that restrict access to rows with matching sandbox_id
CREATE POLICY seo_requests_isolation ON seo_requests
    USING (sandbox_id = current_setting('app.current_sandbox_id', true)::UUID);

CREATE POLICY vendor_reports_isolation ON vendor_reports
    USING (sandbox_id = current_setting('app.current_sandbox_id', true)::UUID);

CREATE POLICY install_profiles_isolation ON install_profiles
    USING (sandbox_id = current_setting('app.current_sandbox_id', true)::UUID);

CREATE POLICY ga4_reports_isolation ON ga4_reports
    USING (sandbox_id = current_setting('app.current_sandbox_id', true)::UUID);

CREATE POLICY publish_notifications_isolation ON publish_notifications
    USING (sandbox_id = current_setting('app.current_sandbox_id', true)::UUID);

-- Add triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seo_requests_modtime
    BEFORE UPDATE ON seo_requests
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_vendor_reports_modtime
    BEFORE UPDATE ON vendor_reports
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_install_profiles_modtime
    BEFORE UPDATE ON install_profiles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Down Migration (Rollback)
-- =============================================================================

-- -- Drop triggers
-- DROP TRIGGER IF EXISTS update_seo_requests_modtime ON seo_requests;
-- DROP TRIGGER IF EXISTS update_vendor_reports_modtime ON vendor_reports;
-- DROP TRIGGER IF EXISTS update_install_profiles_modtime ON install_profiles;
-- DROP FUNCTION IF EXISTS update_modified_column();

-- -- Drop policies
-- DROP POLICY IF EXISTS seo_requests_isolation ON seo_requests;
-- DROP POLICY IF EXISTS vendor_reports_isolation ON vendor_reports;
-- DROP POLICY IF EXISTS install_profiles_isolation ON install_profiles;
-- DROP POLICY IF EXISTS ga4_reports_isolation ON ga4_reports;
-- DROP POLICY IF EXISTS publish_notifications_isolation ON publish_notifications;

-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_seo_requests_sandbox;
-- DROP INDEX IF EXISTS idx_seo_requests_type;
-- DROP INDEX IF EXISTS idx_seo_requests_status;
-- DROP INDEX IF EXISTS idx_vendor_reports_request;
-- DROP INDEX IF EXISTS idx_vendor_reports_sandbox;
-- DROP INDEX IF EXISTS idx_install_profiles_sandbox;
-- DROP INDEX IF EXISTS idx_ga4_reports_sandbox;
-- DROP INDEX IF EXISTS idx_ga4_reports_period;
-- DROP INDEX IF EXISTS idx_publish_notifications_sandbox;
-- DROP INDEX IF EXISTS idx_publish_notifications_request;

-- -- Drop tables
-- DROP TABLE IF EXISTS publish_notifications;
-- DROP TABLE IF EXISTS vendor_communications;
-- DROP TABLE IF EXISTS ga4_reports;
-- DROP TABLE IF EXISTS install_profiles;
-- DROP TABLE IF EXISTS vendor_reports;
-- DROP TABLE IF EXISTS seo_requests;

-- -- Disable Row-Level Security
-- ALTER DATABASE CURRENT SET row_security = off;
