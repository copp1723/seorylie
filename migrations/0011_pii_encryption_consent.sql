-- migrations/0011_pii_encryption_consent.sql
-- ADF-012: Data Privacy / Compliance Hardening
-- 
-- This migration adds GDPR/CCPA compliance features:
-- 1. Converts PII columns to bytea for encrypted storage
-- 2. Adds consent tracking columns
-- 3. Adds data retention date columns
-- 4. Adds indexes for compliance queries
-- 5. Sets up pgcrypto extension for encryption

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add comment explaining compliance purpose
COMMENT ON DATABASE current_database() IS 'This database contains personally identifiable information (PII) subject to GDPR/CCPA regulations. Data retention and consent tracking features are implemented.';

-- Begin transaction to ensure all changes are atomic
BEGIN;

-- Update adf_leads table for PII protection
ALTER TABLE adf_leads
    -- Convert PII fields to bytea for encryption
    ALTER COLUMN customer_email TYPE bytea USING pgp_sym_encrypt(customer_email::text, current_setting('app.encryption_key', true))::bytea,
    ALTER COLUMN customer_phone TYPE bytea USING pgp_sym_encrypt(customer_phone::text, current_setting('app.encryption_key', true))::bytea,
    ALTER COLUMN customer_name TYPE bytea USING pgp_sym_encrypt(customer_name::text, current_setting('app.encryption_key', true))::bytea,
    
    -- Add consent tracking
    ADD COLUMN consent_given boolean NOT NULL DEFAULT false,
    ADD COLUMN consent_timestamp timestamp with time zone,
    ADD COLUMN consent_source varchar(100),
    
    -- Add data retention
    ADD COLUMN data_retention_date timestamp with time zone NOT NULL DEFAULT (NOW() + interval '730 days'),
    ADD COLUMN anonymized boolean NOT NULL DEFAULT false;

-- Add comments explaining PII columns
COMMENT ON COLUMN adf_leads.customer_email IS 'Encrypted email address (PII) - requires decryption with pgp_sym_decrypt';
COMMENT ON COLUMN adf_leads.customer_phone IS 'Encrypted phone number (PII) - requires decryption with pgp_sym_decrypt';
COMMENT ON COLUMN adf_leads.customer_name IS 'Encrypted customer name (PII) - requires decryption with pgp_sym_decrypt';
COMMENT ON COLUMN adf_leads.consent_given IS 'GDPR/CCPA consent flag - true if customer has given explicit consent';
COMMENT ON COLUMN adf_leads.data_retention_date IS 'Date after which this record should be purged or anonymized (default 730 days)';

-- Add indexes for compliance queries
CREATE INDEX idx_adf_leads_consent ON adf_leads(consent_given);
CREATE INDEX idx_adf_leads_retention ON adf_leads(data_retention_date);
CREATE INDEX idx_adf_leads_anonymized ON adf_leads(anonymized);

-- Update leads table for PII protection (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads') THEN
        ALTER TABLE leads
            -- Convert PII fields to bytea for encryption
            ALTER COLUMN email TYPE bytea USING pgp_sym_encrypt(email::text, current_setting('app.encryption_key', true))::bytea,
            ALTER COLUMN phone TYPE bytea USING pgp_sym_encrypt(phone::text, current_setting('app.encryption_key', true))::bytea,
            ALTER COLUMN name TYPE bytea USING pgp_sym_encrypt(name::text, current_setting('app.encryption_key', true))::bytea,
            
            -- Add consent tracking
            ADD COLUMN consent_given boolean NOT NULL DEFAULT false,
            ADD COLUMN consent_timestamp timestamp with time zone,
            ADD COLUMN consent_source varchar(100),
            
            -- Add data retention
            ADD COLUMN data_retention_date timestamp with time zone NOT NULL DEFAULT (NOW() + interval '730 days'),
            ADD COLUMN anonymized boolean NOT NULL DEFAULT false;

        -- Add comments explaining PII columns
        COMMENT ON COLUMN leads.email IS 'Encrypted email address (PII) - requires decryption with pgp_sym_decrypt';
        COMMENT ON COLUMN leads.phone IS 'Encrypted phone number (PII) - requires decryption with pgp_sym_decrypt';
        COMMENT ON COLUMN leads.name IS 'Encrypted customer name (PII) - requires decryption with pgp_sym_decrypt';
        COMMENT ON COLUMN leads.consent_given IS 'GDPR/CCPA consent flag - true if customer has given explicit consent';
        COMMENT ON COLUMN leads.data_retention_date IS 'Date after which this record should be purged or anonymized (default 730 days)';

        -- Add indexes for compliance queries
        CREATE INDEX idx_leads_consent ON leads(consent_given);
        CREATE INDEX idx_leads_retention ON leads(data_retention_date);
        CREATE INDEX idx_leads_anonymized ON leads(anonymized);
    END IF;
END $$;

-- Create a function to securely decrypt PII data
CREATE OR REPLACE FUNCTION decrypt_pii(encrypted_data bytea)
RETURNS text AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, current_setting('app.encryption_key', true));
EXCEPTION
    WHEN OTHERS THEN
        RETURN '[DECRYPTION_ERROR]';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to securely encrypt PII data
