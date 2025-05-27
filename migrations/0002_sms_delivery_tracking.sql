-- Migration 0002: SMS Delivery Tracking Schema
-- Create tables for comprehensive SMS delivery tracking with Twilio integration

-- SMS delivery status enum
CREATE TYPE sms_status AS ENUM (
    'queued',
    'sent', 
    'delivered',
    'failed',
    'undelivered',
    'received',
    'accepted'
);

-- SMS message direction enum  
CREATE TYPE sms_direction AS ENUM (
    'inbound',
    'outbound'
);

-- SMS messages table for comprehensive tracking
CREATE TABLE sms_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Twilio identifiers
    twilio_sid VARCHAR(255) UNIQUE, -- Twilio message SID
    twilio_account_sid VARCHAR(255), -- Twilio account SID
    
    -- Phone numbers (stored masked for privacy)
    to_phone VARCHAR(255) NOT NULL,
    from_phone VARCHAR(255) NOT NULL,
    to_phone_masked VARCHAR(255) NOT NULL, -- e.g., +1-555-***-1234
    from_phone_masked VARCHAR(255) NOT NULL,
    
    -- Message content
    body TEXT,
    media_urls JSONB DEFAULT '[]', -- Array of media URLs
    
    -- Message metadata
    direction sms_direction NOT NULL,
    status sms_status NOT NULL DEFAULT 'queued',
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Pricing information (in cents)
    price_amount INTEGER, -- Price in cents
    price_currency VARCHAR(3) DEFAULT 'USD',
    
    -- Delivery tracking
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    
    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    
    -- Analytics and tracking
    segments INTEGER DEFAULT 1, -- Number of SMS segments
    num_media INTEGER DEFAULT 0, -- Number of media attachments
    
    -- External references
    external_id VARCHAR(255), -- Reference to external system
    webhook_url VARCHAR(500), -- Status callback URL
    
    -- Custom fields for extensibility
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX sms_messages_dealership_idx ON sms_messages(dealership_id);
CREATE INDEX sms_messages_conversation_idx ON sms_messages(conversation_id);
CREATE INDEX sms_messages_lead_idx ON sms_messages(lead_id);
CREATE INDEX sms_messages_twilio_sid_idx ON sms_messages(twilio_sid);
CREATE INDEX sms_messages_status_idx ON sms_messages(status);
CREATE INDEX sms_messages_direction_idx ON sms_messages(direction);
CREATE INDEX sms_messages_to_phone_idx ON sms_messages(to_phone);
CREATE INDEX sms_messages_from_phone_idx ON sms_messages(from_phone);
CREATE INDEX sms_messages_created_at_idx ON sms_messages(created_at);
CREATE INDEX sms_messages_sent_at_idx ON sms_messages(sent_at);
CREATE INDEX sms_messages_retry_idx ON sms_messages(next_retry_at, retry_count) WHERE next_retry_at IS NOT NULL;

-- SMS delivery events table for detailed tracking
CREATE TABLE sms_delivery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sms_message_id UUID NOT NULL REFERENCES sms_messages(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- queued, sent, delivered, failed, etc.
    previous_status sms_status,
    new_status sms_status NOT NULL,
    
    -- Twilio webhook data
    twilio_webhook_data JSONB,
    
    -- Error information
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timing
    event_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for delivery events
CREATE INDEX sms_delivery_events_message_idx ON sms_delivery_events(sms_message_id);
CREATE INDEX sms_delivery_events_type_idx ON sms_delivery_events(event_type);
CREATE INDEX sms_delivery_events_status_idx ON sms_delivery_events(new_status);
CREATE INDEX sms_delivery_events_timestamp_idx ON sms_delivery_events(event_timestamp);

-- SMS templates table for reusable message templates
CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    
    -- Template details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    body TEXT NOT NULL,
    
    -- Template categorization
    category VARCHAR(100), -- welcome, follow_up, appointment, etc.
    tags JSONB DEFAULT '[]',
    
    -- Template variables (for personalization)
    variables JSONB DEFAULT '{}', -- {firstName: "Customer's first name", etc.}
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Template status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT sms_templates_unique_name UNIQUE (dealership_id, name)
);

