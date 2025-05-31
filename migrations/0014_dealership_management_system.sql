-- Migration: 0014_dealership_management_system.sql
-- Description: Comprehensive dealership management system for multi-tenant operations
-- Author: Josh Copp
-- Date: 2025-05-30

BEGIN;

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    operation TEXT NOT NULL,
    changed_by TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at);

-- 1. Dealerships table (master record)
CREATE TABLE IF NOT EXISTS dealerships (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    domain VARCHAR(100) UNIQUE NOT NULL, -- For subdomain: domain.yoursaas.com
    email_domain VARCHAR(100), -- @dealership.com
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, suspended, trial, inactive
    tier VARCHAR(20) NOT NULL DEFAULT 'standard', -- trial, standard, premium, enterprise
    logo_url TEXT,
    primary_color VARCHAR(20), -- Brand color (hex)
    secondary_color VARCHAR(20), -- Brand secondary color
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    phone VARCHAR(50),
    website VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    business_hours JSONB DEFAULT '{"monday":{"open":"09:00","close":"18:00"},"tuesday":{"open":"09:00","close":"18:00"},"wednesday":{"open":"09:00","close":"18:00"},"thursday":{"open":"09:00","close":"18:00"},"friday":{"open":"09:00","close":"18:00"},"saturday":{"open":"10:00","close":"16:00"},"sunday":{"open":"","close":""}}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    settings JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_dealerships_domain ON dealerships(domain);
CREATE INDEX IF NOT EXISTS idx_dealerships_status ON dealerships(status);
CREATE INDEX IF NOT EXISTS idx_dealerships_tier ON dealerships(tier);

-- 2. Dealership email configurations
CREATE TABLE IF NOT EXISTS dealership_email_configs (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Primary', -- Configuration name (e.g., "Primary", "Sales", "Service")
    email_address VARCHAR(255) NOT NULL, -- leads@dealership.com
    display_name VARCHAR(255), -- "ABC Honda Sales"
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_user VARCHAR(255) NOT NULL,
    imap_pass_encrypted TEXT NOT NULL, -- Encrypted password
    imap_use_ssl BOOLEAN NOT NULL DEFAULT true,
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_pass_encrypted TEXT,
    smtp_use_ssl BOOLEAN DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, error
    last_error TEXT,
    last_connected_at TIMESTAMP,
    polling_interval_ms INTEGER DEFAULT 300000, -- 5 minutes
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_configs_dealership ON dealership_email_configs(dealership_id);
CREATE INDEX IF NOT EXISTS idx_email_configs_status ON dealership_email_configs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_configs_primary ON dealership_email_configs(dealership_id) WHERE is_primary = true;

-- 3. Dealership users
CREATE TABLE IF NOT EXISTS dealership_users (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- owner, admin, manager, user, readonly
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, invited, suspended
    phone VARCHAR(50),
    title VARCHAR(100), -- Job title
    department VARCHAR(100),
    avatar_url TEXT,
    last_login_at TIMESTAMP,
    password_hash TEXT, -- Hashed password
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_dealership ON dealership_users(dealership_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON dealership_users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON dealership_users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON dealership_users(status);

-- 4. Dealership settings
CREATE TABLE IF NOT EXISTS dealership_settings (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'email', 'sms', 'ai', 'intent', 'handover', 'general'
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_unique ON dealership_settings(dealership_id, category, key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON dealership_settings(category);

-- 5. Dealership subscriptions
CREATE TABLE IF NOT EXISTS dealership_subscriptions (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL, -- 'trial', 'standard', 'premium', 'enterprise'
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'
    start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'annual'
    price_per_cycle DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    payment_method_id VARCHAR(255),
    external_subscription_id VARCHAR(255), -- ID from payment processor
    features JSONB NOT NULL DEFAULT '{}', -- Enabled features
    limits JSONB NOT NULL DEFAULT '{}', -- Usage limits
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_dealership ON dealership_subscriptions(dealership_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON dealership_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON dealership_subscriptions(end_date);

-- 6. Dealership API keys
CREATE TABLE IF NOT EXISTS dealership_api_keys (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Purpose of the key
    api_key_prefix VARCHAR(10) NOT NULL, -- First few chars of key (not encrypted)
    api_key_hash TEXT NOT NULL, -- Hashed API key
    scopes TEXT[] NOT NULL, -- Permissions: ['leads:read', 'leads:write', etc]
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, revoked
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_dealership ON dealership_api_keys(dealership_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON dealership_api_keys(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON dealership_api_keys(status);

-- 7. Dealership audit trail
CREATE TABLE IF NOT EXISTS dealership_audit_trail (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES dealership_users(id),
    action VARCHAR(100) NOT NULL, -- 'login', 'settings_change', 'user_invite', etc.
    resource_type VARCHAR(50), -- 'user', 'settings', 'email_config', etc.
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_dealership ON dealership_audit_trail(dealership_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON dealership_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON dealership_audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON dealership_audit_trail(created_at);

-- 8. Dealership integration configs
CREATE TABLE IF NOT EXISTS dealership_integrations (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL, -- 'crm', 'dms', 'analytics', etc.
    provider VARCHAR(50) NOT NULL, -- 'salesforce', 'hubspot', 'dealer.com', etc.
    config JSONB NOT NULL,
    credentials JSONB, -- Encrypted credentials
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'error'
    last_sync_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_integrations_dealership ON dealership_integrations(dealership_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON dealership_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON dealership_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON dealership_integrations(status);

-- Add dealership_id to existing ADF tables
ALTER TABLE adf_leads ADD COLUMN IF NOT EXISTS dealership_id INTEGER REFERENCES dealerships(id);
CREATE INDEX IF NOT EXISTS idx_adf_leads_dealership ON adf_leads(dealership_id);

-- Create functions for dealership operations

-- Function to create a new dealership
CREATE OR REPLACE FUNCTION create_dealership(
    p_name VARCHAR(255),
    p_domain VARCHAR(100),
    p_email_domain VARCHAR(100) DEFAULT NULL,
    p_tier VARCHAR(20) DEFAULT 'standard',
    p_created_by VARCHAR(255) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    dealership_id INTEGER;
BEGIN
    INSERT INTO dealerships (
        name, 
        domain, 
        email_domain, 
        tier, 
        created_by,
        updated_by
    ) VALUES (
        p_name, 
        p_domain, 
        COALESCE(p_email_domain, p_domain || '.com'), 
        p_tier, 
        p_created_by,
        p_created_by
    ) RETURNING id INTO dealership_id;
    
    -- Log the creation
    INSERT INTO dealership_audit_trail (
        dealership_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        dealership_id,
        'dealership_created',
        'dealership',
        dealership_id,
        jsonb_build_object(
            'name', p_name,
            'domain', p_domain,
            'tier', p_tier
        )
    );
    
    RETURN dealership_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add email configuration
CREATE OR REPLACE FUNCTION add_dealership_email_config(
    p_dealership_id INTEGER,
    p_email_address VARCHAR(255),
    p_imap_host VARCHAR(255),
    p_imap_port INTEGER,
    p_imap_user VARCHAR(255),
    p_imap_pass TEXT,
    p_is_primary BOOLEAN DEFAULT true,
    p_smtp_host VARCHAR(255) DEFAULT NULL,
    p_smtp_port INTEGER DEFAULT NULL,
    p_smtp_user VARCHAR(255) DEFAULT NULL,
    p_smtp_pass TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    config_id INTEGER;
    encrypted_imap_pass TEXT;
    encrypted_smtp_pass TEXT;
BEGIN
    -- In a real implementation, these would be properly encrypted
    -- This is a simplified version for demonstration
    encrypted_imap_pass := 'encrypted:' || p_imap_pass;
    encrypted_smtp_pass := CASE WHEN p_smtp_pass IS NOT NULL THEN 'encrypted:' || p_smtp_pass ELSE NULL END;
    
    -- If this is primary, set all others to non-primary
    IF p_is_primary THEN
        UPDATE dealership_email_configs 
        SET is_primary = false 
        WHERE dealership_id = p_dealership_id;
    END IF;
    
    INSERT INTO dealership_email_configs (
        dealership_id,
        email_address,
        imap_host,
        imap_port,
        imap_user,
        imap_pass_encrypted,
        is_primary,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass_encrypted
    ) VALUES (
        p_dealership_id,
        p_email_address,
        p_imap_host,
        p_imap_port,
        p_imap_user,
        encrypted_imap_pass,
        p_is_primary,
        p_smtp_host,
        p_smtp_port,
        p_smtp_user,
        encrypted_smtp_pass
    ) RETURNING id INTO config_id;
    
    -- Log the creation
    INSERT INTO dealership_audit_trail (
        dealership_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        p_dealership_id,
        'email_config_added',
        'email_config',
        config_id,
        jsonb_build_object(
            'email_address', p_email_address,
            'is_primary', p_is_primary
        )
    );
    
    RETURN config_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add a dealership user
CREATE OR REPLACE FUNCTION add_dealership_user(
    p_dealership_id INTEGER,
    p_email VARCHAR(255),
    p_name VARCHAR(255),
    p_role VARCHAR(50) DEFAULT 'user',
    p_created_by VARCHAR(255) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    user_id INTEGER;
BEGIN
    INSERT INTO dealership_users (
        dealership_id,
        email,
        name,
        role,
        status
    ) VALUES (
        p_dealership_id,
        p_email,
        p_name,
        p_role,
        'invited'
    ) RETURNING id INTO user_id;
    
    -- Log the creation
    INSERT INTO dealership_audit_trail (
        dealership_id,
        action,
        resource_type,
        resource_id,
        details
    ) VALUES (
        p_dealership_id,
        'user_invited',
        'user',
        user_id,
        jsonb_build_object(
            'email', p_email,
            'name', p_name,
            'role', p_role
        )
    );
    
    RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update dealership settings
CREATE OR REPLACE FUNCTION update_dealership_setting(
    p_dealership_id INTEGER,
    p_category VARCHAR(50),
    p_key VARCHAR(100),
    p_value JSONB,
    p_updated_by VARCHAR(255) DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    setting_exists BOOLEAN;
    old_value JSONB;
BEGIN
    -- Check if setting exists
    SELECT EXISTS (
        SELECT 1 FROM dealership_settings 
        WHERE dealership_id = p_dealership_id AND category = p_category AND key = p_key
    ) INTO setting_exists;
    
    IF setting_exists THEN
        -- Get old value for audit
        SELECT value INTO old_value FROM dealership_settings
        WHERE dealership_id = p_dealership_id AND category = p_category AND key = p_key;
        
        -- Update existing setting
        UPDATE dealership_settings
        SET value = p_value, updated_at = NOW(), updated_by = p_updated_by
        WHERE dealership_id = p_dealership_id AND category = p_category AND key = p_key;
    ELSE
        -- Insert new setting
        INSERT INTO dealership_settings (
            dealership_id, category, key, value, created_by, updated_by
        ) VALUES (
            p_dealership_id, p_category, p_key, p_value, p_updated_by, p_updated_by
        );
    END IF;
    
    -- Log the change
    INSERT INTO dealership_audit_trail (
        dealership_id,
        action,
        resource_type,
        details
    ) VALUES (
        p_dealership_id,
        CASE WHEN setting_exists THEN 'setting_updated' ELSE 'setting_created' END,
        'setting',
        jsonb_build_object(
            'category', p_category,
            'key', p_key,
            'old_value', old_value,
            'new_value', p_value
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for data isolation

-- Enable Row Level Security on tables
ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_email_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealership_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE adf_leads ENABLE ROW LEVEL SECURITY;

-- Create policies for dealership users
CREATE POLICY dealership_user_isolation ON dealership_users
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for dealership data
CREATE POLICY dealership_data_isolation ON dealerships
    USING (id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for email configs
CREATE POLICY email_config_isolation ON dealership_email_configs
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for settings
CREATE POLICY settings_isolation ON dealership_settings
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for subscriptions
CREATE POLICY subscription_isolation ON dealership_subscriptions
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for API keys
CREATE POLICY api_key_isolation ON dealership_api_keys
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for audit trail
CREATE POLICY audit_trail_isolation ON dealership_audit_trail
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for integrations
CREATE POLICY integration_isolation ON dealership_integrations
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create policies for ADF leads
CREATE POLICY adf_lead_isolation ON adf_leads
    USING (dealership_id = current_setting('app.current_dealership_id', true)::INTEGER);

-- Create triggers for audit logging

-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION log_table_changes() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            table_name, record_id, operation, changed_by, new_values
        ) VALUES (
            TG_TABLE_NAME, NEW.id, 'INSERT',
            COALESCE(current_setting('app.current_user', true), 'system'),
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            table_name, record_id, operation, changed_by, old_values, new_values
        ) VALUES (
            TG_TABLE_NAME, NEW.id, 'UPDATE',
            COALESCE(current_setting('app.current_user', true), 'system'),
            row_to_json(OLD), row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            table_name, record_id, operation, changed_by, old_values
        ) VALUES (
            TG_TABLE_NAME, OLD.id, 'DELETE',
            COALESCE(current_setting('app.current_user', true), 'system'),
            row_to_json(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to tables
CREATE TRIGGER dealerships_audit
AFTER INSERT OR UPDATE OR DELETE ON dealerships
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER email_configs_audit
AFTER INSERT OR UPDATE OR DELETE ON dealership_email_configs
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER users_audit
AFTER INSERT OR UPDATE OR DELETE ON dealership_users
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER settings_audit
AFTER INSERT OR UPDATE OR DELETE ON dealership_settings
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER subscriptions_audit
AFTER INSERT OR UPDATE OR DELETE ON dealership_subscriptions
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER api_keys_audit
AFTER INSERT OR UPDATE OR DELETE ON dealership_api_keys
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

CREATE TRIGGER integrations_audit
AFTER INSERT OR UPDATE OR DELETE ON dealership_integrations
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Insert sample data for testing

-- Sample dealership
INSERT INTO dealerships (
    name, 
    legal_name, 
    domain, 
    email_domain, 
    status, 
    tier, 
    logo_url,
    primary_color,
    address_line1,
    city,
    state,
    zip_code,
    phone,
    website,
    timezone,
    created_by
) VALUES (
    'ABC Honda', 
    'ABC Honda Dealership, LLC', 
    'abc-honda', 
    'abchonda.com', 
    'active', 
    'standard', 
    'https://assets.yoursaas.com/logos/abc-honda.png',
    '#FF0000',
    '123 Main Street',
    'Springfield',
    'IL',
    '62701',
    '555-123-4567',
    'https://www.abchonda.com',
    'America/Chicago',
    'system'
);

-- Sample email config
INSERT INTO dealership_email_configs (
    dealership_id,
    name,
    email_address,
    display_name,
    imap_host,
    imap_port,
    imap_user,
    imap_pass_encrypted,
    is_primary,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_pass_encrypted
) VALUES (
    1, -- First dealership
    'Primary Sales Inbox',
    'leads@abchonda.com',
    'ABC Honda Sales',
    'imap.gmail.com',
    993,
    'leads@abchonda.com',
    'encrypted:password123', -- In production, use proper encryption
    true,
    'smtp.gmail.com',
    587,
    'leads@abchonda.com',
    'encrypted:password123' -- In production, use proper encryption
);

-- Sample dealership users
INSERT INTO dealership_users (
    dealership_id,
    email,
    name,
    role,
    status,
    phone,
    title,
    department
) VALUES
(1, 'admin@abchonda.com', 'Admin User', 'admin', 'active', '555-111-2222', 'IT Manager', 'IT'),
(1, 'sales@abchonda.com', 'Sales Manager', 'manager', 'active', '555-222-3333', 'Sales Manager', 'Sales'),
(1, 'support@abchonda.com', 'Support User', 'user', 'active', '555-333-4444', 'Support Specialist', 'Customer Service');

-- Sample settings
INSERT INTO dealership_settings (
    dealership_id,
    category,
    key,
    value,
    description
) VALUES
(1, 'email', 'reply_template', '{"subject": "Thank you for your interest in ABC Honda", "body": "Dear {{customer.name}},\n\nThank you for your interest in the {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. One of our sales representatives will contact you shortly.\n\nBest regards,\nABC Honda Team"}', 'Email reply template'),
(1, 'sms', 'enabled', 'true', 'Enable SMS notifications'),
(1, 'sms', 'template', '{"body": "Hi {{customer.name}}, thanks for your interest in ABC Honda! We received your inquiry about the {{vehicle.year}} {{vehicle.make}} {{vehicle.model}}. A team member will call you soon. Reply STOP to opt-out."}', 'SMS template'),
(1, 'ai', 'model', '{"provider": "openai", "model": "gpt-4", "temperature": 0.7}', 'AI model configuration'),
(1, 'intent', 'handover_threshold', '0.85', 'Threshold for handover intent detection');

-- Sample subscription
INSERT INTO dealership_subscriptions (
    dealership_id,
    plan_name,
    status,
    start_date,
    end_date,
    billing_cycle,
    price_per_cycle,
    currency,
    auto_renew,
    features,
    limits
) VALUES (
    1,
    'standard',
    'active',
    NOW(),
    NOW() + INTERVAL '1 year',
    'monthly',
    99.99,
    'USD',
    true,
    '{"email": true, "sms": true, "ai": true, "analytics": true, "api": true}',
    '{"leads_per_month": 1000, "sms_per_month": 500, "api_calls_per_day": 10000}'
);

-- Sample API key
INSERT INTO dealership_api_keys (
    dealership_id,
    name,
    api_key_prefix,
    api_key_hash,
    scopes,
    created_by
) VALUES (
    1,
    'Integration API Key',
    'abc123',
    'hashed_api_key_would_go_here', -- In production, use proper hashing
    ARRAY['leads:read', 'leads:write', 'analytics:read'],
    'admin@abchonda.com'
);

-- Sample integration
INSERT INTO dealership_integrations (
    dealership_id,
    integration_type,
    provider,
    config,
    credentials,
    created_by
) VALUES (
    1,
    'crm',
    'salesforce',
    '{"instance_url": "https://abchonda.my.salesforce.com", "sync_frequency": "hourly", "lead_object": "Lead", "opportunity_object": "Opportunity"}',
    '{"client_id": "encrypted_client_id", "client_secret": "encrypted_client_secret", "refresh_token": "encrypted_refresh_token"}',
    'admin@abchonda.com'
);

-- Sample audit trail entries
INSERT INTO dealership_audit_trail (
    dealership_id,
    action,
    resource_type,
    details,
    ip_address,
    user_agent
) VALUES
(1, 'dealership_created', 'dealership', '{"name": "ABC Honda", "domain": "abc-honda"}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'user_invited', 'user', '{"email": "admin@abchonda.com", "role": "admin"}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'setting_updated', 'setting', '{"category": "email", "key": "reply_template"}', '192.168.1.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

-- Sample ADF lead with dealership_id
INSERT INTO adf_leads (
    dealership_id,
    provider,
    request_date,
    lead_type,
    status,
    deduplication_hash,
    created_at
) VALUES (
    1,
    'AutoTrader',
    NOW(),
    'purchase',
    'new',
    'sample_hash_123456',
    NOW()
);

COMMIT;
