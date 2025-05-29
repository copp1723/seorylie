-- Migration: 0013_rls_security_policies.sql
-- Description: Implements comprehensive Row-Level Security (RLS) policies for multi-tenant isolation
-- and sandbox data protection across the platform.

-- Transaction wrapper for atomicity
BEGIN;

-- ======================================================================
-- ENABLE ROW LEVEL SECURITY ON SENSITIVE TABLES
-- ======================================================================

-- Enable RLS on Google Ads accounts table
ALTER TABLE gads_accounts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Google Ads campaigns table
ALTER TABLE gads_campaigns ENABLE ROW LEVEL SECURITY;

-- Enable RLS on daily spend logs
ALTER TABLE daily_spend_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sandboxes table
ALTER TABLE sandboxes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sandbox sessions
ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on token usage logs
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tools and agent_tools tables
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- CREATE SECURITY DEFINER FUNCTIONS FOR POLICY CHECKS
-- ======================================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
    -- Check if current user has admin role
    RETURN (SELECT role = 'admin' FROM users WHERE id = current_setting('app.current_user_id', TRUE)::int);
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user belongs to dealership
CREATE OR REPLACE FUNCTION belongs_to_dealership(dealership_id integer)
RETURNS boolean AS $$
BEGIN
    -- Check if current user belongs to specified dealership
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = current_setting('app.current_user_id', TRUE)::int
        AND dealership_id = $1
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns sandbox
CREATE OR REPLACE FUNCTION owns_sandbox(sandbox_id integer)
RETURNS boolean AS $$
BEGIN
    -- Check if current user created the sandbox
    RETURN EXISTS (
        SELECT 1 FROM sandboxes 
        WHERE id = $1
        AND created_by = current_setting('app.current_user_id', TRUE)::int
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to sandbox
CREATE OR REPLACE FUNCTION has_sandbox_access(sandbox_id integer)
RETURNS boolean AS $$
DECLARE
    v_dealership_id integer;
BEGIN
    -- Get dealership of the sandbox
    SELECT dealership_id INTO v_dealership_id 
    FROM sandboxes 
    WHERE id = $1;
    
    -- Check if user belongs to same dealership or is admin
    RETURN (
        is_admin() OR 
        belongs_to_dealership(v_dealership_id) OR 
        owns_sandbox($1)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================
-- SANDBOX ISOLATION POLICIES
-- ======================================================================

-- Sandbox table policies
CREATE POLICY sandbox_select_policy ON sandboxes
    FOR SELECT
    USING (
        is_admin() OR
        belongs_to_dealership(dealership_id) OR
        created_by = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY sandbox_insert_policy ON sandboxes
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        belongs_to_dealership(dealership_id)
    );

CREATE POLICY sandbox_update_policy ON sandboxes
    FOR UPDATE
    USING (
        is_admin() OR
        created_by = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY sandbox_delete_policy ON sandboxes
    FOR DELETE
    USING (
        is_admin() OR
        created_by = current_setting('app.current_user_id', TRUE)::int
    );

-- Sandbox sessions policies
CREATE POLICY sandbox_sessions_select_policy ON sandbox_sessions
    FOR SELECT
    USING (
        is_admin() OR
        has_sandbox_access(sandbox_id) OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY sandbox_sessions_insert_policy ON sandbox_sessions
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        has_sandbox_access(sandbox_id) OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY sandbox_sessions_update_policy ON sandbox_sessions
    FOR UPDATE
    USING (
        is_admin() OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY sandbox_sessions_delete_policy ON sandbox_sessions
    FOR DELETE
    USING (
        is_admin() OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

-- Token usage logs policies
CREATE POLICY token_usage_logs_select_policy ON token_usage_logs
    FOR SELECT
    USING (
        is_admin() OR
        has_sandbox_access(sandbox_id) OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY token_usage_logs_insert_policy ON token_usage_logs
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        has_sandbox_access(sandbox_id) OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

-- ======================================================================
-- GOOGLE ADS ACCOUNT ISOLATION POLICIES
-- ======================================================================

-- Google Ads accounts policies
CREATE POLICY gads_accounts_select_policy ON gads_accounts
    FOR SELECT
    USING (
        is_admin() OR
        belongs_to_dealership(dealership_id) OR
        user_id = current_setting('app.current_user_id', TRUE)::int OR
        has_sandbox_access(sandbox_id)
    );

CREATE POLICY gads_accounts_insert_policy ON gads_accounts
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        belongs_to_dealership(dealership_id) OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY gads_accounts_update_policy ON gads_accounts
    FOR UPDATE
    USING (
        is_admin() OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

CREATE POLICY gads_accounts_delete_policy ON gads_accounts
    FOR DELETE
    USING (
        is_admin() OR
        user_id = current_setting('app.current_user_id', TRUE)::int
    );

-- Google Ads campaigns policies
CREATE POLICY gads_campaigns_select_policy ON gads_campaigns
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM gads_accounts ga
            WHERE ga.id = gads_campaigns.gads_account_id
            AND (
                ga.user_id = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(ga.dealership_id) OR
                has_sandbox_access(ga.sandbox_id)
            )
        )
    );

CREATE POLICY gads_campaigns_insert_policy ON gads_campaigns
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM gads_accounts ga
            WHERE ga.id = gads_campaigns.gads_account_id
            AND (
                ga.user_id = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(ga.dealership_id) OR
                has_sandbox_access(ga.sandbox_id)
            )
        )
    );

CREATE POLICY gads_campaigns_update_policy ON gads_campaigns
    FOR UPDATE
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM gads_accounts ga
            WHERE ga.id = gads_campaigns.gads_account_id
            AND (
                ga.user_id = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(ga.dealership_id)
            )
        )
    );

-- ======================================================================
-- DAILY SPEND LOGS ISOLATION POLICIES
-- ======================================================================

CREATE POLICY daily_spend_logs_select_policy ON daily_spend_logs
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM gads_accounts ga
            WHERE ga.id = daily_spend_logs.gads_account_id
            AND (
                ga.user_id = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(ga.dealership_id) OR
                has_sandbox_access(ga.sandbox_id)
            )
        )
    );

