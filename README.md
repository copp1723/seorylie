# CleanRylie - Automotive Dealership AI Platform

> **Clean Migration**: This repository contains a carefully migrated and cleaned version of the Rylie AI platform, with technical debt removed and conflicts resolved.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# Set up database using the clean schema
# Option 1: Use the complete SQL schema (recommended for fresh start)
psql your_database < supabase-schema.sql

# Option 2: Use Drizzle migrations (for incremental setup)
npm run db:push

# Start development server
npm run dev
```

## 📁 Project Structure

```
cleanrylie/
├── client/           # React frontend
├── server/           # Express.js backend  
├── shared/           # Shared TypeScript schemas and types
├── migrations/       # Database migration files
├── test/             # Test suite (rebuilt for quality)
├── docs/             # Essential documentation
└── scripts/          # Utility scripts
```

## 🔧 Key Changes from Original

### ✅ **Improvements Made**
- ✅ Removed Replit-specific dependencies and configurations
- ✅ Resolved database schema conflicts (using supabase-schema.sql as source of truth)
- ✅ Cleaned package.json and build configurations
- ✅ Maintained all core business logic and features
- ✅ Preserved comprehensive test structure

### ⚠️ **Areas Requiring Setup**
- [ ] Authentication system audit needed (multiple implementations found)
- [ ] Service layer dependencies need review
- [ ] Environment variables must be configured
- [ ] External integrations (OpenAI, Twilio, SendGrid) need verification

## 🗄️ Database Setup

**Recommended Approach**: Use the complete `supabase-schema.sql` for a fresh start:

```sql
-- This file contains the complete, tested schema
-- Run this against a fresh database for the cleanest setup
psql $DATABASE_URL < supabase-schema.sql
```

## 🔑 Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# AI Services  
OPENAI_API_KEY=sk-...

# Email Services
SENDGRID_API_KEY=SG...

# SMS Services (optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Security
SESSION_SECRET=your-secure-secret

# Optional: Redis (will use in-memory fallback if not provided)
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
```

## 🚀 Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📚 Documentation

Essential documentation is available in the `/docs` directory:
- [System Architecture](docs/SYSTEM_ARCHITECTURE.md)
- [API Integration](docs/API_INTEGRATION.md)
- [Database Setup](docs/database-setup.md)

## 🔧 Development

```bash
# Type checking
npm run check

# Database operations
npm run db:push          # Apply schema changes
npm run migrate          # Run migrations
npm run migrate:status   # Check migration status
```

## ⚠️ Migration Notes

This repository represents a **selective migration** from the original Rylie project:

- **Migrated**: All core business logic, working features, and essential configuration
- **Excluded**: Technical debt, conflicting implementations, and environment-specific code
- **Improved**: Removed circular dependencies and duplicate authentication systems

For detailed migration analysis, see the original comprehensive audit documentation.

---

**Tech Stack**: React + TypeScript, Express.js, PostgreSQL, Drizzle ORM, OpenAI API, TailwindCSS