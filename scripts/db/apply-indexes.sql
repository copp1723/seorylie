-- Performance Optimization: Database Indexes
-- Run this script to create the most important indexes for performance

-- Start a transaction to ensure all indexes are created together
BEGIN;

-- Users table indexes (for faster authentication and user lookups)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_dealership_role ON users (dealership_id, role);

-- Conversations table indexes (for faster listing and filtering)
CREATE INDEX IF NOT EXISTS idx_conversations_dealership ON conversations (dealership_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations (customer_email);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_phone ON conversations (customer_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_dealership_created ON conversations (dealership_id, created_at DESC);

-- Messages table indexes (for faster message retrieval)
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from_customer ON messages (is_from_customer);

-- Full-text search index for message content (for advanced searching)
CREATE INDEX IF NOT EXISTS idx_messages_content_tsvector ON messages USING GIN (to_tsvector('english', content));

-- Dealerships table indexes
CREATE INDEX IF NOT EXISTS idx_dealerships_subdomain ON dealerships (subdomain);

-- API Keys table indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_dealership ON api_keys (dealership_id);

-- Personas table indexes
CREATE INDEX IF NOT EXISTS idx_personas_dealership ON personas (dealership_id);
CREATE INDEX IF NOT EXISTS idx_personas_default ON personas (dealership_id, is_default);

-- Vehicles table indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_dealership_status ON vehicles (dealership_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles (make, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_price_range ON vehicles (sale_price);

-- Magic Link Invitations table indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON magic_link_invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON magic_link_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON magic_link_invitations (expires_at);

-- Commit the transaction
COMMIT;