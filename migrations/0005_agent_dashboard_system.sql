-- Migration: Agent dashboard and conversation handover system
-- This adds tables for agent management, conversation handovers, and dashboard functionality

-- Create ENUM types for agent system
CREATE TYPE agent_role AS ENUM ('agent', 'supervisor', 'admin');
CREATE TYPE agent_status AS ENUM ('online', 'busy', 'away', 'offline');
CREATE TYPE handover_status AS ENUM ('pending', 'claimed', 'in_progress', 'resolved', 'escalated');
CREATE TYPE handover_reason AS ENUM ('customer_request', 'ai_limitation', 'complex_inquiry', 'escalation', 'technical_issue');
CREATE TYPE conversation_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    employee_id VARCHAR(50), -- Internal employee ID
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    role agent_role NOT NULL DEFAULT 'agent',
    status agent_status NOT NULL DEFAULT 'offline',
    max_concurrent_conversations INTEGER DEFAULT 5,
    skills JSONB, -- JSON array of skills/specializations
    languages JSONB, -- JSON array of supported languages
    work_schedule JSONB, -- Working hours and days
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    
    -- Indexes for performance
    INDEX idx_agents_dealership (dealership_id),
    INDEX idx_agents_status (status, active),
    INDEX idx_agents_email (email),
    INDEX idx_agents_role (role, dealership_id)
);

-- Agent sessions table (for tracking active sessions)
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    active BOOLEAN DEFAULT true,
    
    INDEX idx_agent_sessions_agent (agent_id, active),
    INDEX idx_agent_sessions_token (session_token),
    INDEX idx_agent_sessions_expires (expires_at)
);

-- Conversation handovers table
CREATE TABLE IF NOT EXISTS conversation_handovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id INTEGER NOT NULL, -- References conversations table
    customer_id INTEGER NOT NULL, -- References customers table
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    status handover_status NOT NULL DEFAULT 'pending',
    reason handover_reason NOT NULL,
    priority conversation_priority NOT NULL DEFAULT 'normal',
    requested_by VARCHAR(100), -- 'ai', 'customer', 'agent:{id}', 'system'
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    claimed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    escalated_to UUID REFERENCES agents(id) ON DELETE SET NULL,
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_reason TEXT,
    context_summary TEXT, -- AI-generated summary of conversation context
    customer_sentiment VARCHAR(20), -- positive, neutral, negative, frustrated
    estimated_resolution_time INTEGER, -- minutes
    actual_resolution_time INTEGER, -- minutes
    customer_satisfaction_score INTEGER, -- 1-5 scale
    metadata JSONB, -- Additional handover-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_handovers_conversation (conversation_id),
    INDEX idx_handovers_status (status, dealership_id),
    INDEX idx_handovers_priority (priority, status),
    INDEX idx_handovers_claimed_by (claimed_by, status),
    INDEX idx_handovers_requested_at (requested_at, status),
    
    -- Ensure one active handover per conversation
    UNIQUE(conversation_id) WHERE status IN ('pending', 'claimed', 'in_progress')
);

-- Agent conversation assignments
CREATE TABLE IF NOT EXISTS agent_conversation_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL, -- References conversations table
    handover_id UUID REFERENCES conversation_handovers(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unassigned_at TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN DEFAULT true, -- Primary agent vs observer/supervisor
    notes TEXT,
    
    INDEX idx_agent_assignments_agent (agent_id, unassigned_at),
    INDEX idx_agent_assignments_conversation (conversation_id, is_primary),
    INDEX idx_agent_assignments_handover (handover_id)
);

-- Agent performance metrics
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    conversations_handled INTEGER DEFAULT 0,
    avg_response_time_minutes DECIMAL(10,2),
    avg_resolution_time_minutes DECIMAL(10,2),
    customer_satisfaction_avg DECIMAL(3,2),
    handovers_claimed INTEGER DEFAULT 0,
    handovers_resolved INTEGER DEFAULT 0,
    handovers_escalated INTEGER DEFAULT 0,
    online_time_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One record per agent per day
    UNIQUE(agent_id, date_recorded),
    INDEX idx_agent_performance_date (date_recorded, agent_id)
);

