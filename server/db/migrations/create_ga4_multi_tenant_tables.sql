-- Multi-tenant GA4 integration tables

-- 1. GA4 Properties table - maps each tenant to their GA4 properties
CREATE TABLE IF NOT EXISTS ga4_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  property_id VARCHAR(30) NOT NULL,
  property_name TEXT,
  measurement_id VARCHAR(30),
  website_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'active', 'error', 'disabled')),
  access_granted_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dealership_id, property_id)
);

-- 2. GA4 Service Account table - stores central service account info
CREATE TABLE IF NOT EXISTS ga4_service_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  key_file_path TEXT NOT NULL,
  project_id VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. GA4 Report Cache - caches reports per tenant/property
CREATE TABLE IF NOT EXISTS ga4_report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR(30) NOT NULL,
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  dimensions JSONB,
  metrics JSONB,
  report_data JSONB NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cache_key)
);

-- 4. GA4 API Usage tracking - track API usage per tenant
CREATE TABLE IF NOT EXISTS ga4_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  property_id VARCHAR(30) NOT NULL,
  api_method VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 1,
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ga4_properties_dealership ON ga4_properties(dealership_id);
CREATE INDEX idx_ga4_properties_active ON ga4_properties(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_ga4_properties_sync_status ON ga4_properties(sync_status);
CREATE INDEX idx_ga4_report_cache_dealership ON ga4_report_cache(dealership_id);
CREATE INDEX idx_ga4_report_cache_expires ON ga4_report_cache(expires_at);
CREATE INDEX idx_ga4_api_usage_dealership ON ga4_api_usage(dealership_id);
CREATE INDEX idx_ga4_api_usage_created ON ga4_api_usage(created_at);

-- Create update trigger for ga4_properties
CREATE TRIGGER trigger_update_ga4_properties_updated_at
  BEFORE UPDATE ON ga4_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_seoworks_tasks_updated_at();

-- Insert the service account info (will be populated by setup script)
-- This is a placeholder, actual values will come from your service account
INSERT INTO ga4_service_account (email, key_file_path, project_id)
VALUES (
  'seo-ga4-service@onekeel-seo.iam.gserviceaccount.com',
  './server/config/ga4-service-account-key.json',
  'onekeel-seo'
) ON CONFLICT (email) DO NOTHING;