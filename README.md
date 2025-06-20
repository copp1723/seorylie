# Rylie SEO Hub 🚀

**White-Label SEO Middleware with Complete Client/Agency Separation**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/typescript-5.1+-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-private-red.svg)](package.json)

---

## 🎯 **Quick Start**

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd seorylie
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start development server
npm run dev

# 4. Test the API
curl http://localhost:3000/health
```

**Ready to go!** 🎉 Your server is running at `http://localhost:3000`

---

## 📋 **Table of Contents**

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Environment Setup](#-environment-setup)
- [Development Commands](#-development-commands)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)

---

## 🔍 **Overview**

Rylie SEO Hub is a sophisticated white-label SEO middleware that provides **complete separation** between clients and agencies through advanced AI proxy technology. It ensures zero PII exposure while maintaining full functionality for both parties.

### ✨ **Key Features**

- **🤖 AI Proxy Middleware** - Complete anonymization of client/agency interactions
- **🔐 Role-Based Access Control (RBAC)** - Granular permission management
- **🎨 White-Label Branding** - Customizable interface for each tenant
- **📊 Comprehensive Analytics** - Google Analytics 4 integration with automated reporting
- **📝 Audit Logging** - Complete activity tracking with trace IDs
- **🔄 Real-time Updates** - WebSocket support for live data synchronization
- **🚀 Modern Tech Stack** - TypeScript, Express, React, PostgreSQL, Redis

### 🎪 **Use Cases**

- **SEO Agencies** managing multiple client accounts
- **White-label SEO providers** offering branded solutions
- **Enterprise companies** requiring strict data separation
- **Multi-tenant SaaS platforms** needing role-based access

---

## 🏗️ **Architecture**

### **System Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Console   │◄──►│   Server API    │◄──►│   External APIs │
│  (React + Vite) │    │ (Express + TS)  │    │ (GA4, OpenAI)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static Files  │    │   PostgreSQL    │    │      Redis      │
│   (S3/Local)    │    │   (Database)    │    │    (Cache)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Core Components**

#### 🎛️ **Server (Node/Express Backend)**
- **Location**: `/server`
- **Purpose**: Main API server handling authentication, data processing, and external integrations
- **Features**: JWT auth, rate limiting, request tracing, error handling
- **Entry Point**: `server/index.ts`

#### 🖥️ **Web Console (React Frontend)**
- **Location**: `/web-console`
- **Purpose**: Admin interface and client/agency dashboards
- **Tech Stack**: React 18, TypeScript, Vite, TailwindCSS
- **Features**: Real-time updates, responsive design, white-label theming

#### 📦 **Packages (Shared Libraries)**
- **GA4 Reporter** (`/packages/ga4-reporter`): Google Analytics 4 data retrieval and reporting
- **SEO Schema** (`/packages/seo-schema`): Shared data models and validation schemas
- **Common Utils** (`/packages/common`): Shared utilities and helpers

#### 📱 **Apps (Specialized Applications)**
- **Location**: `/apps/*`
- **Purpose**: Specialized applications for different use cases
- **Examples**: Mobile apps, specific integrations, microservices

### **Data Flow**

1. **Request** → AI Proxy Middleware (anonymization)
2. **Authentication** → JWT validation + RBAC
3. **Processing** → Business logic + external API calls
4. **Response** → Structured JSON with trace IDs
5. **Logging** → Centralized logging with context

### **Multi-Tenant Architecture**

- **Tenant Isolation**: Complete data separation by tenant ID
- **White-Label Branding**: Customizable UI themes per tenant
- **Role-Based Access**: Client, Agency, Admin role hierarchy
- **Data Anonymization**: Zero PII exposure between roles

---

## ⚙️ **Environment Setup**

### **Prerequisites**

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **Redis** >= 6.0
- **Git** for version control

### **Environment Configuration**

1. **Copy Environment Template**
   ```bash
   cp .env.example .env
   ```

2. **Required Configuration** (minimum for development)
   ```env
   # Database
   DB_NAME=rylie_seo_dev
   DB_USER=postgres
   DB_PASSWORD=your_secure_password
   
   # Security
   JWT_SECRET=your_very_secure_jwt_secret_at_least_64_characters_long
   
   # External Services (optional for development)
   OPENAI_API_KEY=sk-your-openai-key
   GA4_SERVICE_ACCOUNT_EMAIL=your-ga4-service-account@project.iam.gserviceaccount.com
   ```

3. **Production Configuration**
   - Set `NODE_ENV=production`
   - Use strong, unique secrets
   - Configure all external service credentials
   - Set up proper CORS origins

### **Database Setup**

```bash
# Create database
createdb rylie_seo_dev

# Run migrations
npm run migrate

# (Optional) Seed development data
npm run seed
```

### **Validation**

The system will validate your configuration on startup and provide helpful error messages for missing or invalid settings.

### **Google Analytics 4 Integration**

The platform supports Google Analytics 4 integration for tracking and reporting:

1. **Quick Setup**
   ```bash
   ./setup-ga4.sh
   ```

2. **Manual Setup**
   - Follow the guide in `docs/GA4_SETUP.md`
   - Configure service account credentials
   - Update `.env` with GA4 settings

3. **Verify Configuration**
   ```bash
   npm run setup:ga4:verify
   ```

See [GA4 Setup Documentation](docs/GA4_SETUP.md) for detailed instructions.

---

## 🛠️ **Development Commands**

### **Core Commands**

| Command | Purpose | Usage |
|---------|---------|-------|
| `npm run dev` | Start development server with hot reload | Development |
| `npm run build` | Build for production | Deployment |
| `npm start` | Start production server | Production |
| `npm test` | Run all tests | CI/CD |
| `npm run lint` | Check code quality | Development |
| `npm run format` | Format code with Prettier | Development |

### **Database Commands**

```bash
# Database migrations
npm run migrate          # Apply pending migrations
npm run migrate:reset    # Reset database (⚠️ destructive)
npm run generate         # Generate new migration
npm run studio          # Open Drizzle Studio (database GUI)
```

### **Development Utilities**

```bash
# Code Quality
npm run lint:fix        # Auto-fix linting issues
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Security & Maintenance
npm audit              # Check for vulnerabilities
npm run audit:security # Run comprehensive security audit
npm run cleanup        # Remove unused dependencies
```

### **Multi-Service Development**

```bash
# Start all services concurrently
npm run dev:all

# Start specific services
npm run dev:server     # Backend only
npm run dev:console    # Frontend only
npm run dev:ga4        # GA4 service only
```

---

## 🧪 **Testing Infrastructure**

This project uses **Vitest** with TypeScript and ESM support, providing comprehensive test coverage with an **80% coverage gate** that fails the pipeline if not met.

### **Test Commands**

```bash
# Core testing commands
npm run test                    # Run all tests once
npm run test:watch              # Run tests in watch mode (development)
npm run test:ui                 # Interactive test UI

# Test by type
npm run test:unit               # Unit tests only
npm run test:integration        # Integration tests only  
npm run test:e2e                # End-to-end tests only

# Coverage testing
npm run test:coverage           # Generate coverage report
npm run test:coverage:threshold # Enforce 80% coverage gate (CI)

# Pre-commit validation
npm run precommit              # Run lint + test (automatic via Husky)
```

### **Test Structure**

```
tests/
├── setup.ts                    # Global test configuration
├── utils/
│   └── dbTestHelpers.ts        # Async database test utilities
├── unit/                       # Unit tests
├── integration/                # Integration tests
│   └── api-database.spec.ts    # API + Database integration
└── e2e/                        # End-to-end tests
    └── user-signup-journey.spec.ts

# Co-located tests
server/
├── index.spec.ts              # Server health route tests
database/
└── connection.spec.ts         # Database connection tests
routes/
└── public-signup.spec.ts      # API route validation tests
```

### **Coverage Requirements (Enforced in CI)**

- **Lines:** 80% minimum ⛔ *Pipeline fails if below*
- **Functions:** 75% minimum
- **Branches:** 70% minimum
- **Statements:** 80% minimum

### **Test Features**

- ✅ **Async/await** first patterns
- ✅ **Mock database** for environments without PostgreSQL
- ✅ **Test helpers** for common operations
- ✅ **Request/response** mocking utilities
- ✅ **Database cleanup** after each test
- ✅ **ESM + TypeScript** support
- ✅ **Coverage gates** enforced in CI/CD

### **Writing Tests**

#### **Unit Tests** (Testing individual functions)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { testUtils } from '../tests/utils/dbTestHelpers';

describe('Component', () => {
  it('should handle happy path', () => {
    const req = testUtils.createMockRequest();
    const res = testUtils.createMockResponse();
    // Test implementation
  });
});
```

#### **Integration Tests** (Testing API + Database)
```typescript
import { setupTestDatabase } from '../tests/utils/dbTestHelpers';

describe('API Integration', () => {
  const dbHelper = setupTestDatabase(); // Auto setup/cleanup
  
  it('should persist data correctly', async () => {
    const user = await dbHelper.createTestUser({
      email: 'test@example.com'
    });
    expect(user.email).toBe('test@example.com');
  });
});
```

### **Pre-commit Hooks (Husky)**

Automatically runs before each commit:
```bash
npm run lint && npm run test
```

This ensures code quality and prevents broken commits from entering the repository.

---

## 📚 **API Documentation**

### **Base URL**
- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

### **Authentication**

All API endpoints require authentication via JWT tokens:

```bash
# Get auth token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in requests
curl -X GET http://localhost:3000/api/client/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Core Endpoints**

#### **Health & Status**
- `GET /health` - System health check
- `GET /` - API information and endpoints

#### **Client API** (`/api/client/*`)
- `GET /dashboard` - Client dashboard data
- `GET /reports` - Client-specific reports
- `POST /requests` - Submit SEO requests

#### **Agency API** (`/api/agency/*`)
- `GET /clients` - Managed client list (anonymized)
- `GET /tasks` - Agency task queue
- `POST /reports` - Generate reports for clients

#### **Admin API** (`/api/admin/*`)
- `GET /tenants` - Tenant management
- `GET /users` - User management
- `GET /analytics` - System analytics

### **Response Format**

All API responses follow a consistent structure:

```json
{
  "data": { ... },
  "meta": {
    "traceId": "uuid-v4",
    "timestamp": "2025-06-10T20:00:00.000Z",
    "environment": "development"
  }
}
```

### **Error Handling**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "traceId": "uuid-v4",
    "context": { ... }
  }
}
```

---

## 🚀 **Deployment**

### **Production Checklist**

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] External service credentials verified
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented

### **Docker Deployment**

```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale server=3
```

### **Environment-Specific Builds**

```bash
# Production build
NODE_ENV=production npm run build

