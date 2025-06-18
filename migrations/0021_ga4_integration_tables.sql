-- Migration: 0021_ga4_integration_tables.sql
-- Description: Creates Google Analytics 4 integration tables
-- Date: 2025-01-28

-- Create GA4 service accounts table for storing credentials
CREATE TABLE IF NOT EXISTS ga4_service_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    encrypted_key TEXT NOT NULL, -- Encrypted JSON key
    key_hash VARCHAR(64) NOT NULL, -- For quick lookups without decryption
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id, email)
);

-- Create GA4 properties table for mapping properties to tenants
CREATE TABLE IF NOT EXISTS ga4_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    service_account_id UUID REFERENCES ga4_service_accounts(id) ON DELETE CASCADE,
    property_id VARCHAR(255) NOT NULL, -- GA4 property ID
    property_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),
    webstream_id VARCHAR(255),
    measurement_id VARCHAR(255), -- G-XXXXXXXXXX
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    currency VARCHAR(10) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id, property_id),
    CONSTRAINT valid_sync_status CHECK (sync_status IN ('pending', 'syncing', 'success', 'error'))
);

-- Create GA4 report cache table for performance
CREATE TABLE IF NOT EXISTS ga4_report_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES ga4_properties(id) ON DELETE CASCADE,
    report_type VARCHAR(100) NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '[]',
    metrics JSONB NOT NULL DEFAULT '[]',
    filters JSONB DEFAULT '{}',
    report_data JSONB NOT NULL,
    data_hash VARCHAR(64) NOT NULL, -- SHA256 of report parameters
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, data_hash)
);

-- Create GA4 API usage tracking table
CREATE TABLE IF NOT EXISTS ga4_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES ga4_properties(id) ON DELETE CASCADE,
    api_method VARCHAR(255) NOT NULL,
    request_date DATE NOT NULL,
    request_count INTEGER DEFAULT 1,
    token_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, property_id, api_method, request_date)
);

-- Create GA4 data streams table for tracking multiple data sources
CREATE TABLE IF NOT EXISTS ga4_data_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES ga4_properties(id) ON DELETE CASCADE,
    stream_id VARCHAR(255) NOT NULL,
    stream_name VARCHAR(255) NOT NULL,
    stream_type VARCHAR(50) NOT NULL,
    measurement_id VARCHAR(255),
    firebase_app_id VARCHAR(255),
    package_name VARCHAR(255),
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, stream_id),
    CONSTRAINT valid_stream_type CHECK (stream_type IN ('WEB', 'IOS', 'ANDROID'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ga4_service_accounts_tenant_id ON ga4_service_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ga4_service_accounts_email ON ga4_service_accounts(email);
CREATE INDEX IF NOT EXISTS idx_ga4_service_accounts_key_hash ON ga4_service_accounts(key_hash);
CREATE INDEX IF NOT EXISTS idx_ga4_properties_tenant_id ON ga4_properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ga4_properties_service_account_id ON ga4_properties(service_account_id);
CREATE INDEX IF NOT EXISTS idx_ga4_properties_measurement_id ON ga4_properties(measurement_id);
CREATE INDEX IF NOT EXISTS idx_ga4_report_cache_property_id ON ga4_report_cache(property_id);
CREATE INDEX IF NOT EXISTS idx_ga4_report_cache_data_hash ON ga4_report_cache(data_hash);
CREATE INDEX IF NOT EXISTS idx_ga4_report_cache_expires_at ON ga4_report_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ga4_api_usage_tenant_id ON ga4_api_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ga4_api_usage_property_id ON ga4_api_usage(property_id);
CREATE INDEX IF NOT EXISTS idx_ga4_api_usage_request_date ON ga4_api_usage(request_date DESC);
CREATE INDEX IF NOT EXISTS idx_ga4_data_streams_property_id ON ga4_data_streams(property_id);

-- Add updated_at triggers
CREATE TRIGGER update_ga4_service_accounts_updated_at BEFORE UPDATE ON ga4_service_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ga4_properties_updated_at BEFORE UPDATE ON ga4_properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ga4_api_usage_updated_at BEFORE UPDATE ON ga4_api_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ga4_data_streams_updated_at BEFORE UPDATE ON ga4_data_streams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE ga4_service_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_report_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_data_streams ENABLE ROW LEVEL SECURITY;

-- GA4 service accounts accessible by tenant members
CREATE POLICY ga4_service_accounts_tenant_access ON ga4_service_accounts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = ga4_service_accounts.tenant_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- GA4 properties accessible by tenant members
CREATE POLICY ga4_properties_tenant_access ON ga4_properties
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = ga4_properties.tenant_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- GA4 report cache accessible by property access
CREATE POLICY ga4_report_cache_property_access ON ga4_report_cache
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM ga4_properties
            JOIN user_tenants ON user_tenants.tenant_id = ga4_properties.tenant_id
            WHERE ga4_properties.id = ga4_report_cache.property_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- GA4 API usage accessible by tenant members
CREATE POLICY ga4_api_usage_tenant_access ON ga4_api_usage
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.tenant_id = ga4_api_usage.tenant_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- GA4 data streams accessible by property access
CREATE POLICY ga4_data_streams_property_access ON ga4_data_streams
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM ga4_properties
            JOIN user_tenants ON user_tenants.tenant_id = ga4_properties.tenant_id
            WHERE ga4_properties.id = ga4_data_streams.property_id
            AND user_tenants.user_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON ga4_service_accounts TO authenticated;
GRANT ALL ON ga4_properties TO authenticated;
GRANT ALL ON ga4_report_cache TO authenticated;
GRANT ALL ON ga4_api_usage TO authenticated;
GRANT ALL ON ga4_data_streams TO authenticated;

-- Comments for documentation
COMMENT ON TABLE ga4_service_accounts IS 'Stores encrypted Google Analytics service account credentials per tenant';
COMMENT ON TABLE ga4_properties IS 'Maps GA4 properties to tenants with configuration';
COMMENT ON TABLE ga4_report_cache IS 'Caches GA4 report data for performance optimization';
COMMENT ON TABLE ga4_api_usage IS 'Tracks GA4 API usage for monitoring and rate limiting';
COMMENT ON TABLE ga4_data_streams IS 'Manages multiple data streams (web, iOS, Android) per GA4 property';
COMMENT ON COLUMN ga4_service_accounts.encrypted_key IS 'AES-256 encrypted service account JSON key';
COMMENT ON COLUMN ga4_service_accounts.key_hash IS 'SHA256 hash for credential verification without decryption';
COMMENT ON COLUMN ga4_properties.measurement_id IS 'The G-XXXXXXXXXX ID used in gtag.js';
COMMENT ON COLUMN ga4_report_cache.data_hash IS 'SHA256 hash of report parameters for cache key';