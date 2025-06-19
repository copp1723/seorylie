# Dealership Onboarding API Documentation

## Overview
The Dealership Onboarding API provides endpoints to create and manage dealership accounts in the Rylie SEO platform.

## Base URL
- **Production:** `https://seorylie.onrender.com/api/dealership-onboarding`
- **Local Development:** `http://localhost:3003/api/dealership-onboarding`

## Endpoints

### 1. Check Subdomain Availability
**POST** `/check-subdomain`

Check if a subdomain is available for use.

**Request Body:**
```json
{
  "subdomain": "my-dealership"
}
```

**Response:**
```json
{
  "available": true,
  "subdomain": "my-dealership"
}
```

**Validation Rules:**
- Must be 1-63 characters
- Only lowercase letters, numbers, and hyphens
- Cannot start or end with hyphen

### 2. Create Dealership
**POST** `/create`

Create a new dealership with admin user.

**Request Body:**
```json
{
  "name": "ABC Motors",
  "subdomain": "abc-motors",
  "contact_email": "info@abcmotors.com",
  "contact_phone": "+14155551234",
  "website_url": "https://www.abcmotors.com",
  "address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "US"
  },
  "timezone": "America/Los_Angeles",
  "operation_mode": "rylie_ai",
  "admin": {
    "first_name": "John",
    "last_name": "Smith",
    "email": "john@abcmotors.com",
    "password": "SecurePassword123!",
    "phone": "+14155555678"
  },
  "integrations": {
    "ga4_property_id": "123456789",
    "ga4_measurement_id": "G-XXXXXXXXXX",
    "sendgrid_api_key": "SG.xxxxx",
    "purecars_api_key": "xxxxx"
  }
}
```

**Response:**
```json
{
  "success": true,
  "dealership": {
    "id": "uuid",
    "name": "ABC Motors",
    "subdomain": "abc-motors",
    "url": "https://abc-motors.seorylie.com"
  },
  "admin": {
    "id": "uuid",
    "email": "john@abcmotors.com",
    "first_name": "John",
    "last_name": "Smith",
    "role": "admin"
  },
  "apiKey": "cleanrylie_xxxxxxxx",
  "nextSteps": [
    "Configure DNS for subdomain",
    "Set up email integration",
    "Add inventory feed",
    "Configure chat widget"
  ]
}
```

**Important:** The API key is only returned once during creation. Store it securely!

### 3. Get Onboarding Progress
**GET** `/progress/{dealershipId}`

Check the onboarding completion status.

**Response:**
```json
{
  "dealership": {
    "id": "uuid",
    "name": "ABC Motors",
    "subdomain": "abc-motors"
  },
  "steps": {
    "basic_setup": true,
    "admin_user": true,
    "api_key": true,
    "dns_configured": false,
    "email_integration": false,
    "ga4_integration": true,
    "inventory_feed": false,
    "chat_widget": false,
    "test_conversation": false
  },
  "completionPercentage": 33
}
```

### 4. Update Dealership Settings
**PATCH** `/settings/{dealershipId}`

Update dealership configuration settings.

**Request Body:**
```json
{
  "chat_widget": {
    "primary_color": "#007bff",
    "welcome_message": "Welcome! How can I help you today?",
    "position": "bottom-right",
    "auto_open_delay": 5000
  },
  "email_templates": {
    "lead_notification": {
      "subject": "New Lead: {{customer_name}}",
      "body": "You have a new lead..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "chat_widget": {...},
    "email_templates": {...}
  }
}
```

### 5. List Dealerships
**GET** `/list`

List all dealerships (admin only).

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 20)
- `search` (string): Search by name or subdomain

**Response:**
```json
{
  "dealerships": [
    {
      "id": "uuid",
      "name": "ABC Motors",
      "subdomain": "abc-motors",
      "contact_email": "info@abcmotors.com",
      "operation_mode": "rylie_ai",
      "created_at": "2024-06-17T10:00:00Z",
      "user_count": 5,
      "conversation_count": 150
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

## Operation Modes

### 1. Rylie AI Mode (`rylie_ai`)
- Automated AI-powered responses
- 24/7 availability
- Intelligent lead qualification
- Automatic escalation to human agents

### 2. Direct Agent Mode (`direct_agent`)
- Human agents handle all conversations
- Working hours restrictions
- Manual assignment or auto-assignment
- Queue management

## Complete Onboarding Checklist

1. **Create Dealership**
   - Choose unique subdomain
   - Set up admin account
   - Store API key securely

2. **Configure DNS**
   - Add CNAME record pointing to `seorylie.com`
   - Wait for DNS propagation

3. **Email Integration**
   - Configure IMAP settings for receiving
   - Configure SMTP settings for sending
   - Test email connectivity

4. **GA4 Integration**
   - Add service account to GA4 property
   - Configure property and measurement IDs

5. **Inventory Feed**
   - Set up data feed URL or API
   - Configure sync frequency
   - Map inventory fields

6. **Chat Widget**
   - Customize appearance
   - Add to website
   - Test functionality

7. **Test & Launch**
   - Send test conversation
   - Verify lead routing
   - Monitor first interactions

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": {
    "subdomain": "Invalid format",
    "admin.email": "Invalid email"
  }
}
```

### 409 Conflict
```json
{
  "error": "Subdomain already taken"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to create dealership",
  "message": "Database error"
}
```

## Testing

Use the provided test script:
```bash
npm run test:onboarding
```

Or test manually with CURL:
```bash
# Check subdomain
curl -X POST https://seorylie.onrender.com/api/dealership-onboarding/check-subdomain \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "test-dealer"}'

# Create dealership
curl -X POST https://seorylie.onrender.com/api/dealership-onboarding/create \
  -H "Content-Type: application/json" \
  -d '{...full JSON body...}'
```