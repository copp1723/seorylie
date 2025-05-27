-- Migration: Secure credentials storage for Twilio and other services
-- This adds tables for encrypted credential storage per dealership

-- Create table for storing encrypted credentials
CREATE TABLE IF NOT EXISTS dealership_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one active credential set per dealership per provider
    UNIQUE(dealership_id, provider)
);

-- Create table for credential activity logging (audit trail)
CREATE TABLE IF NOT EXISTS credential_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- created, updated, rotated, validated, etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45), -- Support IPv6
    user_id INTEGER, -- Would reference users table if available
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- Index for audit queries
    INDEX idx_credential_log_dealership_provider (dealership_id, provider),
    INDEX idx_credential_log_timestamp (timestamp),
    INDEX idx_credential_log_action (action)
);

-- Create indexes for performance
CREATE INDEX idx_dealership_credentials_dealership ON dealership_credentials(dealership_id);
CREATE INDEX idx_dealership_credentials_provider ON dealership_credentials(provider);
CREATE INDEX idx_dealership_credentials_active ON dealership_credentials(is_active) WHERE is_active = true;

-- Add missing column to sms_messages for encrypted phone storage
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS encrypted_phone TEXT;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for dealership_credentials
CREATE TRIGGER update_dealership_credentials_updated_at 
    BEFORE UPDATE ON dealership_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default credentials configuration for existing dealerships
-- This would typically be done through the application, but for migration purposes:
INSERT INTO dealership_credentials (dealership_id, provider, encrypted_credentials, is_active)
SELECT 
    id, 
    'twilio', 
    'default_encrypted_placeholder', -- This should be replaced with actual encrypted credentials
    false -- Set to false initially, require manual activation
FROM dealerships 
WHERE NOT EXISTS (
    SELECT 1 FROM dealership_credentials dc 
    WHERE dc.dealership_id = dealerships.id AND dc.provider = 'twilio'
);

-- Create view for active credentials (without sensitive data)
CREATE OR REPLACE VIEW active_credentials_summary AS
SELECT 
    dc.dealership_id,
    dc.provider,
    dc.is_active,
    dc.created_at,
    dc.updated_at,
    d.name as dealership_name
FROM dealership_credentials dc
JOIN dealerships d ON dc.dealership_id = d.id
WHERE dc.is_active = true;

-- Grant appropriate permissions
-- GRANT SELECT, INSERT, UPDATE ON dealership_credentials TO app_user;
-- GRANT SELECT, INSERT ON credential_activity_log TO app_user;
-- GRANT SELECT ON active_credentials_summary TO app_user;