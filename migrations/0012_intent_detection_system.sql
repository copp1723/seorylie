-- Migration: 0012_intent_detection_system.sql
-- Description: Adds intent detection system tables and functions for ADF-07
-- Author: ADF Development Team
-- Date: 2025-05-29

-- Start transaction
BEGIN;

-- Enable error handling
DO $$
BEGIN
    -- Add version info to migrations table
    INSERT INTO migrations (name, applied_at)
    VALUES ('0012_intent_detection_system', NOW());
    
    -- =============================================
    -- 1. Add handoverTriggeredAt to conversations
    -- =============================================
    
    -- Check if column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'handover_triggered_at'
    ) THEN
        ALTER TABLE conversations 
        ADD COLUMN handover_triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        
        -- Add index for efficient querying
        CREATE INDEX idx_conversations_handover_triggered_at 
        ON conversations(handover_triggered_at);
        
        -- Add column for trigger type
        ALTER TABLE conversations
        ADD COLUMN handover_trigger_type VARCHAR(50) DEFAULT NULL;
        
        -- Add column for trigger details
        ALTER TABLE conversations
        ADD COLUMN handover_trigger_details JSONB DEFAULT NULL;
    END IF;
    
    -- =============================================
    -- 2. Create intent_detection_events table
    -- =============================================
    
    CREATE TABLE IF NOT EXISTS intent_detection_events (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        dealership_id INTEGER NOT NULL,
        customer_id INTEGER,
        trigger_type VARCHAR(50) NOT NULL, -- 'rule', 'ml', 'behavioural', 'sla'
        trigger_id VARCHAR(100) NOT NULL,  -- e.g. 'R-BUY-1', 'ML-FIN-1'
        trigger_confidence DECIMAL(5,4),   -- 0.0000 to 1.0000
        trigger_details JSONB,
        triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        processed BOOLEAN DEFAULT FALSE,
        processing_latency_ms INTEGER,
        handover_created BOOLEAN DEFAULT FALSE,
        handover_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_intent_conversation
            FOREIGN KEY(conversation_id)
            REFERENCES conversations(id)
            ON DELETE CASCADE,
        CONSTRAINT fk_intent_dealership
            FOREIGN KEY(dealership_id)
            REFERENCES dealerships(id)
            ON DELETE CASCADE
    );
    
    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_intent_events_conversation_id 
    ON intent_detection_events(conversation_id);
    
    CREATE INDEX IF NOT EXISTS idx_intent_events_dealership_id 
    ON intent_detection_events(dealership_id);
    
    CREATE INDEX IF NOT EXISTS idx_intent_events_trigger_type 
    ON intent_detection_events(trigger_type);
    
    CREATE INDEX IF NOT EXISTS idx_intent_events_triggered_at 
    ON intent_detection_events(triggered_at);
    
    CREATE INDEX IF NOT EXISTS idx_intent_events_processed 
    ON intent_detection_events(processed);
    
    -- =============================================
    -- 3. Create intent_detection_rules table
    -- =============================================
    
    CREATE TABLE IF NOT EXISTS intent_detection_rules (
        id SERIAL PRIMARY KEY,
        rule_id VARCHAR(100) NOT NULL UNIQUE, -- e.g. 'R-BUY-1'
        name VARCHAR(255) NOT NULL,
        description TEXT,
        rule_type VARCHAR(50) NOT NULL, -- 'phrase', 'regex', 'complex'
        rule_pattern TEXT NOT NULL,     -- phrase, regex pattern, or JSON config
        is_active BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 100,   -- lower number = higher priority
        category VARCHAR(100),          -- e.g. 'purchase', 'test-drive', 'financing'
        confidence_score DECIMAL(5,4) DEFAULT 1.0000,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
    );
    
    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_intent_rules_rule_id 
    ON intent_detection_rules(rule_id);
    
    CREATE INDEX IF NOT EXISTS idx_intent_rules_is_active 
    ON intent_detection_rules(is_active);
    
    CREATE INDEX IF NOT EXISTS idx_intent_rules_priority 
    ON intent_detection_rules(priority);
    
    CREATE INDEX IF NOT EXISTS idx_intent_rules_category 
    ON intent_detection_rules(category);
    
    -- =============================================
    -- 4. Create intent_detection_metrics table
    -- =============================================
    
    CREATE TABLE IF NOT EXISTS intent_detection_metrics (
        id SERIAL PRIMARY KEY,
        dealership_id INTEGER NOT NULL,
        metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
        metric_hour INTEGER NOT NULL DEFAULT EXTRACT(HOUR FROM NOW()),
        trigger_type VARCHAR(50) NOT NULL, -- 'rule', 'ml', 'behavioural', 'sla'
        trigger_id VARCHAR(100),           -- e.g. 'R-BUY-1', 'ML-FIN-1'
        total_triggers INTEGER DEFAULT 0,
        true_positives INTEGER DEFAULT 0,
        false_positives INTEGER DEFAULT 0,
        avg_latency_ms INTEGER DEFAULT 0,
        max_latency_ms INTEGER DEFAULT 0,
        min_latency_ms INTEGER DEFAULT 0,
        handover_conversion_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_metrics_dealership
            FOREIGN KEY(dealership_id)
            REFERENCES dealerships(id)
            ON DELETE CASCADE,
        CONSTRAINT uq_intent_metrics_hourly
            UNIQUE(dealership_id, metric_date, metric_hour, trigger_type, trigger_id)
    );
    
    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_intent_metrics_dealership_id 
    ON intent_detection_metrics(dealership_id);
    
    CREATE INDEX IF NOT EXISTS idx_intent_metrics_date 
    ON intent_detection_metrics(metric_date);
    
    CREATE INDEX IF NOT EXISTS idx_intent_metrics_trigger_type 
    ON intent_detection_metrics(trigger_type);
    
    -- =============================================
    -- 5. Create conversation_engagement_metrics table
    -- =============================================
    
    CREATE TABLE IF NOT EXISTS conversation_engagement_metrics (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        dealership_id INTEGER NOT NULL,
        customer_id INTEGER,
        message_count INTEGER DEFAULT 0,
        customer_message_count INTEGER DEFAULT 0,
        agent_message_count INTEGER DEFAULT 0,
        avg_customer_response_time_seconds INTEGER,
        avg_message_length INTEGER,
        engagement_score DECIMAL(5,4),  -- 0.0000 to 1.0000
        engagement_level VARCHAR(50),   -- 'low', 'medium', 'high'
        first_response_time_seconds INTEGER,
        last_customer_message_at TIMESTAMP WITH TIME ZONE,
        conversation_duration_seconds INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_engagement_conversation
            FOREIGN KEY(conversation_id)
            REFERENCES conversations(id)
            ON DELETE CASCADE,
        CONSTRAINT fk_engagement_dealership
            FOREIGN KEY(dealership_id)
            REFERENCES dealerships(id)
            ON DELETE CASCADE,
        CONSTRAINT uq_conversation_engagement
            UNIQUE(conversation_id)
    );
    
    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_engagement_conversation_id 
    ON conversation_engagement_metrics(conversation_id);
    
    CREATE INDEX IF NOT EXISTS idx_engagement_dealership_id 
    ON conversation_engagement_metrics(dealership_id);
    
    CREATE INDEX IF NOT EXISTS idx_engagement_score 
    ON conversation_engagement_metrics(engagement_score);
    
    CREATE INDEX IF NOT EXISTS idx_engagement_level 
    ON conversation_engagement_metrics(engagement_level);
    
    CREATE INDEX IF NOT EXISTS idx_last_customer_message 
    ON conversation_engagement_metrics(last_customer_message_at);
    
    -- =============================================
    -- 6. Create helper functions
    -- =============================================
    
    -- Function to check if a conversation has any intent triggers
    CREATE OR REPLACE FUNCTION has_intent_triggers(p_conversation_id INTEGER)
    RETURNS BOOLEAN AS $$
    DECLARE
        has_triggers BOOLEAN;
    BEGIN
        SELECT EXISTS(
            SELECT 1 FROM intent_detection_events
            WHERE conversation_id = p_conversation_id
        ) INTO has_triggers;
        
        RETURN has_triggers;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Function to get the latest intent trigger for a conversation
    CREATE OR REPLACE FUNCTION get_latest_intent_trigger(p_conversation_id INTEGER)
    RETURNS TABLE(
        id INTEGER,
        trigger_type VARCHAR(50),
        trigger_id VARCHAR(100),
        confidence DECIMAL(5,4),
        triggered_at TIMESTAMP WITH TIME ZONE
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            e.id,
            e.trigger_type,
            e.trigger_id,
            e.trigger_confidence,
            e.triggered_at
        FROM intent_detection_events e
        WHERE e.conversation_id = p_conversation_id
        ORDER BY e.triggered_at DESC
        LIMIT 1;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Function to record an intent trigger event
    CREATE OR REPLACE FUNCTION record_intent_trigger(
        p_conversation_id INTEGER,
        p_dealership_id INTEGER,
        p_trigger_type VARCHAR(50),
        p_trigger_id VARCHAR(100),
        p_trigger_confidence DECIMAL(5,4),
        p_trigger_details JSONB,
        p_processing_latency_ms INTEGER
    )
    RETURNS INTEGER AS $$
    DECLARE
        new_event_id INTEGER;
    BEGIN
        INSERT INTO intent_detection_events(
            conversation_id,
            dealership_id,
            trigger_type,
            trigger_id,
            trigger_confidence,
            trigger_details,
            processing_latency_ms
        )
        VALUES(
            p_conversation_id,
            p_dealership_id,
            p_trigger_type,
            p_trigger_id,
            p_trigger_confidence,
            p_trigger_details,
            p_processing_latency_ms
        )
        RETURNING id INTO new_event_id;
        
        -- Update conversation table
        UPDATE conversations
        SET 
            handover_triggered_at = NOW(),
            handover_trigger_type = p_trigger_type,
            handover_trigger_details = p_trigger_details,
            updated_at = NOW()
        WHERE id = p_conversation_id;
        
        -- Update metrics
        PERFORM update_intent_metrics(
            p_dealership_id,
            p_trigger_type,
            p_trigger_id,
            p_processing_latency_ms
        );
        
        RETURN new_event_id;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Function to update intent metrics
    CREATE OR REPLACE FUNCTION update_intent_metrics(
        p_dealership_id INTEGER,
        p_trigger_type VARCHAR(50),
        p_trigger_id VARCHAR(100),
        p_latency_ms INTEGER
    )
    RETURNS VOID AS $$
    DECLARE
        current_date DATE := CURRENT_DATE;
        current_hour INTEGER := EXTRACT(HOUR FROM NOW());
    BEGIN
        -- Insert or update metrics
        INSERT INTO intent_detection_metrics(
            dealership_id,
            metric_date,
            metric_hour,
            trigger_type,
            trigger_id,
            total_triggers,
            avg_latency_ms,
            max_latency_ms,
            min_latency_ms,
            updated_at
        )
        VALUES(
            p_dealership_id,
            current_date,
            current_hour,
            p_trigger_type,
            p_trigger_id,
            1, -- total_triggers
            p_latency_ms, -- avg_latency_ms
            p_latency_ms, -- max_latency_ms
            p_latency_ms, -- min_latency_ms
            NOW()
        )
        ON CONFLICT (dealership_id, metric_date, metric_hour, trigger_type, trigger_id)
        DO UPDATE SET
            total_triggers = intent_detection_metrics.total_triggers + 1,
            avg_latency_ms = (intent_detection_metrics.avg_latency_ms * intent_detection_metrics.total_triggers + p_latency_ms) / (intent_detection_metrics.total_triggers + 1),
            max_latency_ms = GREATEST(intent_detection_metrics.max_latency_ms, p_latency_ms),
            min_latency_ms = LEAST(intent_detection_metrics.min_latency_ms, p_latency_ms),
            updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql;
    
    -- Function to update engagement metrics
    CREATE OR REPLACE FUNCTION update_engagement_metrics(
        p_conversation_id INTEGER,
        p_dealership_id INTEGER
    )
    RETURNS VOID AS $$
    DECLARE
        v_customer_id INTEGER;
        v_message_count INTEGER;
        v_customer_message_count INTEGER;
        v_agent_message_count INTEGER;
        v_first_message_time TIMESTAMP WITH TIME ZONE;
        v_last_message_time TIMESTAMP WITH TIME ZONE;
        v_last_customer_message_time TIMESTAMP WITH TIME ZONE;
        v_avg_message_length INTEGER;
        v_avg_response_time INTEGER;
        v_engagement_score DECIMAL(5,4);
        v_engagement_level VARCHAR(50);
    BEGIN
        -- Get conversation metrics
        SELECT 
            c.customer_id,
            COUNT(m.id),
            COUNT(m.id) FILTER (WHERE m.is_from_customer = TRUE),
            COUNT(m.id) FILTER (WHERE m.is_from_customer = FALSE),
            MIN(m.created_at),
            MAX(m.created_at),
            MAX(m.created_at) FILTER (WHERE m.is_from_customer = TRUE),
            AVG(LENGTH(m.content))::INTEGER
        INTO
            v_customer_id,
            v_message_count,
            v_customer_message_count,
            v_agent_message_count,
            v_first_message_time,
            v_last_message_time,
            v_last_customer_message_time,
            v_avg_message_length
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.id = p_conversation_id
        GROUP BY c.id, c.customer_id;
        
        -- Calculate response time (simplified)
        SELECT 
            EXTRACT(EPOCH FROM AVG(m2.created_at - m1.created_at))::INTEGER
        INTO v_avg_response_time
        FROM messages m1
        JOIN messages m2 ON m1.conversation_id = m2.conversation_id
            AND m1.is_from_customer != m2.is_from_customer
            AND m2.created_at > m1.created_at
        WHERE m1.conversation_id = p_conversation_id
        AND NOT EXISTS (
            SELECT 1 FROM messages m3
            WHERE m3.conversation_id = m1.conversation_id
            AND m3.created_at > m1.created_at
            AND m3.created_at < m2.created_at
        );
        
        -- Calculate engagement score (simplified algorithm)
        -- Score based on message count, response time, and message length
        v_engagement_score := LEAST(1.0, GREATEST(0.0, 
            (0.4 * LEAST(1.0, v_customer_message_count::DECIMAL / 5)) + -- 40% weight for message count
            (0.3 * LEAST(1.0, CASE WHEN v_avg_response_time IS NULL OR v_avg_response_time = 0 THEN 0 
                ELSE 1 - LEAST(1.0, v_avg_response_time::DECIMAL / 3600) END)) + -- 30% weight for response time
            (0.3 * LEAST(1.0, v_avg_message_length::DECIMAL / 100)) -- 30% weight for message length
        ));
        
        -- Determine engagement level
        v_engagement_level := CASE
            WHEN v_engagement_score >= 0.7 THEN 'high'
            WHEN v_engagement_score >= 0.4 THEN 'medium'
            ELSE 'low'
        END;
        
        -- Insert or update engagement metrics
        INSERT INTO conversation_engagement_metrics(
            conversation_id,
            dealership_id,
            customer_id,
            message_count,
            customer_message_count,
            agent_message_count,
            avg_customer_response_time_seconds,
            avg_message_length,
            engagement_score,
            engagement_level,
            first_response_time_seconds,
            last_customer_message_at,
            conversation_duration_seconds,
            updated_at
        )
        VALUES(
            p_conversation_id,
            p_dealership_id,
            v_customer_id,
            v_message_count,
            v_customer_message_count,
            v_agent_message_count,
            v_avg_response_time,
            v_avg_message_length,
            v_engagement_score,
            v_engagement_level,
            CASE WHEN v_first_message_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (v_first_message_time - 
                    (SELECT created_at FROM conversations WHERE id = p_conversation_id)))::INTEGER
                ELSE NULL
            END,
            v_last_customer_message_time,
            CASE WHEN v_first_message_time IS NOT NULL AND v_last_message_time IS NOT NULL THEN
                EXTRACT(EPOCH FROM (v_last_message_time - v_first_message_time))::INTEGER
                ELSE NULL
            END,
            NOW()
        )
        ON CONFLICT (conversation_id)
        DO UPDATE SET
            message_count = EXCLUDED.message_count,
            customer_message_count = EXCLUDED.customer_message_count,
            agent_message_count = EXCLUDED.agent_message_count,
            avg_customer_response_time_seconds = EXCLUDED.avg_customer_response_time_seconds,
            avg_message_length = EXCLUDED.avg_message_length,
            engagement_score = EXCLUDED.engagement_score,
            engagement_level = EXCLUDED.engagement_level,
            first_response_time_seconds = EXCLUDED.first_response_time_seconds,
            last_customer_message_at = EXCLUDED.last_customer_message_at,
            conversation_duration_seconds = EXCLUDED.conversation_duration_seconds,
            updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql;
    
    -- =============================================
    -- 7. Insert default intent rules
    -- =============================================
    
    -- Insert default rules if they don't exist
    INSERT INTO intent_detection_rules (
        rule_id, name, description, rule_type, rule_pattern, 
        is_active, priority, category, confidence_score
    )
    VALUES
    -- Purchase intent rules
    ('R-BUY-1', 'Ready to Buy', 'Customer explicitly states they are ready to purchase', 
     'phrase', 'ready to buy|want to buy|purchase|buy it|buy this|buy the|buy that|buying|purchase', 
     TRUE, 10, 'purchase', 1.0),
     
    ('R-TEST-1', 'Test Drive Request', 'Customer asks for a test drive', 
     'phrase', 'test drive|test-drive|testdrive|drive it|drive this|drive the|drive that', 
     TRUE, 20, 'test-drive', 0.9),
     
    ('R-FIN-1', 'Financing Inquiry', 'Customer asks about financing options', 
     'phrase', 'finance|financing|loan|credit|apr|interest rate|monthly payment|down payment', 
     TRUE, 30, 'financing', 0.8),
     
    ('R-PRICE-1', 'Price Negotiation', 'Customer negotiates on price', 
     'phrase', 'best price|lowest price|discount|deal|offer|negotiate|negotiation|haggle', 
     TRUE, 40, 'pricing', 0.7),
     
    ('R-AVAIL-1', 'Availability Check', 'Customer checks if vehicle is still available', 
     'phrase', 'available|availability|in stock|on the lot|still have|still there', 
     TRUE, 50, 'availability', 0.6),
     
    ('R-TRADE-1', 'Trade-in Inquiry', 'Customer asks about trade-in options', 
     'phrase', 'trade in|trade-in|tradein|trade my|trade value|value of my', 
     TRUE, 60, 'trade-in', 0.7)
    ON CONFLICT (rule_id) DO NOTHING;
    
    RAISE NOTICE 'Intent detection system migration completed successfully';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Migration failed: %', SQLERRM;
        ROLLBACK;
