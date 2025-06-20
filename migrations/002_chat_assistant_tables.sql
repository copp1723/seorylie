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

-- Table for GA4 report cache
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

-- Basic dealerships table if it doesn't exist
CREATE TABLE IF NOT EXISTS dealerships (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(63) UNIQUE NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    website_url VARCHAR(255),
    address JSONB,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    operation_mode VARCHAR(20) DEFAULT 'rylie_ai',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    dealership_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(255) PRIMARY KEY,
    dealership_id VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEOWerks onboarding submissions table
CREATE TABLE IF NOT EXISTS seoworks_onboarding_submissions (
    id VARCHAR(255) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    package VARCHAR(20) NOT NULL,
    main_brand VARCHAR(100) NOT NULL,
    target_cities TEXT[],
    target_vehicle_models TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEOWerks tasks table
CREATE TABLE IF NOT EXISTS seoworks_tasks (
    id VARCHAR(255) PRIMARY KEY,
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    dealership_id VARCHAR(255),
    completion_notes TEXT,
    post_title VARCHAR(255),
    post_url VARCHAR(255),
    completion_date TIMESTAMP WITH TIME ZONE,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GA4 properties table
CREATE TABLE IF NOT EXISTS ga4_properties (
    id SERIAL PRIMARY KEY,
    dealership_id VARCHAR(255) NOT NULL,
    property_id VARCHAR(100) NOT NULL,
    property_name VARCHAR(255),
    measurement_id VARCHAR(100),
    website_url VARCHAR(255),
    sync_status VARCHAR(20) DEFAULT 'pending',
    is_active BOOLEAN DEFAULT TRUE,
    access_granted_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dealership_id, property_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_requests_dealership_status ON seo_requests(dealership_id, status);
CREATE INDEX IF NOT EXISTS idx_seo_requests_created_at ON seo_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_dealership ON chat_conversations(dealership_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ga4_cache_key ON ga4_report_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ga4_cache_expires ON ga4_report_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ga4_usage_dealership ON ga4_api_usage(dealership_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dealerships_subdomain ON dealerships(subdomain);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_dealership ON users(dealership_id);
CREATE INDEX IF NOT EXISTS idx_seoworks_tasks_dealership ON seoworks_tasks(dealership_id);
CREATE INDEX IF NOT EXISTS idx_ga4_properties_dealership ON ga4_properties(dealership_id);

-- Update function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_seo_requests_updated_at ON seo_requests;
CREATE TRIGGER update_seo_requests_updated_at BEFORE UPDATE ON seo_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dealerships_updated_at ON dealerships;
CREATE TRIGGER update_dealerships_updated_at BEFORE UPDATE ON dealerships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seoworks_tasks_updated_at ON seoworks_tasks;
CREATE TRIGGER update_seoworks_tasks_updated_at BEFORE UPDATE ON seoworks_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ga4_properties_updated_at ON ga4_properties;
CREATE TRIGGER update_ga4_properties_updated_at BEFORE UPDATE ON ga4_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

