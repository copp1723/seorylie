-- Rollback Migration 0011: Disable Row Level Security (RLS)
-- This rollback script removes all RLS policies and disables RLS on all tables
-- It also drops related functions and views

-- First drop all policies in reverse order of creation
-- 1. Drop separate insert policies
DROP POLICY IF EXISTS vehicles_insert_policy ON vehicles;
DROP POLICY IF EXISTS customers_insert_policy ON customers;
DROP POLICY IF EXISTS leads_insert_policy ON leads;
DROP POLICY IF EXISTS conversations_insert_policy ON conversations;

-- 2. Drop main isolation policies
DROP POLICY IF EXISTS sms_delivery_events_isolation_policy ON sms_delivery_events;
DROP POLICY IF EXISTS sms_opt_outs_isolation_policy ON sms_opt_outs;
DROP POLICY IF EXISTS sms_campaigns_isolation_policy ON sms_campaigns;
DROP POLICY IF EXISTS sms_phone_numbers_isolation_policy ON sms_phone_numbers;
DROP POLICY IF EXISTS sms_templates_isolation_policy ON sms_templates;
DROP POLICY IF EXISTS sms_messages_isolation_policy ON sms_messages;
DROP POLICY IF EXISTS messages_isolation_policy ON messages;
DROP POLICY IF EXISTS users_isolation_policy ON users;
DROP POLICY IF EXISTS vehicles_isolation_policy ON vehicles;
DROP POLICY IF EXISTS customers_isolation_policy ON customers;
DROP POLICY IF EXISTS leads_isolation_policy ON leads;
DROP POLICY IF EXISTS conversations_isolation_policy ON conversations;

-- 3. Disable RLS on all tables
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_phone_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs DISABLE ROW LEVEL SECURITY;
ALTER TABLE sms_delivery_events DISABLE ROW LEVEL SECURITY;

-- 4. Drop the RLS context view
DROP VIEW IF EXISTS current_rls_context;

-- 5. Drop the RLS functions in reverse dependency order
DROP FUNCTION IF EXISTS setup_rls_context(INTEGER, TEXT);
DROP FUNCTION IF EXISTS can_modify_record(INTEGER);
DROP FUNCTION IF EXISTS has_dealership_access(INTEGER);
DROP FUNCTION IF EXISTS set_tenant_context(INTEGER, TEXT);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Row Level Security has been successfully disabled and removed';
END $$;
