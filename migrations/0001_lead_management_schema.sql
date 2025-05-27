-- Migration 0001: Lead Management Schema
-- Create comprehensive normalized lead storage and conversation management tables
-- Supports ADF integration, attribution tracking, and API-driven conversational AI

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create lead_sources table
CREATE TABLE lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('adf_email', 'website_form', 'phone_call', 'walk_in', 'referral', 'social_media', 'advertising', 'partner', 'manual', 'api')),
    description TEXT,
    configuration JSONB DEFAULT '{}',
    total_leads INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2),
    average_value INTEGER, -- in cents
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT lead_sources_unique_name UNIQUE (dealership_id, name)
);

-- Create indexes for lead_sources
CREATE INDEX lead_sources_dealership_idx ON lead_sources(dealership_id);
CREATE INDEX lead_sources_type_idx ON lead_sources(type);

-- Create vehicle_interests table
CREATE TABLE vehicle_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER,
    make VARCHAR(100),
    model VARCHAR(100),
    trim VARCHAR(100),
    body_style VARCHAR(100),
    vin VARCHAR(17),
    stock_number VARCHAR(50),
    condition VARCHAR(20) CHECK (condition IN ('new', 'used', 'cpo', 'any')),
    min_price INTEGER, -- in cents
    max_price INTEGER, -- in cents
    mileage_max INTEGER,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    features JSONB DEFAULT '[]',
    has_trade_in BOOLEAN DEFAULT false,
    trade_in_year INTEGER,
    trade_in_make VARCHAR(100),
    trade_in_model VARCHAR(100),
    trade_in_trim VARCHAR(100),
    trade_in_vin VARCHAR(17),
    trade_in_mileage INTEGER,
    trade_in_condition VARCHAR(50),
    trade_in_value INTEGER, -- in cents
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for vehicle_interests
CREATE INDEX vehicle_interests_make_model_idx ON vehicle_interests(make, model);
CREATE INDEX vehicle_interests_year_idx ON vehicle_interests(year);
CREATE INDEX vehicle_interests_vin_idx ON vehicle_interests(vin);

-- Create customers table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    alternate_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    date_of_birth TIMESTAMP,
    preferred_language VARCHAR(20) DEFAULT 'en',
    preferred_contact VARCHAR(20), -- email, phone, sms
    lead_score INTEGER DEFAULT 0,
    customer_value INTEGER DEFAULT 0, -- in cents
    segment VARCHAR(50),
    gdpr_consent BOOLEAN DEFAULT false,
    marketing_opt_in BOOLEAN DEFAULT false,
    do_not_call BOOLEAN DEFAULT false,
    first_contact_date TIMESTAMP,
    last_contact_date TIMESTAMP,
    total_leads INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    custom_fields JSONB DEFAULT '{}',
    deduplication_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT customers_unique_dedup UNIQUE (dealership_id, deduplication_hash)
);

-- Create indexes for customers
CREATE INDEX customers_dealership_idx ON customers(dealership_id);
CREATE INDEX customers_email_idx ON customers(email);
CREATE INDEX customers_phone_idx ON customers(phone);
CREATE INDEX customers_full_name_idx ON customers(full_name);
CREATE INDEX customers_dedup_idx ON customers(deduplication_hash);

-- Create leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vehicle_interest_id UUID REFERENCES vehicle_interests(id),
    source_id UUID REFERENCES lead_sources(id),
    assigned_user_id INTEGER REFERENCES users(id),
    lead_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'sold', 'lost', 'follow_up', 'archived')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    request_type VARCHAR(50),
    request_category VARCHAR(100),
    description TEXT,
    timeframe VARCHAR(100),
    source VARCHAR(100) NOT NULL CHECK (source IN ('adf_email', 'website_form', 'phone_call', 'walk_in', 'referral', 'social_media', 'advertising', 'partner', 'manual', 'api')),
    medium VARCHAR(100),
    campaign VARCHAR(100),
    keyword VARCHAR(255),
    referrer VARCHAR(500),
    landing_page VARCHAR(500),
    lead_score INTEGER DEFAULT 0,
    estimated_value INTEGER, -- in cents
    probability DECIMAL(3,2), -- 0.00 to 1.00
    first_contact_date TIMESTAMP,
    last_contact_date TIMESTAMP,
    expected_close_date TIMESTAMP,
    actual_close_date TIMESTAMP,
    next_follow_up_date TIMESTAMP,
    follow_up_notes TEXT,
    external_id VARCHAR(255),
    original_payload JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    deduplication_hash VARCHAR(64) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT leads_unique_lead_number UNIQUE (dealership_id, lead_number),
    CONSTRAINT leads_unique_dedup UNIQUE (dealership_id, deduplication_hash)
);

