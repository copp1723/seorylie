# External API Integration - Ready for Use! 🚀

The cleanrylie AI platform now exposes external API endpoints for conversation generation and handover analysis.

## 🔑 API Endpoints Available

### Base URL

```
https://your-cleanrylie-domain.com/api/v1
```

### 1. Conversation AI

```bash
POST /api/v1/conversation/reply
X-API-Key: cleanrylie_your_api_key_here
Content-Type: application/json

{
  "customer": {
    "name": "John Smith",
    "email": "john@email.com",
    "phone": "+15551234567"
  },
  "conversation_history": [
    {"role": "customer", "message": "I'm interested in a 2024 Honda Accord"}
  ],
  "context": {
    "dealership_id": "honda_downtown",
    "lead_source": "website"
  }
}
```

**Response:**

```json
{
  "reply": "I'd be happy to help you with the 2024 Honda Accord...",
  "confidence": 0.92,
  "intent_detected": "vehicle_inquiry",
  "suggested_actions": ["send_pricing", "schedule_test_drive"],
  "response_time_ms": 1250
}
```

### 2. Handover Intelligence

```bash
POST /api/v1/handover/analyze
X-API-Key: cleanrylie_your_api_key_here
Content-Type: application/json

{
  "customer": {
    "name": "John Smith",
    "email": "john@email.com"
  },
  "conversation_history": [
    {"role": "customer", "message": "I'm ready to buy this car"},
    {"role": "assistant", "message": "Great! Let me connect you with our sales team."}
  ],
  "trigger_reason": "high_intent_detected"
}
```

**Response:**

```json
{
  "handover_recommended": true,
  "urgency": "high",
  "dossier": {
    "customer_summary": "Highly engaged buyer ready for purchase",
    "vehicle_interests": [
      { "make": "Honda", "model": "Accord", "year": 2024, "confidence": 0.88 }
    ],
    "key_insights": [
      { "key": "Purchase Intent", "value": "Ready to buy", "confidence": 0.95 }
    ],
    "suggested_approach": "Focus on closing immediately",
    "next_steps": [
      "Schedule immediate appointment",
      "Prepare purchase paperwork"
    ]
  },
  "response_time_ms": 2100
}
```

## 🔐 Authentication

All endpoints require an API key in the header:

```
X-API-Key: cleanrylie_your_api_key_here
```

**Test API Key Format:** `cleanrylie_test_[random_string]`

## 🏥 Health & Validation

```bash
# Check API health
GET /api/v1/health

# Validate your API key
GET /api/v1/validate
X-API-Key: your_key_here
```

## 📞 Contact for Setup

**Need API keys or have questions?**

- Contact: Josh Copp
- For production keys and integration support

## 🚀 Quick Test

```bash
curl -X POST "http://localhost:3000/api/v1/conversation/reply" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: cleanrylie_test_12345" \
  -d '{
    "customer": {"name": "Test User"},
    "conversation_history": [
      {"role": "customer", "message": "Hi, I need help with a car"}
    ],
    "context": {"dealership_id": "test_dealer"}
  }'
```

**You're ready to integrate!** 🎉
