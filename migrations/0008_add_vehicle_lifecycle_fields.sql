-- Add vehicle lifecycle tracking fields
-- Migration: Add is_active and last_seen fields to vehicles table

ALTER TABLE vehicles 
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN last_seen TIMESTAMP DEFAULT NOW();

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS vehicles_is_active_idx ON vehicles(is_active);
CREATE INDEX IF NOT EXISTS vehicles_last_seen_idx ON vehicles(last_seen);
CREATE INDEX IF NOT EXISTS vehicles_dealership_active_idx ON vehicles(dealership_id, is_active);

-- Update existing vehicles to have explicit active status and last_seen
UPDATE vehicles 
SET is_active = TRUE, 
    last_seen = NOW() 
WHERE is_active IS NULL OR last_seen IS NULL;