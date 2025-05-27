-- Migration: Add Agent Squad tracking and configuration tables
-- Author: Claude Code Agent Squad Integration
-- Date: 2025-05-26

-- Add Agent Squad columns to messages table
ALTER TABLE messages 
ADD COLUMN selected_agent VARCHAR(50),
ADD COLUMN agent_confidence DECIMAL(3,2),
ADD COLUMN processing_time_ms INTEGER,
ADD COLUMN agent_reasoning TEXT;

-- Create Agent Squad configuration per dealership
CREATE TABLE agent_squad_config (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  fallback_enabled BOOLEAN DEFAULT true,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  preferred_agents JSON DEFAULT '[]'::json, -- Array of preferred agent names for this dealership
  agent_personalities JSON DEFAULT '{}'::json, -- Custom agent personality overrides
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(dealership_id)
);

-- Create Agent Squad analytics table for tracking performance
CREATE TABLE agent_squad_analytics (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  selected_agent VARCHAR(50) NOT NULL,
  classification_confidence DECIMAL(3,2),
  response_time_ms INTEGER,
  customer_satisfaction_score INTEGER CHECK (customer_satisfaction_score >= 1 AND customer_satisfaction_score <= 5),
  escalated_to_human BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_messages_selected_agent ON messages(selected_agent);
CREATE INDEX idx_agent_analytics_dealership ON agent_squad_analytics(dealership_id);
CREATE INDEX idx_agent_analytics_agent ON agent_squad_analytics(selected_agent);
CREATE INDEX idx_agent_analytics_created_at ON agent_squad_analytics(created_at);

-- Insert default Agent Squad config for existing dealerships
INSERT INTO agent_squad_config (dealership_id, enabled, fallback_enabled)
SELECT id, false, true FROM dealerships
ON CONFLICT (dealership_id) DO NOTHING;

-- Create view for Agent Squad performance metrics
CREATE VIEW agent_squad_performance AS
SELECT 
  asa.dealership_id,
  asa.selected_agent,
  COUNT(*) as total_interactions,
  AVG(asa.classification_confidence) as avg_confidence,
  AVG(asa.response_time_ms) as avg_response_time_ms,
  AVG(asa.customer_satisfaction_score) as avg_satisfaction,
  COUNT(*) FILTER (WHERE asa.escalated_to_human = true) as escalations,
  ROUND(
    (COUNT(*) FILTER (WHERE asa.escalated_to_human = false)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as success_rate_percent
FROM agent_squad_analytics asa
GROUP BY asa.dealership_id, asa.selected_agent;

-- Add comment for documentation
COMMENT ON TABLE agent_squad_config IS 'Configuration settings for Agent Squad per dealership';
COMMENT ON TABLE agent_squad_analytics IS 'Analytics and performance tracking for Agent Squad interactions';
COMMENT ON VIEW agent_squad_performance IS 'Aggregated performance metrics for Agent Squad by dealership and agent';