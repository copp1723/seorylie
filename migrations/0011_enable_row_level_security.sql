-- Migration 0011: Enable Row Level Security (RLS) for Multi-tenant Data Isolation
-- This migration implements comprehensive Row Level Security policies to ensure
-- proper tenant isolation at the database level, beyond application-layer filtering.

-- Create a session variable setting function to store the current user's context
CREATE OR REPLACE FUNCTION set_tenant_context(dealership_id INTEGER, user_role TEXT)
RETURNS VOID AS $$
BEGIN
  -- Store the current dealership ID and user role in session variables
  PERFORM set_config('app.current_dealership_id', dealership_id::TEXT, FALSE);
  PERFORM set_config('app.current_user_role', user_role, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to check if the current user has access to a specific dealership
CREATE OR REPLACE FUNCTION has_dealership_access(record_dealership_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_dealership_id INTEGER;
  current_user_role TEXT;
BEGIN
  -- Get the current context
  current_dealership_id := NULLIF(current_setting('app.current_dealership_id', TRUE), '')::INTEGER;
  current_user_role := NULLIF(current_setting('app.current_user_role', TRUE), '');
  
  -- Super admins can access all dealerships
  IF current_user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Regular users can only access their own dealership
  RETURN record_dealership_id = current_dealership_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if a user can modify a record
CREATE OR REPLACE FUNCTION can_modify_record(record_dealership_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_dealership_id INTEGER;
  current_user_role TEXT;
BEGIN
  -- Get the current context
  current_dealership_id := NULLIF(current_setting('app.current_dealership_id', TRUE), '')::INTEGER;
  current_user_role := NULLIF(current_setting('app.current_user_role', TRUE), '');
  
  -- Super admins can modify all records
  IF current_user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Dealership admins and regular users can only modify their own dealership's records
  RETURN record_dealership_id = current_dealership_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS and create policies for each multi-tenant table
-- 1. Conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_isolation_policy ON conversations
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 2. Leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_isolation_policy ON leads
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 3. Customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_isolation_policy ON customers
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 4. Vehicles table
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_isolation_policy ON vehicles
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 5. Users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation_policy ON users
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 6. Messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_isolation_policy ON messages
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 7. SMS Messages table
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_messages_isolation_policy ON sms_messages
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 8. SMS Templates table
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_templates_isolation_policy ON sms_templates
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 9. SMS Phone Numbers table
ALTER TABLE sms_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_phone_numbers_isolation_policy ON sms_phone_numbers
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 10. SMS Campaigns table
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_campaigns_isolation_policy ON sms_campaigns
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 11. SMS Opt-outs table
ALTER TABLE sms_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_opt_outs_isolation_policy ON sms_opt_outs
  FOR ALL
  USING (has_dealership_access(dealership_id));

-- 12. SMS Delivery Events table
ALTER TABLE sms_delivery_events ENABLE ROW LEVEL SECURITY;

-- For SMS Delivery Events, we need to join to the parent table to get the dealership_id
CREATE POLICY sms_delivery_events_isolation_policy ON sms_delivery_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sms_messages sm
      WHERE sm.id = sms_message_id
      AND has_dealership_access(sm.dealership_id)
    )
  );

-- Create separate insert policies where needed for tables that might need different insert rules
CREATE POLICY conversations_insert_policy ON conversations
  FOR INSERT
  WITH CHECK (can_modify_record(dealership_id));

CREATE POLICY leads_insert_policy ON leads
  FOR INSERT
  WITH CHECK (can_modify_record(dealership_id));

CREATE POLICY customers_insert_policy ON customers
  FOR INSERT
  WITH CHECK (can_modify_record(dealership_id));

CREATE POLICY vehicles_insert_policy ON vehicles
  FOR INSERT
  WITH CHECK (can_modify_record(dealership_id));

-- Create a function to set up the RLS context for a database session
CREATE OR REPLACE FUNCTION setup_rls_context(p_dealership_id INTEGER, p_user_role TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_tenant_context(p_dealership_id, p_user_role);
  RAISE NOTICE 'RLS context set: dealership_id=%, user_role=%', p_dealership_id, p_user_role;
END;
$$ LANGUAGE plpgsql;

-- Create a view to help diagnose RLS context
CREATE OR REPLACE VIEW current_rls_context AS
SELECT 
  NULLIF(current_setting('app.current_dealership_id', TRUE), '')::INTEGER AS current_dealership_id,
  NULLIF(current_setting('app.current_user_role', TRUE), '') AS current_user_role;

-- Add comments for documentation
COMMENT ON FUNCTION set_tenant_context IS 'Sets the current tenant context for Row Level Security';
COMMENT ON FUNCTION has_dealership_access IS 'Checks if the current user has access to a specific dealership';
COMMENT ON FUNCTION can_modify_record IS 'Checks if the current user can modify a record';
COMMENT ON FUNCTION setup_rls_context IS 'Convenience function to set up RLS context for a session';
COMMENT ON VIEW current_rls_context IS 'Shows the current RLS context for debugging';

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION set_tenant_context TO PUBLIC;
GRANT EXECUTE ON FUNCTION has_dealership_access TO PUBLIC;
GRANT EXECUTE ON FUNCTION can_modify_record TO PUBLIC;
GRANT EXECUTE ON FUNCTION setup_rls_context TO PUBLIC;
GRANT SELECT ON current_rls_context TO PUBLIC;
