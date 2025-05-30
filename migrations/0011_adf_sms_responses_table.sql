-- Migration: 0011_adf_sms_responses_table.sql
-- Description: Add ADF SMS responses tracking table for Twilio integration
-- ADF-06: SMS Response Sender (Twilio)

-- Create SMS delivery status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_delivery_status') THEN
        CREATE TYPE sms_delivery_status AS ENUM (
            'pending',
            'queued',
            'sent',
            'delivered',
            'failed',
            'undelivered',
            'opted_out',
            'retried_success',
            'retried_failed'
        );
    END IF;
END$$;

-- Create ADF SMS responses table
CREATE TABLE IF NOT EXISTS adf_sms_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id INTEGER NOT NULL REFERENCES adf_leads(id) ON DELETE CASCADE,
    dealership_id INTEGER NOT NULL,
    phone_number TEXT NOT NULL,
    phone_number_masked TEXT NOT NULL,
    message TEXT NOT NULL,
    message_sid TEXT,
    status sms_delivery_status NOT NULL DEFAULT 'pending',
    error_code TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    is_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    encrypted_phone TEXT, -- For secure storage of phone number
    metadata JSONB
);

-- Create SMS delivery events tracking table
CREATE TABLE IF NOT EXISTS adf_sms_delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES adf_sms_responses(id) ON DELETE CASCADE,
    message_sid TEXT NOT NULL,
    status sms_delivery_status NOT NULL,
    error_code TEXT,
    error_message TEXT,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    raw_payload JSONB -- Store the raw webhook payload for debugging
);

-- Create SMS opt-out tracking table
CREATE TABLE IF NOT EXISTS adf_sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership_id INTEGER NOT NULL,
    phone_number TEXT NOT NULL,
    phone_number_masked TEXT NOT NULL,
    phone_number_hash TEXT NOT NULL, -- For secure lookups
    reason TEXT NOT NULL DEFAULT 'user_request',
    opted_out_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    opted_back_in_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add column to adf_leads table for SMS status tracking
ALTER TABLE adf_leads ADD COLUMN IF NOT EXISTS sms_status TEXT;
ALTER TABLE adf_leads ADD COLUMN IF NOT EXISTS sms_error TEXT;
ALTER TABLE adf_leads ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE adf_leads ADD COLUMN IF NOT EXISTS sms_delivered_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_adf_sms_responses_lead_id ON adf_sms_responses(lead_id);
CREATE INDEX IF NOT EXISTS idx_adf_sms_responses_message_sid ON adf_sms_responses(message_sid) WHERE message_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_adf_sms_responses_status ON adf_sms_responses(status);
CREATE INDEX IF NOT EXISTS idx_adf_sms_responses_created_at ON adf_sms_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_adf_sms_responses_dealership_phone ON adf_sms_responses(dealership_id, phone_number_masked);
CREATE INDEX IF NOT EXISTS idx_adf_sms_responses_retry ON adf_sms_responses(retry_count) WHERE status IN ('failed', 'undelivered');

CREATE INDEX IF NOT EXISTS idx_adf_sms_delivery_events_message_id ON adf_sms_delivery_events(message_id);
CREATE INDEX IF NOT EXISTS idx_adf_sms_delivery_events_message_sid ON adf_sms_delivery_events(message_sid);
CREATE INDEX IF NOT EXISTS idx_adf_sms_delivery_events_timestamp ON adf_sms_delivery_events(event_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_adf_sms_opt_outs_dealership_phone ON adf_sms_opt_outs(dealership_id, phone_number_hash);
CREATE INDEX IF NOT EXISTS idx_adf_sms_opt_outs_phone_hash ON adf_sms_opt_outs(phone_number_hash);
CREATE INDEX IF NOT EXISTS idx_adf_sms_opt_outs_opted_out_at ON adf_sms_opt_outs(opted_out_at);

-- Add adf_leads SMS status index
CREATE INDEX IF NOT EXISTS idx_adf_leads_sms_status ON adf_leads(sms_status);

-- Helper function to check if a phone number has opted out
CREATE OR REPLACE FUNCTION check_sms_opt_out(p_dealership_id INTEGER, p_phone_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_phone_hash TEXT;
    v_opted_out BOOLEAN;
BEGIN
    -- Create hash of phone number
    v_phone_hash := encode(digest(p_phone_number, 'sha256'), 'hex');
    
    -- Check if opted out
    SELECT EXISTS (
        SELECT 1 FROM adf_sms_opt_outs
        WHERE dealership_id = p_dealership_id
        AND phone_number_hash = v_phone_hash
        AND opted_back_in_at IS NULL
    ) INTO v_opted_out;
    
    RETURN v_opted_out;
END;
$$ LANGUAGE plpgsql;

-- Helper function to find leads by phone number
CREATE OR REPLACE FUNCTION find_leads_by_phone(p_dealership_id INTEGER, p_phone_number TEXT)
RETURNS TABLE(lead_id INTEGER) AS $$
DECLARE
    v_last_digits TEXT;
BEGIN
    -- Get last 10 digits for matching
    v_last_digits := RIGHT(regexp_replace(p_phone_number, '[^0-9]', '', 'g'), 10);
    
    RETURN QUERY
    SELECT DISTINCT l.id
    FROM adf_leads l
    JOIN adf_customers c ON l.id = c.lead_id
    WHERE 
        l.dealership_id = p_dealership_id
        AND (
            c.phone LIKE '%' || v_last_digits
            OR c.mobile_phone LIKE '%' || v_last_digits
            OR c.home_phone LIKE '%' || v_last_digits
            OR c.work_phone LIKE '%' || v_last_digits
        );
END;
$$ LANGUAGE plpgsql;

-- Add comment to tables
COMMENT ON TABLE adf_sms_responses IS 'Tracks SMS responses sent to ADF leads via Twilio';
COMMENT ON TABLE adf_sms_delivery_events IS 'Tracks delivery status events for SMS messages';
COMMENT ON TABLE adf_sms_opt_outs IS 'Tracks customer opt-outs from SMS messaging';

-- Rollback SQL (to be used in rollback script)
-- DROP TABLE IF EXISTS adf_sms_delivery_events;
-- DROP TABLE IF EXISTS adf_sms_responses;
-- DROP TABLE IF EXISTS adf_sms_opt_outs;
-- ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_status;
-- ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_error;
-- ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_sent_at;
-- ALTER TABLE adf_leads DROP COLUMN IF EXISTS sms_delivered_at;
-- DROP FUNCTION IF EXISTS check_sms_opt_out(INTEGER, TEXT);
-- DROP FUNCTION IF EXISTS find_leads_by_phone(INTEGER, TEXT);
-- DROP TYPE IF EXISTS sms_delivery_status;
