-- Rollback for vehicle lifecycle fields migration
-- Migration rollback: Remove is_active and last_seen fields

-- Drop indexes first
DROP INDEX IF EXISTS vehicles_is_active_idx;
DROP INDEX IF EXISTS vehicles_last_seen_idx;
DROP INDEX IF EXISTS vehicles_dealership_active_idx;

-- Remove columns
ALTER TABLE vehicles 
DROP COLUMN IF EXISTS is_active,
DROP COLUMN IF EXISTS last_seen;