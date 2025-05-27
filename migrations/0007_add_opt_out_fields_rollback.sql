-- Rollback for opt-out fields migration
-- Migration rollback: Remove opted_out and opted_out_at fields

-- Drop index first
DROP INDEX IF EXISTS customers_opted_out_idx;

-- Remove columns
ALTER TABLE customers 
DROP COLUMN IF EXISTS opted_out,
DROP COLUMN IF EXISTS opted_out_at;