-- Create indexes for leads
CREATE INDEX leads_dealership_idx ON leads(dealership_id);
CREATE INDEX leads_customer_idx ON leads(customer_id);
CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX leads_assigned_user_idx ON leads(assigned_user_id);
CREATE INDEX leads_source_idx ON leads(source);
CREATE INDEX leads_created_at_idx ON leads(created_at);
CREATE INDEX leads_lead_number_idx ON leads(lead_number);

-- Create conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    assigned_user_id INTEGER REFERENCES users(id),
    subject VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting_response', 'escalated', 'resolved', 'archived')),
    channel VARCHAR(50), -- email, chat, sms, phone
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    is_ai_assisted BOOLEAN DEFAULT true,
    ai_persona_id INTEGER REFERENCES personas(id),
    external_thread_id VARCHAR(255),
    tags JSONB DEFAULT '[]',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP
);

-- Create indexes for conversations
CREATE INDEX conversations_dealership_idx ON conversations(dealership_id);
CREATE INDEX conversations_lead_idx ON conversations(lead_id);
CREATE INDEX conversations_customer_idx ON conversations(customer_id);
CREATE INDEX conversations_status_idx ON conversations(status);
CREATE INDEX conversations_assigned_user_idx ON conversations(assigned_user_id);
CREATE INDEX conversations_last_message_idx ON conversations(last_message_at);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'markdown')),
    subject VARCHAR(255),
    type VARCHAR(50) NOT NULL CHECK (type IN ('inbound', 'outbound', 'internal_note', 'system', 'escalation')),
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('customer', 'ai', 'agent', 'system')),
    sender_user_id INTEGER REFERENCES users(id),
    sender_name VARCHAR(100),
    sender_email VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    external_message_id VARCHAR(255),
    in_reply_to UUID REFERENCES messages(id),
    ai_model VARCHAR(100),
    ai_confidence DECIMAL(3,2),
    processing_time INTEGER, -- milliseconds
    attachments JSONB DEFAULT '[]',
    sentiment VARCHAR(20), -- positive, negative, neutral
    entities JSONB DEFAULT '{}',
    keywords JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for messages
CREATE INDEX messages_conversation_idx ON messages(conversation_id);
CREATE INDEX messages_type_idx ON messages(type);
CREATE INDEX messages_sender_idx ON messages(sender);
CREATE INDEX messages_created_at_idx ON messages(created_at);
CREATE INDEX messages_external_id_idx ON messages(external_message_id);

-- Create handovers table
CREATE TABLE handovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('complex_inquiry', 'technical_issue', 'pricing_negotiation', 'customer_request', 'ai_limitation', 'policy_escalation', 'other')),
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'resolved', 'rejected')),
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    requested_by_id INTEGER REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    context JSONB DEFAULT '{}',
    handover_notes TEXT,
    resolution_notes TEXT,
    urgency VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
    customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for handovers
CREATE INDEX handovers_conversation_idx ON handovers(conversation_id);
CREATE INDEX handovers_lead_idx ON handovers(lead_id);
CREATE INDEX handovers_status_idx ON handovers(status);
CREATE INDEX handovers_to_user_idx ON handovers(to_user_id);
CREATE INDEX handovers_requested_at_idx ON handovers(requested_at);

-- Create lead_activities table
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,
    duration INTEGER, -- minutes
    outcome VARCHAR(100),
    next_action TEXT,
    next_action_date TIMESTAMP,
    message_id UUID REFERENCES messages(id),
    handover_id UUID REFERENCES handovers(id),
    external_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for lead_activities
CREATE INDEX lead_activities_lead_idx ON lead_activities(lead_id);
CREATE INDEX lead_activities_type_idx ON lead_activities(type);
CREATE INDEX lead_activities_user_idx ON lead_activities(user_id);
CREATE INDEX lead_activities_created_at_idx ON lead_activities(created_at);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lead_sources_updated_at BEFORE UPDATE ON lead_sources
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_vehicle_interests_updated_at BEFORE UPDATE ON vehicle_interests
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_handovers_updated_at BEFORE UPDATE ON handovers
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to generate lead numbers
CREATE OR REPLACE FUNCTION generate_lead_number(dealership_id INTEGER)
RETURNS VARCHAR(50) AS $$
DECLARE
    lead_count INTEGER;
    year_suffix VARCHAR(2);
    lead_number VARCHAR(50);