CREATE POLICY daily_spend_logs_insert_policy ON daily_spend_logs
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM gads_accounts ga
            WHERE ga.id = daily_spend_logs.gads_account_id
            AND (
                ga.user_id = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(ga.dealership_id) OR
                has_sandbox_access(ga.sandbox_id)
            )
        )
    );

-- ======================================================================
-- TOOLS AND AGENT_TOOLS POLICIES
-- ======================================================================

-- Tools policies (admin-only for modification, all users can view)
CREATE POLICY tools_select_policy ON tools
    FOR SELECT
    USING (TRUE);  -- All authenticated users can view available tools

CREATE POLICY tools_insert_policy ON tools
    FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY tools_update_policy ON tools
    FOR UPDATE
    USING (is_admin());

CREATE POLICY tools_delete_policy ON tools
    FOR DELETE
    USING (is_admin());

-- Agent tools policies
CREATE POLICY agent_tools_select_policy ON agent_tools
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM sandboxes s
            WHERE s.id = agent_tools.sandbox_id
            AND (
                s.created_by = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(s.dealership_id)
            )
        )
    );

CREATE POLICY agent_tools_insert_policy ON agent_tools
    FOR INSERT
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM sandboxes s
            WHERE s.id = agent_tools.sandbox_id
            AND (
                s.created_by = current_setting('app.current_user_id', TRUE)::int OR
                belongs_to_dealership(s.dealership_id)
            )
        )
    );

-- ======================================================================
-- EMERGENCY ADMIN ACCESS FUNCTION
-- ======================================================================

