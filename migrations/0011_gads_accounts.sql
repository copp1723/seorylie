-- Migration: 0011_gads_accounts.sql
-- Google Ads API integration tables

BEGIN;

-- Create gads_accounts table
CREATE TABLE IF NOT EXISTS gads_accounts (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    currency_code VARCHAR(10),
    timezone VARCHAR(100),
    is_manager_account BOOLEAN DEFAULT FALSE,
    refresh_token TEXT,
    access_token TEXT,
    token_expires_at TIMESTAMP,
    sandbox_id INTEGER REFERENCES sandboxes(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT gads_accounts_cid_user_unique UNIQUE (cid, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gads_accounts_cid ON gads_accounts(cid);
CREATE INDEX IF NOT EXISTS idx_gads_accounts_user_id ON gads_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_gads_accounts_sandbox_id ON gads_accounts(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_gads_accounts_dealership_id ON gads_accounts(dealership_id);

-- Create gads_campaigns table
CREATE TABLE IF NOT EXISTS gads_campaigns (
    id SERIAL PRIMARY KEY,
    gads_account_id INTEGER NOT NULL REFERENCES gads_accounts(id) ON DELETE CASCADE,
    campaign_id VARCHAR(255) NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50),
    status VARCHAR(50),
    budget_amount DECIMAL(12, 2),
    is_dry_run BOOLEAN DEFAULT FALSE,
    created_by_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT gads_campaigns_account_campaign_unique UNIQUE (gads_account_id, campaign_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gads_campaigns_campaign_id ON gads_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_gads_campaigns_gads_account_id ON gads_campaigns(gads_account_id);
CREATE INDEX IF NOT EXISTS idx_gads_campaigns_status ON gads_campaigns(status);

-- Add a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_gads_accounts_updated_at
BEFORE UPDATE ON gads_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gads_campaigns_updated_at
BEFORE UPDATE ON gads_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for multi-tenant access
ALTER TABLE gads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gads_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for gads_accounts
CREATE POLICY gads_accounts_user_isolation ON gads_accounts
    USING (user_id = current_setting('app.current_user_id', true)::INTEGER OR 
           dealership_id IN (
               SELECT dealership_id FROM users WHERE id = current_setting('app.current_user_id', true)::INTEGER
           ));

-- Create policies for gads_campaigns
CREATE POLICY gads_campaigns_user_isolation ON gads_campaigns
    USING (gads_account_id IN (
        SELECT id FROM gads_accounts 
        WHERE user_id = current_setting('app.current_user_id', true)::INTEGER OR 
              dealership_id IN (
                  SELECT dealership_id FROM users WHERE id = current_setting('app.current_user_id', true)::INTEGER
              )
    ));

-- Create view for simplified access to campaigns with account info
CREATE OR REPLACE VIEW gads_campaigns_view AS
SELECT 
    c.id,
    c.campaign_id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.budget_amount,
    c.is_dry_run,
    c.created_by_agent,
    c.created_at,
    c.updated_at,
    a.id AS account_id,
    a.cid AS account_cid,
    a.name AS account_name,
    a.is_manager_account,
    a.sandbox_id,
    a.user_id,
    a.dealership_id
FROM gads_campaigns c
JOIN gads_accounts a ON c.gads_account_id = a.id;

-- Add comment to tables for documentation
COMMENT ON TABLE gads_accounts IS 'Stores Google Ads accounts linked via OAuth';
COMMENT ON TABLE gads_campaigns IS 'Tracks campaigns created or managed through the platform';
COMMENT ON VIEW gads_campaigns_view IS 'Simplified view of campaigns with account information';

COMMIT;

-- Rollback section
-- BEGIN;
-- DROP VIEW IF EXISTS gads_campaigns_view;
-- DROP TRIGGER IF EXISTS update_gads_campaigns_updated_at ON gads_campaigns;
-- DROP TRIGGER IF EXISTS update_gads_accounts_updated_at ON gads_accounts;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS gads_campaigns;
-- DROP TABLE IF EXISTS gads_accounts;
-- COMMIT;