# Staging build
NODE_ENV=staging npm run build:staging

# Development build
npm run build:dev
```

---

## 🤝 **Contributing**

We welcome contributions! Please follow our development workflow:

### **Branch Strategy**

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development
- `fix/*` - Bug fixes
- `hotfix/*` - Emergency production fixes

### **Development Workflow**

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/TICKET-123-short-description
   ```

2. **Make Changes**
   - Follow TypeScript conventions
   - Add tests for new features
   - Update documentation

3. **Quality Checks**
   ```bash
   npm run lint:fix
   npm run format
   npm test
   ```

4. **Submit Pull Request**
   - Target the `develop` branch
   - Include ticket reference
   - Add clear description

### **Code Standards**

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint + Prettier
- **Testing**: Jest for unit tests
- **Documentation**: JSDoc for functions
- **Commits**: Conventional commit format

### **Pre-commit Hooks**

Husky automatically runs:
- Linting and formatting
- Type checking
- Test suite (on relevant files)

---

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Server Won't Start**
```bash
# Check Node version
node --version  # Should be >= 18.0.0

# Check environment configuration
npm run validate:env

# Check port availability
lsof -i :3000
```

#### **Database Connection Failed**
```bash
# Verify PostgreSQL is running
pg_isready

# Check connection string
npm run test:db

# Reset database if needed
npm run migrate:reset
```

#### **Build Failures**
```bash
# Clear caches
npm run clean
rm -rf node_modules
npm install

# Check TypeScript errors
npm run type-check
```

### **Debug Mode**

Enable detailed logging for debugging:

```bash
# Start with debug logging
LOG_LEVEL=debug npm run dev

# View specific service logs
DEBUG=seorylie:* npm run dev
```

### **Getting Help**

- **Documentation**: Check `/docs` folder for detailed guides
- **Issues**: Create GitHub issue with reproduction steps
- **Security**: Email security issues privately
- **Community**: Join our Discord/Slack for discussions

---

## 📄 **License**

This project is proprietary software. All rights reserved.

---

## 🏆 **Acknowledgments**

Built with ❤️ using modern technologies:
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Express.js](https://expressjs.com/) for robust API development
- [React](https://reactjs.org/) for dynamic user interfaces
- [PostgreSQL](https://www.postgresql.org/) for reliable data storage
- [Redis](https://redis.io/) for high-performance caching

---

**Ready to build amazing SEO solutions?** 🚀

For support and questions, please check our [troubleshooting guide](#-troubleshooting) or create an issue.