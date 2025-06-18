-- SEOWerks Queue Management Tables
-- This migration creates the necessary tables for task queue management and deliverable tracking

-- Extend the tasks table with queue-specific fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS queue_position INTEGER;

-- Create deliverables table for tracking files
CREATE TABLE IF NOT EXISTS deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- File information
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- 'pdf', 'html', 'doc', 'image', etc.
  file_size INTEGER,
  mime_type VARCHAR(100),
  
  -- Storage paths
  original_path VARCHAR(500), -- SEOWerks branded version
  processed_path VARCHAR(500), -- Agency branded version
  
  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- Metadata
  version INTEGER DEFAULT 1,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tasks_status_queue ON tasks(status, queue_position) WHERE status IN ('submitted', 'in_progress');
CREATE INDEX idx_tasks_claimed_by ON tasks(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX idx_tasks_agency_status ON tasks(agency_id, status);
CREATE INDEX idx_deliverables_task_id ON deliverables(task_id);
CREATE INDEX idx_deliverables_processing_status ON deliverables(processing_status);

-- Create a view for the SEOWerks queue dashboard
CREATE OR REPLACE VIEW seowerks_queue_view AS
SELECT 
  t.id,
  t.type as task_type,
  t.status,
  t.parameters,
  t.priority,
  t.due_date,
  t.created_at,
  t.claimed_by,
  t.claimed_at,
  t.queue_position,
  -- Agency info
  ab.name as agency_name,
  ab.logo_url as agency_logo,
  -- Dealership info
  d.name as dealership_name,
  d.website as dealership_website,
  os.package as dealership_package,
  -- Claimed by user info
  u.email as claimed_by_email,
  u.full_name as claimed_by_name
FROM tasks t
LEFT JOIN agency_branding ab ON t.agency_id = ab.agency_id
LEFT JOIN dealerships d ON t.dealership_id = d.id
LEFT JOIN seoworks_onboarding_submissions os ON d.id = os.id
LEFT JOIN users u ON t.claimed_by = u.id
WHERE t.status IN ('submitted', 'in_progress', 'review')
ORDER BY 
  CASE 
    WHEN os.package = 'PLATINUM' THEN 1
    WHEN os.package = 'GOLD' THEN 2
    WHEN os.package = 'SILVER' THEN 3
    ELSE 4
  END,
  t.priority DESC,
  t.created_at ASC;

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_deliverables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deliverables_timestamp
  BEFORE UPDATE ON deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_deliverables_updated_at();

-- Add RLS policies for security
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

-- SEOWerks team members can view all deliverables
CREATE POLICY seowerks_view_deliverables ON deliverables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('seowerks_team', 'super_admin')
    )
  );

-- Agencies can only view their own deliverables
CREATE POLICY agency_view_own_deliverables ON deliverables
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = deliverables.task_id
      AND t.agency_id IN (
        SELECT agency_id FROM user_agencies 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE deliverables IS 'Stores all deliverable files for tasks with processing status';
COMMENT ON VIEW seowerks_queue_view IS 'Dashboard view for SEOWerks team to see and claim tasks';