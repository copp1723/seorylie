-- Chat Assistant and Task Management Database Schema
-- Migration: 002_chat_assistant_tables.sql

-- Table for storing SEO requests from chat assistant
CREATE TABLE IF NOT EXISTS seo_requests (
    id VARCHAR(255) PRIMARY KEY,
    dealership_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    source VARCHAR(50) DEFAULT 'manual',
    context JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Table for chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id VARCHAR(255) PRIMARY KEY,
    dealership_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    last_message TEXT,
    last_response TEXT,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for individual chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    dealership_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    category VARCHAR(50),
    has_request_button BOOLEAN DEFAULT FALSE,
    request_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for GA4 report cache (enhance existing)
CREATE TABLE IF NOT EXISTS ga4_report_cache (
    id SERIAL PRIMARY KEY,
    property_id VARCHAR(100) NOT NULL,
    dealership_id VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    date_range_start DATE,
    date_range_end DATE,
    dimensions JSONB,
    metrics JSONB,
    report_data JSONB NOT NULL,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for GA4 API usage tracking
CREATE TABLE IF NOT EXISTS ga4_api_usage (
    id SERIAL PRIMARY KEY,
    dealership_id VARCHAR(255) NOT NULL,
    property_id VARCHAR(100) NOT NULL,
    api_method VARCHAR(100) NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_requests_dealership_status ON seo_requests(dealership_id, status);
CREATE INDEX IF NOT EXISTS idx_seo_requests_created_at ON seo_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_dealership ON chat_conversations(dealership_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ga4_cache_key ON ga4_report_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ga4_cache_expires ON ga4_report_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ga4_usage_dealership ON ga4_api_usage(dealership_id, created_at);

-- Comments for documentation
COMMENT ON TABLE seo_requests IS 'SEO service requests generated from chat assistant and other sources';
COMMENT ON TABLE chat_conversations IS 'Chat conversation sessions with metadata';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat conversations';
COMMENT ON TABLE ga4_report_cache IS 'Cached GA4 report data to reduce API calls';
COMMENT ON TABLE ga4_api_usage IS 'GA4 API usage tracking for monitoring and optimization';

-- Update function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_seo_requests_updated_at BEFORE UPDATE ON seo_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

