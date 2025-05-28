# CleanRylie - Automotive Dealership AI Platform

> **Enterprise-Grade AI Platform**: CleanRylie is a comprehensive multi-tenant AI platform designed for automotive dealerships, featuring real-time conversation management, intelligent lead processing, and advanced analytics.

## Key Features

- ** AI-Powered Conversations**: OpenAI GPT-4 integration with customizable personas
- ** Multi-Tenant Architecture**: Secure dealership isolation with role-based access control
- ** Real-Time Communication**: WebSocket-powered chat with typing indicators and live updates
- ** Advanced Analytics**: Customer insights, conversation analytics, and performance metrics
- ** Automated Lead Processing**: ADF email parsing and intelligent lead routing
- ** Multi-Channel Support**: SMS, email, and web chat integration
- ** A/B Testing**: Built-in prompt experimentation and performance optimization
- ** Enterprise Security**: JWT authentication, CSRF protection, and data encryption

##Quick Start

### Prerequisites

- **Node.js**: v20.0.0 or higher
- **PostgreSQL**: v13 or higher
- **Redis**: Optional (for enhanced caching)

### Installation

```bash
# Clone and navigate to the project
cd cleanrylie-main

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual configuration values

# Set up database
# Option 1: Use the complete SQL schema (recommended for fresh start)
psql $DATABASE_URL < supabase-schema.sql

# Option 2: Use Drizzle migrations (for incremental setup)
npm run db:push

# Validate environment configuration
npm run env:validate

# Start development server
npm run dev
```

### Verification

```bash
# Check application health
curl http://localhost:5000/api/health

# Run quick tests
npm run test:quick

# Verify database connection
npm run migrate:status
```

##  Project Architecture

```
cleanrylie/
├── client/                    # React frontend (TypeScript + Vite)
│   ├── src/components/       # Reusable UI components (Shadcn/UI)
│   ├── src/pages/           # Application pages and routes
│   ├── src/hooks/           # Custom React hooks
│   └── src/lib/             # Utility functions and configurations
├── server/                   # Express.js backend (TypeScript)
│   ├── routes/              # API route handlers
│   ├── services/            # Business logic and external integrations
│   ├── middleware/          # Authentication, validation, and security
│   ├── utils/               # Helper functions and utilities
│   └── db.ts                # Database connection and configuration
├── shared/                   # Shared TypeScript schemas and types
│   ├── schema.ts            # Core database schema (Drizzle ORM)
│   ├── enhanced-schema.ts   # Extended entities and relationships
│   └── api-schemas.ts       # API request/response schemas
├── test/                     # Comprehensive test suite
│   ├── unit/                # Unit tests (Vitest)
│   ├── load/                # Performance and load tests (k6)
│   └── performance/         # Performance monitoring and analysis
├── migrations/               # Database migration files
├── scripts/                  # Utility and deployment scripts
└── docs/                     # Technical documentation
```

##  Technology Stack

### **Frontend**
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Full type safety across the application
- **Vite**: Fast build tool and development server
- **TanStack Query**: Powerful data fetching and caching
- **Wouter**: Lightweight routing solution
- **Shadcn/UI**: Modern component library with Radix UI primitives
- **TailwindCSS**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions

### **Backend**
- **Node.js 20+**: Latest LTS with ES modules support
- **Express.js**: Web application framework
- **TypeScript**: Type-safe server-side development
- **Drizzle ORM v2**: Modern TypeScript ORM with excellent performance
- **PostgreSQL**: Primary database with advanced features
- **Redis**: Optional caching layer for enhanced performance
- **WebSocket**: Real-time communication via ws library

### **AI & External Services**
- **OpenAI GPT-4**: Advanced AI conversation capabilities
- **SendGrid**: Reliable email delivery service
- **Twilio**: SMS and communication services
- **IMAP**: Email processing for ADF lead imports

### **Security & Authentication**
- **JWT**: Stateless authentication tokens
- **bcrypt**: Password hashing and verification
- **CSRF Protection**: Cross-site request forgery prevention
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Zod schema validation

### **Testing & Quality**
- **Vitest**: Fast unit testing framework
- **Jest**: Additional testing capabilities
- **k6**: Performance and load testing
- **Supertest**: API endpoint testing
- **TypeScript**: Compile-time error detection

##  Database Setup

### **Schema Management**

CleanRylie uses **Drizzle ORM v2** for type-safe database operations with PostgreSQL.

#### **Option 1: Complete Schema (Recommended)**
```bash
# Apply the complete, tested schema
psql $DATABASE_URL < supabase-schema.sql
```

#### **Option 2: Incremental Migrations**
```bash
# Generate migrations from schema changes
npm run db:generate

# Apply migrations to database
npm run db:push

# Check migration status
npm run migrate:status
```

### **Database Features**
- **Multi-tenant architecture** with dealership-based isolation
- **Row Level Security (RLS)** for data protection
- **Optimized indexes** for high-performance queries
- **JSONB fields** for flexible data storage
- **Audit logging** for compliance and debugging
- **Automated backups** and point-in-time recovery

## Environment Configuration

### **Required Variables**

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# AI Services
OPENAI_API_KEY=sk-...                    # OpenAI API key for GPT-4 integration

