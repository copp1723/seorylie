-- Migration: 0014_adf_conversation_integration.sql
-- Enhances the conversation system to integrate with ADF leads and SMS responses
-- Adds necessary columns, indexes, views, and triggers for the customer conversation dashboard

-- Notify about migration start
DO $$
BEGIN
    RAISE NOTICE 'Starting ADF conversation integration migration (0014)';
END $$;

-- Add columns to conversations table to link with ADF leads and store metrics
ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS adf_lead_id INTEGER REFERENCES adf_leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_response_rate FLOAT,
ADD COLUMN IF NOT EXISTS average_response_time FLOAT,
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add columns to conversation_messages table for enhanced metadata
ALTER TABLE IF EXISTS conversation_messages
ADD COLUMN IF NOT EXISTS adf_sms_response_id INTEGER REFERENCES adf_sms_responses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS ai_confidence FLOAT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create conversation_events table for tracking status changes and important events
CREATE TABLE IF NOT EXISTS conversation_events (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_adf_lead_id ON conversations(adf_lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_adf_sms_response_id ON conversation_messages(adf_sms_response_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_delivery_status ON conversation_messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_activity_at ON conversations(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_conversations_search_vector ON conversations USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation_id ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_event_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversation_events_created_at ON conversation_events(created_at);

-- Create view for dealership conversation summary
CREATE OR REPLACE VIEW dealership_conversation_summary AS
SELECT 
    c.id,
    c.dealership_id,
    c.subject,
    c.status,
    c.channel,
    c.source,
    c.adf_lead_id,
    c.created_at,
    c.last_activity_at,
    c.message_count,
    c.customer_response_rate,
    c.average_response_time,
    COALESCE(cust.first_name || ' ' || cust.last_name, 'Unknown Customer') AS customer_name,
    (SELECT content FROM conversation_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
    (SELECT created_at FROM conversation_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
    (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id AND role = 'customer') AS customer_message_count,
    (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id AND role IN ('ai', 'agent')) AS agent_message_count
FROM 
    conversations c
LEFT JOIN 
    customers cust ON c.customer_id = cust.id;

-- Create view for customer conversation history
CREATE OR REPLACE VIEW customer_conversation_history AS
SELECT 
    cm.id,
    cm.conversation_id,
    c.dealership_id,
    cm.content,
    cm.role,
    cm.created_at,
    cm.delivery_status,
    cm.ai_confidence,
    cm.metadata,
    cm.adf_sms_response_id,
    c.adf_lead_id,
    c.customer_id
FROM 
    conversation_messages cm
JOIN 
    conversations c ON cm.conversation_id = c.id;

-- Create view for ADF conversation metrics
CREATE OR REPLACE VIEW adf_conversation_metrics AS
SELECT 
    c.dealership_id,
    DATE_TRUNC('day', c.created_at) AS date,
    COUNT(DISTINCT c.id) AS conversation_count,
    COUNT(DISTINCT c.customer_id) AS unique_customers,
    COUNT(DISTINCT c.adf_lead_id) AS adf_lead_count,
    AVG(c.message_count) AS avg_message_count,
    AVG(c.customer_response_rate) AS avg_response_rate,
    AVG(c.average_response_time) AS avg_response_time_seconds,
    SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) AS completed_conversations,
    SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) AS active_conversations,
    SUM(CASE WHEN c.status = 'handover' THEN 1 ELSE 0 END) AS handover_conversations
FROM 
    conversations c
WHERE 
    c.adf_lead_id IS NOT NULL
GROUP BY 
    c.dealership_id, DATE_TRUNC('day', c.created_at);

-- Create function to sync ADF SMS responses to conversation messages
CREATE OR REPLACE FUNCTION sync_adf_message_to_conversation() RETURNS TRIGGER AS $$
DECLARE
    conv_id INTEGER;
BEGIN
    -- Find or create conversation for this lead
    SELECT id INTO conv_id FROM conversations WHERE adf_lead_id = NEW.adf_lead_id LIMIT 1;
    
    IF conv_id IS NULL THEN
        -- Create new conversation if none exists
        INSERT INTO conversations (
            dealership_id, 
            customer_id,
            adf_lead_id, 
            subject, 
            channel, 
            status, 
            source,
            created_at,
            updated_at,
            last_activity_at
        ) 
        SELECT 
            NEW.dealership_id,
            l.customer_id,
            NEW.adf_lead_id,
            COALESCE(l.vehicle_of_interest, 'New Lead'),
            'sms',
            'active',
            'adf',
            NOW(),
            NOW(),
            NOW()
        FROM adf_leads l
        WHERE l.id = NEW.adf_lead_id
        RETURNING id INTO conv_id;
    END IF;
    
    -- Add message to conversation
    INSERT INTO conversation_messages (
        conversation_id,
        content,
        role,
        adf_sms_response_id,
        delivery_status,
        metadata,
        created_at
    ) VALUES (
        conv_id,
        NEW.message,
        CASE WHEN NEW.direction = 'outbound' THEN 'ai' ELSE 'customer' END,
        NEW.id,
        NEW.status,
        jsonb_build_object(
            'twilio_sid', NEW.twilio_sid,
            'phone_number', NEW.phone_number,
            'direction', NEW.direction
        ),
        NEW.created_at
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync ADF SMS responses to conversation messages
DROP TRIGGER IF EXISTS adf_message_conversation_trigger ON adf_sms_responses;
CREATE TRIGGER adf_message_conversation_trigger
AFTER INSERT ON adf_sms_responses
FOR EACH ROW
EXECUTE FUNCTION sync_adf_message_to_conversation();

-- Create function to update conversation last activity timestamp
CREATE OR REPLACE FUNCTION update_conversation_last_activity() RETURNS TRIGGER AS $$
BEGIN
    -- Update conversation last activity timestamp and message count
    UPDATE conversations
    SET 
        last_activity_at = NEW.created_at,
        message_count = (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = NEW.conversation_id),
        customer_response_rate = (
            SELECT 
                CASE 
                    WHEN COUNT(*) FILTER (WHERE role = 'customer') > 0 THEN
                        COUNT(*) FILTER (WHERE role IN ('ai', 'agent'))::float / NULLIF(COUNT(*) FILTER (WHERE role = 'customer'), 0)
                    ELSE NULL
                END
            FROM conversation_messages 
            WHERE conversation_id = NEW.conversation_id
        ),
        average_response_time = (
            SELECT 
                AVG(EXTRACT(EPOCH FROM (
                    SELECT MIN(cm2.created_at) 
                    FROM conversation_messages cm2 
                    WHERE cm2.conversation_id = cm.conversation_id 
                      AND cm2.role IN ('ai', 'agent') 
                      AND cm2.created_at > cm.created_at
                )) - EXTRACT(EPOCH FROM cm.created_at))
            FROM conversation_messages cm
            WHERE cm.conversation_id = NEW.conversation_id
              AND cm.role = 'customer'
        )
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update conversation last activity timestamp
DROP TRIGGER IF EXISTS update_conversation_last_activity ON conversation_messages;
CREATE TRIGGER update_conversation_last_activity
AFTER INSERT ON conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_activity();

-- Create function to update conversation status based on events
CREATE OR REPLACE FUNCTION update_conversation_status() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type IN ('status_change', 'handover', 'completed', 'reopened') THEN
        UPDATE conversations
        SET 
            status = CASE 
                WHEN NEW.event_type = 'handover' THEN 'handover'
                WHEN NEW.event_type = 'completed' THEN 'completed'
                WHEN NEW.event_type = 'reopened' THEN 'active'
                ELSE COALESCE(NEW.metadata->>'status', status)
            END,
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update conversation status based on events
DROP TRIGGER IF EXISTS update_conversation_status_trigger ON conversation_events;
CREATE TRIGGER update_conversation_status_trigger
AFTER INSERT ON conversation_events
FOR EACH ROW
EXECUTE FUNCTION update_conversation_status();

-- Create RLS policies for multi-tenant isolation
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_events_isolation_policy ON conversation_events
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
        AND c.dealership_id = current_setting('app.current_dealership_id', true)::integer
    )
);

CREATE POLICY conversation_view_policy ON dealership_conversation_summary
USING (dealership_id = current_setting('app.current_dealership_id', true)::integer);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_messages_isolation_policy ON conversation_messages
USING (
    EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
        AND c.dealership_id = current_setting('app.current_dealership_id', true)::integer
    )
);

-- Notify about migration completion
DO $$
BEGIN
    RAISE NOTICE 'ADF conversation integration migration (0014) completed successfully';
END $$;