-- Create indexes for SMS templates
CREATE INDEX sms_templates_dealership_idx ON sms_templates(dealership_id);
CREATE INDEX sms_templates_category_idx ON sms_templates(category);
CREATE INDEX sms_templates_active_idx ON sms_templates(is_active);

-- SMS phone numbers table for managing Twilio phone numbers
CREATE TABLE sms_phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    
    -- Phone number details
    phone_number VARCHAR(255) NOT NULL UNIQUE,
    phone_number_masked VARCHAR(255) NOT NULL, -- For display purposes
    friendly_name VARCHAR(255),
    
    -- Twilio details
    twilio_sid VARCHAR(255) UNIQUE,
    twilio_account_sid VARCHAR(255),
    
    -- Capabilities
    sms_enabled BOOLEAN DEFAULT true,
    voice_enabled BOOLEAN DEFAULT false,
    mms_enabled BOOLEAN DEFAULT false,
    
    -- Webhook configuration
    webhook_url VARCHAR(500),
    status_callback_url VARCHAR(500),
    
    -- Usage tracking
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    monthly_message_limit INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for phone numbers
CREATE INDEX sms_phone_numbers_dealership_idx ON sms_phone_numbers(dealership_id);
CREATE INDEX sms_phone_numbers_active_idx ON sms_phone_numbers(is_active);
CREATE INDEX sms_phone_numbers_twilio_sid_idx ON sms_phone_numbers(twilio_sid);

-- SMS campaigns table for bulk messaging
CREATE TABLE sms_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    
    -- Campaign details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_id UUID REFERENCES sms_templates(id),
    
    -- Campaign configuration
    from_phone_id UUID REFERENCES sms_phone_numbers(id),
    recipient_criteria JSONB, -- Criteria for selecting recipients
    
    -- Scheduling
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Campaign status
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, completed, cancelled
    
    -- Statistics
    total_recipients INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    opt_outs INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for campaigns
CREATE INDEX sms_campaigns_dealership_idx ON sms_campaigns(dealership_id);
CREATE INDEX sms_campaigns_status_idx ON sms_campaigns(status);
CREATE INDEX sms_campaigns_scheduled_idx ON sms_campaigns(scheduled_at);

-- SMS opt-outs table for managing unsubscribes
CREATE TABLE sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Phone number (hashed for privacy)
    phone_number_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of phone number
    phone_number_masked VARCHAR(255), -- For display purposes
    
    -- Opt-out details
    opted_out_at TIMESTAMP NOT NULL DEFAULT NOW(),
    opt_out_method VARCHAR(50), -- sms_reply, web_form, api, etc.
    opt_out_message TEXT, -- The message that triggered opt-out
    
    -- Re-opt-in capability
    opted_back_in_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT sms_opt_outs_unique_phone UNIQUE (dealership_id, phone_number_hash)
);

-- Create indexes for opt-outs
CREATE INDEX sms_opt_outs_dealership_idx ON sms_opt_outs(dealership_id);
CREATE INDEX sms_opt_outs_customer_idx ON sms_opt_outs(customer_id);
CREATE INDEX sms_opt_outs_hash_idx ON sms_opt_outs(phone_number_hash);

