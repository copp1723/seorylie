-- Rylie Platform Complete Database Schema for Supabase
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Step 2: Create Core Tables

-- Dealerships table - the core of our multi-tenant system
CREATE TABLE dealerships (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    website VARCHAR(255),
    description TEXT,
    
    -- Branding fields
    logo_url VARCHAR(255),
    primary_color VARCHAR(20) DEFAULT '#000000',
    secondary_color VARCHAR(20) DEFAULT '#ffffff',
    accent_color VARCHAR(20) DEFAULT '#4f46e5',
    font_family VARCHAR(100) DEFAULT 'Inter, system-ui, sans-serif',
    
    -- Persona settings
    persona_name VARCHAR(100) DEFAULT 'Rylie',
    persona_tone VARCHAR(50) DEFAULT 'friendly',
    persona_template TEXT,
    welcome_message TEXT,
    
    -- Mode configuration
    operation_mode VARCHAR(50) DEFAULT 'rylie_ai' CHECK (operation_mode IN ('rylie_ai', 'direct_agent')),
    
    -- AI Configuration (JSON)
    ai_config JSONB DEFAULT '{}',
    
    -- Direct Agent Configuration (JSON)
    agent_config JSONB DEFAULT '{
        "enabled_channels": ["chat", "email"],
        "auto_assignment": false,
        "working_hours": {
            "timezone": "America/New_York",
            "schedule": {
                "monday": {"start": "09:00", "end": "17:00", "enabled": true},
                "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
                "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
                "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
                "friday": {"start": "09:00", "end": "17:00", "enabled": true},
                "saturday": {"start": "10:00", "end": "16:00", "enabled": true},
                "sunday": {"start": "12:00", "end": "16:00", "enabled": false}
            }
        },
        "escalation_rules": {
            "response_time_minutes": 5,
            "max_queue_size": 10,
            "priority_routing": true
        },
        "templates": {}
    }',
    
    -- Lead routing configuration (JSON)
    lead_routing JSONB DEFAULT '{
        "auto_create_leads": true,
        "default_lead_source": "website_chat",
        "lead_assignment_strategy": "round_robin",
        "scoring_enabled": true,
        "follow_up_automation": true
    }',
    
    -- Operational settings
    active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for dealerships
CREATE INDEX idx_dealerships_subdomain ON dealerships(subdomain);
CREATE INDEX idx_dealerships_active ON dealerships(active);

-- Users table with dealership_id foreign key
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('super_admin', 'dealership_admin', 'manager', 'user')),
    dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX idx_users_dealership ON users(dealership_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- API Keys table
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for api_keys
CREATE INDEX idx_api_keys_dealership ON api_keys(dealership_id);
CREATE INDEX idx_api_keys_key ON api_keys(key);

-- Personas table
CREATE TABLE personas (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    prompt_template TEXT NOT NULL,
    arguments JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for personas
CREATE INDEX idx_personas_dealership ON personas(dealership_id);
CREATE INDEX idx_personas_default ON personas(is_default);

-- Vehicle inventory table
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    vin VARCHAR(17) NOT NULL,
    stock_number VARCHAR(50),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    trim VARCHAR(100),
    body_style VARCHAR(100),
    ext_color VARCHAR(100),
    int_color VARCHAR(100),
    mileage INTEGER,
    engine VARCHAR(255),
    transmission VARCHAR(100),
    drivetrain VARCHAR(100),
    fuel_type VARCHAR(50),
    fuel_economy INTEGER,
    msrp INTEGER,
    sale_price INTEGER,
    status VARCHAR(50) DEFAULT 'Available',
    certified BOOLEAN DEFAULT false,
    description TEXT,
    features JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    video_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for VIN per dealership
    CONSTRAINT unique_vin_per_dealership UNIQUE (dealership_id, vin)
);

-- Create indexes for vehicles
CREATE INDEX idx_vehicles_dealership ON vehicles(dealership_id);
CREATE INDEX idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX idx_vehicles_year ON vehicles(year);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_active ON vehicles(is_active);

-- Lead Sources - Track where leads come from
CREATE TABLE lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('adf_email', 'website_form', 'phone_call', 'walk_in', 'referral', 'social_media', 'advertising', 'partner', 'manual', 'api')),
    description TEXT,
    configuration JSONB DEFAULT '{}',
    total_leads INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2),
    average_value INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint for source name per dealership
    CONSTRAINT unique_source_name_per_dealership UNIQUE (dealership_id, name)
);

-- Create indexes for lead_sources
CREATE INDEX idx_lead_sources_dealership ON lead_sources(dealership_id);
CREATE INDEX idx_lead_sources_type ON lead_sources(type);
CREATE INDEX idx_lead_sources_active ON lead_sources(is_active);

