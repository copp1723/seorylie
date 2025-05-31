
-- Quick setup for dual-mode chat system
-- Run this in your PostgreSQL database

-- 1. Add operation mode to dealerships
ALTER TABLE dealerships 
ADD COLUMN IF NOT EXISTS operation_mode VARCHAR(50) DEFAULT 'rylie_ai',
ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS agent_config JSONB DEFAULT '{}';

-- 2. Create leads table (simplified version)
CREATE TABLE IF NOT EXISTS leads (
    id BIGINT PRIMARY KEY DEFAULT (extract(epoch from now()) * 1000 + (random() * 1000)::int),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
    conversation_id INTEGER REFERENCES conversations(id),
    source VARCHAR(255) NOT NULL DEFAULT 'chat',
    status VARCHAR(50) DEFAULT 'new',
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(100),
    lead_score INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create message templates
CREATE TABLE IF NOT EXISTS message_templates (
    id VARCHAR(255) PRIMARY KEY DEFAULT ('tpl_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 8)),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    channel VARCHAR(50) DEFAULT 'both',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create agent queue  
CREATE TABLE IF NOT EXISTS agent_queue (
    id BIGSERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
    priority VARCHAR(50) DEFAULT 'normal',
    queued_at TIMESTAMP DEFAULT NOW(),
    assigned_to INTEGER REFERENCES users(id)
);

-- 5. Add essential indexes
CREATE INDEX IF NOT EXISTS idx_leads_dealership_status ON leads(dealership_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_queue_dealership ON agent_queue(dealership_id, queued_at);
CREATE INDEX IF NOT EXISTS idx_dealerships_mode ON dealerships(operation_mode);

-- 6. Insert default data for existing dealerships
UPDATE dealerships 
SET operation_mode = 'direct_agent',
    agent_config = '{
      "enabledChannels": ["chat", "email"],
      "autoAssignment": false,
      "workingHours": {
        "timezone": "America/New_York",
        "schedule": {
          "monday": {"start": "09:00", "end": "17:00", "enabled": true},
          "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
          "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
          "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
          "friday": {"start": "09:00", "end": "17:00", "enabled": true},
          "saturday": {"start": "10:00", "end": "16:00", "enabled": false},
          "sunday": {"start": "12:00", "end": "16:00", "enabled": false}
        }
      },
      "templates": {
        "greeting": "Thank you for your message. An agent will be with you shortly.",
        "away": "Our team is currently offline. We will respond during business hours.",
        "queue": "You are in the queue. We will be with you soon!"
      }
    }'::jsonb
WHERE operation_mode IS NULL;

-- 7. Create a test conversation if none exists
INSERT INTO conversations (dealership_id, customer_name, customer_email, status, source, created_at, updated_at)
SELECT 
    1, 
    'Test Customer', 
    'test@example.com', 
    'active', 
    'chat_demo',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM conversations WHERE dealership_id = 1)
ON CONFLICT DO NOTHING;

SELECT 'Database setup completed! ✅' as status;
