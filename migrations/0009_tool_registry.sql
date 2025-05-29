-- Migration: 0009_tool_registry.sql
-- Description: Adds tools and agent_tools tables for the Tool Registry system

-- Create updated_at timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create tools table
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  service VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(50) NOT NULL DEFAULT 'POST',
  input_schema JSON,
  output_schema JSON,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create agent_tools table (many-to-many relationship)
CREATE TABLE agent_tools (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  tool_id INTEGER NOT NULL,
  permissions JSON,
  config_override JSON,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tool_id FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX idx_tools_service ON tools (service);
CREATE INDEX idx_tools_category ON tools (category);
CREATE INDEX idx_agent_tools_agent_id ON agent_tools (agent_id);
CREATE UNIQUE INDEX idx_agent_tools_unique ON agent_tools (agent_id, tool_id);

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER set_tools_updated_at
BEFORE UPDATE ON tools
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER set_agent_tools_updated_at
BEFORE UPDATE ON agent_tools
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- Seed initial tool entries
INSERT INTO tools (name, service, endpoint, method, description, category, input_schema, output_schema)
VALUES 
(
  'watchdog_analysis', 
  'watchdog', 
  '/api/question', 
  'POST',
  'Analyzes data and answers questions using the Watchdog analytics engine',
  'analytics',
  '{
    "type": "object",
    "required": ["uploadId", "question"],
    "properties": {
      "uploadId": {
        "type": "string",
        "description": "ID of the uploaded dataset"
      },
      "question": {
        "type": "string",
        "description": "Natural language question about the data"
      }
    }
  }',
  '{
    "type": "object",
    "properties": {
      "success": {
        "type": "boolean"
      },
      "requestId": {
        "type": "string"
      },
      "insights": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "title": {"type": "string"},
            "description": {"type": "string"},
            "score": {"type": "number"},
            "metrics": {"type": "object"},
            "visualization": {
              "type": "object",
              "properties": {
                "type": {"type": "string"},
                "data": {"type": "object"},
                "config": {"type": "object"}
              }
            }
          }
        }
      }
    }
  }'
),
(
  'vin_agent_task', 
  'vin-agent', 
  '/api/v1/tasks', 
  'POST',
  'Executes automation tasks using the VIN Agent service',
  'automation',
  '{
    "type": "object",
    "required": ["taskType", "parameters"],
    "properties": {
      "taskType": {
        "type": "string",
        "description": "Type of task to execute"
      },
      "parameters": {
        "type": "object",
        "description": "Task-specific parameters"
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "default": "medium"
      }
    }
  }',
  '{
    "type": "object",
    "properties": {
      "success": {"type": "boolean"},
      "taskId": {"type": "string"},
      "status": {"type": "string"},
      "result": {"type": "object"}
    }
  }'
);

-- Create a rollback script (commented out, for reference)
/*
DROP TRIGGER IF EXISTS set_agent_tools_updated_at ON agent_tools;
DROP TRIGGER IF EXISTS set_tools_updated_at ON tools;
DROP TABLE IF EXISTS agent_tools;
DROP TABLE IF EXISTS tools;
DROP FUNCTION IF EXISTS set_updated_at_timestamp();
*/