-- Function to temporarily grant admin access for emergency operations
CREATE OR REPLACE FUNCTION grant_emergency_admin_access(
    p_user_id INTEGER,
    p_reason TEXT,
    p_duration_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
    v_expiry TIMESTAMP;
    v_admin_id INTEGER;
BEGIN
    -- Only existing admins can grant emergency access
    SELECT id INTO v_admin_id FROM users WHERE id = current_setting('app.current_user_id', TRUE)::int AND role = 'admin';
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Only administrators can grant emergency access';
    END IF;
    
    -- Calculate expiry time
    v_expiry := NOW() + (p_duration_minutes * INTERVAL '1 minute');
    
    -- Log the emergency access grant
    INSERT INTO audit_logs (
        event_type,
        user_id,
        target_user_id,
        description,
        metadata,
        expires_at
    ) VALUES (
        'EMERGENCY_ACCESS_GRANTED',
        v_admin_id,
        p_user_id,
        'Emergency admin access granted',
        jsonb_build_object(
            'reason', p_reason,
            'duration_minutes', p_duration_minutes,
            'granted_by', v_admin_id
        ),
        v_expiry
    );
    
    -- Temporarily update user role to admin
    UPDATE users 
    SET 
        role = 'admin',
        temporary_admin_until = v_expiry,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke emergency admin access
CREATE OR REPLACE FUNCTION revoke_emergency_admin_access(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_admin_id INTEGER;
    v_original_role TEXT;
BEGIN
    -- Only existing admins can revoke emergency access
    SELECT id INTO v_admin_id FROM users WHERE id = current_setting('app.current_user_id', TRUE)::int AND role = 'admin';
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Only administrators can revoke emergency access';
    END IF;
    
    -- Get original role from audit logs
    SELECT metadata->>'original_role' INTO v_original_role
    FROM audit_logs
    WHERE event_type = 'EMERGENCY_ACCESS_GRANTED' AND target_user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no original role found, default to 'user'
    v_original_role := COALESCE(v_original_role, 'user');
    
    -- Log the emergency access revocation
    INSERT INTO audit_logs (
        event_type,
        user_id,
        target_user_id,
        description,
        metadata
    ) VALUES (
        'EMERGENCY_ACCESS_REVOKED',
        v_admin_id,
        p_user_id,
        'Emergency admin access revoked',
        jsonb_build_object(
            'revoked_by', v_admin_id,
            'revoked_at', NOW()::text
        )
    );
    
    -- Reset user role and clear temporary admin expiry
    UPDATE users 
    SET 
        role = v_original_role,
        temporary_admin_until = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================
-- AUDIT TRAIL TRIGGERS
-- ======================================================================

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id INTEGER;
    v_old_data JSONB;
    v_new_data JSONB;
    v_event_type TEXT;
BEGIN
    -- Get current user ID from app context
    BEGIN
        v_user_id := current_setting('app.current_user_id', TRUE)::int;
    EXCEPTION
        WHEN OTHERS THEN
            v_user_id := NULL;
    END;
    
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        v_event_type := 'INSERT';
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_event_type := 'UPDATE';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_event_type := 'DELETE';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
    END IF;
    
    -- Insert audit log
    INSERT INTO audit_logs (
        event_type,
        table_name,
        record_id,
        user_id,
        old_data,
        new_data,
        description
    ) VALUES (
        v_event_type,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN (v_old_data->>'id')::integer
            ELSE (v_new_data->>'id')::integer
        END,
        v_user_id,
        v_old_data,
        v_new_data,
        format('%s operation on %s', TG_OP, TG_TABLE_NAME)
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_gads_accounts_trigger
AFTER INSERT OR UPDATE OR DELETE ON gads_accounts
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_gads_campaigns_trigger
AFTER INSERT OR UPDATE OR DELETE ON gads_campaigns
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_sandboxes_trigger
AFTER INSERT OR UPDATE OR DELETE ON sandboxes
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER audit_sandbox_sessions_trigger
AFTER INSERT OR UPDATE OR DELETE ON sandbox_sessions
FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- ======================================================================
-- PERFORMANCE OPTIMIZATIONS
-- ======================================================================

-- Create indexes to support RLS policies
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_dealership_id ON users(dealership_id);
CREATE INDEX IF NOT EXISTS idx_sandboxes_created_by ON sandboxes(created_by);
CREATE INDEX IF NOT EXISTS idx_sandboxes_dealership_id ON sandboxes(dealership_id);
CREATE INDEX IF NOT EXISTS idx_gads_accounts_user_id ON gads_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_gads_accounts_dealership_id ON gads_accounts(dealership_id);
CREATE INDEX IF NOT EXISTS idx_gads_accounts_sandbox_id ON gads_accounts(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_gads_campaigns_gads_account_id ON gads_campaigns(gads_account_id);
CREATE INDEX IF NOT EXISTS idx_daily_spend_logs_gads_account_id ON daily_spend_logs(gads_account_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_sandbox_id ON token_usage_logs(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tools_sandbox_id ON agent_tools(sandbox_id);

-- ======================================================================
-- TESTING SCENARIOS (COMMENTS)
-- ======================================================================

/*
TESTING SCENARIOS:

1. Cross-Sandbox Isolation Test:
   - Create two sandboxes (A and B) owned by different users
   - Create Google Ads campaigns in each sandbox
   - Verify user from sandbox A cannot SELECT campaigns from sandbox B
   - SQL: 
     SET app.current_user_id = '1'; -- User who owns sandbox A
     SELECT * FROM gads_campaigns WHERE id IN (
       SELECT gc.id FROM gads_campaigns gc
       JOIN gads_accounts ga ON gc.gads_account_id = ga.id
       WHERE ga.sandbox_id = 2  -- Sandbox B
     );
     -- Should return 0 rows

2. Admin Access Test:
   - Verify admin users can access all data across sandboxes
   - SQL:
     SET app.current_user_id = '999'; -- Admin user
     SELECT * FROM gads_campaigns;
     -- Should return all campaigns

3. Dealership Isolation Test:
   - Create sandboxes in different dealerships
   - Verify user from dealership A cannot access data from dealership B
   - SQL:
     SET app.current_user_id = '1'; -- User from dealership A
     SELECT * FROM sandboxes WHERE dealership_id != (
       SELECT dealership_id FROM users WHERE id = 1
     );
     -- Should return 0 rows

4. Token Usage Logs Isolation:
   - Generate token usage in different sandboxes
   - Verify users can only see token usage from their sandboxes
   - SQL:
     SET app.current_user_id = '1'; -- User who owns sandbox A
     SELECT * FROM token_usage_logs WHERE sandbox_id != (
       SELECT id FROM sandboxes WHERE created_by = 1 LIMIT 1
     );
     -- Should return 0 rows

5. Emergency Admin Access Test:
   - Grant emergency access to a regular user
   - Verify they can temporarily access all data
   - Revoke access and verify restrictions are back in place
   - SQL:
     -- As admin
     SELECT grant_emergency_admin_access(2, 'Emergency testing', 5);
     -- As user 2 (now with temp admin)
     SET app.current_user_id = '2';
     SELECT * FROM gads_accounts;
     -- Should return all accounts
     -- After 5 minutes or manual revocation
     SELECT * FROM gads_accounts;
     -- Should return only owned accounts

6. Audit Trail Test:
   - Perform operations on sensitive tables
   - Verify audit logs are created with correct user IDs
   - SQL:
     SET app.current_user_id = '1';
     INSERT INTO sandboxes (...) VALUES (...);
     SELECT * FROM audit_logs WHERE table_name = 'sandboxes' ORDER BY created_at DESC LIMIT 1;
     -- Should show the insert operation with user_id = 1
*/

-- ======================================================================
-- COMMIT TRANSACTION
-- ======================================================================

COMMIT;
