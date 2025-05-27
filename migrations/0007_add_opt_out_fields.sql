-- Add opt-out fields to customers table for compliance
-- Migration: Add opted_out and opted_out_at fields

ALTER TABLE customers 
ADD COLUMN opted_out BOOLEAN DEFAULT FALSE,
ADD COLUMN opted_out_at TIMESTAMP;

-- Add index for efficient opt-out queries
CREATE INDEX IF NOT EXISTS customers_opted_out_idx ON customers(opted_out);

-- Update any existing customers to have explicit opt-out status
UPDATE customers SET opted_out = FALSE WHERE opted_out IS NULL;