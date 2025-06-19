-- Client Domain Setup Script
-- Usage: Replace variables and run for each new client

-- Variables to replace:
-- {DEALERSHIP_ID} - The dealership ID from database
-- {CLIENT_NAME} - Full business name (e.g., "Kunes RV Fox")
-- {CLIENT_DOMAIN} - Their domain (e.g., "kunesrvfox.com")
-- {CLIENT_SLUG} - Short identifier (e.g., "kunesrvfox")
-- {PROFESSIONAL_EMAIL} - Professional email address (e.g., "kelseyb@kunesrvfox.com")
-- {GMAIL_ADDRESS} - Gmail for IMAP (e.g., "rylieai1234@gmail.com")
-- {GMAIL_PASSWORD} - Gmail app password

-- Update dealership configuration
UPDATE dealerships
SET
  name = '{CLIENT_NAME}',
  contact_email = '{PROFESSIONAL_EMAIL}',
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'email', jsonb_build_object(
      'fromEmail', '{PROFESSIONAL_EMAIL}',
      'fromName', '{CLIENT_NAME}',
      'replyTo', '{PROFESSIONAL_EMAIL}',
      'domain', '{CLIENT_DOMAIN}',
      'verified', false
    ),
    'imap', jsonb_build_object(
      'host', 'imap.gmail.com',
      'port', 993,
      'user', '{GMAIL_ADDRESS}',
      'password', '{GMAIL_PASSWORD}',
      'tls', true,
      'markSeen', true,
      'pollingInterval', 300,
      'provider', 'gmail'
    )
  ),
  operation_mode = 'rylie_ai',
  updated_at = NOW()
WHERE id = {DEALERSHIP_ID};

-- Verify the update
SELECT
  id,
  name,
  contact_email,
  settings,
  operation_mode
FROM dealerships
WHERE id = {DEALERSHIP_ID};
