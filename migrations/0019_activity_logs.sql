-- Activity Logs Table
-- This migration creates a table for tracking user actions within the system

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Action details
  action VARCHAR(100) NOT NULL, -- e.g. 'task_claimed', 'task_completed', 'login', etc.
  entity_type VARCHAR(50), -- e.g. 'task', 'dealership', 'agency', etc.
  entity_id UUID, -- ID of the entity being acted upon
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Request information
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE activity_logs IS 'Audit trail of all user actions in the system';
COMMENT ON COLUMN activity_logs.action IS 'The action performed (e.g. task_claimed, task_completed)';
COMMENT ON COLUMN activity_logs.entity_type IS 'Type of entity the action was performed on';
COMMENT ON COLUMN activity_logs.entity_id IS 'ID of the specific entity';
COMMENT ON COLUMN activity_logs.metadata IS 'Additional contextual data about the action';