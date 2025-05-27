-- Migration: JWT tokens tracking and lead source prompt templates
-- This adds JWT token management and dynamic prompt template system

-- JWT tokens table for tracking and revocation
CREATE TABLE IF NOT EXISTS jwt_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID
    user_id VARCHAR(255) NOT NULL, -- User/Agent ID
    dealership_id INTEGER REFERENCES dealerships(id) ON DELETE CASCADE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    user_agent TEXT,
    ip_address VARCHAR(45),
    
    INDEX idx_jwt_tokens_jti (jti),
    INDEX idx_jwt_tokens_user (user_id, active),
    INDEX idx_jwt_tokens_expires (expires_at),
    INDEX idx_jwt_tokens_dealership (dealership_id, active)
);

-- Create ENUM types for prompt templates
CREATE TYPE prompt_template_type AS ENUM ('greeting', 'qualification', 'followup', 'closing', 'objection_handling', 'appointment_booking');
CREATE TYPE template_variable_type AS ENUM ('text', 'number', 'date', 'boolean', 'select', 'multiselect');
CREATE TYPE prompt_tone AS ENUM ('professional', 'friendly', 'casual', 'formal', 'urgent', 'empathetic');

-- Lead source prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    lead_source VARCHAR(100), -- website, facebook, phone, email, etc. NULL = applies to all
    template_type prompt_template_type NOT NULL,
    prompt_content TEXT NOT NULL,
    tone prompt_tone DEFAULT 'professional',
    language VARCHAR(10) DEFAULT 'en',
    variables JSONB, -- Array of variable definitions
    conditions JSONB, -- JSON conditions for when to use this template
    priority INTEGER DEFAULT 1, -- Higher priority templates are preferred
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Default template for this type/source
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2), -- Percentage of successful conversations using this template
    created_by VARCHAR(255), -- User ID who created the template
    approved_by VARCHAR(255), -- User ID who approved the template
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for efficient template selection
    INDEX idx_prompt_templates_dealership (dealership_id, is_active),
    INDEX idx_prompt_templates_source (lead_source, template_type, is_active),
    INDEX idx_prompt_templates_type (template_type, priority, is_active),
    INDEX idx_prompt_templates_default (dealership_id, template_type, is_default),
    
    -- Ensure only one default template per type per source per dealership
    UNIQUE(dealership_id, template_type, lead_source, is_default) WHERE is_default = true
);

-- Template variables definition
CREATE TABLE IF NOT EXISTS template_variables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    variable_name VARCHAR(100) NOT NULL,
    variable_type template_variable_type NOT NULL,
    description TEXT,
    default_value TEXT,
    required BOOLEAN DEFAULT false,
    validation_rules JSONB, -- JSON schema for validation
    options JSONB, -- For select/multiselect types
    display_order INTEGER DEFAULT 0,
    
    -- Ensure unique variable names per template
    UNIQUE(template_id, variable_name),
    INDEX idx_template_variables_template (template_id, display_order)
);

-- Template usage analytics
CREATE TABLE IF NOT EXISTS template_usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL, -- References conversations table
    customer_id INTEGER NOT NULL, -- References customers table
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    lead_source VARCHAR(100),
    rendered_prompt TEXT, -- The actual prompt sent (with variables filled)
    variables_used JSONB, -- The variable values used
    response_received BOOLEAN DEFAULT false,
    response_time_minutes INTEGER,
    conversation_successful BOOLEAN, -- Did this lead to a positive outcome?
    customer_satisfaction_score INTEGER, -- 1-5 scale if available
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_template_analytics_template (template_id, used_at),
    INDEX idx_template_analytics_conversation (conversation_id),
    INDEX idx_template_analytics_success (conversation_successful, template_id)
);

-- Template A/B testing
CREATE TABLE IF NOT EXISTS template_ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
    test_name VARCHAR(200) NOT NULL,
    description TEXT,
    template_a_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    template_b_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    traffic_split_percentage INTEGER DEFAULT 50, -- Percentage going to template A
    lead_source VARCHAR(100), -- Limit test to specific lead source
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    min_sample_size INTEGER DEFAULT 100,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_template_ab_tests_dealership (dealership_id, is_active),
    INDEX idx_template_ab_tests_dates (start_date, end_date, is_active)
);