-- Agent notifications/alerts
CREATE TABLE IF NOT EXISTS agent_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'new_handover', 'escalation', 'message', 'system'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority conversation_priority DEFAULT 'normal',
    related_conversation_id INTEGER,
    related_handover_id UUID REFERENCES conversation_handovers(id) ON DELETE SET NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_agent_notifications_agent (agent_id, read_at),
    INDEX idx_agent_notifications_type (type, created_at),
    INDEX idx_agent_notifications_priority (priority, read_at)
);

-- Agent quick responses/templates
CREATE TABLE IF NOT EXISTS agent_quick_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- NULL for dealership-wide
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB, -- Placeholders that can be filled in
    usage_count INTEGER DEFAULT 0,
    is_shared BOOLEAN DEFAULT false, -- Can other agents use this?
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_quick_responses_agent (agent_id, active),
    INDEX idx_quick_responses_dealership (dealership_id, is_shared, active),
    INDEX idx_quick_responses_category (category, dealership_id)
);

-- Conversation notes by agents
CREATE TABLE IF NOT EXISTS conversation_agent_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id INTEGER NOT NULL, -- References conversations table
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    note_type VARCHAR(50) DEFAULT 'general', -- general, internal, followup, resolution
    content TEXT NOT NULL,
    is_visible_to_customer BOOLEAN DEFAULT false,
    tags JSONB, -- Array of tags for categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_conversation_notes_conversation (conversation_id, created_at),
    INDEX idx_conversation_notes_agent (agent_id, created_at),
    INDEX idx_conversation_notes_type (note_type, conversation_id)
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_agent_dashboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON agents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_agent_dashboard_updated_at();

CREATE TRIGGER update_conversation_handovers_updated_at 
    BEFORE UPDATE ON conversation_handovers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_agent_dashboard_updated_at();

CREATE TRIGGER update_agent_quick_responses_updated_at 
    BEFORE UPDATE ON agent_quick_responses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_agent_dashboard_updated_at();

CREATE TRIGGER update_conversation_agent_notes_updated_at 
    BEFORE UPDATE ON conversation_agent_notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_agent_dashboard_updated_at();

-- Insert default quick responses
INSERT INTO agent_quick_responses (dealership_id, category, title, content, is_shared, variables)
SELECT 
    id,
    'greetings',
    'Welcome Message',
    'Hello {{customer_name}}! Thank you for contacting {{dealership_name}}. How can I assist you today?',
    true,
    '["customer_name", "dealership_name"]'::jsonb
FROM dealerships
WHERE NOT EXISTS (
    SELECT 1 FROM agent_quick_responses aqr 
    WHERE aqr.dealership_id = dealerships.id 
    AND aqr.category = 'greetings'
);

-- Create view for agent dashboard summary
CREATE OR REPLACE VIEW agent_dashboard_summary AS
SELECT 
    a.id as agent_id,
    a.display_name,
    a.status,
    a.role,
    COUNT(DISTINCT aca.conversation_id) FILTER (WHERE aca.unassigned_at IS NULL) as active_conversations,
    COUNT(DISTINCT ch.id) FILTER (WHERE ch.status = 'pending') as pending_handovers,
    COUNT(DISTINCT an.id) FILTER (WHERE an.read_at IS NULL) as unread_notifications,
    a.last_active_at,
    d.name as dealership_name
FROM agents a
LEFT JOIN dealerships d ON a.dealership_id = d.id
LEFT JOIN agent_conversation_assignments aca ON a.id = aca.agent_id AND aca.unassigned_at IS NULL
LEFT JOIN conversation_handovers ch ON a.id = ch.claimed_by AND ch.status = 'pending'
LEFT JOIN agent_notifications an ON a.id = an.agent_id AND an.read_at IS NULL AND an.dismissed_at IS NULL
WHERE a.active = true
GROUP BY a.id, a.display_name, a.status, a.role, a.last_active_at, d.name;