-- Customers - Normalized customer information
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    
    -- Personal information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    alternate_phone VARCHAR(50),
    
    -- Address information
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'US',
    
    -- Additional demographics
    date_of_birth TIMESTAMPTZ,
    preferred_language VARCHAR(20) DEFAULT 'en',
    preferred_contact VARCHAR(20),
    
    -- Customer scoring and segmentation
    lead_score INTEGER DEFAULT 0,
    customer_value INTEGER DEFAULT 0,
    segment VARCHAR(50),
    
    -- Privacy and compliance
    gdpr_consent BOOLEAN DEFAULT false,
    marketing_opt_in BOOLEAN DEFAULT false,
    do_not_call BOOLEAN DEFAULT false,
    opted_out BOOLEAN DEFAULT false,
    opted_out_at TIMESTAMPTZ,
    
    -- Customer lifecycle
    first_contact_date TIMESTAMPTZ,
    last_contact_date TIMESTAMPTZ,
    total_leads INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    
    -- Custom fields and deduplication
    custom_fields JSONB DEFAULT '{}',
    deduplication_hash VARCHAR(64) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint for deduplication
    CONSTRAINT unique_customer_dedup_per_dealership UNIQUE (dealership_id, deduplication_hash)
);

-- Create indexes for customers
CREATE INDEX idx_customers_dealership ON customers(dealership_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_full_name ON customers(full_name);
CREATE INDEX idx_customers_dedup ON customers(deduplication_hash);

-- Vehicle Interest - What vehicles customers are interested in
CREATE TABLE vehicle_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic vehicle information
    year INTEGER,
    make VARCHAR(100),
    model VARCHAR(100),
    trim VARCHAR(100),
    body_style VARCHAR(100),
    
    -- Specific vehicle reference
    vin VARCHAR(17),
    stock_number VARCHAR(50),
    
    -- Condition and price range
    condition VARCHAR(20),
    min_price INTEGER,
    max_price INTEGER,
    
    -- Preferences
    mileage_max INTEGER,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    features JSONB DEFAULT '[]',
    
    -- Trade-in information
    has_trade_in BOOLEAN DEFAULT false,
    trade_in_year INTEGER,
    trade_in_make VARCHAR(100),
    trade_in_model VARCHAR(100),
    trade_in_trim VARCHAR(100),
    trade_in_vin VARCHAR(17),
    trade_in_mileage INTEGER,
    trade_in_condition VARCHAR(50),
    trade_in_value INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for vehicle_interests
CREATE INDEX idx_vehicle_interests_make_model ON vehicle_interests(make, model);
CREATE INDEX idx_vehicle_interests_year ON vehicle_interests(year);
CREATE INDEX idx_vehicle_interests_vin ON vehicle_interests(vin);

-- Leads - Main lead entity linking customers to their inquiries
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vehicle_interest_id UUID REFERENCES vehicle_interests(id),
    source_id UUID REFERENCES lead_sources(id),
    assigned_user_id INTEGER REFERENCES users(id),
    
    -- Lead identification
    lead_number VARCHAR(50) NOT NULL,
    
    -- Lead details
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'sold', 'lost', 'follow_up', 'archived')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Request information
    request_type VARCHAR(50),
    request_category VARCHAR(100),
    description TEXT,
    timeframe VARCHAR(100),
    
    -- Attribution and tracking
    source VARCHAR(100) NOT NULL CHECK (source IN ('adf_email', 'website_form', 'phone_call', 'walk_in', 'referral', 'social_media', 'advertising', 'partner', 'manual', 'api')),
    medium VARCHAR(100),
    campaign VARCHAR(100),
    keyword VARCHAR(255),
    referrer VARCHAR(500),
    landing_page VARCHAR(500),
    
    -- Lead scoring and value
    lead_score INTEGER DEFAULT 0,
    estimated_value INTEGER,
    probability DECIMAL(3,2),
    
    -- Timing information
    first_contact_date TIMESTAMPTZ,
    last_contact_date TIMESTAMPTZ,
    expected_close_date TIMESTAMPTZ,
    actual_close_date TIMESTAMPTZ,
    
    -- Follow-up scheduling
    next_follow_up_date TIMESTAMPTZ,
    follow_up_notes TEXT,
    
    -- Integration data
    external_id VARCHAR(255),
    original_payload JSONB DEFAULT '{}',
    
    -- Custom fields and deduplication
    custom_fields JSONB DEFAULT '{}',
    deduplication_hash VARCHAR(64) NOT NULL,
    version INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraints
    CONSTRAINT unique_lead_number_per_dealership UNIQUE (dealership_id, lead_number),
    CONSTRAINT unique_lead_dedup_per_dealership UNIQUE (dealership_id, deduplication_hash)
);

