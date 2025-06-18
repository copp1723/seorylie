-- Add completion_date column to existing seoworks_tasks table
ALTER TABLE seoworks_tasks 
ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ;

-- Create index on completion_date for performance
CREATE INDEX IF NOT EXISTS idx_seoworks_tasks_completion_date 
ON seoworks_tasks(completion_date) 
WHERE completion_date IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN seoworks_tasks.completion_date IS 'Date and time when the task was completed';