# Email Services
SENDGRID_API_KEY=SG...                   # SendGrid API key for email delivery
EMAIL_FROM=noreply@yourdomain.com        # Default sender email address

# Security
SESSION_SECRET=your-secure-secret        # Generate with: openssl rand -base64 32
CREDENTIALS_ENCRYPTION_KEY=your-key      # Generate with: openssl rand -base64 32
JWT_SECRET=your-jwt-secret               # JWT token signing secret
```

### **Optional Services**

```bash
# SMS Services (for multi-channel communication)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Caching (Redis - optional, falls back to in-memory)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=...

# Email Processing (for ADF lead imports)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Development Settings
NODE_ENV=development                     # development | production | test
PORT=5000                               # Server port
LOG_LEVEL=debug                         # debug | info | warn | error
AUTH_BYPASS=true                        # Only for development/testing
```

### **Environment Validation**

```bash
# Validate all environment variables
npm run env:validate

# Check deployment readiness
npm run deploy:check
```

##  Testing

### **Unit & Integration Tests**

```bash
# Run all tests
npm test

# Run with coverage reporting
npm run test:coverage

# Run specific test suites
npm run test:unit                        # Unit tests only
npm run test:integration                 # Integration tests only

# Watch mode for development
npm run test:watch
```

### **Performance & Load Testing**

```bash
# Quick performance verification
npm run test:quick

# Setup test data for load testing
npm run test:setup-data

# Run comprehensive performance tests
npm run test:performance:full

# Individual load tests
npm run test:load:api                    # API endpoint testing
npm run test:load:chat                   # WebSocket/chat testing
npm run test:load:inventory              # Inventory operations testing

# Cleanup test data
npm run test:cleanup-data
```

### **Performance Requirements**

- **API Response Time**: < 1 second under 50 concurrent users
- **WebSocket Latency**: < 500ms for real-time features
- **Error Rate**: < 1% under normal load
- **Database Queries**: < 2 seconds for complex operations

## 🚀 Deployment

### **Production Build**

```bash
# Build frontend and backend
npm run build

# Start production server
npm start

# Verify deployment readiness
npm run deploy:check
```

### **Environment Setup**

```bash
# Production environment variables
NODE_ENV=production
AUTH_BYPASS=false
LOG_LEVEL=info

# Ensure all security variables are set
SESSION_SECRET=<strong-secret>
CREDENTIALS_ENCRYPTION_KEY=<encryption-key>
JWT_SECRET=<jwt-secret>
```

### **Health Monitoring**

```bash
# Check application health
curl http://localhost:5000/api/health

# Monitor system metrics
curl http://localhost:5000/api/metrics/system

# Database health check
curl http://localhost:5000/api/metrics/database
```

## 📚 Documentation

### **Core Documentation**
- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)**: Comprehensive system design and architecture
- **[Environment Configuration](docs/ENVIRONMENT_CONFIGURATION.md)**: Detailed environment setup guide
- **[Database Setup](docs/database-setup.md)**: Database configuration and migration guide

### **API Documentation**
- **REST API**: Available at `/api/docs` when server is running
- **WebSocket API**: Real-time communication protocols
- **Authentication**: JWT and session-based authentication flows

### **Development Guides**
- **Testing**: Unit, integration, and performance testing procedures
- **Deployment**: Production deployment and monitoring setup
- **Contributing**: Code standards and contribution guidelines

## Development Workflow

### **Daily Development**

```bash
# Start development environment
npm run dev

# Type checking (continuous)
npm run check:watch

# Run tests in watch mode
npm run test:watch

# Database operations
npm run db:studio                        # Open Drizzle Studio
npm run migrate:status                   # Check migration status
```

### **Code Quality**

```bash
# Type checking
npm run check

# Run all tests
npm test

# Performance validation
npm run test:quick

# Environment validation
npm run env:validate
```

### **Database Management**

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:push

# Check migration status
npm run migrate:status

# Rollback migration (if needed)
npm run migrate:rollback
```

##  Security Features

- **Multi-tenant isolation**: Dealership-based data segregation
- **Role-based access control**: Admin, manager, user, and API roles
- **JWT authentication**: Stateless token-based authentication
- **CSRF protection**: Cross-site request forgery prevention
- **Rate limiting**: API abuse prevention with tiered limits
- **Input validation**: Comprehensive Zod schema validation
- **Data encryption**: Sensitive data encryption at rest and in transit
- **Audit logging**: Complete audit trail for compliance

##  Performance Optimizations

- **Database indexing**: Optimized indexes for multi-tenant queries
- **Caching layer**: Redis-based caching with in-memory fallback
- **Query optimization**: Drizzle ORM with optimized query patterns
- **WebSocket efficiency**: Optimized real-time communication
- **Asset optimization**: Vite-based build optimization
- **Load balancing ready**: Stateless design for horizontal scaling

---

##  Support & Contributing

### **Getting Help**
1. Check the [documentation](docs/) for detailed guides
2. Run `npm run env:validate` for configuration issues
3. Check application logs for error details
4. Review the [troubleshooting guide](docs/TROUBLESHOOTING.md)

### **Contributing**
1. Fork the repository
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

---

**Built with**: React 18, TypeScript, Express.js, PostgreSQL, Drizzle ORM v2, OpenAI GPT-4, TailwindCSS, and modern web technologies.