-- Create indexes for leads
CREATE INDEX idx_leads_dealership ON leads(dealership_id);
CREATE INDEX idx_leads_customer ON leads(customer_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_user ON leads(assigned_user_id);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_lead_number ON leads(lead_number);

-- Conversations - Track ongoing conversations with customers
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    assigned_user_id INTEGER REFERENCES users(id),
    
    -- Conversation metadata
    subject VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'waiting_response', 'escalated', 'resolved', 'archived')),
    channel VARCHAR(50),
    
    -- Conversation state
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    
    -- AI/Agent assignment
    is_ai_assisted BOOLEAN DEFAULT true,
    ai_persona_id INTEGER REFERENCES personas(id),
    
    -- External references
    external_thread_id VARCHAR(255),
    
    -- Conversation metadata
    tags JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    closed_at TIMESTAMPTZ
);

-- Create indexes for conversations
CREATE INDEX idx_conversations_dealership ON conversations(dealership_id);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_assigned_user ON conversations(assigned_user_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at);

-- Messages - Individual messages within conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Message content
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'markdown')),
    subject VARCHAR(255),
    
    -- Message metadata
    type VARCHAR(50) NOT NULL CHECK (type IN ('inbound', 'outbound', 'internal_note', 'system', 'escalation')),
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('customer', 'ai', 'agent', 'system')),
    sender_user_id INTEGER REFERENCES users(id),
    sender_name VARCHAR(100),
    sender_email VARCHAR(255),
    
    -- Message state
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- External message references
    external_message_id VARCHAR(255),
    in_reply_to UUID REFERENCES messages(id),
    
    -- AI-specific fields
    ai_model VARCHAR(100),
    ai_confidence DECIMAL(3,2),
    processing_time INTEGER,
    
    -- Attachments and media
    attachments JSONB DEFAULT '[]',
    
    -- Message analytics
    sentiment VARCHAR(20),
    entities JSONB DEFAULT '{}',
    keywords JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_type ON messages(type);
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_external_id ON messages(external_message_id);

-- Handovers - Track escalations from AI to human agents
CREATE TABLE handovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Handover details
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('complex_inquiry', 'technical_issue', 'pricing_negotiation', 'customer_request', 'ai_limitation', 'policy_escalation', 'other')),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'resolved', 'rejected')),
    
    -- Assignment
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    requested_by_id INTEGER REFERENCES users(id),
    
    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Context and notes
    context JSONB DEFAULT '{}',
    handover_notes TEXT,
    resolution_notes TEXT,
    
    -- Priority and urgency
    urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
    customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for handovers
CREATE INDEX idx_handovers_conversation ON handovers(conversation_id);
CREATE INDEX idx_handovers_lead ON handovers(lead_id);
CREATE INDEX idx_handovers_status ON handovers(status);
CREATE INDEX idx_handovers_to_user ON handovers(to_user_id);
CREATE INDEX idx_handovers_requested_at ON handovers(requested_at);

-- Lead Activities - Track all activities on a lead
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    
    -- Activity details
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,
    
    -- Activity metadata
    duration INTEGER,
    outcome VARCHAR(100),
    next_action TEXT,
    next_action_date TIMESTAMPTZ,
    
    -- Related entities
    message_id UUID REFERENCES messages(id),
    handover_id UUID REFERENCES handovers(id),
    
    -- External references
    external_id VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for lead_activities
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_type ON lead_activities(type);
CREATE INDEX idx_lead_activities_user ON lead_activities(user_id);
CREATE INDEX idx_lead_activities_created_at ON lead_activities(created_at);

-- Magic link invitations table
CREATE TABLE magic_link_invitations (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER REFERENCES dealerships(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('super_admin', 'dealership_admin', 'manager', 'user')),
    token VARCHAR(255) NOT NULL UNIQUE,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    invited_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for magic_link_invitations
CREATE INDEX idx_invitations_dealership ON magic_link_invitations(dealership_id);
CREATE INDEX idx_invitations_token ON magic_link_invitations(token);
CREATE INDEX idx_invitations_email ON magic_link_invitations(email);

-- Sessions table for express-session
CREATE TABLE sessions (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

-- Create index for sessions
CREATE INDEX idx_sessions_expire ON sessions(expire);

-- Report schedules table
CREATE TABLE report_schedules (
    id SERIAL PRIMARY KEY,
    active BOOLEAN NOT NULL DEFAULT true
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at columns
CREATE TRIGGER update_dealerships_updated_at BEFORE UPDATE ON dealerships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lead_sources_updated_at BEFORE UPDATE ON lead_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_interests_updated_at BEFORE UPDATE ON vehicle_interests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_handovers_updated_at BEFORE UPDATE ON handovers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a sample dealership for testing
INSERT INTO dealerships (name, subdomain, contact_email, contact_phone, city, state) 
VALUES 
('Sample Auto Dealership', 'sample-auto', 'contact@sampleauto.com', '555-123-4567', 'Sample City', 'CA');

-- Insert a sample user
INSERT INTO users (email, name, role, dealership_id, is_verified) 
VALUES 
('admin@sampleauto.com', 'Admin User', 'dealership_admin', 1, true);