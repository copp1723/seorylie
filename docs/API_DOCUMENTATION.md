# CleanRylie API Documentation

This document provides comprehensive API documentation for the CleanRylie platform, including authentication, endpoints, request/response formats, and integration examples.

## Table of Contents
1. [Authentication](#authentication)
2. [Core API Endpoints](#core-api-endpoints)
3. [WebSocket API](#websocket-api)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Integration Examples](#integration-examples)

## Authentication

### Authentication Methods

CleanRylie supports multiple authentication methods depending on the use case:

#### 1. JWT Token Authentication (Recommended)
```http
Authorization: Bearer <jwt-token>
```

**Obtaining a JWT Token:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@dealership.com",
  "password": "secure-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "user": {
      "id": 123,
      "email": "user@dealership.com",
      "name": "John Doe",
      "role": "manager",
      "dealership_id": 1
    }
  }
}
```

#### 2. API Key Authentication (Integrations)
```http
X-API-Key: <api-key>
```

**Creating an API Key:**
```http
POST /api/admin/api-keys
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json

{
  "name": "CRM Integration",
  "description": "Integration with Salesforce CRM",
  "permissions": ["conversations:read", "leads:write"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### 3. Session Authentication (Web UI)
```http
Cookie: session=<session-id>
```

### Role-Based Access Control

| Role | Permissions | Description |
|------|-------------|-------------|
| `super_admin` | All permissions | System-wide administration |
| `dealership_admin` | Dealership scope | Full dealership management |
| `manager` | Read/Write (limited) | Department management |
| `user` | Read/Write (own data) | Standard user access |
| `api` | Configured scope | Programmatic access |

## Core API Endpoints

### Health & Status

#### System Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "services": {
      "database": "connected",
      "redis": "connected",
      "openai": "available",
      "sendgrid": "available"
    },
    "performance": {
      "response_time_ms": 45,
      "memory_usage_mb": 256,
      "cpu_usage_percent": 15
    }
  }
}
```

### Dealership Management

#### Get Dealership Information
```http
GET /api/dealerships/{dealership_id}
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Premium Auto Group",
    "subdomain": "premium-auto",
    "contact_email": "info@premiumauto.com",
    "contact_phone": "+1-555-0123",
    "address": "123 Main St, Anytown, ST 12345",
    "timezone": "America/New_York",
    "logo_url": "https://cdn.cleanrylie.com/logos/premium-auto.png",
    "primary_color": "#1a365d",
    "secondary_color": "#ffffff",
    "ai_config": {
      "default_persona_id": 1,
      "response_delay_ms": 1000,
      "escalation_triggers": ["human", "manager", "help"]
    },
    "business_hours": {
      "monday": {"start": "09:00", "end": "18:00", "enabled": true},
      "tuesday": {"start": "09:00", "end": "18:00", "enabled": true},
      "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
      "thursday": {"start": "09:00", "end": "18:00", "enabled": true},
      "friday": {"start": "09:00", "end": "18:00", "enabled": true},
      "saturday": {"start": "09:00", "end": "17:00", "enabled": true},
      "sunday": {"start": "12:00", "end": "17:00", "enabled": false}
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Conversation Management

#### List Conversations
```http
GET /api/dealerships/{dealership_id}/conversations
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (`active`, `escalated`, `closed`, `archived`)
- `channel` (string): Filter by channel (`web`, `sms`, `email`, `phone`)
- `assigned_to` (integer): Filter by assigned user ID
- `search` (string): Search in customer name or message content
- `date_from` (string): Filter conversations from date (ISO 8601)
- `date_to` (string): Filter conversations to date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "customer_name": "Jane Smith",
      "customer_phone": "+1-555-0456",
      "customer_email": "jane.smith@email.com",
      "channel": "web",
      "status": "active",
      "assigned_to": {
        "id": 45,
        "name": "Sales Agent",
        "email": "agent@dealership.com"
      },
      "last_message": {
        "id": 789,
        "content": "I'm interested in the 2024 Honda Civic",
        "is_from_customer": true,
        "created_at": "2024-01-15T10:25:00Z"
      },
      "message_count": 5,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:25:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "has_more": true
    },
    "filters": {
      "status": "active",
      "channel": null,
      "assigned_to": null
    }
  }
}
```

#### Create New Conversation
```http
POST /api/dealerships/{dealership_id}/conversations
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_phone": "+1-555-0789",
  "customer_email": "john.doe@email.com",
  "channel": "web",
  "initial_message": "Hi, I'm looking for a reliable SUV for my family",
  "campaign_context": "Summer Sale 2024",
  "customer_context": {
    "source": "website",
    "referrer": "google",
    "utm_campaign": "summer-sale"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 124,
    "customer_name": "John Doe",
    "customer_phone": "+1-555-0789",
    "customer_email": "john.doe@email.com",
    "channel": "web",
    "status": "active",
    "assigned_to": null,
    "campaign_context": "Summer Sale 2024",
    "customer_context": {
      "source": "website",
      "referrer": "google",
      "utm_campaign": "summer-sale"
    },
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Message Management

#### Get Conversation Messages
```http
GET /api/conversations/{conversation_id}/messages
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 50, max: 200)
- `order` (string): Sort order (`asc`, `desc`) (default: `asc`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "content": "I'm interested in the 2024 Honda Civic",
      "is_from_customer": true,
      "channel": "web",
      "message_type": "text",
      "ai_generated": false,
      "metadata": {
        "user_agent": "Mozilla/5.0...",
        "ip_address": "192.168.1.100"
      },
      "created_at": "2024-01-15T10:25:00Z"
    },
    {
      "id": 790,
      "content": "Great choice! The 2024 Honda Civic is one of our most popular models. It offers excellent fuel economy and reliability. Would you like to schedule a test drive?",
      "is_from_customer": false,
      "channel": "web",
      "message_type": "text",
      "ai_generated": true,
      "ai_model": "gpt-4",
      "ai_confidence": 0.95,
      "processing_time_ms": 1250,
      "metadata": {
        "persona_id": 1,
        "intent": "vehicle_inquiry",
        "sentiment": "positive"
      },
      "created_at": "2024-01-15T10:25:30Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 5,
      "has_more": false
    }
  }
}
```

#### Send Message
```http
POST /api/conversations/{conversation_id}/messages
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "content": "Thank you for your interest! I'd be happy to help you find the perfect vehicle.",
  "message_type": "text",
  "metadata": {
    "agent_id": 45,
    "response_time_ms": 30000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 791,
    "content": "Thank you for your interest! I'd be happy to help you find the perfect vehicle.",
    "is_from_customer": false,
    "channel": "web",
    "message_type": "text",
    "ai_generated": false,
    "metadata": {
      "agent_id": 45,
      "response_time_ms": 30000
    },
    "created_at": "2024-01-15T10:26:00Z"
  }
}
```

### Vehicle Inventory

#### Search Vehicles
```http
GET /api/dealerships/{dealership_id}/vehicles
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `make` (string): Filter by vehicle make
- `model` (string): Filter by vehicle model
- `year` (integer): Filter by year
- `year_min` (integer): Minimum year
- `year_max` (integer): Maximum year
- `price_min` (number): Minimum price
- `price_max` (number): Maximum price
- `mileage_max` (integer): Maximum mileage
- `status` (string): Filter by status (`Available`, `Sold`, `Pending`)
- `certified` (boolean): Filter certified vehicles
- `search` (string): Search in make, model, or description

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "vin": "1HGCM82633A123456",
      "stock_number": "H24001",
      "make": "Honda",
      "model": "Civic",
      "year": 2024,
      "trim": "Sport",
      "body_style": "Sedan",
      "ext_color": "Sonic Gray Pearl",
      "int_color": "Black",
      "mileage": 15,
      "engine": "2.0L 4-Cylinder",
      "transmission": "CVT",
      "drivetrain": "FWD",
      "fuel_type": "Gasoline",
      "fuel_economy": 32,
      "msrp": 25900.00,
      "sale_price": 24500.00,
      "status": "Available",
      "certified": true,
      "description": "Like-new 2024 Honda Civic Sport with low miles and excellent condition.",
      "features": [
        "Apple CarPlay",
        "Android Auto",
        "Honda Sensing",
        "Sunroof",
        "Heated Seats"
      ],
      "images": [
        {
          "url": "https://cdn.cleanrylie.com/vehicles/456/exterior-1.jpg",
          "type": "exterior",
          "order": 1
        },
        {
          "url": "https://cdn.cleanrylie.com/vehicles/456/interior-1.jpg",
          "type": "interior",
          "order": 2
        }
      ],
      "video_url": "https://cdn.cleanrylie.com/vehicles/456/walkthrough.mp4",
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-15T09:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "has_more": true
    },
    "filters": {
      "make": "Honda",
      "model": null,
      "year": null,
      "price_range": null,
      "status": "Available"
    },
    "summary": {
      "total_vehicles": 45,
      "avg_price": 28750.00,
      "price_range": {
        "min": 18500.00,
        "max": 45900.00
      }
    }
  }
}
```

### Lead Management

#### Create Lead
```http
POST /api/dealerships/{dealership_id}/leads
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "customer_name": "Sarah Johnson",
  "customer_email": "sarah.johnson@email.com",
  "customer_phone": "+1-555-0321",
  "source": "website",
  "vehicle_interest": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2024,
    "budget_min": 25000,
    "budget_max": 35000
  },
  "notes": "Customer is looking for a reliable sedan for daily commuting",
  "priority": "medium",
  "campaign_context": "Spring Sales Event"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 789,
    "customer_name": "Sarah Johnson",
    "customer_email": "sarah.johnson@email.com",
    "customer_phone": "+1-555-0321",
    "source": "website",
    "status": "new",
    "priority": "medium",
    "score": 75,
    "vehicle_interest": {
      "make": "Toyota",
      "model": "Camry",
      "year": 2024,
      "budget_min": 25000,
      "budget_max": 35000
    },
    "assigned_to": null,
    "notes": "Customer is looking for a reliable sedan for daily commuting",
    "campaign_context": "Spring Sales Event",
    "created_at": "2024-01-15T11:00:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

