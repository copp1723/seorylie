-- Create seoworks_tasks table for storing SEOWerks webhook data
CREATE TABLE IF NOT EXISTS seoworks_tasks (
  id VARCHAR(255) PRIMARY KEY,
  task_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  dealership_id VARCHAR(255),
  completion_notes TEXT,
  post_title TEXT,
  post_url TEXT,
  completion_date TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_seoworks_tasks_status ON seoworks_tasks(status);
CREATE INDEX idx_seoworks_tasks_dealership_id ON seoworks_tasks(dealership_id);
CREATE INDEX idx_seoworks_tasks_updated_at ON seoworks_tasks(updated_at DESC);
CREATE INDEX idx_seoworks_tasks_task_type ON seoworks_tasks(task_type);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_seoworks_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_seoworks_tasks_updated_at
  BEFORE UPDATE ON seoworks_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_seoworks_tasks_updated_at();

-- Add comment for documentation
COMMENT ON TABLE seoworks_tasks IS 'Stores task updates from SEOWerks webhooks including blog posts and other SEO tasks';