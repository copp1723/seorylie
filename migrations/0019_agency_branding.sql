-- Agency Branding and White-labeling Tables
-- This migration creates the necessary tables for multi-agency white-labeling support

-- Create agencies table if it doesn't exist
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE, -- for subdomain routing
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agency_branding table for customization
CREATE TABLE IF NOT EXISTS agency_branding (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  
  -- Basic branding
  company_name VARCHAR(255) NOT NULL,
  tagline VARCHAR(500),
  
  -- Visual branding
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  primary_color VARCHAR(7) DEFAULT '#2563eb', -- Hex color
  secondary_color VARCHAR(7) DEFAULT '#1e40af', -- Hex color
  accent_color VARCHAR(7) DEFAULT '#10b981', -- Hex color
  
  -- Theme settings
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  font_family VARCHAR(100) DEFAULT 'Inter',
  
  -- Advanced customization (JSON for flexibility)
  custom_css TEXT, -- Custom CSS overrides
  theme_config JSONB DEFAULT '{}'::jsonb, -- Extended theme settings
  
  -- Domain settings
  custom_domain VARCHAR(255), -- e.g., 'seo.velocitymotors.com'
  subdomain VARCHAR(100), -- e.g., 'velocity' for velocity.rylieseo.com
  
  -- Contact information
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  address TEXT,
  
  -- Feature flags
  features JSONB DEFAULT '{}'::jsonb, -- Agency-specific features
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_agencies junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS user_agencies (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, agency_id)
);

-- Create dealerships table if it doesn't exist
CREATE TABLE IF NOT EXISTS dealerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  package VARCHAR(50) CHECK (package IN ('PLATINUM', 'GOLD', 'SILVER')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add agency_id to existing tasks table if not present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN agency_id UUID REFERENCES agencies(id);
  END IF;
END $$;

-- Add dealership_id to existing tasks table if not present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'dealership_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN dealership_id UUID REFERENCES dealerships(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX idx_agencies_slug ON agencies(slug);
CREATE INDEX idx_agencies_status ON agencies(status);
CREATE INDEX idx_agency_branding_subdomain ON agency_branding(subdomain);
CREATE INDEX idx_agency_branding_custom_domain ON agency_branding(custom_domain);
CREATE INDEX idx_user_agencies_user_id ON user_agencies(user_id);
CREATE INDEX idx_user_agencies_agency_id ON user_agencies(agency_id);
CREATE INDEX idx_dealerships_agency_id ON dealerships(agency_id);

-- Create view for agency dashboard
CREATE OR REPLACE VIEW agency_dashboard_view AS
SELECT 
  a.id,
  a.name,
  a.slug,
  a.status,
  ab.company_name,
  ab.logo_url,
  ab.primary_color,
  ab.subdomain,
  ab.custom_domain,
  COUNT(DISTINCT d.id) as dealership_count,
  COUNT(DISTINCT ua.user_id) as user_count,
  COUNT(DISTINCT t.id) as task_count
FROM agencies a
LEFT JOIN agency_branding ab ON a.id = ab.agency_id
LEFT JOIN dealerships d ON a.id = d.agency_id
LEFT JOIN user_agencies ua ON a.id = ua.agency_id
LEFT JOIN tasks t ON a.id = t.agency_id
GROUP BY a.id, a.name, a.slug, a.status, ab.company_name, ab.logo_url, 
         ab.primary_color, ab.subdomain, ab.custom_domain;

-- Update triggers
CREATE OR REPLACE FUNCTION update_agencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agencies_timestamp
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_agencies_updated_at();

CREATE TRIGGER update_agency_branding_timestamp
  BEFORE UPDATE ON agency_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_agencies_updated_at();

CREATE TRIGGER update_dealerships_timestamp
  BEFORE UPDATE ON dealerships
  FOR EACH ROW
  EXECUTE FUNCTION update_agencies_updated_at();

-- Row Level Security
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealerships ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Agencies: Users can view agencies they belong to
CREATE POLICY users_view_own_agencies ON agencies
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT agency_id FROM user_agencies 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Agency branding: Same as agencies
CREATE POLICY users_view_agency_branding ON agency_branding
  FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_agencies 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Agency owners/admins can update branding
CREATE POLICY agency_admins_update_branding ON agency_branding
  FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_agencies 
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin')
    )
  );

-- User agencies: Users can view their own associations
CREATE POLICY users_view_own_associations ON user_agencies
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Dealerships: Users can view dealerships in their agencies
CREATE POLICY users_view_agency_dealerships ON dealerships
  FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM user_agencies 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Insert sample data for testing (remove in production)
INSERT INTO agencies (id, name, slug, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Velocity SEO', 'velocity', 'active'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Team Impel SEO', 'teamimpel', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO agency_branding (agency_id, company_name, primary_color, secondary_color, subdomain) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'VelocitySEO', '#dc2626', '#991b1b', 'velocity'),
  ('550e8400-e29b-41d4-a716-446655440002', 'TeamImpelSEO', '#059669', '#047857', 'teamimpel')
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE agencies IS 'Master table for all agencies using the white-label platform';
COMMENT ON TABLE agency_branding IS 'Stores branding customization for each agency';
COMMENT ON TABLE user_agencies IS 'Junction table linking users to agencies with roles';
COMMENT ON TABLE dealerships IS 'Dealerships managed by agencies';
COMMENT ON VIEW agency_dashboard_view IS 'Aggregated view for agency statistics';
