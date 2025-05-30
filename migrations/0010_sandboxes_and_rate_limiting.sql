-- Migration: 0010_sandboxes_and_rate_limiting.sql
-- Description: Adds sandbox functionality and rate limiting for agent orchestration

-- Create updated_at timestamp function if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_timestamp') THEN
    CREATE FUNCTION set_updated_at_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END
$$;

-- Create sandboxes table
CREATE TABLE IF NOT EXISTS sandboxes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  token_limit_per_hour INTEGER NOT NULL DEFAULT 10000,
  token_limit_per_day INTEGER NOT NULL DEFAULT 100000,
  current_hourly_usage INTEGER DEFAULT 0,
  current_daily_usage INTEGER DEFAULT 0,
  usage_reset_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_reset_day TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create sandbox_sessions table
CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id SERIAL PRIMARY KEY,
  sandbox_id INTEGER NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  websocket_channel VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create token_usage_logs table
CREATE TABLE IF NOT EXISTS token_usage_logs (
  id SERIAL PRIMARY KEY,
  sandbox_id INTEGER NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  operation_type VARCHAR(100) NOT NULL,
  tokens_used INTEGER NOT NULL,
  request_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_sandboxes_dealership_id ON sandboxes(dealership_id);
CREATE INDEX idx_sandboxes_owner_id ON sandboxes(owner_id);
CREATE INDEX idx_sandboxes_is_active ON sandboxes(is_active);

CREATE INDEX idx_sandbox_sessions_sandbox_id ON sandbox_sessions(sandbox_id);
CREATE INDEX idx_sandbox_sessions_session_id ON sandbox_sessions(session_id);
CREATE INDEX idx_sandbox_sessions_user_id ON sandbox_sessions(user_id);
CREATE INDEX idx_sandbox_sessions_is_active ON sandbox_sessions(is_active);
CREATE INDEX idx_sandbox_sessions_websocket_channel ON sandbox_sessions(websocket_channel);

CREATE INDEX idx_token_usage_logs_sandbox_id ON token_usage_logs(sandbox_id);
CREATE INDEX idx_token_usage_logs_session_id ON token_usage_logs(session_id);
CREATE INDEX idx_token_usage_logs_created_at ON token_usage_logs(created_at);
CREATE INDEX idx_token_usage_logs_operation_type ON token_usage_logs(operation_type);

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER set_sandboxes_updated_at
BEFORE UPDATE ON sandboxes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER set_sandbox_sessions_updated_at
BEFORE UPDATE ON sandbox_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- Add RLS (Row Level Security) policies
ALTER TABLE sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sandboxes
CREATE POLICY sandboxes_dealership_isolation ON sandboxes
  USING (dealership_id IS NULL OR dealership_id = current_setting('app.current_dealership_id', TRUE)::INTEGER);

CREATE POLICY sandboxes_admin_access ON sandboxes
  USING (pg_has_role(current_setting('app.current_user_id', TRUE)::INTEGER, 'admin', 'member'));

-- Create RLS policies for sandbox_sessions
CREATE POLICY sandbox_sessions_dealership_isolation ON sandbox_sessions
  USING (EXISTS (
    SELECT 1 FROM sandboxes s
    WHERE s.id = sandbox_id
    AND (s.dealership_id IS NULL OR s.dealership_id = current_setting('app.current_dealership_id', TRUE)::INTEGER)
  ));

CREATE POLICY sandbox_sessions_user_access ON sandbox_sessions
  USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER OR pg_has_role(current_setting('app.current_user_id', TRUE)::INTEGER, 'admin', 'member'));

-- Create RLS policies for token_usage_logs
CREATE POLICY token_usage_logs_dealership_isolation ON token_usage_logs
  USING (EXISTS (
    SELECT 1 FROM sandboxes s
    WHERE s.id = sandbox_id
    AND (s.dealership_id IS NULL OR s.dealership_id = current_setting('app.current_dealership_id', TRUE)::INTEGER)
  ));

CREATE POLICY token_usage_logs_admin_access ON token_usage_logs
  USING (pg_has_role(current_setting('app.current_user_id', TRUE)::INTEGER, 'admin', 'member'));

