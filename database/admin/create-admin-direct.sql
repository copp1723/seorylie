-- Create admin user directly via SQL
-- First, ensure we have a dealership
INSERT INTO dealerships (name, subdomain, contact_email, contact_phone, address, city, state, zip, created_at, updated_at)
VALUES ('Alpha Dealership', 'alpha', 'admin@alpha.ai', '555-0000', '123 Main Street', 'Demo City', 'CA', '90210', NOW(), NOW())
ON CONFLICT (subdomain) DO NOTHING;

-- Get the dealership ID for reference
DO $$
DECLARE 
    dealer_id INTEGER;
BEGIN
    SELECT id INTO dealer_id FROM dealerships WHERE subdomain = 'alpha' LIMIT 1;
    
    -- Create the super admin user
    INSERT INTO users (username, email, password, role, dealership_id, created_at, updated_at)
    VALUES (
        'admin', 
        'admin@alpha.ai', 
        '$2b$10$rQJ8Kx/4QK5oYa1dZ9LF3OGmb1Zb0yZz3QW3CmK5H1RYcH8MkwjY6', -- "admin123" hashed
        'super_admin', 
        dealer_id, 
        NOW(), 
        NOW()
    )
    ON CONFLICT (email) DO NOTHING;
END $$;

SELECT 'Admin user created successfully! Use admin/admin123 to login' AS result;