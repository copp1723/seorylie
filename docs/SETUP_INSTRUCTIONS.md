# CleanRylie Setup Instructions

> **Complete setup guide for the stabilization workflow** > **Target Audience**: New developers, CI/CD systems, deployment environments

---

## 🚀 Quick Start (5 Minutes)

### For Experienced Developers

```bash
# 1. Clone and setup
git clone <repository-url>
cd cleanrylie
npm run setup

# 2. Start development
npm run dev

# 3. Verify everything works
npm run test
npm run build
```

**Expected Result**: Development server running on http://localhost:5173 with backend on http://localhost:3000

---

## 📋 Detailed Setup Guide

### Prerequisites

**Required Software:**

- **Node.js**: 18+ (recommended: 20+)
- **npm**: 8+ (comes with Node.js)
- **Git**: Latest version
- **Database**: Supabase account (or PostgreSQL 14+)

**Optional but Recommended:**

- **Docker**: For local services (Redis, PostgreSQL)
- **VS Code**: With TypeScript and ESLint extensions

### Step 1: Environment Setup

#### 1.1 Clone Repository

```bash
git clone <repository-url>
cd cleanrylie
```

#### 1.2 Install Dependencies

```bash
# Automated setup (recommended)
npm run setup

# Or manual setup
npm install
npm run env:validate
npm run check
```

#### 1.3 Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env  # or your preferred editor
```

**Required Environment Variables:**

```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/database

# Authentication
JWT_SECRET=your-jwt-secret-here
SESSION_SECRET=your-session-secret-here

# External APIs
OPENAI_API_KEY=sk-your-openai-key
SENDGRID_API_KEY=SG.your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379
```

### Step 2: Database Setup

#### 2.1 Supabase Setup (Recommended)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy database URL from project settings
4. Add to `.env` file

#### 2.2 Local PostgreSQL (Alternative)

```bash
# Using Docker
docker run --name cleanrylie-postgres \
  -e POSTGRES_DB=cleanrylie \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:14

# Update .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cleanrylie
```

#### 2.3 Run Migrations

```bash
npm run migrate
npm run db:seed  # Optional: add test data
```

### Step 3: Development Environment

#### 3.1 Start Development Server

```bash
# Start both frontend and backend
npm run dev

# Or start separately
npm run dev:server  # Backend only
npm run dev:client  # Frontend only
```

#### 3.2 Verify Setup

```bash
# Check health
curl http://localhost:3000/api/health

# Run tests
npm run test

# Build for production
npm run build
```

---

## 🔧 Advanced Configuration

### Docker Development Environment

#### Full Stack with Docker

```bash
# Start all services
docker-compose -f docker-compose.platform.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

#### Services Included:

- **Application**: Frontend + Backend
- **PostgreSQL**: Database
- **Redis**: Caching and sessions
- **Grafana**: Monitoring dashboards
- **Prometheus**: Metrics collection

### IDE Configuration

#### VS Code Setup

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "on"
}
```

#### Recommended Extensions:

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- GitLens
- Thunder Client (API testing)

---

## 🧪 Testing Setup

### Test Environment Configuration

```bash
# Setup test database
export NODE_ENV=test
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cleanrylie_test

# Run test suite
npm run test:ci
```

### Test Categories

#### Unit Tests

```bash
npm run test           # Vitest unit tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

#### Integration Tests

```bash
npm run test:integration  # API integration tests
npm run test:adf         # ADF pipeline tests
npm run test:fixtures    # Database fixtures
```

#### End-to-End Tests

```bash
npm run test:e2e      # Playwright E2E tests
npm run test:load     # Load testing with k6
npm run test:performance  # Performance benchmarks
```

---

## 🚀 Deployment Setup

### Staging Environment

#### Environment Variables

```env
NODE_ENV=staging
DATABASE_URL=<staging-database-url>
REDIS_URL=<staging-redis-url>
# ... other staging-specific vars
```

#### Deployment Commands

```bash
npm run deploy:staging     # Deploy to staging
npm run deploy:check       # Verify deployment readiness
npm run health            # Check application health
```

### Production Environment

#### Prerequisites

- [ ] Production database configured
- [ ] SSL certificates installed
- [ ] Environment variables set
- [ ] Monitoring configured
- [ ] Backup strategy implemented

#### Deployment Process

```bash
# Automated deployment (recommended)
git push origin main  # Triggers auto-deployment

# Manual deployment
npm run deploy:production
```

---

## 🔍 Monitoring & Validation

### Continuous Validation

#### Setup Validation Daemon

```bash
# Start continuous monitoring
npm run validation:daemon

# Manual validation check
npm run validation:run

# Test validation acceptance
npm run validation:test
```

#### Validation Reports

```bash
# View latest reports
ls -la validation/reports/

# Analyze specific report
cat validation/reports/health-check-latest.json
```

### Health Monitoring

#### Health Check Endpoints

```bash
# Basic health
curl http://localhost:3000/api/health

# Detailed health
curl http://localhost:3000/api/health/detailed

# Service health
curl http://localhost:3000/api/health/services

# Metrics
curl http://localhost:3000/api/metrics
```

---

## 🛠️ Troubleshooting

### Common Issues

#### Dependencies Not Installing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### TypeScript Errors

```bash
# Check TypeScript configuration
npm run check

# Clean TypeScript cache
npx tsc --build --clean
```

#### Database Connection Issues

```bash
# Test database connection
npm run env:validate

# Check database status
npm run health
```

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Getting Help

1. **Check Documentation**: Review relevant docs in `/docs`
2. **Run Diagnostics**: Use `npm run setup:verify`
3. **Check Logs**: Review application and error logs
4. **Team Support**: Contact team members for assistance

---

## 📚 Next Steps

After successful setup:

1. **Read Workflow Guide**: [Stabilization Workflow](./STABILIZATION_WORKFLOW.md)
2. **Review Validation**: [Validation Checklists](./VALIDATION_CHECKLISTS.md)
3. **Understand Architecture**: [System Architecture](./SYSTEM_ARCHITECTURE.md)
4. **Start Development**: Create your first feature branch

---

**Setup Complete!** 🎉 You're ready to start developing with CleanRylie's stabilization workflow.
