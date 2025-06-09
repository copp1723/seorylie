# CleanRylie Project Structure

## Overview

CleanRylie is a full-stack automotive dealership AI assistant platform built with React (Frontend), Node.js/Express (Backend), and PostgreSQL (Database). The application provides intelligent conversation management, lead tracking, and dealership operations automation.

## Repository Structure

```
cleanrylie/
├── 📁 client/                    # Frontend React application
├── 📁 server/                    # Backend Node.js/Express application
├── 📁 shared/                    # Shared types and schemas
├── 📁 docs/                      # Project documentation
├── 📁 migrations/                # Database migration scripts
├── 📁 scripts/                   # Build and utility scripts
├── 📁 test/                      # Test files and utilities
├── 📁 monitoring/                # Observability and monitoring
├── 📁 etl/                       # Data ETL processes
├── 📁 helm/                      # Kubernetes/Helm charts
├── 📁 cypress/                   # E2E testing
├── 📄 package.json               # Project dependencies
├── 📄 docker-compose.*.yml       # Docker configuration
├── 📄 Dockerfile                 # Container definition
└── 📄 README.md                  # Project overview
```

## 🎯 Frontend (`/client`)

### Structure

```
client/
├── src/
│   ├── components/               # React components
│   │   ├── ui/                  # Base UI components (shadcn/ui)
│   │   ├── auth/                # Authentication components
│   │   ├── chat/                # Chat interface components
│   │   ├── dashboard/           # Dashboard components
│   │   ├── forms/               # Form components
│   │   ├── layout/              # Layout components
│   │   ├── admin/               # Admin-specific components
│   │   └── [feature]/           # Feature-specific components
│   ├── hooks/                   # Custom React hooks
│   ├── pages/                   # Page components/routes
│   ├── contexts/                # React context providers
│   ├── lib/                     # Client utilities
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Helper functions
├── public/                      # Static assets
└── dist/                        # Build output
```

### Key Technologies

- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router
- **Build Tool**: Vite
- **Testing**: Jest + React Testing Library

### Component Organization

#### UI Components (`/client/src/components/ui/`)

Base design system components following shadcn/ui patterns:

- Form controls (Button, Input, Select, etc.)
- Layout components (Card, Dialog, Sheet, etc.)
- Feedback components (Toast, Alert, Progress, etc.)

#### Feature Components

Organized by domain:

- `auth/` - Authentication flows
- `chat/` - Conversation interfaces
- `dashboard/` - Analytics and overview
- `admin/` - Administrative interfaces
- `inventory/` - Vehicle management

#### Pages (`/client/src/pages/`)

Route-level components:

- Authentication pages
- Dashboard views
- Administrative interfaces
- Feature-specific pages

### Custom Hooks (`/client/src/hooks/`)

Reusable logic abstraction:

- `useAuth.ts` - Authentication state management
- `useLocalStorage.ts` - Browser storage utilities
- `useDebounce.ts` - Input debouncing
- `useNotifications.tsx` - Notification system

## 🔧 Backend (`/server`)

### Structure

```
server/
├── routes/                      # API route handlers
├── services/                    # Business logic layer
├── middleware/                  # Express middleware
├── utils/                       # Server utilities
├── controllers/                 # Request/response handling
├── types/                       # TypeScript definitions
├── templates/                   # Email/message templates
├── observability/               # Monitoring and tracing
└── standalone-routes/           # Isolated route handlers
```

### Key Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT + Magic Links
- **Caching**: Redis
- **File Storage**: Local filesystem + cloud storage
- **Monitoring**: Prometheus + Grafana
- **API Documentation**: OpenAPI/Swagger

### Service Layer (`/server/services/`)

Domain-driven service organization:

- `conversation-service.ts` - Chat and messaging logic
- `lead-service.ts` - Lead management and scoring
- `auth-service.ts` - Authentication and authorization
- `notification-service.ts` - Multi-channel notifications
- `inventory-service.ts` - Vehicle inventory management

### Routes (`/server/routes/`)

RESTful API endpoints:

- `auth-routes.ts` - Authentication endpoints
- `conversation-api.ts` - Chat and messaging API
- `lead-api-routes.ts` - Lead management
- `admin-routes.ts` - Administrative functions
- `monitoring-routes.ts` - Health and metrics

### Middleware (`/server/middleware/`)

Request processing pipeline:

- `auth.ts` - Authentication verification
- `rate-limit.ts` - API rate limiting
- `validation.ts` - Request validation
- `feature-flags.ts` - Feature flag evaluation
- `tenant-context.ts` - Multi-tenant isolation

## 🗄️ Database (`/migrations`)

### Migration Structure

```
migrations/
├── 0001_initial_schema.sql           # Base tables
├── 0002_lead_management.sql          # Lead tracking
├── 0003_conversation_system.sql      # Chat functionality
├── 0004_auth_improvements.sql        # Authentication
├── 0005_multi_tenant.sql             # Multi-tenancy
└── [timestamp]_[description].sql     # Future migrations
```

### Schema Organization

- **Core Tables**: Users, dealerships, configurations
- **Conversation System**: Messages, chat sessions, AI responses
- **Lead Management**: Leads, scoring, handover tracking
- **Authentication**: Sessions, magic links, JWT tokens
- **Multi-tenancy**: Row-level security policies

