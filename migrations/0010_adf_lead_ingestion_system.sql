-- Migration: 0010_adf_lead_ingestion_system.sql
-- Description: Create ADF (Auto Data Format) lead ingestion system tables
-- Author: Josh Copp
-- Date: 2025-01-20

BEGIN;

-- Create ADF processing status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adf_processing_status') THEN
        CREATE TYPE adf_processing_status AS ENUM (
            'pending',
            'processing', 
            'processed',
            'failed',
            'retrying'
        );
    END IF;
END$$;

-- Create ADF lead status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adf_lead_status') THEN
        CREATE TYPE adf_lead_status AS ENUM (
            'new',
            'contacted',
            'qualified',
            'converted',
            'lost',
            'archived'
        );
    END IF;
END$$;

-- Main ADF Leads table
CREATE TABLE IF NOT EXISTS adf_leads (
    id SERIAL PRIMARY KEY,
    
    -- ADF Header Information
    adf_version VARCHAR(10) NOT NULL DEFAULT '1.0',
    request_date TIMESTAMP NOT NULL,
    
    -- Customer Information
    customer_full_name VARCHAR(255) NOT NULL,
    customer_first_name VARCHAR(100),
    customer_last_name VARCHAR(100),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_address TEXT,
    customer_city VARCHAR(100),
    customer_state VARCHAR(50),
    customer_zip VARCHAR(20),
    customer_country VARCHAR(50) DEFAULT 'US',
    
    -- Vehicle Information
    vehicle_year INTEGER,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_trim VARCHAR(100),
    vehicle_vin VARCHAR(17),
    vehicle_stock VARCHAR(50),
    vehicle_condition VARCHAR(50),
    vehicle_price INTEGER, -- Stored in cents
    vehicle_mileage INTEGER,
    
    -- Vendor Information
    vendor_name VARCHAR(255),
    vendor_email VARCHAR(255),
    vendor_phone VARCHAR(50),
    vendor_address TEXT,
    vendor_city VARCHAR(100),
    vendor_state VARCHAR(50),
    vendor_zip VARCHAR(20),
    
    -- Provider Information
    provider_name VARCHAR(255),
    provider_email VARCHAR(255),
    provider_phone VARCHAR(50),
    provider_service VARCHAR(100),
    
    -- Trade-in Information
    trade_in_year INTEGER,
    trade_in_make VARCHAR(100),
    trade_in_model VARCHAR(100),
    trade_in_trim VARCHAR(100),
    trade_in_vin VARCHAR(17),
    trade_in_mileage INTEGER,
    trade_in_condition VARCHAR(50),
    trade_in_value INTEGER, -- Stored in cents
    
    -- Additional Information
    comments TEXT,
    time_frame VARCHAR(100),
    
    -- Source Email Information
    source_email_id VARCHAR(255),
    source_email_subject VARCHAR(500),
    source_email_from VARCHAR(255),
    source_email_date TIMESTAMP,
    
    -- Processing Information
    dealership_id INTEGER, -- Foreign key to dealerships table (added later)
    lead_status VARCHAR(50) NOT NULL DEFAULT 'new',
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    deduplication_hash VARCHAR(64) NOT NULL,
    
    -- Raw Data Storage
    raw_adf_xml TEXT NOT NULL,
    parsed_adf_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_adf_leads_deduplication ON adf_leads(deduplication_hash);
CREATE INDEX IF NOT EXISTS idx_adf_leads_customer_email ON adf_leads(customer_email);
CREATE INDEX IF NOT EXISTS idx_adf_leads_customer_phone ON adf_leads(customer_phone);
CREATE INDEX IF NOT EXISTS idx_adf_leads_vendor_name ON adf_leads(vendor_name);
CREATE INDEX IF NOT EXISTS idx_adf_leads_request_date ON adf_leads(request_date);
CREATE INDEX IF NOT EXISTS idx_adf_leads_lead_status ON adf_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_adf_leads_processing_status ON adf_leads(processing_status);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_adf_leads_unique_deduplication ON adf_leads(deduplication_hash);

-- ADF Email Queue table for processing pipeline
CREATE TABLE IF NOT EXISTS adf_email_queue (
    id SERIAL PRIMARY KEY,
    
    -- Email Metadata
    email_message_id VARCHAR(255) NOT NULL,
    email_subject VARCHAR(500),
    email_from VARCHAR(255) NOT NULL,
    email_to VARCHAR(255) NOT NULL,
    email_date TIMESTAMP NOT NULL,
    
    -- Email Content
    raw_email_content TEXT,
    adf_xml_content TEXT,
    attachment_info JSONB DEFAULT '[]',
    
    -- Processing Information
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    processing_attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    processing_errors JSONB DEFAULT '[]',
    resulting_lead_id INTEGER, -- Foreign key to adf_leads
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Create indexes for email queue
CREATE INDEX IF NOT EXISTS idx_adf_email_queue_message_id ON adf_email_queue(email_message_id);
CREATE INDEX IF NOT EXISTS idx_adf_email_queue_processing_status ON adf_email_queue(processing_status);
CREATE INDEX IF NOT EXISTS idx_adf_email_queue_email_from ON adf_email_queue(email_from);
CREATE INDEX IF NOT EXISTS idx_adf_email_queue_email_date ON adf_email_queue(email_date);
CREATE INDEX IF NOT EXISTS idx_adf_email_queue_resulting_lead ON adf_email_queue(resulting_lead_id);

-- Unique constraint for email message ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_adf_email_queue_unique_message ON adf_email_queue(email_message_id);

-- ADF Processing Logs table for audit trail
CREATE TABLE IF NOT EXISTS adf_processing_logs (
    id SERIAL PRIMARY KEY,
    
    -- Reference Information
    adf_lead_id INTEGER, -- Foreign key to adf_leads (nullable for pre-lead processing steps)
    email_queue_id INTEGER, -- Foreign key to adf_email_queue
    
    -- Processing Step Information
    process_step VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'success', 'warning', 'error'
    message TEXT NOT NULL,
    error_details JSONB DEFAULT '{}',
    
    -- Timing Information
    processing_time_ms INTEGER,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for processing logs
CREATE INDEX IF NOT EXISTS idx_adf_processing_logs_lead ON adf_processing_logs(adf_lead_id);
CREATE INDEX IF NOT EXISTS idx_adf_processing_logs_queue ON adf_processing_logs(email_queue_id);
CREATE INDEX IF NOT EXISTS idx_adf_processing_logs_step ON adf_processing_logs(process_step);
CREATE INDEX IF NOT EXISTS idx_adf_processing_logs_status ON adf_processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_adf_processing_logs_created_at ON adf_processing_logs(created_at);

-- Add foreign key constraints (will be added after dealerships table is created)
-- ALTER TABLE adf_leads ADD CONSTRAINT fk_adf_leads_dealership FOREIGN KEY (dealership_id) REFERENCES dealerships(id);
-- ALTER TABLE adf_email_queue ADD CONSTRAINT fk_adf_email_queue_lead FOREIGN KEY (resulting_lead_id) REFERENCES adf_leads(id);
-- ALTER TABLE adf_processing_logs ADD CONSTRAINT fk_adf_processing_logs_lead FOREIGN KEY (adf_lead_id) REFERENCES adf_leads(id);
-- ALTER TABLE adf_processing_logs ADD CONSTRAINT fk_adf_processing_logs_queue FOREIGN KEY (email_queue_id) REFERENCES adf_email_queue(id);

-- Add table comments
COMMENT ON TABLE adf_leads IS 'Stores processed ADF (Auto Data Format) leads from email ingestion';
COMMENT ON TABLE adf_email_queue IS 'Queue for processing ADF emails with retry logic';
COMMENT ON TABLE adf_processing_logs IS 'Audit trail for ADF lead processing steps';

COMMIT;
