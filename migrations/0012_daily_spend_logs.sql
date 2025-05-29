-- Migration: 0012_daily_spend_logs.sql
-- Description: Creates daily_spend_logs table for Google Ads performance data
-- with partitioning, indexes, and retention policies

-- Create the daily_spend_logs table
CREATE TABLE IF NOT EXISTS daily_spend_logs (
    id SERIAL PRIMARY KEY,
    cid VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    campaign_id VARCHAR(50),
    campaign_name VARCHAR(255),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    cost_micros BIGINT DEFAULT 0,
    conversions DECIMAL(10,2) DEFAULT 0,
    conversion_value_micros BIGINT DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,
    cpc_micros BIGINT DEFAULT 0,
    roas DECIMAL(10,4) DEFAULT 0,
    cpa_micros BIGINT DEFAULT 0,
    account_currency_code VARCHAR(3),
    extracted_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (date);

-- Create monthly partitions for the current year and next year
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('year', CURRENT_DATE);
    end_date DATE := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '2 years';
    month_date DATE;
BEGIN
    month_date := start_date;
    WHILE month_date < end_date LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS daily_spend_logs_%s PARTITION OF daily_spend_logs 
             FOR VALUES FROM (%L) TO (%L)',
            TO_CHAR(month_date, 'YYYY_MM'),
            month_date,
            month_date + INTERVAL '1 month'
        );
        month_date := month_date + INTERVAL '1 month';
    END LOOP;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_spend_logs_cid_date ON daily_spend_logs(cid, date);
CREATE INDEX IF NOT EXISTS idx_daily_spend_logs_date ON daily_spend_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_spend_logs_campaign_id ON daily_spend_logs(campaign_id);

-- Add unique constraint to prevent duplicates
ALTER TABLE daily_spend_logs ADD CONSTRAINT uq_daily_spend_logs_cid_campaign_date 
    UNIQUE (cid, campaign_id, date);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_daily_spend_logs_modtime
    BEFORE UPDATE ON daily_spend_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Create a function for automatic partition management
CREATE OR REPLACE FUNCTION create_daily_spend_logs_partition()
RETURNS VOID AS $$
DECLARE
    next_month DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months');
    partition_name TEXT := 'daily_spend_logs_' || TO_CHAR(next_month, 'YYYY_MM');
BEGIN
    -- Check if the partition already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name AND n.nspname = 'public'
    ) THEN
        -- Create the new partition
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF daily_spend_logs 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            next_month,
            next_month + INTERVAL '1 month'
        );
        
        RAISE NOTICE 'Created new partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function for data retention management (drops partitions older than 13 months)
CREATE OR REPLACE FUNCTION manage_daily_spend_logs_retention()
RETURNS VOID AS $$
DECLARE
    retention_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '13 months');
    partition_name TEXT := 'daily_spend_logs_' || TO_CHAR(retention_date, 'YYYY_MM');
BEGIN
    -- Check if the partition exists
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name AND n.nspname = 'public'
    ) THEN
        -- Drop the old partition
        EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
        RAISE NOTICE 'Dropped old partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy access to KPI metrics
CREATE OR REPLACE VIEW ads_kpi_metrics AS
SELECT 
    cid,
    date,
    SUM(impressions) AS total_impressions,
    SUM(clicks) AS total_clicks,
    SUM(cost_micros) / 1000000.0 AS total_cost,
    SUM(conversions) AS total_conversions,
    SUM(conversion_value_micros) / 1000000.0 AS total_conversion_value,
    CASE 
        WHEN SUM(impressions) > 0 THEN (SUM(clicks)::DECIMAL / SUM(impressions)) 
        ELSE 0 
    END AS avg_ctr,
    CASE 
        WHEN SUM(clicks) > 0 THEN (SUM(cost_micros)::DECIMAL / SUM(clicks)) / 1000000.0
        ELSE 0 
    END AS avg_cpc,
    CASE 
        WHEN SUM(cost_micros) > 0 THEN (SUM(conversion_value_micros)::DECIMAL / SUM(cost_micros))
        ELSE 0 
    END AS avg_roas,
    CASE 
        WHEN SUM(conversions) > 0 THEN (SUM(cost_micros)::DECIMAL / SUM(conversions)) / 1000000.0
        ELSE 0 
    END AS avg_cpa,
    account_currency_code
FROM daily_spend_logs
GROUP BY cid, date, account_currency_code;

-- Create a rolling 30-day view for dashboard KPIs
CREATE OR REPLACE VIEW ads_kpi_30day AS
SELECT 
    cid,
    account_currency_code,
    SUM(impressions) AS impressions_30d,
    SUM(clicks) AS clicks_30d,
    SUM(cost_micros) / 1000000.0 AS cost_30d,
    SUM(conversions) AS conversions_30d,
    SUM(conversion_value_micros) / 1000000.0 AS conversion_value_30d,
    CASE 
        WHEN SUM(impressions) > 0 THEN (SUM(clicks)::DECIMAL / SUM(impressions)) 
        ELSE 0 
    END AS ctr_30d,
    CASE 
        WHEN SUM(clicks) > 0 THEN (SUM(cost_micros)::DECIMAL / SUM(clicks)) / 1000000.0
        ELSE 0 
    END AS cpc_30d,
    CASE 
        WHEN SUM(cost_micros) > 0 THEN (SUM(conversion_value_micros)::DECIMAL / SUM(cost_micros))
        ELSE 0 
    END AS roas_30d,
    CASE 
        WHEN SUM(conversions) > 0 THEN (SUM(cost_micros)::DECIMAL / SUM(conversions)) / 1000000.0
        ELSE 0 
    END AS cpa_30d,
    MAX(date) AS last_data_date
FROM daily_spend_logs
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cid, account_currency_code;

-- Comment for rollback script
-- DROP VIEW IF EXISTS ads_kpi_30day;
-- DROP VIEW IF EXISTS ads_kpi_metrics;
-- DROP FUNCTION IF EXISTS manage_daily_spend_logs_retention();
-- DROP FUNCTION IF EXISTS create_daily_spend_logs_partition();
-- DROP TRIGGER IF EXISTS update_daily_spend_logs_modtime ON daily_spend_logs;
-- DROP FUNCTION IF EXISTS update_modified_column();
-- DROP TABLE IF EXISTS daily_spend_logs CASCADE;
