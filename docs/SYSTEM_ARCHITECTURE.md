# Rylie AI System Architecture Reference

This document provides a technical reference for the architecture of the Rylie AI platform, intended for developers and system integrators.

## Table of Contents
1. [Architectural Overview](#architectural-overview)
2. [System Components](#system-components)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [API Architecture](#api-architecture)
6. [Security Model](#security-model)
7. [Integration Points](#integration-points)
8. [Deployment Architecture](#deployment-architecture)
9. [Scaling Considerations](#scaling-considerations)
10. [Technical Debt & Future Improvements](#technical-debt--future-improvements)

## Architectural Overview

Rylie AI follows a modern full-stack architecture pattern with a clear separation of concerns:

![System Architecture Diagram](https://assets.rylie-ai.com/docs/system-architecture.png)

### High-Level Architecture

The system is built on a three-tier architecture:

1. **Presentation Layer**: React-based single-page application
2. **Application Layer**: Express.js API server
3. **Data Layer**: PostgreSQL database with Drizzle ORM

### Key Technologies

- **Frontend**: React, TypeScript, TanStack Query, Shadcn/UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4o integration
- **Email**: SendGrid integration
- **Authentication**: Replit Auth (OpenID Connect)
- **Hosting**: Replit with containerized deployment

## System Components

### Frontend Components

#### Core UI Components
- Single Page Application structure
- TanStack Query for data fetching and caching
- Shadcn/UI component library
- Responsive layout system
- Dark/light mode support

#### Primary Views
- Dashboard: Key metrics and recent activity
- Conversations: Real-time conversation management
- Inventory: Vehicle inventory management
- Personas: AI persona configuration
- Analytics: Performance reporting
- Settings: System configuration

#### State Management
- React Query for server state
- Local state with React hooks
- Context API for global state
- LocalStorage for persisted preferences

### Backend Components

#### API Layer
- RESTful API architecture
- Express.js routing and middleware
- Input validation with Zod schemas
- Controller organization by domain
- Response normalization

#### Middleware
- Authentication and authorization
- Request validation
- Error handling
- Logging
- CORS configuration

#### Service Layer
- Business logic separation
- AI service integration
- Email service integration
- Import/Export services
- Report generation

#### Storage Layer
- Database abstraction (Storage interface)
- Query construction
- Transaction management
- Connection pooling
- Migration handling

### AI Components

#### OpenAI Integration
- Model configuration (GPT-4o)
- Prompt engineering system
- Context building
- Response parsing
- Error handling with fallbacks

#### A/B Testing System
- Experiment configuration
- Variant management
- Traffic allocation
- Metrics collection
- Statistical analysis

#### Conversation Management
- Message history management
- Context preparation
- Handover logic
- Intent detection
- Response generation

## Data Flow

### Customer Conversation Flow

1. Customer sends a message through a channel (SMS, Chat, etc.)
2. Message is received by the API and stored in the database
3. Conversation context is assembled (message history, customer info, dealership info)
4. If applicable, inventory matching is performed based on message content
5. Context is sent to OpenAI with the appropriate prompt template
6. AI generates a response, which is stored in the database
7. Response is sent back to the customer
8. If AI detects a need for human intervention, handover process is initiated

### Handover Flow

1. AI or system detects need for handover (via keyword, intent, or explicit request)
2. Conversation status is updated to "escalated"
3. Handover dossier is generated with conversation summary and customer details
4. Dossier is sent via email to the appropriate recipient(s)
5. Response to customer acknowledges the handover and sets expectations
6. Conversation remains accessible in the dashboard for human continuation

### Inventory Update Flow

1. Inventory TSV file is sent via email to the designated address
2. Email listener service detects the email and extracts the attachment
3. File is parsed and validated against the expected schema
4. Vehicle data is transformed to match the internal data model
5. Database is updated with new and modified vehicles
6. Vehicles not in the import but in the database are marked as "Not Available"
7. Import summary is generated and emailed to the dealership

## Database Schema

The database uses a relational PostgreSQL schema with the following key entities:

### Core Entities

#### Users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  profile_image_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  dealership_id INTEGER REFERENCES dealerships(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Dealerships
```sql
CREATE TABLE dealerships (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  domain TEXT,
  handover_email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Vehicles
```sql
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  vin TEXT NOT NULL,
  stock_number TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  trim TEXT,
  body_style TEXT,
  ext_color TEXT,
  int_color TEXT,
  mileage INTEGER NOT NULL DEFAULT 0,
  engine TEXT,
  transmission TEXT,
  drivetrain TEXT,
  fuel_type TEXT,
  fuel_economy INTEGER,
  msrp NUMERIC,
  sale_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'Available',
  certified BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  features JSONB,
  images JSONB,
  video_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_import_id INTEGER
);
```

#### Conversations
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  campaign_context TEXT,
  inventory_context TEXT,
  status conversation_status NOT NULL DEFAULT 'active',
  assigned_to INTEGER REFERENCES users(id),
  escalated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Messages
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  content TEXT NOT NULL,
  is_from_customer BOOLEAN NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Personas
```sql
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  prompt_template TEXT NOT NULL,
  arguments JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### A/B Testing Tables

```sql
CREATE TABLE prompt_experiments (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  traffic_percentage INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_metric TEXT NOT NULL,
  secondary_metrics JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE experiment_variants (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES prompt_experiments(id),
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  is_control BOOLEAN NOT NULL DEFAULT false,
  traffic_percentage INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_metrics (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  message_id INTEGER NOT NULL REFERENCES messages(id),
  experiment_id INTEGER NOT NULL REFERENCES prompt_experiments(id),
  variant_id INTEGER NOT NULL REFERENCES experiment_variants(id),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### API Key Authentication

```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  dealership_id INTEGER NOT NULL REFERENCES dealerships(id),
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  last_used TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Session Management

```sql
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IDX_session_expire ON sessions (expire);
```

## API Architecture

### API Design Principles

- RESTful resource-oriented design
- Consistent URL patterns
- HTTP verb semantics (GET, POST, PUT, DELETE)
- JSON response format
- Status codes for error handling
- Versioning through URL prefix
- Pagination for collection endpoints
- Filtering and sorting parameters

### Authentication Methods

The API supports two authentication methods:

1. **API Key Authentication**:
   - For machine-to-machine communication
   - API key passed in `X-API-Key` header
   - Associated with a specific dealership
   - Scoped permissions based on key

2. **Session Authentication**:
   - For user interface access
   - Cookie-based sessions via Replit Auth
   - User identity and permissions
   - CSRF protection

### Rate Limiting

- Per-IP rate limiting for public endpoints
- Per-API key rate limiting for authenticated endpoints
- Tiered limits based on client type
- Exponential backoff for repeated violations

### Error Handling

Standardized error response format:

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "status": 400,
  "details": {
    "field": "The field with the issue",
    "reason": "Specific reason for rejection"
  }
}
```

## Security Model

### Authentication Security

- OAuth 2.0 / OpenID Connect with Replit Auth
- Secure session management with encrypted cookies
- API key rotation and revocation
- Password-less authentication

### Authorization Model

Role-based access control with the following roles:
- **Admin**: Full system access
- **Manager**: Dealership-wide access
- **Sales**: Access to conversations and customer data
- **Service**: Limited access to service-related functionality
- **API**: Programmatic access via API keys

Each role has specific permissions for:
- Read access
- Write access
- Delete access
- Administrative functions

### Data Security

- All sensitive data encrypted at rest
- TLS encryption for data in transit
- PII handling compliant with GDPR and CCPA
- Data retention policies
- Data access logging

### API Security

- CORS configuration
- Content Security Policy
- Rate limiting to prevent abuse
- Input validation to prevent injection attacks
- Output encoding to prevent XSS

## Integration Points

### External Service Integrations

The system integrates with several external services:

1. **OpenAI**:
   - GPT-4o for conversation generation
   - Uses streaming API for real-time responses
   - Error handling and fallback mechanisms

2. **SendGrid**:
   - Email notifications
   - Handover dossier delivery
   - Report distribution
   - Template management

3. **Replit Auth**:
   - User authentication
   - Profile management
   - Session handling

### Extension Points

The system provides several extension points for custom integrations:

1. **Webhook Notifications**:
   - Conversation events
   - Inventory updates
   - Handover events

2. **Custom Data Processors**:
   - Inventory import adapters
   - Message formatters
   - Custom metrics collectors

3. **External System Connectors**:
   - CRM integration hooks
   - DMS integration points
   - Analytics platform connectors

## Deployment Architecture

### Infrastructure Components

The application is deployed on Replit with the following components:

1. **Web Server**:
   - Node.js Express application
   - Serves both API and static assets
   - WebSocket support for real-time features

2. **Database**:
   - PostgreSQL database
   - Connection pooling
   - Automated backups
   - Point-in-time recovery

3. **Caching Layer**:
   - In-memory caching for high-frequency data
   - Query result caching
   - Session data caching

4. **Background Workers**:
   - Scheduled tasks execution
   - Report generation
   - Data processing jobs
   - Email sending queue

### Environment Configuration

The system uses environment variables for configuration:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API authentication |
| `SENDGRID_API_KEY` | SendGrid API authentication |
| `SESSION_SECRET` | Session encryption secret |
| `REPLIT_DOMAINS` | Allowed domains for auth |
| `NODE_ENV` | Environment (development/production) |

## Scaling Considerations

### Performance Optimizations

- Database query optimization
- Response caching
- Asset compression and CDN delivery
- API response pagination
- Lazy loading of resources

### Horizontal Scaling

- Stateless API design for multiple instances
- Database connection pooling
- Session storage in database for shared state
- Message queue for background tasks

### Vertical Scaling

- Database resource allocation
- Memory optimization
- CPU utilization monitoring
- Storage scaling for inventory data

## Technical Debt & Future Improvements

### Current Technical Debt

- Some API endpoints need additional input validation
- Test coverage could be improved in certain areas
- Performance optimization for large inventory imports
- Enhanced monitoring and logging infrastructure

### Planned Improvements

1. **Architecture Enhancements**:
   - Migrate to microservices for key components
   - Implement GraphQL API alongside REST
   - Enhance real-time capabilities with WebSockets

2. **Performance Improvements**:
   - Implement Redis caching layer
   - Optimize database indexing strategy
   - Image processing optimizations

3. **Developer Experience**:
   - Expanded API documentation
   - Enhanced development environment
   - Additional testing helpers

---

For additional technical documentation or questions, contact the Rylie AI development team at dev-support@rylie-ai.com