-- Seed a default sandbox for testing
INSERT INTO sandboxes (name, description, token_limit_per_hour, token_limit_per_day)
VALUES ('Default Sandbox', 'Default sandbox for testing agent orchestration', 50000, 500000);

-- Create a function to reset token usage counters
CREATE OR REPLACE FUNCTION reset_token_usage_counters()
RETURNS VOID AS $$
BEGIN
  -- Reset hourly usage for sandboxes where the reset hour has passed
  UPDATE sandboxes
  SET current_hourly_usage = 0,
      usage_reset_hour = NOW()
  WHERE NOW() >= usage_reset_hour + INTERVAL '1 hour';

  -- Reset daily usage for sandboxes where the reset day has passed
  UPDATE sandboxes
  SET current_daily_usage = 0,
      usage_reset_day = NOW()
  WHERE NOW() >= usage_reset_day + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create a function to record token usage
CREATE OR REPLACE FUNCTION record_token_usage(
  p_sandbox_id INTEGER,
  p_session_id VARCHAR,
  p_operation_type VARCHAR,
  p_tokens_used INTEGER,
  p_request_id VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_hourly_limit INTEGER;
  v_daily_limit INTEGER;
  v_current_hourly_usage INTEGER;
  v_current_daily_usage INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Get sandbox limits and current usage
  SELECT 
    token_limit_per_hour,
    token_limit_per_day,
    current_hourly_usage,
    current_daily_usage,
    is_active
  INTO
    v_hourly_limit,
    v_daily_limit,
    v_current_hourly_usage,
    v_current_daily_usage,
    v_is_active
  FROM sandboxes
  WHERE id = p_sandbox_id;
  
  -- Check if sandbox is active
  IF NOT v_is_active THEN
    RETURN FALSE;
  END IF;
  
  -- Check if we need to reset counters
  PERFORM reset_token_usage_counters();
  
  -- Re-fetch current usage after potential reset
  SELECT 
    current_hourly_usage,
    current_daily_usage
  INTO
    v_current_hourly_usage,
    v_current_daily_usage
  FROM sandboxes
  WHERE id = p_sandbox_id;
  
  -- Check if usage would exceed limits
  IF (v_current_hourly_usage + p_tokens_used > v_hourly_limit) THEN
    RETURN FALSE;
  END IF;
  
  IF (v_current_daily_usage + p_tokens_used > v_daily_limit) THEN
    RETURN FALSE;
  END IF;
  
  -- Update usage counters
  UPDATE sandboxes
  SET 
    current_hourly_usage = current_hourly_usage + p_tokens_used,
    current_daily_usage = current_daily_usage + p_tokens_used
  WHERE id = p_sandbox_id;
  
  -- Log the token usage
  INSERT INTO token_usage_logs (
    sandbox_id,
    session_id,
    operation_type,
    tokens_used,
    request_id
  ) VALUES (
    p_sandbox_id,
    p_session_id,
    p_operation_type,
    p_tokens_used,
    p_request_id
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a rollback script (commented out, for reference)
/*
DROP FUNCTION IF EXISTS record_token_usage(INTEGER, VARCHAR, VARCHAR, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS reset_token_usage_counters();
DROP TRIGGER IF EXISTS set_sandbox_sessions_updated_at ON sandbox_sessions;
DROP TRIGGER IF EXISTS set_sandboxes_updated_at ON sandboxes;
DROP POLICY IF EXISTS token_usage_logs_admin_access ON token_usage_logs;
DROP POLICY IF EXISTS token_usage_logs_dealership_isolation ON token_usage_logs;
DROP POLICY IF EXISTS sandbox_sessions_user_access ON sandbox_sessions;
DROP POLICY IF EXISTS sandbox_sessions_dealership_isolation ON sandbox_sessions;
DROP POLICY IF EXISTS sandboxes_admin_access ON sandboxes;
DROP POLICY IF EXISTS sandboxes_dealership_isolation ON sandboxes;
DROP TABLE IF EXISTS token_usage_logs;
DROP TABLE IF EXISTS sandbox_sessions;
DROP TABLE IF EXISTS sandboxes;
*/
