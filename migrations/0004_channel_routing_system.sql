-- Migration: Channel routing and preferences system
-- This adds comprehensive channel routing, preferences, and delivery tracking

-- Create ENUM types for channel routing
CREATE TYPE communication_channel AS ENUM ('email', 'sms', 'web_chat', 'phone');
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked');
CREATE TYPE channel_preference_type AS ENUM ('preferred', 'allowed', 'blocked');
CREATE TYPE routing_reason AS ENUM ('user_preference', 'channel_unavailable', 'fallback', 'business_hours', 'urgency_level');

-- Customer channel preferences table
CREATE TABLE IF NOT EXISTS customer_channel_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id INTEGER NOT NULL, -- References customers table
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    channel communication_channel NOT NULL,
    preference_type channel_preference_type NOT NULL DEFAULT 'allowed',
    priority INTEGER DEFAULT 1, -- Lower number = higher priority
    active_hours_start TIME, -- When they prefer to receive messages
    active_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference per customer per channel
    UNIQUE(customer_id, dealership_id, channel)
);

-- Dealership channel routing rules
CREATE TABLE IF NOT EXISTS dealership_channel_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    lead_source VARCHAR(100), -- website, facebook, phone, etc.
    urgency_level VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    channel communication_channel NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1, -- Routing priority (1 = highest)
    max_attempts INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    business_hours_only BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for efficient lookups
    INDEX idx_dealership_channel_rules_lookup (dealership_id, lead_source, urgency_level, active)
);

-- Message delivery attempts tracking
CREATE TABLE IF NOT EXISTS message_delivery_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL, -- References various message tables
    conversation_id INTEGER, -- References conversations table if applicable
    customer_id INTEGER NOT NULL, -- References customers table
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    channel communication_channel NOT NULL,
    status delivery_status NOT NULL DEFAULT 'pending',
    routing_reason routing_reason NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    content_hash VARCHAR(64), -- SHA-256 hash of message content for deduplication
    external_message_id VARCHAR(255), -- Twilio SID, email message ID, etc.
    error_code VARCHAR(50),
    error_message TEXT,
    delivery_timestamp TIMESTAMP WITH TIME ZONE,
    opened_timestamp TIMESTAMP WITH TIME ZONE,
    clicked_timestamp TIMESTAMP WITH TIME ZONE,
    response_timestamp TIMESTAMP WITH TIME ZONE,
    metadata JSONB, -- Additional channel-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_message_delivery_customer (customer_id, dealership_id),
    INDEX idx_message_delivery_conversation (conversation_id),
    INDEX idx_message_delivery_status (status, channel),
    INDEX idx_message_delivery_timestamp (delivery_timestamp),
    INDEX idx_message_delivery_external_id (external_message_id)
);

-- Channel availability schedule (business hours, maintenance, etc.)
CREATE TABLE IF NOT EXISTS channel_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    channel communication_channel NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure no overlapping schedules
    CONSTRAINT check_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
    INDEX idx_channel_availability_lookup (dealership_id, channel, day_of_week, active)
);

-- Channel performance metrics (for routing optimization)
CREATE TABLE IF NOT EXISTS channel_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    channel communication_channel NOT NULL,
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_opened INTEGER DEFAULT 0,
    messages_clicked INTEGER DEFAULT 0,
    messages_replied INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    avg_delivery_time_minutes DECIMAL(10,2),
    avg_response_time_minutes DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One record per dealership per channel per day
    UNIQUE(dealership_id, channel, date_recorded),
    INDEX idx_channel_performance_date (date_recorded, dealership_id)
);

-- Fallback routing chains
CREATE TABLE IF NOT EXISTS channel_fallback_chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    chain_name VARCHAR(100) NOT NULL,
    primary_channel communication_channel NOT NULL,
    fallback_channel communication_channel NOT NULL,
    fallback_delay_minutes INTEGER DEFAULT 15,
    max_fallback_attempts INTEGER DEFAULT 2,
    conditions JSONB, -- JSON conditions for when to trigger fallback
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_fallback_chains_dealership (dealership_id, active)
);

-- Create indexes for performance
CREATE INDEX idx_customer_channel_preferences_customer ON customer_channel_preferences(customer_id, dealership_id);
CREATE INDEX idx_customer_channel_preferences_priority ON customer_channel_preferences(priority, preference_type) WHERE preference_type = 'preferred';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_channel_routing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_customer_channel_preferences_updated_at 
    BEFORE UPDATE ON customer_channel_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_channel_routing_updated_at();

CREATE TRIGGER update_dealership_channel_rules_updated_at 
    BEFORE UPDATE ON dealership_channel_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_channel_routing_updated_at();

-- Insert default channel rules for existing dealerships
INSERT INTO dealership_channel_rules (dealership_id, lead_source, channel, priority, max_attempts)
SELECT 
    id,
    'website',
    'email',
    1,
    3
FROM dealerships 
WHERE NOT EXISTS (
    SELECT 1 FROM dealership_channel_rules dcr 
    WHERE dcr.dealership_id = dealerships.id
);

-- Insert default business hours for all channels
INSERT INTO channel_availability (dealership_id, channel, day_of_week, start_time, end_time)
SELECT 
    d.id,
    channel_enum.channel,
    day_series.day,
    '09:00:00'::TIME,
    '17:00:00'::TIME
FROM dealerships d
CROSS JOIN (VALUES 
    ('email'::communication_channel),
    ('sms'::communication_channel),
    ('web_chat'::communication_channel)
) AS channel_enum(channel)
CROSS JOIN generate_series(1, 5) AS day_series(day) -- Monday to Friday
WHERE NOT EXISTS (
    SELECT 1 FROM channel_availability ca 
    WHERE ca.dealership_id = d.id 
    AND ca.channel = channel_enum.channel
);

-- Create view for channel routing insights
CREATE OR REPLACE VIEW channel_routing_analytics AS
SELECT 
    d.name as dealership_name,
    mda.dealership_id,
    mda.channel,
    mda.status,
    COUNT(*) as message_count,
    AVG(EXTRACT(EPOCH FROM (mda.delivery_timestamp - mda.created_at))/60) as avg_delivery_minutes,
    COUNT(CASE WHEN mda.opened_timestamp IS NOT NULL THEN 1 END) as opened_count,
    COUNT(CASE WHEN mda.response_timestamp IS NOT NULL THEN 1 END) as response_count,
    DATE(mda.created_at) as date_sent
FROM message_delivery_attempts mda
JOIN dealerships d ON mda.dealership_id = d.id
WHERE mda.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY d.name, mda.dealership_id, mda.channel, mda.status, DATE(mda.created_at)
ORDER BY date_sent DESC, dealership_name, mda.channel;