## WebSocket API

### Connection

Connect to the WebSocket server for real-time updates:

```javascript
const ws = new WebSocket('wss://api.cleanrylie.com/ws');

// Authentication after connection
ws.onopen = function() {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token'
  }));
};
```

### Message Types

#### Authentication
```json
{
  "type": "authenticate",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Join Conversation
```json
{
  "type": "join_conversation",
  "conversation_id": 123
}
```

#### Send Message
```json
{
  "type": "send_message",
  "conversation_id": 123,
  "content": "Hello, how can I help you today?",
  "message_type": "text"
}
```

#### Typing Indicator
```json
{
  "type": "typing",
  "conversation_id": 123,
  "is_typing": true
}
```

### Incoming Events

#### New Message
```json
{
  "type": "message",
  "conversation_id": 123,
  "message": {
    "id": 456,
    "content": "I'm interested in your inventory",
    "is_from_customer": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Conversation Status Update
```json
{
  "type": "conversation_status",
  "conversation_id": 123,
  "status": "escalated",
  "assigned_to": {
    "id": 45,
    "name": "Sales Manager"
  }
}
```

#### Typing Indicator
```json
{
  "type": "typing",
  "conversation_id": 123,
  "user": {
    "id": 45,
    "name": "Sales Agent"
  },
  "is_typing": true
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789"
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 401 | `AUTHENTICATION_REQUIRED` | Authentication required |
| 401 | `INVALID_TOKEN` | Invalid or expired token |
| 403 | `INSUFFICIENT_PERMISSIONS` | Insufficient permissions |
| 403 | `DEALERSHIP_ACCESS_DENIED` | Access to dealership denied |
| 404 | `RESOURCE_NOT_FOUND` | Requested resource not found |
| 409 | `RESOURCE_CONFLICT` | Resource conflict (duplicate) |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Internal server error |
| 502 | `EXTERNAL_SERVICE_ERROR` | External service unavailable |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Rate Limiting

### Rate Limit Tiers

| Authentication Type | Requests per Hour | Burst Limit |
|-------------------|------------------|-------------|
| Public (IP-based) | 100 | 10 |
| Authenticated User | 1,000 | 50 |
| API Key (Standard) | 5,000 | 100 |
| API Key (Premium) | 20,000 | 200 |
| API Key (Enterprise) | 100,000 | 500 |

### Rate Limit Headers

All API responses include rate limiting information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
X-RateLimit-Retry-After: 3600
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2024-01-15T11:00:00Z",
      "retry_after": 3600
    }
  }
}
```

## Integration Examples

### JavaScript/Node.js Integration

#### Basic API Client
```javascript
class CleanRylieAPI {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async request(method, endpoint, data = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!result.success) {
      throw new Error(`API Error: ${result.error.message}`);
    }

    return result.data;
  }

  // Get dealership conversations
  async getConversations(dealershipId, filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request('GET', `/api/dealerships/${dealershipId}/conversations?${params}`);
  }

  // Create new conversation
  async createConversation(dealershipId, conversationData) {
    return this.request('POST', `/api/dealerships/${dealershipId}/conversations`, conversationData);
  }

  // Send message
  async sendMessage(conversationId, messageData) {
    return this.request('POST', `/api/conversations/${conversationId}/messages`, messageData);
  }

  // Search vehicles
  async searchVehicles(dealershipId, filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request('GET', `/api/dealerships/${dealershipId}/vehicles?${params}`);
  }
}

// Usage example
const api = new CleanRylieAPI('https://api.cleanrylie.com', 'your-api-key');

// Get active conversations
const conversations = await api.getConversations(1, { status: 'active' });

// Create new conversation
const newConversation = await api.createConversation(1, {
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  channel: 'web',
  initial_message: 'I need help finding a car'
});

// Send response
await api.sendMessage(newConversation.id, {
  content: 'Hello! I\'d be happy to help you find the perfect vehicle.',
  message_type: 'text'
});
```

#### WebSocket Integration
```javascript
class CleanRylieWebSocket {
  constructor(wsURL, token) {
    this.wsURL = wsURL;
    this.token = token;
    this.ws = null;
    this.eventHandlers = {};
  }

  connect() {
    this.ws = new WebSocket(this.wsURL);

    this.ws.onopen = () => {
      // Authenticate after connection
      this.send({
        type: 'authenticate',
        token: this.token
      });
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleEvent(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Implement reconnection logic
      setTimeout(() => this.connect(), 5000);
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler);
  }

  handleEvent(data) {
    const handlers = this.eventHandlers[data.type] || [];
    handlers.forEach(handler => handler(data));
  }

  joinConversation(conversationId) {
    this.send({
      type: 'join_conversation',
      conversation_id: conversationId
    });
  }

  sendMessage(conversationId, content) {
    this.send({
      type: 'send_message',
      conversation_id: conversationId,
      content: content,
      message_type: 'text'
    });
  }

  setTyping(conversationId, isTyping) {
    this.send({
      type: 'typing',
      conversation_id: conversationId,
      is_typing: isTyping
    });
  }
}

// Usage example
const ws = new CleanRylieWebSocket('wss://api.cleanrylie.com/ws', 'your-jwt-token');

// Set up event handlers
ws.on('message', (data) => {
  console.log('New message:', data.message);
  // Update UI with new message
});

ws.on('conversation_status', (data) => {
  console.log('Conversation status changed:', data.status);
  // Update conversation status in UI
});

ws.on('typing', (data) => {
  console.log('Typing indicator:', data.is_typing);
  // Show/hide typing indicator
});

// Connect and join conversation
ws.connect();
ws.joinConversation(123);
```

### Python Integration

#### Basic API Client
```python
import requests
import json
from typing import Dict, List, Optional

class CleanRylieAPI:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': api_key
        })

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        url = f"{self.base_url}{endpoint}"

        if method.upper() == 'GET':
            response = self.session.get(url, params=data)
        else:
            response = self.session.request(method, url, json=data)

        response.raise_for_status()
        result = response.json()

        if not result.get('success'):
            raise Exception(f"API Error: {result.get('error', {}).get('message')}")

        return result.get('data')

    def get_conversations(self, dealership_id: int, filters: Optional[Dict] = None) -> List[Dict]:
        endpoint = f"/api/dealerships/{dealership_id}/conversations"
        return self._request('GET', endpoint, filters)

    def create_conversation(self, dealership_id: int, conversation_data: Dict) -> Dict:
        endpoint = f"/api/dealerships/{dealership_id}/conversations"
        return self._request('POST', endpoint, conversation_data)

    def send_message(self, conversation_id: int, message_data: Dict) -> Dict:
        endpoint = f"/api/conversations/{conversation_id}/messages"
        return self._request('POST', endpoint, message_data)

    def search_vehicles(self, dealership_id: int, filters: Optional[Dict] = None) -> List[Dict]:
        endpoint = f"/api/dealerships/{dealership_id}/vehicles"
        return self._request('GET', endpoint, filters)

    def create_lead(self, dealership_id: int, lead_data: Dict) -> Dict:
        endpoint = f"/api/dealerships/{dealership_id}/leads"
        return self._request('POST', endpoint, lead_data)

# Usage example
api = CleanRylieAPI('https://api.cleanrylie.com', 'your-api-key')

# Get active conversations
conversations = api.get_conversations(1, {'status': 'active'})

# Create new lead
lead = api.create_lead(1, {
    'customer_name': 'Jane Smith',
    'customer_email': 'jane@example.com',
    'customer_phone': '+1-555-0123',
    'source': 'website',
    'vehicle_interest': {
        'make': 'Honda',
        'model': 'Civic',
        'year': 2024
    }
})

print(f"Created lead with ID: {lead['id']}")
```

### PHP Integration

#### Basic API Client
```php
<?php

class CleanRylieAPI {
    private $baseUrl;
    private $apiKey;

    public function __construct($baseUrl, $apiKey) {
        $this->baseUrl = $baseUrl;
        $this->apiKey = $apiKey;
    }

    private function request($method, $endpoint, $data = null) {
        $url = $this->baseUrl . $endpoint;

        $headers = [
            'Content-Type: application/json',
            'X-API-Key: ' . $this->apiKey
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

        if ($data && $method !== 'GET') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($data && $method === 'GET') {
            $url .= '?' . http_build_query($data);
            curl_setopt($ch, CURLOPT_URL, $url);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception("HTTP Error: $httpCode");
        }

        $result = json_decode($response, true);

        if (!$result['success']) {
            throw new Exception("API Error: " . $result['error']['message']);
        }

        return $result['data'];
    }

    public function getConversations($dealershipId, $filters = []) {
        return $this->request('GET', "/api/dealerships/$dealershipId/conversations", $filters);
    }

    public function createConversation($dealershipId, $conversationData) {
        return $this->request('POST', "/api/dealerships/$dealershipId/conversations", $conversationData);
    }

    public function sendMessage($conversationId, $messageData) {
        return $this->request('POST', "/api/conversations/$conversationId/messages", $messageData);
    }

    public function searchVehicles($dealershipId, $filters = []) {
        return $this->request('GET', "/api/dealerships/$dealershipId/vehicles", $filters);
    }
}

// Usage example
$api = new CleanRylieAPI('https://api.cleanrylie.com', 'your-api-key');

// Get conversations
$conversations = $api->getConversations(1, ['status' => 'active']);

// Create conversation
$newConversation = $api->createConversation(1, [
    'customer_name' => 'John Doe',
    'customer_email' => 'john@example.com',
    'channel' => 'web',
    'initial_message' => 'Looking for a new car'
]);

echo "Created conversation with ID: " . $newConversation['id'];
?>
```

### Webhook Integration

#### Webhook Endpoint Example (Node.js/Express)
```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Webhook secret for signature verification
const WEBHOOK_SECRET = 'your-webhook-secret';

// Verify webhook signature
function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Webhook endpoint
app.post('/webhooks/cleanrylie', (req, res) => {
  const signature = req.headers['x-cleanrylie-signature'];
  const payload = JSON.stringify(req.body);

  // Verify signature
  if (!verifySignature(payload, signature)) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  // Handle different event types
  switch (event.type) {
    case 'conversation.created':
      console.log('New conversation created:', event.data);
      // Handle new conversation
      break;

    case 'conversation.escalated':
      console.log('Conversation escalated:', event.data);
      // Notify sales team
      break;

    case 'message.received':
      console.log('New message received:', event.data);
      // Process incoming message
      break;

    case 'lead.created':
      console.log('New lead created:', event.data);
      // Add to CRM system
      break;

    default:
      console.log('Unknown event type:', event.type);
  }

  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});
```

---

## Support & Resources

### Getting Help
- **Documentation**: Complete API documentation at `/api/docs`
- **Support Email**: api-support@cleanrylie.com
- **Developer Portal**: https://developers.cleanrylie.com
- **Status Page**: https://status.cleanrylie.com

### SDKs & Libraries
- **JavaScript/Node.js**: `npm install @cleanrylie/api-client`
- **Python**: `pip install cleanrylie-api`
- **PHP**: Available via Composer
- **Ruby**: `gem install cleanrylie-api`

### Testing
- **Sandbox Environment**: https://sandbox-api.cleanrylie.com
- **Test API Keys**: Available in developer portal
- **Postman Collection**: Import from developer portal

---

**This documentation is continuously updated. For the latest version, visit the developer portal or check the API documentation endpoint.**
```