CREATE OR REPLACE FUNCTION encrypt_pii(data text)
RETURNS bytea AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, current_setting('app.encryption_key', true))::bytea;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for accessing decrypted data (with proper permissions)
CREATE OR REPLACE VIEW vw_adf_leads_decrypted AS
SELECT
    id,
    external_id,
    dealership_id,
    decrypt_pii(customer_name) AS customer_name,
    decrypt_pii(customer_email) AS customer_email,
    decrypt_pii(customer_phone) AS customer_phone,
    customer_comments,
    vehicle_year,
    vehicle_make,
    vehicle_model,
    vehicle_trim,
    vehicle_stock_number,
    consent_given,
    consent_timestamp,
    consent_source,
    data_retention_date,
    anonymized,
    created_at,
    updated_at
FROM adf_leads;

-- Create a function to anonymize expired records
CREATE OR REPLACE FUNCTION anonymize_expired_leads()
RETURNS integer AS $$
DECLARE
    records_anonymized integer := 0;
BEGIN
    -- Anonymize records past retention date that haven't been anonymized yet
    UPDATE adf_leads
    SET
        customer_name = encrypt_pii('[ANONYMIZED]'),
        customer_email = encrypt_pii('[ANONYMIZED]'),
        customer_phone = encrypt_pii('[ANONYMIZED]'),
        customer_comments = '[ANONYMIZED]',
        anonymized = true
    WHERE
        data_retention_date < CURRENT_DATE
        AND NOT anonymized;
        
    GET DIAGNOSTICS records_anonymized = ROW_COUNT;
    
    -- Also anonymize in the leads table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads') THEN
        UPDATE leads
        SET
            name = encrypt_pii('[ANONYMIZED]'),
            email = encrypt_pii('[ANONYMIZED]'),
            phone = encrypt_pii('[ANONYMIZED]'),
            anonymized = true
        WHERE
            data_retention_date < CURRENT_DATE
            AND NOT anonymized;
            
        GET DIAGNOSTICS records_anonymized = ROW_COUNT + records_anonymized;
    END IF;
    
    RETURN records_anonymized;
END;
$$ LANGUAGE plpgsql;

-- Create a function to delete records that are very old (beyond legal requirements)
CREATE OR REPLACE FUNCTION delete_very_old_leads()
RETURNS integer AS $$
DECLARE
    records_deleted integer := 0;
BEGIN
    -- Delete records that are 3 years past retention date (5+ years old)
    DELETE FROM adf_leads
    WHERE
        data_retention_date < (CURRENT_DATE - interval '3 years')
        AND anonymized = true;
        
    GET DIAGNOSTICS records_deleted = ROW_COUNT;
    
    -- Also delete from the leads table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads') THEN
        DELETE FROM leads
        WHERE
            data_retention_date < (CURRENT_DATE - interval '3 years')
            AND anonymized = true;
            
        GET DIAGNOSTICS records_deleted = ROW_COUNT + records_deleted;
    END IF;
    
    RETURN records_deleted;
END;
$$ LANGUAGE plpgsql;

-- Set up app.encryption_key parameter (will need to be set in production)
-- This is just a placeholder, the actual key should be set securely
DO $$
BEGIN
    -- Check if the parameter already exists
    IF NOT EXISTS (SELECT 1 FROM pg_settings WHERE name = 'app.encryption_key') THEN
        -- In production, this would be set externally, not in the migration
        RAISE NOTICE 'IMPORTANT: You must set app.encryption_key parameter in postgresql.conf or via ALTER SYSTEM';
    END IF;
END $$;

-- Create a GDPR right to be forgotten function
CREATE OR REPLACE FUNCTION gdpr_forget_user(p_email text)
RETURNS boolean AS $$
DECLARE
    encrypted_email bytea;
    success boolean := false;
BEGIN
    -- Encrypt the email to match the stored format
    encrypted_email := encrypt_pii(p_email);
    
    -- Anonymize in adf_leads
    UPDATE adf_leads
    SET
        customer_name = encrypt_pii('[DELETED]'),
        customer_email = encrypt_pii('[DELETED]'),
        customer_phone = encrypt_pii('[DELETED]'),
        customer_comments = '[DELETED]',
        anonymized = true,
        data_retention_date = CURRENT_DATE
    WHERE
        customer_email = encrypted_email;
        
    -- Also anonymize in leads if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads') THEN
        UPDATE leads
        SET
            name = encrypt_pii('[DELETED]'),
            email = encrypt_pii('[DELETED]'),
            phone = encrypt_pii('[DELETED]'),
            anonymized = true,
            data_retention_date = CURRENT_DATE
        WHERE
            email = encrypted_email;
    END IF;
    
    success := true;
    RETURN success;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

COMMIT;