-- Create triggers for updated_at columns
CREATE TRIGGER update_sms_messages_updated_at BEFORE UPDATE ON sms_messages
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sms_templates_updated_at BEFORE UPDATE ON sms_templates
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sms_phone_numbers_updated_at BEFORE UPDATE ON sms_phone_numbers
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sms_campaigns_updated_at BEFORE UPDATE ON sms_campaigns
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to mask phone numbers for privacy
CREATE OR REPLACE FUNCTION mask_phone_number(phone_number VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    cleaned_phone VARCHAR;
    masked_phone VARCHAR;
BEGIN
    -- Remove all non-digit characters except +
    cleaned_phone := REGEXP_REPLACE(phone_number, '[^+0-9]', '', 'g');
    
    -- Handle different phone number formats
    IF LENGTH(cleaned_phone) >= 10 THEN
        -- Show first 3 and last 4 digits, mask the middle
        IF cleaned_phone LIKE '+1%' THEN
            -- US number: +1-555-***-1234
            masked_phone := SUBSTRING(cleaned_phone, 1, 6) || '-***-' || RIGHT(cleaned_phone, 4);
        ELSE
            -- International number: +33-***-1234
            masked_phone := SUBSTRING(cleaned_phone, 1, 4) || '-***-' || RIGHT(cleaned_phone, 4);
        END IF;
    ELSE
        -- Short number, mask most of it
        masked_phone := LEFT(cleaned_phone, 2) || '***' || RIGHT(cleaned_phone, 1);
    END IF;
    
    RETURN masked_phone;
END;
$$ LANGUAGE plpgsql;

-- Function to hash phone numbers for opt-out tracking
CREATE OR REPLACE FUNCTION hash_phone_number(phone_number VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
    -- Remove all non-digit characters except +, then hash
    RETURN ENCODE(SHA256(REGEXP_REPLACE(phone_number, '[^+0-9]', '', 'g')::BYTEA), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to check if a phone number is opted out
CREATE OR REPLACE FUNCTION is_phone_opted_out(p_dealership_id INTEGER, p_phone_number VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    phone_hash VARCHAR(64);
    opt_out_count INTEGER;
BEGIN
    phone_hash := hash_phone_number(p_phone_number);
    
    SELECT COUNT(*) INTO opt_out_count
    FROM sms_opt_outs
    WHERE dealership_id = p_dealership_id
    AND phone_number_hash = phone_hash
    AND opted_back_in_at IS NULL;
    
    RETURN opt_out_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Create view for SMS analytics
CREATE OR REPLACE VIEW sms_analytics AS
SELECT 
    sm.dealership_id,
    sm.direction,
    sm.status,
    DATE_TRUNC('day', sm.created_at) as message_date,
    COUNT(*) as message_count,
    SUM(CASE WHEN sm.status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
    SUM(CASE WHEN sm.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
    SUM(sm.price_amount) as total_cost_cents,
    AVG(EXTRACT(EPOCH FROM (sm.delivered_at - sm.sent_at))/60) as avg_delivery_time_minutes
FROM sms_messages sm
WHERE sm.created_at >= NOW() - INTERVAL '90 days'
GROUP BY sm.dealership_id, sm.direction, sm.status, DATE_TRUNC('day', sm.created_at)
ORDER BY sm.dealership_id, message_date DESC;

-- Insert default SMS templates for dealerships
INSERT INTO sms_templates (dealership_id, name, description, body, category, variables)
SELECT 
    id,
    'Welcome Message',
    'Default welcome message for new leads',
    'Hi {{firstName}}, thank you for your interest in {{vehicleMake}} {{vehicleModel}}. We''ll be in touch soon!',
    'welcome',
    '{"firstName": "Customer first name", "vehicleMake": "Vehicle make", "vehicleModel": "Vehicle model"}'::jsonb
FROM dealerships
WHERE active = true;

INSERT INTO sms_templates (dealership_id, name, description, body, category, variables)
SELECT 
    id,
    'Appointment Reminder',
    'Reminder for scheduled appointments',
    'Hi {{firstName}}, this is a reminder about your appointment tomorrow at {{appointmentTime}}. See you then!',
    'appointment',
    '{"firstName": "Customer first name", "appointmentTime": "Appointment time"}'::jsonb
FROM dealerships
WHERE active = true;

INSERT INTO sms_templates (dealership_id, name, description, body, category, variables)
SELECT 
    id,
    'Follow Up',
    'General follow-up message',
    'Hi {{firstName}}, I wanted to follow up on your interest in the {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}. Any questions?',
    'follow_up',
    '{"firstName": "Customer first name", "vehicleYear": "Vehicle year", "vehicleMake": "Vehicle make", "vehicleModel": "Vehicle model"}'::jsonb
FROM dealerships
WHERE active = true;

COMMENT ON TABLE sms_messages IS 'Comprehensive SMS message tracking with Twilio integration';
COMMENT ON TABLE sms_delivery_events IS 'Detailed SMS delivery status change events';
COMMENT ON TABLE sms_templates IS 'Reusable SMS message templates with variables';
COMMENT ON TABLE sms_phone_numbers IS 'Twilio phone numbers assigned to dealerships';
COMMENT ON TABLE sms_campaigns IS 'Bulk SMS campaigns and their statistics';
COMMENT ON TABLE sms_opt_outs IS 'Phone numbers that have opted out of SMS messages';