END $$;

COMMIT;

-- Rollback SQL (to be used in 0012_intent_detection_system_rollback.sql)
/*
BEGIN;

-- Drop helper functions
DROP FUNCTION IF EXISTS update_engagement_metrics(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS update_intent_metrics(INTEGER, VARCHAR, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS record_intent_trigger(INTEGER, INTEGER, VARCHAR, VARCHAR, DECIMAL, JSONB, INTEGER);
DROP FUNCTION IF EXISTS get_latest_intent_trigger(INTEGER);
DROP FUNCTION IF EXISTS has_intent_triggers(INTEGER);

-- Drop tables
DROP TABLE IF EXISTS conversation_engagement_metrics;
DROP TABLE IF EXISTS intent_detection_metrics;
DROP TABLE IF EXISTS intent_detection_events;
DROP TABLE IF EXISTS intent_detection_rules;

-- Remove columns from conversations table
ALTER TABLE conversations DROP COLUMN IF EXISTS handover_trigger_details;
ALTER TABLE conversations DROP COLUMN IF EXISTS handover_trigger_type;
ALTER TABLE conversations DROP COLUMN IF EXISTS handover_triggered_at;

-- Remove version info from migrations table
DELETE FROM migrations WHERE name = '0012_intent_detection_system';

COMMIT;
*/