-- Template performance metrics (daily aggregates)
CREATE TABLE IF NOT EXISTS template_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    successful_conversations INTEGER DEFAULT 0,
    avg_response_time_minutes DECIMAL(10,2),
    avg_customer_satisfaction DECIMAL(3,2),
    conversion_rate DECIMAL(5,2), -- Percentage of successful conversations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One record per template per day
    UNIQUE(template_id, date_recorded),
    INDEX idx_template_performance_date (date_recorded, template_id)
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prompt_templates_updated_at 
    BEFORE UPDATE ON prompt_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_prompt_templates_updated_at();

-- Function to update template usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE prompt_templates 
    SET usage_count = usage_count + 1
    WHERE id = NEW.template_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_template_usage_trigger
    AFTER INSERT ON template_usage_analytics
    FOR EACH ROW
    EXECUTE FUNCTION increment_template_usage();

-- Insert default prompt templates for existing dealerships
INSERT INTO prompt_templates (
    dealership_id, name, description, lead_source, template_type, 
    prompt_content, tone, variables, is_default, created_by
)
SELECT 
    id,
    'Website Lead Greeting',
    'Default greeting for website leads',
    'website',
    'greeting',
    'Hello {{customer_name}}! Thank you for your interest in {{vehicle_make}} {{vehicle_model}}. I''m {{agent_name}} from {{dealership_name}}. How can I help you find the perfect vehicle today?',
    'friendly',
    '[
        {"name": "customer_name", "type": "text", "required": true, "description": "Customer''s name"},
        {"name": "vehicle_make", "type": "text", "required": false, "description": "Vehicle make"},
        {"name": "vehicle_model", "type": "text", "required": false, "description": "Vehicle model"},
        {"name": "agent_name", "type": "text", "required": true, "description": "Agent''s name"},
        {"name": "dealership_name", "type": "text", "required": true, "description": "Dealership name"}
    ]'::jsonb,
    true,
    'system'
FROM dealerships
WHERE NOT EXISTS (
    SELECT 1 FROM prompt_templates pt 
    WHERE pt.dealership_id = dealerships.id 
    AND pt.template_type = 'greeting' 
    AND pt.lead_source = 'website'
);

-- Insert Facebook lead template
INSERT INTO prompt_templates (
    dealership_id, name, description, lead_source, template_type, 
    prompt_content, tone, variables, is_default, created_by
)
SELECT 
    id,
    'Facebook Lead Greeting',
    'Default greeting for Facebook leads',
    'facebook',
    'greeting',
    'Hi {{customer_name}}! I saw you''re interested in our {{vehicle_make}} {{vehicle_model}} from our Facebook post. I''m {{agent_name}} from {{dealership_name}}. We have some great deals available - would you like to know more?',
    'casual',
    '[
        {"name": "customer_name", "type": "text", "required": true, "description": "Customer''s name"},
        {"name": "vehicle_make", "type": "text", "required": false, "description": "Vehicle make"},
        {"name": "vehicle_model", "type": "text", "required": false, "description": "Vehicle model"},
        {"name": "agent_name", "type": "text", "required": true, "description": "Agent''s name"},
        {"name": "dealership_name", "type": "text", "required": true, "description": "Dealership name"}
    ]'::jsonb,
    true,
    'system'
FROM dealerships
WHERE NOT EXISTS (
    SELECT 1 FROM prompt_templates pt 
    WHERE pt.dealership_id = dealerships.id 
    AND pt.template_type = 'greeting' 
    AND pt.lead_source = 'facebook'
);

-- Create view for template performance summary
CREATE OR REPLACE VIEW template_performance_summary AS
SELECT 
    pt.id,
    pt.name,
    pt.lead_source,
    pt.template_type,
    pt.tone,
    pt.usage_count,
    pt.success_rate,
    COALESCE(AVG(tpm.conversion_rate), 0) as avg_conversion_rate,
    COALESCE(AVG(tpm.avg_customer_satisfaction), 0) as avg_satisfaction,
    COUNT(tua.id) as recent_usage_count,
    d.name as dealership_name
FROM prompt_templates pt
LEFT JOIN dealerships d ON pt.dealership_id = d.id
LEFT JOIN template_performance_metrics tpm ON pt.id = tpm.template_id AND tpm.date_recorded >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN template_usage_analytics tua ON pt.id = tua.template_id AND tua.used_at >= CURRENT_DATE - INTERVAL '7 days'
WHERE pt.is_active = true
GROUP BY pt.id, pt.name, pt.lead_source, pt.template_type, pt.tone, pt.usage_count, pt.success_rate, d.name;