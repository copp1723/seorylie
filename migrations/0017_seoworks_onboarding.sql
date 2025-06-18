-- SEOWerks Onboarding Submissions Table
CREATE TABLE IF NOT EXISTS seoworks_onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Business Info
  business_name VARCHAR(255) NOT NULL,
  website_url VARCHAR(500) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  
  -- Contact Information
  contact_name VARCHAR(255) NOT NULL,
  contact_title VARCHAR(255) NOT NULL,
  billing_email VARCHAR(255) NOT NULL,
  
  -- SEOWerks Specific
  package VARCHAR(50) NOT NULL CHECK (package IN ('PLATINUM', 'GOLD', 'SILVER')),
  main_brand VARCHAR(100) NOT NULL,
  other_brand VARCHAR(100),
  
  -- SEO Targets (stored as JSONB arrays)
  target_vehicle_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_dealers JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Access Requirements
  site_access_notes TEXT,
  google_business_profile_access BOOLEAN DEFAULT false,
  google_analytics_access BOOLEAN DEFAULT false,
  
  -- Submission Tracking
  submission_status VARCHAR(50) DEFAULT 'pending' CHECK (submission_status IN ('pending', 'submitted', 'failed', 'processed')),
  seoworks_submission_id VARCHAR(255), -- ID from SEOWerks if submission successful
  seoworks_submission_date TIMESTAMPTZ,
  seoworks_error TEXT, -- Error message if submission failed
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  
  -- Admin notes
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX idx_seoworks_onboarding_email ON seoworks_onboarding_submissions(email);
CREATE INDEX idx_seoworks_onboarding_business_name ON seoworks_onboarding_submissions(business_name);
CREATE INDEX idx_seoworks_onboarding_status ON seoworks_onboarding_submissions(submission_status);
CREATE INDEX idx_seoworks_onboarding_created_at ON seoworks_onboarding_submissions(created_at DESC);
CREATE INDEX idx_seoworks_onboarding_package ON seoworks_onboarding_submissions(package);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seoworks_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_seoworks_onboarding_timestamp
  BEFORE UPDATE ON seoworks_onboarding_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_seoworks_onboarding_updated_at();

-- Add RLS policies if needed
ALTER TABLE seoworks_onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- Policy for admins to view all submissions
CREATE POLICY admin_view_all_onboarding ON seoworks_onboarding_submissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Add comment to table
COMMENT ON TABLE seoworks_onboarding_submissions IS 'Stores SEOWerks onboarding form submissions from public signup page';