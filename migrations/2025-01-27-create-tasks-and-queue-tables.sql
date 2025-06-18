-- File: /migrations/2025-01-27-create-tasks-and-queue-tables.sql
-- Purpose: Creates the necessary tables in a Render-hosted PostgreSQL database for task management and SEOWerks work queue.
-- Deployment Note for Render: This migration must be executed manually as Render does not run migrations automatically.
-- To deploy: Use a PostgreSQL client like 'psql' with your DATABASE_URL from Render (e.g., `psql -d your_db_url < this_file.sql`).
-- Alternatively, run a one-off command on Render if supported, or use a database admin tool. Ensure your database user has permissions to create tables and indexes.

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- e.g., 'landing_page', 'blog_post', 'gbp_post', 'maintenance'
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- e.g., 'draft', 'submitted', 'in_progress', 'review', 'completed', 'published'
  parameters JSONB DEFAULT '{}'::jsonb, -- Stores task-specific details, e.g., {"target": "F-150", "keywords": ["ford", "truck"]}
  agency_id UUID NOT NULL, -- Links to agency for multi-tenancy
  dealership_id UUID NOT NULL, -- Links to dealership for tracking
  priority VARCHAR(20) DEFAULT 'medium', -- e.g., 'high', 'medium', 'low'
  due_date TIMESTAMP WITH TIME ZONE, -- Optional deadline for task completion
  assigned_to UUID, -- Optional reference to assigned user or SEOWerks handler
  deliverable_url VARCHAR(255), -- URL to completed deliverable after processing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Timestamp of task creation
  updated_at TIMESTAMP WITH TIME ZONE -- Timestamp of last update
);

CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, -- Links to task in tasks table
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., 'pending', 'claimed', 'completed'
  claimed_by VARCHAR(255), -- Name or ID of SEOWerks team member who claimed the task
  claimed_at TIMESTAMP WITH TIME ZONE, -- Timestamp when task was claimed
  completed_at TIMESTAMP WITH TIME ZONE, -- Timestamp when task was completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Timestamp of queue entry creation
);

-- Optional: Add indexes for performance on frequently queried fields
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agency_id ON tasks(agency_id);