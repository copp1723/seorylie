-- 0024_multi_tenant_rbac.sql
-- Adds first-class multi-tenant support and role-based access control
-- ---------------------------------------------------------------
-- 1. Tenants table
--    • Agencies (parent_id IS NULL)
--    • Dealers  (parent_id = agency_id)
-- 2. Add tenant_id & role to users
-- 3. Create role enum helper
-- 4. Migrate existing users/dealerships to new model (best-effort)  

BEGIN;

-- 1. Tenants -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    brand        JSONB DEFAULT '{}',              -- {logoUrl, primaryColor, secondaryColor}
    parent_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Role enum ----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super', 'agency', 'dealer');
    END IF;
END$$;

-- 3. Users table changes -------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'dealer';

CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);

-- 4. Best-effort migration -----------------------------------------------------
-- If users.dealership_id column exists, map to tenants structure.
-- We create one tenant per distinct dealership_id and link users.
DO $$
DECLARE
    _did  INTEGER;
    _tid  UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'dealership_id'
    ) THEN
        FOR _did IN SELECT DISTINCT dealership_id FROM users LOOP
            INSERT INTO tenants(name) VALUES (concat('Dealer-', _did)) RETURNING id INTO _tid;
            UPDATE users SET tenant_id = _tid WHERE dealership_id = _did;
        END LOOP;
    END IF;
END$$;

COMMIT;
