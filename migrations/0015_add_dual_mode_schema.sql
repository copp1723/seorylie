
-- Add dual-mode support to existing schema
-- Run this script to add the required tables and columns

-- 1. Add new columns to dealerships table
ALTER TABLE dealerships 
ADD COLUMN IF NOT EXISTS operation_mode VARCHAR(50) DEFAULT 'rylie_ai',
ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS agent_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS lead_routing JSONB DEFAULT '{}';

-- (Rest of the SQL file content remains exactly the same...)
-- Script completion
SELECT 'Dual-mode schema update completed successfully!' as status;
