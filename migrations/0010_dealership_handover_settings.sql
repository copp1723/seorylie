-- Migration: 0010_dealership_handover_settings.sql
-- Description: Add dealership handover settings table and dossier field to handovers

-- Up Migration
BEGIN;

-- Create dealership_handover_settings table
CREATE TABLE IF NOT EXISTS dealership_handover_settings (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    handover_email VARCHAR(255) NOT NULL,
    sla_hours INTEGER NOT NULL DEFAULT 24,
    dossier_template VARCHAR(100) DEFAULT 'default',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_dealership_handover_settings UNIQUE (dealership_id)
);

-- Add indexes
CREATE INDEX idx_dealership_handover_settings_dealership_id ON dealership_handover_settings(dealership_id);

-- Add dossier field to handovers table
ALTER TABLE handovers
ADD COLUMN IF NOT EXISTS dossier JSONB DEFAULT NULL;

-- Add index on dossier for potential future queries
CREATE INDEX idx_handovers_dossier_gin ON handovers USING GIN (dossier jsonb_path_ops);

-- Insert default settings for existing dealerships
INSERT INTO dealership_handover_settings (dealership_id, handover_email)
SELECT id, CONCAT('sales@', LOWER(REPLACE(name, ' ', '')), '.com')
FROM dealerships
ON CONFLICT (dealership_id) DO NOTHING;

COMMIT;

-- Down Migration
BEGIN;

-- Remove dossier field from handovers table
ALTER TABLE handovers DROP COLUMN IF EXISTS dossier;

-- Drop index
DROP INDEX IF EXISTS idx_handovers_dossier_gin;

-- Drop dealership_handover_settings table
DROP TABLE IF EXISTS dealership_handover_settings;

COMMIT;