## 📊 Shared Code (`/shared`)

### Schema Definitions

```
shared/
├── schema.ts                    # Core database schema
├── enhanced-schema.ts           # Extended schemas
├── lead-management-schema.ts    # Lead-specific schemas
├── adf-schema.ts               # ADF (Auto Data Format) schemas
├── api-schemas.ts              # API request/response schemas
├── schema-extensions.ts         # Schema utilities
└── index.ts                    # Centralized exports
```

### Purpose

- **Type Safety**: Shared TypeScript interfaces
- **Validation**: Zod schemas for runtime validation
- **API Contracts**: Request/response type definitions
- **Database Models**: ORM schema definitions

## 🧪 Testing (`/test`)

### Test Organization

```
test/
├── unit/                       # Unit tests
├── integration/                # Integration tests
├── e2e/                       # End-to-end tests
├── load/                      # Performance tests
├── fixtures/                  # Test data
├── helpers/                   # Test utilities
└── setup/                     # Test configuration
```

### Testing Strategy

- **Unit Tests**: Individual function/component testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user journey testing (Cypress)
- **Load Tests**: Performance and scalability testing

## 🐳 Deployment (`/docker-compose.*.yml`)

### Environment Configurations

- `docker-compose.platform.yml` - Main application stack
- `docker-compose.monitoring.yml` - Observability stack

### Container Strategy

- **Application**: Node.js container for server
- **Frontend**: Nginx serving static React build
- **Database**: PostgreSQL with persistence
- **Cache**: Redis for session storage
- **Monitoring**: Prometheus, Grafana, Tempo

## 📝 Scripts (`/scripts`)

### Utility Scripts

```
scripts/
├── database/                   # Database utilities
├── auth/                      # Authentication setup
├── deployment/                # Deployment automation
├── testing/                   # Test runners
└── maintenance/               # Maintenance tasks
```

### Key Scripts

- `setup-database.ts` - Database initialization
- `migrate.ts` - Migration runner
- `seed-data.ts` - Test data seeding
- `health-check.ts` - System health verification

## 📚 Documentation (`/docs`)

### Documentation Structure

```
docs/
├── tickets/                   # Completed ticket summaries
├── reports/                   # Testing and analysis reports
├── CODING_STANDARDS.md        # Development guidelines
├── BRANCHING_STRATEGY.md      # Git workflow
├── PROJECT_STRUCTURE.md       # This document
├── API_DOCUMENTATION.md       # API reference
└── DEPLOYMENT_GUIDE.md        # Deployment instructions
```

## 🔍 Monitoring (`/monitoring`)

### Observability Stack

```
monitoring/
├── prometheus/                # Metrics collection
├── grafana/                  # Visualization dashboards
├── tempo/                    # Distributed tracing
└── budget-alarm/             # Cost monitoring
```

### Monitoring Features

- **Application Metrics**: Performance, errors, usage
- **Infrastructure Metrics**: Resource utilization
- **Business Metrics**: Conversations, leads, revenue
- **Alerting**: Automated incident detection

## 🚀 Development Workflow

### Local Development

1. **Environment Setup**

   ```bash
   npm install                    # Install dependencies
   cp .env.example .env          # Configure environment
   npm run db:setup              # Initialize database
   ```

2. **Development Servers**

   ```bash
   npm run dev:client            # Start React dev server
   npm run dev:server            # Start Express dev server
   npm run dev                   # Start both concurrently
   ```

3. **Database Operations**
   ```bash
   npm run db:migrate            # Run migrations
   npm run db:seed               # Seed test data
   npm run db:reset              # Reset and reseed
   ```

### Code Quality

- **Linting**: ESLint for code quality
- **Formatting**: Prettier for code style
- **Type Checking**: TypeScript strict mode
- **Testing**: Jest + React Testing Library
- **Pre-commit Hooks**: Husky + lint-staged

### Build Process

```bash
npm run build:client           # Build React app
npm run build:server           # Build server
npm run build                  # Build entire application
```

## 🔐 Security Considerations

### Authentication & Authorization

- JWT tokens with refresh mechanism
- Magic link authentication
- Role-based access control (RBAC)
- Multi-tenant data isolation

### Data Protection

- Row-level security (RLS) in PostgreSQL
- Environment variable security
- API rate limiting
- Input validation and sanitization

### Infrastructure Security

- Container security scanning
- Dependency vulnerability monitoring
- SSL/TLS encryption
- Network security policies

## 📈 Performance Optimization

### Frontend Performance

- Code splitting with React.lazy()
- Memoization with React.memo()
- Optimized bundle sizes
- CDN asset delivery

### Backend Performance

- Database connection pooling
- Redis caching strategy
- API response optimization
- Background job processing

### Database Performance

- Proper indexing strategy
- Query optimization
- Connection pooling
- Read replicas for scaling

## 🔄 Integration Points

### External Services

- **Twilio**: SMS messaging
- **SendGrid**: Email delivery
- **OpenAI**: AI conversation processing
- **Google Ads**: Advertising integration
- **ADF Providers**: Lead data ingestion

### Internal APIs

- Authentication service
- Conversation AI engine
- Lead management system
- Notification service
- Analytics platform

This structure provides a scalable foundation for the CleanRylie platform while maintaining clear separation of concerns and enabling efficient development workflows.
