# CleanRylie System Architecture Reference

This document provides a comprehensive technical reference for the CleanRylie AI platform architecture, designed for developers, system integrators, and technical stakeholders.

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [System Components](#system-components)
3. [Data Flow & Communication](#data-flow--communication)
4. [Database Architecture](#database-architecture)
5. [API Architecture](#api-architecture)
6. [Security Model](#security-model)
7. [Integration Points](#integration-points)
8. [Performance Architecture](#performance-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Scaling Considerations](#scaling-considerations)
11. [Monitoring & Observability](#monitoring--observability)

## Architectural Overview

CleanRylie follows a modern, enterprise-grade full-stack architecture with strong emphasis on multi-tenancy, security, and performance.

### High-Level Architecture

The system implements a **multi-tier, multi-tenant architecture**:

1. **Presentation Layer**: React 18 SPA with TypeScript and modern tooling
2. **API Gateway Layer**: Express.js with comprehensive middleware stack
3. **Business Logic Layer**: Service-oriented architecture with domain separation
4. **Data Access Layer**: Drizzle ORM v2 with optimized query patterns
5. **Data Storage Layer**: PostgreSQL with multi-tenant isolation
6. **Caching Layer**: Redis with in-memory fallback
7. **External Services Layer**: AI, email, SMS, and third-party integrations

### Core Technologies

#### **Frontend Stack**

- **React 18**: Modern React with concurrent features and hooks
- **TypeScript**: Full type safety across the application
- **Vite**: Fast build tool and development server
- **TanStack Query**: Advanced data fetching, caching, and synchronization
- **Wouter**: Lightweight, hook-based routing
- **Shadcn/UI**: Modern component library built on Radix UI primitives
- **TailwindCSS**: Utility-first CSS framework with custom design system
- **Framer Motion**: Smooth animations and micro-interactions

#### **Backend Stack**

- **Node.js 20+**: Latest LTS with ES modules and performance optimizations
- **Express.js**: Web application framework with extensive middleware ecosystem
- **TypeScript**: Type-safe server-side development with strict configuration
- **Drizzle ORM v2**: Modern TypeScript ORM with excellent performance and type safety
- **PostgreSQL 13+**: Advanced relational database with JSONB and full-text search
- **Redis**: High-performance caching and session storage
- **WebSocket (ws)**: Real-time bidirectional communication

#### **AI & External Services**

- **OpenAI GPT-4**: Advanced language model for conversation generation
- **SendGrid**: Enterprise email delivery with template management
- **Twilio**: SMS and voice communication services
- **IMAP**: Email processing for automated lead import (ADF format)

## System Components

### Frontend Architecture

#### **Component Hierarchy**

```
App (Root)
├── Router (Wouter)
├── QueryClient Provider (TanStack Query)
├── Theme Provider (next-themes)
└── Layout Components
    ├── Navigation
    ├── Sidebar
    ├── Main Content Area
    └── Notification System
```

#### **Core UI Components**

- **Design System**: Shadcn/UI components with custom theming
- **Data Fetching**: TanStack Query with optimistic updates and background sync
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for analytics and reporting
- **Real-time**: WebSocket integration for live updates
- **Accessibility**: ARIA compliance and keyboard navigation

#### **Primary Application Views**

- **Dashboard**: Real-time metrics, recent activity, and quick actions
- **Conversations**: Multi-channel conversation management with AI assistance
- **Inventory**: Vehicle inventory with advanced search and filtering
- **Leads**: Lead management with automated scoring and routing
- **Analytics**: Comprehensive reporting and business intelligence
- **Admin**: System administration and configuration
- **Settings**: User preferences and dealership configuration

#### **State Management Strategy**

- **Server State**: TanStack Query for API data with intelligent caching
- **Client State**: React hooks (useState, useReducer) for local component state
- **Global State**: React Context for theme, user session, and app-wide settings
- **Persistent State**: LocalStorage for user preferences and session data
- **Real-time State**: WebSocket integration for live conversation updates

### Backend Architecture

#### **Layered Service Architecture**

```
HTTP Request
├── Middleware Stack
│   ├── CORS & Security Headers
│   ├── Rate Limiting (Tiered)
│   ├── Authentication (JWT/Session)
│   ├── Authorization (RBAC)
│   ├── Tenant Context
│   ├── Request Validation (Zod)
│   └── Error Handling
├── Route Handlers
├── Service Layer
│   ├── Business Logic
│   ├── External Integrations
│   └── Data Transformation
├── Data Access Layer (Drizzle ORM)
└── Database (PostgreSQL)
```

#### **API Layer Design**

- **RESTful Architecture**: Resource-oriented design with consistent patterns
- **OpenAPI Documentation**: Comprehensive API documentation with Swagger
- **Versioning Strategy**: URL-based versioning for backward compatibility
- **Response Normalization**: Consistent response format across all endpoints
- **Error Handling**: Standardized error responses with detailed context

#### **Middleware Stack**

- **Security**: CORS, CSRF protection, security headers
- **Authentication**: JWT token validation and session management
- **Authorization**: Role-based access control with dealership isolation
- **Validation**: Comprehensive input validation using Zod schemas
- **Logging**: Structured logging with request tracing and performance metrics
- **Rate Limiting**: Multi-tier rate limiting (IP, user, API key based)
- **Caching**: Response caching with intelligent invalidation

#### **Service Layer Organization**

- **Domain Services**: Business logic organized by domain (conversations, inventory, leads)
- **Integration Services**: External service wrappers (OpenAI, SendGrid, Twilio)
- **Utility Services**: Cross-cutting concerns (email, SMS, file processing)
- **Background Services**: Scheduled tasks and queue processing

### AI & Machine Learning Components

#### **OpenAI Integration Architecture**

```
Customer Message
├── Context Assembly
│   ├── Conversation History
│   ├── Customer Profile
│   ├── Dealership Configuration
│   └── Inventory Context
├── Prompt Engineering
│   ├── System Prompts
│   ├── Persona Templates
│   ├── A/B Test Variants
│   └── Dynamic Context Injection
├── OpenAI API Call
│   ├── GPT-4 Model
│   ├── Streaming Response
│   ├── Error Handling
│   └── Fallback Mechanisms
└── Response Processing
    ├── Content Filtering
    ├── Intent Detection
    ├── Handover Triggers
    └── Response Storage
```

#### **A/B Testing & Experimentation**

- **Experiment Management**: Create and manage prompt experiments
- **Traffic Allocation**: Intelligent user segmentation and variant assignment
- **Metrics Collection**: Comprehensive performance and engagement metrics
- **Statistical Analysis**: Automated significance testing and reporting
- **Variant Management**: Dynamic prompt template switching

#### **Conversation Intelligence**

- **Intent Recognition**: Automated classification of customer intents
- **Sentiment Analysis**: Real-time sentiment tracking and escalation triggers
- **Context Management**: Intelligent conversation context preservation
- **Handover Detection**: Smart escalation to human agents
- **Response Optimization**: Continuous improvement based on performance data

### Real-Time Communication

#### **WebSocket Architecture**

```
Client Connection
├── Authentication & Authorization
├── Connection Management
│   ├── Connection Pooling
│   ├── Heartbeat Monitoring
│   ├── Automatic Reconnection
│   └── Load Balancing
├── Message Routing
│   ├── Conversation Channels
│   ├── User Presence
│   ├── Typing Indicators
│   └── Broadcast Messages
└── Event Handling
    ├── Message Events
    ├── Status Updates
    ├── Notification Events
    └── System Events
```

## Data Flow & Communication

### **Multi-Channel Conversation Flow**

#### **Inbound Message Processing**

1. **Message Reception**: Multi-channel message ingestion (SMS, email, web chat)
2. **Authentication & Routing**: Channel validation and dealership routing
3. **Context Assembly**: Conversation history, customer profile, and dealership context
4. **AI Processing**: OpenAI integration with persona-specific prompts
5. **Response Generation**: AI response with intent detection and handover logic
6. **Multi-Channel Delivery**: Response delivery via appropriate channel
7. **Real-Time Updates**: WebSocket notifications to connected clients

#### **Human Handover Flow**

1. **Trigger Detection**: AI confidence threshold, keyword detection, or manual request
2. **Context Preparation**: Comprehensive conversation summary and customer dossier
3. **Agent Notification**: Real-time notification to available agents
4. **Seamless Transition**: Context transfer with full conversation history
5. **Collaborative Mode**: AI assistance during human-led conversations

#### **Automated Lead Processing (ADF)**

1. **Email Monitoring**: IMAP-based email listening for ADF attachments
2. **ADF Parsing**: XML parsing and validation against ADF schema
3. **Lead Enrichment**: Customer profile creation and vehicle interest matching
4. **Intelligent Routing**: Lead assignment based on dealership rules and agent availability
5. **Follow-up Automation**: Automated initial contact and nurture sequences

## Database Architecture

### **Multi-Tenant Database Design**

CleanRylie implements a **shared database, shared schema** multi-tenancy model with **dealership-based isolation** enforced at the application layer.

#### **Core Design Principles**

- **Tenant Isolation**: All data access filtered by `dealership_id`
- **Performance Optimization**: Optimized indexes for multi-tenant queries
- **Data Integrity**: Foreign key constraints with cascade rules
- **Audit Trail**: Comprehensive audit logging for compliance
- **Scalability**: Designed for horizontal scaling with read replicas

### **Schema Overview**

#### **Core Entities Hierarchy**

```
Dealerships (Tenant Root)
├── Users (Staff & Admins)
├── Vehicles (Inventory)
├── Customers (Lead Sources)
├── Conversations (Multi-Channel)
│   └── Messages (Conversation History)
├── Leads (Sales Pipeline)
├── Personas (AI Configuration)
└── API Keys (Integration Access)
```

### **Key Database Tables**

#### **Dealerships (Multi-Tenant Root)**

```sql
CREATE TABLE dealerships (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) NOT NULL UNIQUE,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  -- Branding & Configuration
  logo_url VARCHAR(255),
  primary_color VARCHAR(20) DEFAULT '#000000',
  secondary_color VARCHAR(20) DEFAULT '#ffffff',
  -- AI Configuration
  ai_config JSONB DEFAULT '{}',
  -- Agent Configuration
  agent_config JSONB DEFAULT '{}',
  -- Operational Settings
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  business_hours JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Users (Role-Based Access)**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255), -- bcrypt hashed
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user', -- super_admin, dealership_admin, manager, user
  dealership_id INTEGER REFERENCES dealerships(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Optimized indexes for multi-tenant queries
CREATE INDEX user_dealership_idx ON users(dealership_id);
CREATE INDEX user_email_idx ON users(email);
```

#### **Vehicles (Inventory Management)**

```sql
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  vin VARCHAR(17) NOT NULL,
  stock_number VARCHAR(50),
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  trim VARCHAR(100),
  body_style VARCHAR(50),
  ext_color VARCHAR(50),
  int_color VARCHAR(50),
  mileage INTEGER DEFAULT 0,
  engine VARCHAR(100),
  transmission VARCHAR(50),
  drivetrain VARCHAR(20),
  fuel_type VARCHAR(20),
  fuel_economy INTEGER,
  msrp DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'Available',
  certified BOOLEAN DEFAULT false,
  description TEXT,
  features JSONB, -- Flexible feature storage
  images JSONB,   -- Image URLs and metadata
  video_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure VIN uniqueness per dealership
  CONSTRAINT unique_vin UNIQUE (dealership_id, vin)
);

-- Performance indexes
CREATE INDEX vehicle_dealership_idx ON vehicles(dealership_id);
CREATE INDEX vehicle_search_idx ON vehicles(dealership_id, make, model, year);
CREATE INDEX vehicle_status_idx ON vehicles(dealership_id, status);
```

#### **Conversations (Multi-Channel Communication)**

```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  channel VARCHAR(20) NOT NULL DEFAULT 'web', -- web, sms, email, phone
  status VARCHAR(20) DEFAULT 'active', -- active, escalated, closed, archived
  assigned_to INTEGER REFERENCES users(id),
  escalated_at TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT NOW(),
  -- Context and metadata
  campaign_context TEXT,
  inventory_context JSONB,
  customer_context JSONB,
  ai_context JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes for conversation queries
CREATE INDEX conversation_dealership_idx ON conversations(dealership_id);
CREATE INDEX conversation_status_idx ON conversations(dealership_id, status);
CREATE INDEX conversation_assigned_idx ON conversations(assigned_to);
CREATE INDEX conversation_customer_idx ON conversations(customer_id);
```

#### **Messages (Conversation History)**

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_from_customer BOOLEAN NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'web',
  message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
  -- AI and processing metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_model VARCHAR(50),
  ai_confidence DECIMAL(3,2),
  processing_time_ms INTEGER,
  -- Message metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for message retrieval
CREATE INDEX message_conversation_idx ON messages(conversation_id);
CREATE INDEX message_created_idx ON messages(conversation_id, created_at);
```

#### **Personas (AI Configuration)**

```sql
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  -- AI Configuration
  prompt_template TEXT NOT NULL,
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  -- Persona behavior
  personality_traits JSONB,
  response_style JSONB,
  escalation_triggers JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure only one default persona per dealership
  CONSTRAINT unique_default_persona UNIQUE (dealership_id, is_default)
    DEFERRABLE INITIALLY DEFERRED
);
```

### **A/B Testing & Experimentation Tables**

```sql
CREATE TABLE prompt_experiments (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hypothesis TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  traffic_percentage INTEGER DEFAULT 50 CHECK (traffic_percentage BETWEEN 1 AND 100),
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, completed, cancelled
  primary_metric VARCHAR(100) NOT NULL,
  secondary_metrics JSONB,
  -- Statistical configuration
  confidence_level DECIMAL(3,2) DEFAULT 0.95,
  minimum_sample_size INTEGER DEFAULT 100,
  -- Results
  results JSONB,
  winner_variant_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE experiment_variants (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES prompt_experiments(id) ON DELETE CASCADE,
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  name VARCHAR(255) NOT NULL,
  is_control BOOLEAN DEFAULT false,
  traffic_percentage INTEGER DEFAULT 50,
  -- Performance metrics
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  handover_rate DECIMAL(5,4),
  customer_satisfaction DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE prompt_metrics (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES messages(id),
  experiment_id INTEGER NOT NULL REFERENCES prompt_experiments(id),
  variant_id INTEGER NOT NULL REFERENCES experiment_variants(id),
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Authentication & Security Tables**

```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]', -- Array of permission strings
  rate_limit_tier VARCHAR(20) DEFAULT 'standard', -- standard, premium, enterprise
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX idx_session_expire ON sessions(expire);
CREATE INDEX idx_api_key_dealership ON api_keys(dealership_id);
```

### **Audit & Compliance Tables**

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER REFERENCES dealerships(id),
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX audit_dealership_idx ON audit_logs(dealership_id);
CREATE INDEX audit_user_idx ON audit_logs(user_id);
CREATE INDEX audit_action_idx ON audit_logs(action);
CREATE INDEX audit_created_idx ON audit_logs(created_at);
```

## API Architecture

### **RESTful API Design**

CleanRylie implements a comprehensive RESTful API following industry best practices and OpenAPI 3.0 specification.

#### **Core Design Principles**

- **Resource-Oriented**: Clear resource hierarchy with logical URL patterns
- **HTTP Semantics**: Proper use of HTTP methods and status codes
- **Stateless**: Each request contains all necessary information
- **Cacheable**: Appropriate cache headers for performance optimization
- **Layered**: Clean separation between API gateway, business logic, and data layers
- **Uniform Interface**: Consistent patterns across all endpoints

#### **URL Structure & Conventions**

```
Base URL: https://api.cleanrylie.com/v1

Resource Patterns:
├── /dealerships/{id}                    # Dealership management
├── /dealerships/{id}/users              # User management
├── /dealerships/{id}/vehicles           # Inventory management
├── /dealerships/{id}/conversations      # Conversation management
├── /dealerships/{id}/leads              # Lead management
├── /dealerships/{id}/personas           # AI persona configuration
├── /dealerships/{id}/analytics          # Analytics and reporting
└── /admin                               # System administration
```

### **Authentication & Authorization**

#### **Multi-Method Authentication**

1. **JWT Token Authentication** (Primary)

   ```http
   Authorization: Bearer <jwt-token>
   ```

   - Stateless authentication for API clients
   - Short-lived access tokens with refresh token rotation
   - Role and permission claims embedded in token

2. **API Key Authentication** (Integration)

   ```http
   X-API-Key: <api-key>
   ```

   - For third-party integrations and webhooks
   - Dealership-scoped with configurable permissions
   - Rate limiting and usage tracking

3. **Session Authentication** (Web UI)
   ```http
   Cookie: session=<session-id>
   ```
   - Browser-based authentication with CSRF protection
   - Secure, HTTP-only cookies with SameSite protection

#### **Role-Based Access Control (RBAC)**

```
Roles Hierarchy:
├── super_admin          # System-wide access
├── dealership_admin     # Full dealership access
├── manager             # Dealership management access
├── user                # Standard user access
└── api                 # Programmatic access
```

### **Request/Response Patterns**

#### **Standardized Response Format**

```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "has_more": true
    }
  }
}
```

#### **Error Response Format**

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

### **Rate Limiting & Throttling**

#### **Tiered Rate Limiting**

```
Rate Limit Tiers:
├── Public Endpoints:     100 requests/hour per IP
├── Authenticated Users:  1000 requests/hour per user
├── API Keys (Standard):  5000 requests/hour per key
├── API Keys (Premium):   20000 requests/hour per key
└── API Keys (Enterprise): 100000 requests/hour per key
```

#### **Rate Limit Headers**

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
X-RateLimit-Retry-After: 3600
```

## Security Model

### **Multi-Layered Security Architecture**

CleanRylie implements defense-in-depth security with multiple layers of protection.

#### **Authentication Security**

- **JWT Token Security**: RS256 algorithm with rotating keys
- **Password Security**: bcrypt hashing with configurable rounds
- **Session Security**: Secure, HTTP-only cookies with SameSite protection
- **API Key Security**: Cryptographically secure key generation with expiration
- **Multi-Factor Authentication**: TOTP support for enhanced security

#### **Authorization & Access Control**

```
Permission Matrix:
                    │ Read │ Write │ Delete │ Admin │
├─ super_admin      │  ✓   │   ✓   │   ✓    │   ✓   │
├─ dealership_admin │  ✓   │   ✓   │   ✓    │   ✓*  │ (* dealership scope)
├─ manager          │  ✓   │   ✓   │   ✗    │   ✗   │
├─ user             │  ✓   │   ✓*  │   ✗    │   ✗   │ (* own data only)
└─ api              │  ✓*  │   ✓*  │   ✗    │   ✗   │ (* configured scope)
```

#### **Data Protection & Privacy**

- **Encryption at Rest**: AES-256 encryption for sensitive data
- **Encryption in Transit**: TLS 1.3 for all communications
- **PII Protection**: Automatic detection and masking of sensitive data
- **Data Anonymization**: Customer data anonymization for analytics
- **GDPR Compliance**: Right to be forgotten and data portability
- **CCPA Compliance**: California privacy rights implementation

#### **Application Security**

- **Input Validation**: Comprehensive Zod schema validation
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **XSS Prevention**: Content Security Policy and output encoding
- **CSRF Protection**: Double-submit cookie pattern
- **CORS Configuration**: Strict origin validation
- **Security Headers**: Comprehensive security header implementation

#### **Infrastructure Security**

- **Network Security**: VPC isolation and security groups
- **Database Security**: Connection encryption and access controls
- **Secrets Management**: Environment-based secret management
- **Audit Logging**: Comprehensive audit trail for all actions
- **Intrusion Detection**: Automated threat detection and response

### **Compliance & Governance**

#### **Data Governance**

- **Data Classification**: Automatic data sensitivity classification
- **Retention Policies**: Automated data lifecycle management
- **Access Monitoring**: Real-time access pattern analysis
- **Compliance Reporting**: Automated compliance report generation

#### **Security Monitoring**

- **Real-time Monitoring**: Continuous security event monitoring
- **Anomaly Detection**: ML-based anomaly detection for unusual patterns
- **Incident Response**: Automated incident response workflows
- **Vulnerability Management**: Regular security assessments and updates

## Performance Architecture

### **Performance Requirements & SLAs**

#### **Response Time Requirements**

- **API Endpoints**: < 1 second response time under 50 concurrent users
- **WebSocket Connections**: < 500ms latency for real-time features
- **Database Queries**: < 2 seconds for complex analytical queries
- **AI Response Generation**: < 3 seconds for OpenAI API calls
- **File Uploads**: < 30 seconds for inventory imports

#### **Throughput Requirements**

- **Concurrent Users**: Support for 100+ concurrent users per dealership
- **API Requests**: 10,000+ requests per hour per dealership
- **WebSocket Connections**: 500+ concurrent connections
- **Message Processing**: 1,000+ messages per minute
- **Database Operations**: 10,000+ queries per minute

### **Performance Optimization Strategies**

#### **Database Performance**

```sql
-- Optimized indexes for multi-tenant queries
CREATE INDEX CONCURRENTLY idx_conversations_dealership_status
  ON conversations(dealership_id, status)
  WHERE status IN ('active', 'escalated');

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY idx_vehicles_active_search
  ON vehicles(dealership_id, make, model, year)
  WHERE is_active = true;

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);
```

#### **Caching Strategy**

```
Caching Layers:
├── Browser Cache (Static Assets)
├── CDN Cache (Global Distribution)
├── Application Cache (Redis)
│   ├── Session Data (15 minutes TTL)
│   ├── User Profiles (1 hour TTL)
│   ├── Dealership Config (24 hours TTL)
│   └── Vehicle Inventory (30 minutes TTL)
├── Database Query Cache (PostgreSQL)
└── ORM Query Cache (Drizzle)
```

#### **Real-Time Performance**

- **WebSocket Connection Pooling**: Efficient connection management
- **Message Queuing**: Redis-based message queuing for scalability
- **Event Streaming**: Real-time event streaming for live updates
- **Connection Load Balancing**: Intelligent connection distribution

## Integration Points

### **External Service Integrations**

#### **AI & Machine Learning Services**

```
OpenAI Integration:
├── Model: GPT-4 (latest)
├── API Features:
│   ├── Streaming Responses
│   ├── Function Calling
│   ├── Context Management (128k tokens)
│   └── Error Handling & Retries
├── Performance:
│   ├── Response Time: < 3 seconds
│   ├── Rate Limiting: 10,000 RPM
│   └── Fallback Mechanisms
└── Security:
    ├── API Key Rotation
    ├── Request Logging
    └── Content Filtering
```

#### **Communication Services**

```
SendGrid Email Service:
├── Transactional Emails
│   ├── Welcome & Onboarding
│   ├── Password Reset
│   ├── Handover Notifications
│   └── System Alerts
├── Marketing Emails
│   ├── Newsletter Campaigns
│   ├── Feature Announcements
│   └── Customer Surveys
├── Template Management
│   ├── Dynamic Content
│   ├── Personalization
│   └── A/B Testing
└── Analytics & Tracking
    ├── Delivery Rates
    ├── Open Rates
    └── Click-through Rates

Twilio SMS Service:
├── Two-way SMS Communication
├── Bulk Messaging
├── Delivery Tracking
├── Phone Number Management
└── Webhook Integration
```

#### **Email Processing (ADF Leads)**

```
IMAP Email Processing:
├── Gmail Integration
├── Outlook/Exchange Support
├── Automated Attachment Processing
├── ADF XML Parsing
├── Lead Enrichment
└── Error Handling & Retry Logic
```

### **Webhook & Event System**

#### **Outbound Webhooks**

```
Event Types:
├── conversation.created
├── conversation.escalated
├── conversation.closed
├── message.received
├── message.sent
├── lead.created
├── lead.updated
├── inventory.updated
└── user.activity

Webhook Configuration:
├── URL Endpoint
├── Authentication (HMAC-SHA256)
├── Retry Policy (exponential backoff)
├── Event Filtering
└── Payload Customization
```

#### **Inbound Webhooks**

```
Supported Integrations:
├── CRM Systems (Salesforce, HubSpot)
├── DMS Systems (CDK, Reynolds)
├── Inventory Feeds (AutoTrader, Cars.com)
├── Lead Sources (Facebook, Google)
└── Communication Platforms (Slack, Teams)
```

### **API Integration Capabilities**

#### **Third-Party Integration Framework**

- **Plugin Architecture**: Modular integration system
- **Custom Adapters**: Configurable data transformation
- **Rate Limiting**: Per-integration rate limiting
- **Error Handling**: Comprehensive error recovery
- **Monitoring**: Integration health monitoring
- **Documentation**: Auto-generated API documentation

## Deployment Architecture

### **Modern Cloud-Native Deployment**

CleanRylie is designed for flexible deployment across various cloud platforms with containerization and orchestration support.

#### **Deployment Options**

```
Deployment Strategies:
├── Container-Based (Docker)
│   ├── Single Container (Development)
│   ├── Multi-Container (Docker Compose)
│   └── Kubernetes (Production)
├── Platform-as-a-Service
│   ├── Vercel (Frontend)
│   ├── Railway (Full-Stack)
│   ├── Render (Full-Stack)
│   └── Heroku (Full-Stack)
└── Infrastructure-as-a-Service
    ├── AWS (ECS/EKS)
    ├── Google Cloud (GKE)
    └── Azure (AKS)
```

### **Production Infrastructure**

#### **Application Tier**

```
Load Balancer (HTTPS Termination)
├── Frontend Servers (React SPA)
│   ├── Static Asset Serving
│   ├── CDN Integration
│   └── Progressive Web App
├── API Servers (Express.js)
│   ├── Horizontal Scaling
│   ├── Health Check Endpoints
│   ├── Graceful Shutdown
│   └── Request Logging
└── WebSocket Servers
    ├── Connection Pooling
    ├── Session Affinity
    └── Real-time Communication
```

#### **Data Tier**

```
Primary Database (PostgreSQL)
├── Read Replicas (2-3 instances)
├── Connection Pooling (PgBouncer)
├── Automated Backups
├── Point-in-Time Recovery
└── Performance Monitoring

Cache Layer (Redis)
├── Session Storage
├── Application Cache
├── Rate Limiting Data
├── WebSocket Session Management
└── Background Job Queue
```

#### **External Services**

```
Third-Party Integrations:
├── OpenAI API (AI Processing)
├── SendGrid (Email Delivery)
├── Twilio (SMS Communication)
├── CDN (Static Asset Delivery)
├── Monitoring (Application Performance)
└── Logging (Centralized Logging)
```

### **Environment Configuration**

#### **Required Environment Variables**

| Variable                     | Purpose                 | Example                               |
| ---------------------------- | ----------------------- | ------------------------------------- |
| `DATABASE_URL`               | PostgreSQL connection   | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL`                  | Redis connection        | `redis://user:pass@host:6379`         |
| `OPENAI_API_KEY`             | OpenAI authentication   | `sk-...`                              |
| `SENDGRID_API_KEY`           | SendGrid authentication | `SG.xxx`                              |
| `SESSION_SECRET`             | Session encryption      | `<32-byte-secret>`                    |
| `JWT_SECRET`                 | JWT token signing       | `<32-byte-secret>`                    |
| `CREDENTIALS_ENCRYPTION_KEY` | Data encryption         | `<32-byte-secret>`                    |

#### **Optional Configuration**

| Variable             | Purpose            | Default       |
| -------------------- | ------------------ | ------------- |
| `NODE_ENV`           | Environment mode   | `development` |
| `PORT`               | Server port        | `5000`        |
| `LOG_LEVEL`          | Logging level      | `info`        |
| `TWILIO_ACCOUNT_SID` | SMS service        | -             |
| `TWILIO_AUTH_TOKEN`  | SMS authentication | -             |

## Scaling Considerations

### **Horizontal Scaling Strategy**

#### **Application Layer Scaling**

```
Scaling Approach:
├── Stateless Design
│   ├── No server-side session storage
│   ├── JWT-based authentication
│   └── Database-backed sessions
├── Load Balancing
│   ├── Round-robin distribution
│   ├── Health check integration
│   └── Session affinity for WebSockets
├── Auto-scaling
│   ├── CPU-based scaling (70% threshold)
│   ├── Memory-based scaling (80% threshold)
│   └── Request queue depth scaling
└── Container Orchestration
    ├── Kubernetes deployment
    ├── Rolling updates
    └── Blue-green deployments
```

#### **Database Scaling**

```
Database Scaling Strategy:
├── Read Replicas
│   ├── 2-3 read replicas per region
│   ├── Read-write splitting
│   └── Connection pooling
├── Vertical Scaling
│   ├── CPU and memory optimization
│   ├── Storage performance tuning
│   └── Connection limit management
├── Partitioning Strategy
│   ├── Tenant-based partitioning
│   ├── Time-based partitioning (messages)
│   └── Hash-based partitioning (large tables)
└── Caching Strategy
    ├── Query result caching
    ├── Application-level caching
    └── CDN for static content
```

### **Performance Monitoring & Optimization**

#### **Key Performance Indicators (KPIs)**

- **Response Time**: 95th percentile < 1 second
- **Throughput**: 10,000+ requests/hour per dealership
- **Error Rate**: < 0.1% for critical operations
- **Availability**: 99.9% uptime SLA
- **Database Performance**: Query time < 100ms for 95% of queries

#### **Monitoring Stack**

```
Monitoring & Observability:
├── Application Performance Monitoring
│   ├── Request tracing
│   ├── Error tracking
│   └── Performance metrics
├── Infrastructure Monitoring
│   ├── Server metrics (CPU, memory, disk)
│   ├── Database performance
│   └── Network monitoring
├── Business Metrics
│   ├── Conversation volume
│   ├── AI response quality
│   └── Customer satisfaction
└── Alerting & Notifications
    ├── Critical error alerts
    ├── Performance degradation alerts
    └── Capacity planning alerts
```

## Monitoring & Observability

### **Comprehensive Monitoring Strategy**

#### **Application Monitoring**

- **Request Tracing**: Distributed tracing for request flow analysis
- **Error Tracking**: Real-time error detection and alerting
- **Performance Metrics**: Response times, throughput, and resource utilization
- **Business Metrics**: Conversation quality, AI performance, and user engagement

#### **Infrastructure Monitoring**

- **Server Health**: CPU, memory, disk, and network monitoring
- **Database Performance**: Query performance, connection pooling, and replication lag
- **Cache Performance**: Hit rates, memory usage, and eviction patterns
- **External Service Monitoring**: API response times and error rates

#### **Security Monitoring**

- **Access Patterns**: Unusual access pattern detection
- **Authentication Events**: Failed login attempts and suspicious activity
- **Data Access**: Sensitive data access monitoring
- **Compliance Auditing**: Automated compliance report generation

### **Logging & Audit Trail**

#### **Structured Logging**

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "api-server",
  "request_id": "req_123456789",
  "user_id": "user_123",
  "dealership_id": 1,
  "action": "conversation.create",
  "resource_id": "conv_456",
  "duration_ms": 150,
  "metadata": {
    "channel": "web",
    "ai_model": "gpt-4"
  }
}
```

#### **Audit Logging**

- **User Actions**: Complete audit trail of user actions
- **Data Changes**: Before/after values for all data modifications
- **System Events**: System-level events and configuration changes
- **Compliance Reporting**: Automated compliance report generation

---

## Summary

CleanRylie represents a modern, enterprise-grade AI platform built with scalability, security, and performance in mind. The architecture supports:

- **Multi-tenant isolation** with dealership-based data segregation
- **Real-time communication** via WebSocket integration
- **AI-powered conversations** with OpenAI GPT-4 integration
- **Comprehensive security** with multiple authentication methods and audit trails
- **High performance** with sub-second response times under load
- **Flexible deployment** across various cloud platforms
- **Extensive monitoring** and observability for production operations

The system is designed to scale horizontally and vertically while maintaining data integrity, security, and performance standards required for enterprise automotive dealership operations.

---

**For technical support or architecture questions, please refer to the development team or create an issue in the project repository.**
