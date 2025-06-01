-- ADF-W10: Conversation Orchestrator v2 Schema
-- Enhanced conversation tracking for advanced orchestration

-- Enhanced conversations table with orchestration metadata
CREATE TABLE IF NOT EXISTS conversations_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id VARCHAR(255) NOT NULL,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  conversation_id_legacy INTEGER, -- Reference to old conversations table
  current_turn INTEGER DEFAULT 0,
  max_turns INTEGER DEFAULT 2,
  state VARCHAR(20) DEFAULT 'active' CHECK (state IN ('active', 'paused', 'completed', 'escalated', 'failed')),
  ai_model VARCHAR(50) DEFAULT 'gpt-3.5-turbo',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  metadata JSONB DEFAULT '{}',
  history JSONB DEFAULT '[]',
  priority INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalation_reason TEXT,
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced conversation messages with detailed metadata
CREATE TABLE IF NOT EXISTS conversation_messages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations_v2(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  processing_time_ms INTEGER,
  confidence_score DECIMAL(3,2),
  intent_detected VARCHAR(100),
  sentiment_score DECIMAL(3,2),
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  channel VARCHAR(50) DEFAULT 'web',
  delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying')),
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation orchestration queue for managing processing
CREATE TABLE IF NOT EXISTS conversation_queue_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations_v2(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'process-turn',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation orchestration metrics for monitoring
CREATE TABLE IF NOT EXISTS conversation_orchestration_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations_v2(id) ON DELETE CASCADE,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,6) NOT NULL,
  metric_type VARCHAR(50) NOT NULL DEFAULT 'counter' CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt template cache for dynamic prompt management
CREATE TABLE IF NOT EXISTS prompt_templates_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'conversation',
  dealership_id INTEGER REFERENCES dealerships(id),
  vehicle_type VARCHAR(100),
  turn_number INTEGER,
  template_content TEXT NOT NULL,
  compiled_template TEXT,
  variables JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES prompt_templates_v2(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit breaker state tracking
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  state VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half-open')),
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  configuration JSONB DEFAULT '{}',
  health_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_v2_lead_id ON conversations_v2(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_v2_dealership_id ON conversations_v2(dealership_id);
CREATE INDEX IF NOT EXISTS idx_conversations_v2_state ON conversations_v2(state);
CREATE INDEX IF NOT EXISTS idx_conversations_v2_last_activity ON conversations_v2(last_activity);
CREATE INDEX IF NOT EXISTS idx_conversations_v2_priority ON conversations_v2(priority DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_v2_conversation_id ON conversation_messages_v2(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_v2_turn_number ON conversation_messages_v2(turn_number);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_v2_created_at ON conversation_messages_v2(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_v2_role ON conversation_messages_v2(role);

CREATE INDEX IF NOT EXISTS idx_conversation_queue_jobs_status ON conversation_queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_conversation_queue_jobs_scheduled_at ON conversation_queue_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_conversation_queue_jobs_priority ON conversation_queue_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_queue_jobs_conversation_id ON conversation_queue_jobs(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_orchestration_metrics_conversation_id ON conversation_orchestration_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_orchestration_metrics_timestamp ON conversation_orchestration_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_orchestration_metrics_metric_name ON conversation_orchestration_metrics(metric_name);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_v2_name ON prompt_templates_v2(name);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_v2_category ON prompt_templates_v2(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_v2_dealership_id ON prompt_templates_v2(dealership_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_v2_turn_number ON prompt_templates_v2(turn_number);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_v2_active ON prompt_templates_v2(is_active);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_conversations_v2
  BEFORE UPDATE ON conversations_v2
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_conversation_messages_v2
  BEFORE UPDATE ON conversation_messages_v2
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_conversation_queue_jobs
  BEFORE UPDATE ON conversation_queue_jobs
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_prompt_templates_v2
  BEFORE UPDATE ON prompt_templates_v2
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_circuit_breaker_states
  BEFORE UPDATE ON circuit_breaker_states
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

-- Grants for application access
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations_v2 TO cleanrylie_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_messages_v2 TO cleanrylie_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_queue_jobs TO cleanrylie_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_orchestration_metrics TO cleanrylie_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON prompt_templates_v2 TO cleanrylie_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON circuit_breaker_states TO cleanrylie_app;

-- Comments for documentation
COMMENT ON TABLE conversations_v2 IS 'Enhanced conversation tracking for ADF-W10 orchestrator with state management and metrics';
COMMENT ON TABLE conversation_messages_v2 IS 'Detailed message storage with AI processing metadata and delivery tracking';
COMMENT ON TABLE conversation_queue_jobs IS 'Queue management for asynchronous conversation processing';
COMMENT ON TABLE conversation_orchestration_metrics IS 'Performance and operational metrics for conversation orchestrator';
COMMENT ON TABLE prompt_templates_v2 IS 'Dynamic prompt template management with versioning and caching';
COMMENT ON TABLE circuit_breaker_states IS 'Circuit breaker state tracking for service resilience';