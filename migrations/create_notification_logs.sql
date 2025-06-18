-- Create notification_logs table for tracking SEO notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES deliverables(id) ON DELETE CASCADE,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE CASCADE,
  agency_id UUID,
  data JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_notification_logs_dealership ON notification_logs(dealership_id);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_read_at ON notification_logs(read_at);
CREATE INDEX idx_notification_logs_type ON notification_logs(type);

-- Enable real-time for notification logs
ALTER PUBLICATION supabase_realtime ADD TABLE notification_logs;