BEGIN
    -- Get current year suffix
    year_suffix := EXTRACT(YEAR FROM NOW())::TEXT;
    year_suffix := RIGHT(year_suffix, 2);
    
    -- Count existing leads for this dealership this year
    SELECT COUNT(*) + 1 INTO lead_count
    FROM leads 
    WHERE leads.dealership_id = generate_lead_number.dealership_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    
    -- Format: LEAD-{DEALERSHIP_ID}-{YEAR}-{COUNT}
    lead_number := 'LEAD-' || dealership_id || '-' || year_suffix || '-' || LPAD(lead_count::TEXT, 4, '0');
    
    RETURN lead_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate deduplication hash for customers
CREATE OR REPLACE FUNCTION generate_customer_dedup_hash(
    p_email VARCHAR(255),
    p_phone VARCHAR(50),
    p_full_name VARCHAR(255)
)
RETURNS VARCHAR(64) AS $$
DECLARE
    hash_input TEXT;
BEGIN
    -- Create consistent hash input from normalized data
    hash_input := LOWER(TRIM(COALESCE(p_email, ''))) || '|' ||
                  REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g') || '|' ||
                  LOWER(TRIM(COALESCE(p_full_name, '')));
    
    -- Return SHA-256 hash
    RETURN ENCODE(SHA256(hash_input::BYTEA), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to generate deduplication hash for leads
CREATE OR REPLACE FUNCTION generate_lead_dedup_hash(
    p_customer_id UUID,
    p_request_type VARCHAR(50),
    p_vehicle_year INTEGER,
    p_vehicle_make VARCHAR(100),
    p_vehicle_model VARCHAR(100)
)
RETURNS VARCHAR(64) AS $$
DECLARE
    hash_input TEXT;
BEGIN
    -- Create consistent hash input from key lead attributes
    hash_input := p_customer_id::TEXT || '|' ||
                  COALESCE(p_request_type, '') || '|' ||
                  COALESCE(p_vehicle_year::TEXT, '') || '|' ||
                  LOWER(TRIM(COALESCE(p_vehicle_make, ''))) || '|' ||
                  LOWER(TRIM(COALESCE(p_vehicle_model, '')));
    
    -- Return SHA-256 hash
    RETURN ENCODE(SHA256(hash_input::BYTEA), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Insert default lead sources for existing dealerships
INSERT INTO lead_sources (dealership_id, name, type, description, is_active)
SELECT 
    id,
    'ADF Email',
    'adf_email',
    'Leads from ADF email processing system',
    true
FROM dealerships
WHERE active = true;

INSERT INTO lead_sources (dealership_id, name, type, description, is_active)
SELECT 
    id,
    'Website Form',
    'website_form',
    'Leads from website contact forms',
    true
FROM dealerships
WHERE active = true;

INSERT INTO lead_sources (dealership_id, name, type, description, is_active)
SELECT 
    id,
    'Phone Inquiry',
    'phone_call',
    'Leads from phone calls',
    true
FROM dealerships
WHERE active = true;

-- Create view for lead pipeline analytics
CREATE OR REPLACE VIEW lead_pipeline_summary AS
SELECT 
    l.dealership_id,
    l.status,
    l.source,
    COUNT(*) as lead_count,
    AVG(l.lead_score) as avg_lead_score,
    SUM(l.estimated_value) as total_estimated_value,
    AVG(EXTRACT(EPOCH FROM (l.updated_at - l.created_at))/86400) as avg_days_in_stage
FROM leads l
WHERE l.created_at >= NOW() - INTERVAL '90 days'
GROUP BY l.dealership_id, l.status, l.source
ORDER BY l.dealership_id, l.status, l.source;

-- Create view for conversation metrics
CREATE OR REPLACE VIEW conversation_metrics AS
SELECT 
    c.dealership_id,
    c.status,
    c.channel,
    COUNT(*) as conversation_count,
    AVG(c.message_count) as avg_message_count,
    AVG(EXTRACT(EPOCH FROM (c.last_message_at - c.created_at))/3600) as avg_duration_hours,
    COUNT(CASE WHEN c.is_ai_assisted THEN 1 END) as ai_assisted_count
FROM conversations c
WHERE c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.dealership_id, c.status, c.channel
ORDER BY c.dealership_id, c.status, c.channel;

COMMENT ON TABLE lead_sources IS 'Configuration and tracking for different lead sources';
COMMENT ON TABLE customers IS 'Normalized customer data with deduplication';
COMMENT ON TABLE vehicle_interests IS 'Customer vehicle interests and trade-in information';
COMMENT ON TABLE leads IS 'Main lead entities with attribution and scoring';
COMMENT ON TABLE conversations IS 'Conversation threads between customers and agents/AI';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE handovers IS 'Escalations from AI to human agents';
COMMENT ON TABLE lead_activities IS 'Audit trail of all lead-related activities';