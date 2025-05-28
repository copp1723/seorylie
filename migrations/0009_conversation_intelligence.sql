-- Migration: Add conversation intelligence and context tracking
-- File: 0009_conversation_intelligence.sql

-- Conversation context table for intelligent conversation tracking
CREATE TABLE IF NOT EXISTS conversation_context (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    dealership_id INTEGER NOT NULL,
    
    -- Customer Information
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Conversation State
    conversation_stage VARCHAR(50) DEFAULT 'greeting',
    current_intent JSONB,
    customer_sentiment VARCHAR(20) DEFAULT 'neutral',
    urgency_level VARCHAR(20) DEFAULT 'low',
    
    -- Customer Journey & Interests
    previous_interests JSONB DEFAULT '[]',
    current_need JSONB,
    visit_history JSONB DEFAULT '[]',
    
    -- Conversation Memory
    key_facts JSONB DEFAULT '[]',
    conversation_summary TEXT DEFAULT '',
    preferences JSONB DEFAULT '{}',
    
    -- Metadata
    total_messages INTEGER DEFAULT 0,
    session_start_time TIMESTAMP DEFAULT NOW(),
    last_message_time TIMESTAMP DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_context_conversation_id ON conversation_context(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_dealership_id ON conversation_context(dealership_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_customer_email ON conversation_context(customer_email);
CREATE INDEX IF NOT EXISTS idx_conversation_context_last_message_time ON conversation_context(last_message_time);

-- Enhanced conversation messages table with intelligence metadata
CREATE TABLE IF NOT EXISTS conversation_messages_enhanced (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Message Content
    content TEXT NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    
    -- Intelligence Metadata
    detected_intent VARCHAR(100),
    detected_entities JSONB DEFAULT '{}',
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    confidence_score DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Message Context
    conversation_stage_at_time VARCHAR(50),
    customer_interests_at_time JSONB DEFAULT '[]',
    
    -- Processing Metadata
    processing_time_ms INTEGER,
    ai_model_used VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    
    -- Timestamps
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key
    FOREIGN KEY (conversation_id) REFERENCES conversation_context(conversation_id) ON DELETE CASCADE
);

-- Indexes for conversation messages
CREATE INDEX IF NOT EXISTS idx_conversation_messages_enhanced_conversation_id ON conversation_messages_enhanced(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_enhanced_timestamp ON conversation_messages_enhanced(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_enhanced_intent ON conversation_messages_enhanced(detected_intent);

-- Customer journey tracking table
CREATE TABLE IF NOT EXISTS customer_journey_events (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    
    -- Event Information
    event_type VARCHAR(100) NOT NULL, -- 'page_view', 'vehicle_interest', 'quote_request', etc.
    event_data JSONB NOT NULL,
    
    -- Context
    conversation_stage VARCHAR(50),
    customer_sentiment VARCHAR(20),
    
    -- Timestamps
    event_time TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key
    FOREIGN KEY (conversation_id) REFERENCES conversation_context(conversation_id) ON DELETE CASCADE
);

-- Indexes for customer journey
CREATE INDEX IF NOT EXISTS idx_customer_journey_events_conversation_id ON customer_journey_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_customer_journey_events_customer_email ON customer_journey_events(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_journey_events_event_type ON customer_journey_events(event_type);
CREATE INDEX IF NOT EXISTS idx_customer_journey_events_event_time ON customer_journey_events(event_time);

-- Conversation analytics summary table
CREATE TABLE IF NOT EXISTS conversation_analytics (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    dealership_id INTEGER NOT NULL,
    
    -- Conversation Metrics
    total_messages INTEGER DEFAULT 0,
    conversation_duration_minutes INTEGER,
    stages_progressed JSONB DEFAULT '[]',
    intents_detected JSONB DEFAULT '[]',
    
    -- Customer Insights
    customer_satisfaction_score DECIMAL(3,2), -- 1.0 to 5.0
    lead_quality_score DECIMAL(3,2), -- 0.0 to 1.0
    conversion_likelihood DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Outcomes
    outcome_type VARCHAR(100), -- 'lead_generated', 'appointment_scheduled', 'no_interest', etc.
    handoff_to_human BOOLEAN DEFAULT FALSE,
    handoff_reason VARCHAR(255),
    
    -- Timestamps
    conversation_start TIMESTAMP,
    conversation_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (conversation_id) REFERENCES conversation_context(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_conversation_id ON conversation_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_dealership_id ON conversation_analytics(dealership_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_outcome_type ON conversation_analytics(outcome_type);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_lead_quality_score ON conversation_analytics(lead_quality_score);

-- Intelligent response templates table
CREATE TABLE IF NOT EXISTS intelligent_response_templates (
    id SERIAL PRIMARY KEY,
    dealership_id INTEGER NOT NULL,
    
    -- Template Information
    template_name VARCHAR(255) NOT NULL,
    conversation_stage VARCHAR(50) NOT NULL,
    intent VARCHAR(100) NOT NULL,
    
    -- Template Content
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '{}', -- Variables that can be replaced
    
    -- Usage Criteria
    customer_sentiment VARCHAR(20), -- When to use this template
    urgency_level VARCHAR(20),
    context_requirements JSONB DEFAULT '{}', -- Required context for this template
    
    -- Performance Metrics
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0, -- How often it leads to positive outcomes
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key
    FOREIGN KEY (dealership_id) REFERENCES dealerships(id) ON DELETE CASCADE
);

-- Indexes for response templates
CREATE INDEX IF NOT EXISTS idx_intelligent_response_templates_dealership_id ON intelligent_response_templates(dealership_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_response_templates_stage_intent ON intelligent_response_templates(conversation_stage, intent);
CREATE INDEX IF NOT EXISTS idx_intelligent_response_templates_active ON intelligent_response_templates(is_active);

-- Update trigger for conversation context
CREATE OR REPLACE FUNCTION update_conversation_context_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_context_timestamp
    BEFORE UPDATE ON conversation_context
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_context_timestamp();

-- Update trigger for conversation analytics
CREATE TRIGGER trigger_update_conversation_analytics_timestamp
    BEFORE UPDATE ON conversation_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_context_timestamp();

-- Update trigger for response templates
CREATE TRIGGER trigger_update_response_templates_timestamp
    BEFORE UPDATE ON intelligent_response_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_context_timestamp();