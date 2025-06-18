-- Multi-tenant GA4 integration tables (Production-ready schema)
-- Aligned with dealerships table instead of separate tenants table

-- 1. GA4 Properties table - maps each dealership to their GA4 properties
CREATE TABLE IF NOT EXISTS ga4_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  property_id VARCHAR(32) NOT NULL, -- GA4 property ID, e.g. '320759942'
  property_name TEXT,
  measurement_id VARCHAR(30), -- G-XXXXXXXXXX format
  website_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sync_status VARCHAR(16) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'active', 'error', 'revoked')),
  access_granted_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dealership_id, property_id)
);

-- 2. GA4 Report Cache - for performance and quota management
CREATE TABLE IF NOT EXISTS ga4_report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  property_id VARCHAR(32) NOT NULL,
  report_type TEXT NOT NULL,
  date_range TEXT NOT NULL,
  dimensions JSONB,
  metrics JSONB,
  filters JSONB,
  report_data JSONB NOT NULL,
  cache_key TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. GA4 API Usage - track API usage per dealership for monitoring/quota
CREATE TABLE IF NOT EXISTS ga4_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  property_id VARCHAR(32) NOT NULL,
  endpoint TEXT NOT NULL,
  api_method VARCHAR(50) NOT NULL,
  request_count INTEGER DEFAULT 1,
  quota_consumed INTEGER DEFAULT 1,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  status_code INTEGER,
  error_message TEXT,
  request_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. GA4 Service Account - for managing service accounts (supports rotation)
CREATE TABLE IF NOT EXISTS ga4_service_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(16) NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  service_account_email TEXT NOT NULL UNIQUE,
  project_id TEXT,
  key_file_path TEXT, -- Path to key file (not storing key in DB)
  key_id TEXT,
  quota_limits JSONB DEFAULT '{"daily": 50000, "per_property_daily": 25000}',
  status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'rotating')),
  is_primary BOOLEAN DEFAULT FALSE,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. GA4 Sync History - track sync operations for debugging
CREATE TABLE IF NOT EXISTS ga4_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  property_id VARCHAR(32) NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  records_processed INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_details JSONB,
  metadata JSONB
);

-- Create indexes for performance
CREATE INDEX idx_ga4_properties_dealership_active ON ga4_properties(dealership_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_ga4_properties_sync_status ON ga4_properties(sync_status);
CREATE INDEX idx_ga4_properties_last_sync ON ga4_properties(last_sync_at);

CREATE INDEX idx_ga4_report_cache_dealership ON ga4_report_cache(dealership_id);
CREATE INDEX idx_ga4_report_cache_expires ON ga4_report_cache(expires_at);
CREATE INDEX idx_ga4_report_cache_key ON ga4_report_cache(cache_key);

CREATE INDEX idx_ga4_api_usage_dealership_created ON ga4_api_usage(dealership_id, created_at);
CREATE INDEX idx_ga4_api_usage_property_created ON ga4_api_usage(property_id, created_at);
CREATE INDEX idx_ga4_api_usage_success ON ga4_api_usage(success);

CREATE INDEX idx_ga4_sync_history_dealership ON ga4_sync_history(dealership_id);
CREATE INDEX idx_ga4_sync_history_property ON ga4_sync_history(property_id);
CREATE INDEX idx_ga4_sync_history_status ON ga4_sync_history(status);

-- Create update triggers
CREATE OR REPLACE FUNCTION update_ga4_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ga4_properties_updated_at
  BEFORE UPDATE ON ga4_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_ga4_updated_at();

-- Insert the primary service account
INSERT INTO ga4_service_account (
  service_account_email, 
  key_file_path, 
  project_id,
  environment,
  is_primary,
  activated_at
)
VALUES (
  'seo-ga4-service@onekeel-seo.iam.gserviceaccount.com',
  './server/config/ga4-service-account-key.json',
  'onekeel-seo',
  'production',
  TRUE,
  NOW()
) ON CONFLICT (service_account_email) DO UPDATE SET
  key_file_path = EXCLUDED.key_file_path,
  is_primary = TRUE,
  activated_at = NOW();

-- Add comments for documentation
COMMENT ON TABLE ga4_properties IS 'Maps dealerships to their GA4 properties with multi-property support';
COMMENT ON TABLE ga4_report_cache IS 'Caches GA4 reports to reduce API calls and improve performance';
COMMENT ON TABLE ga4_api_usage IS 'Tracks GA4 API usage for quota management and monitoring';
COMMENT ON TABLE ga4_service_account IS 'Manages GA4 service accounts with support for key rotation';
COMMENT ON TABLE ga4_sync_history IS 'Audit trail of GA4 sync operations for debugging';

COMMENT ON COLUMN ga4_properties.sync_status IS 'pending: awaiting access, active: working, error: access issues, revoked: access removed';
COMMENT ON COLUMN ga4_service_account.quota_limits IS 'JSON object with quota configuration per environment';