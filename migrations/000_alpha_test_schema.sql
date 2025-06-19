-- Alpha Test Schema for Rylie SEO
-- Simple schema focused on the core features needed for testing

-- Create dealerships table
CREATE TABLE IF NOT EXISTS dealerships (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table with password field
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    dealership_id VARCHAR(50) REFERENCES dealerships(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create GA4 properties table
CREATE TABLE IF NOT EXISTS ga4_properties (
    id SERIAL PRIMARY KEY,
    dealership_id VARCHAR(50) REFERENCES dealerships(id),
    property_id VARCHAR(20) NOT NULL,
    property_name VARCHAR(255),
    measurement_id VARCHAR(50),
    website_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create SEOWerks tasks table
CREATE TABLE IF NOT EXISTS seoworks_tasks (
    id SERIAL PRIMARY KEY,
    dealership_id VARCHAR(50) REFERENCES dealerships(id),
    external_id VARCHAR(100) UNIQUE,
    task_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    data JSONB,
    completion_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id VARCHAR(100) PRIMARY KEY,
    dealership_id VARCHAR(50) REFERENCES dealerships(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(100) PRIMARY KEY,
    conversation_id VARCHAR(100) REFERENCES chat_conversations(id),
    message_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create SEO requests table
CREATE TABLE IF NOT EXISTS seo_requests (
    id VARCHAR(100) PRIMARY KEY,
    dealership_id VARCHAR(50) REFERENCES dealerships(id),
    user_id INTEGER REFERENCES users(id),
    request_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    description TEXT NOT NULL,
    additional_context TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for auth
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_dealership ON users(dealership_id);
CREATE INDEX idx_ga4_properties_dealership ON ga4_properties(dealership_id);
CREATE INDEX idx_seoworks_tasks_dealership ON seoworks_tasks(dealership_id);
CREATE INDEX idx_seoworks_tasks_status ON seoworks_tasks(status);
CREATE INDEX idx_chat_conversations_dealership ON chat_conversations(dealership_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_seo_requests_dealership ON seo_requests(dealership_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_dealerships_updated_at BEFORE UPDATE ON dealerships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ga4_properties_updated_at BEFORE UPDATE ON ga4_properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seoworks_tasks_updated_at BEFORE UPDATE ON seoworks_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seo_requests_updated_at BEFORE UPDATE ON seo_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert demo dealership and user for alpha testing
INSERT INTO dealerships (id, name, website, settings) VALUES 
('alpha-test-001', 'Alpha Test Ford', 'https://alphatestford.com', 
 '{"package": "GOLD", "main_brand": "Ford", "target_cities": ["Springfield", "Shelbyville"], "target_vehicle_models": ["F-150", "Mustang", "Explorer"]}')
ON CONFLICT (id) DO NOTHING;

-- Insert demo user (password is 'demo123' hashed with bcrypt)
INSERT INTO users (dealership_id, email, password, first_name, last_name, role) VALUES 
('alpha-test-001', 'demo@alphatestford.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJRdIoWC', 'Demo', 'User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert some sample SEO tasks
INSERT INTO seoworks_tasks (dealership_id, external_id, task_type, status, data) VALUES 
('alpha-test-001', 'task-001', 'blog_post', 'completed', '{"title": "Top 5 Features of the 2024 Ford F-150", "published_url": "https://alphatestford.com/blog/2024-f150-features"}'),
('alpha-test-001', 'task-002', 'blog_post', 'completed', '{"title": "Why the Ford Mustang is Perfect for Summer", "published_url": "https://alphatestford.com/blog/mustang-summer-driving"}'),
('alpha-test-001', 'task-003', 'landing_page', 'in_progress', '{"title": "Ford Explorer Special Offers", "target_keywords": ["Ford Explorer deals", "Explorer specials Springfield"]}')
ON CONFLICT (external_id) DO NOTHING;

-- Insert GA4 property
INSERT INTO ga4_properties (dealership_id, property_id, property_name, measurement_id, website_url) VALUES 
('alpha-test-001', '493777160', 'Alpha Test Ford GA4', 'G-XXXXXXXXXX', 'https://alphatestford.com')
ON CONFLICT DO NOTHING;