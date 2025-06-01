# Development Environment Setup Guide

## ⚠️ Critical Setup Requirements

**CleanRylie uses a stabilization workflow. Before running any commands, ensure proper setup:**

```bash
npm run setup
```

**For environments with network restrictions after container startup:**
All dependencies must be installed during the setup/init phase, not dynamically at test time.

## 🔄 Stabilization Workflow Setup

CleanRylie follows a **stabilization git strategy** with automated quality gates:

### Branch Strategy
- `main` - Production baseline (protected)
- `stabilization` - Long-lived integration branch
- `feature/stab-<ID>/<desc>` - Feature development branches

### Required Setup Steps
1. **Clone and setup**: `git clone <repo> && cd cleanrylie && npm run setup`
2. **Create feature branch**: `git checkout -b feature/stab-<ID>/<description> stabilization`
3. **Development**: Make changes with comprehensive testing
4. **Quality gates**: `npm run setup` validates all requirements
5. **Submit PR**: Target `stabilization` branch for review

## Quick Start

### 1. Initial Setup

Run the comprehensive setup script:

```bash
# Full setup (recommended)
npm run setup

# Or step by step:
npm run setup:install    # Install dependencies only
npm run setup:verify     # Verify existing setup
npm run setup:check      # Check environment only
```

### 2. Verify Installation

To verify vitest is installed:

```bash
npx vitest --version
```

To verify all critical dependencies:

```bash
npm run setup:verify
```

### 3. Development Commands

After setup, you can run:

```bash
npm run lint       # TypeScript checking
npm run check      # Type checking
npm run test       # Run tests
npm run build      # Build project
npm run dev        # Start development server
```

## Automatic Pre-checks

The following commands now include automatic dependency verification:

- `npm run dev` - Development server
- `npm run test` - All test commands
- `npm run lint` - Linting and type checking  
- `npm run check` - Type checking
- `npm run build` - Build process

If dependencies are missing, these commands will automatically run verification and provide helpful error messages.

## Environment Requirements

### Node.js Version
- **Required:** Node.js 18+
- **Recommended:** Node.js 20+

### Package Manager
- **Required:** npm 8+
- **Alternative:** yarn 1.22+ (not tested)

### Critical Dependencies

The following dependencies are verified during setup:

**Runtime Dependencies:**
- `drizzle-orm` - Database ORM
- `bull` - Queue management
- `ioredis` - Redis client
- `handlebars` - Template engine
- `prom-client` - Metrics collection
- `express` - Web framework
- `uuid` - ID generation
- `zod` - Schema validation

**Development Dependencies:**
- `vitest` - Testing framework
- `jest` - Additional testing
- `typescript` - Type checking
- `tsx` - TypeScript execution
- `drizzle-kit` - Database migrations

## Setup Scripts

### Main Setup Script: `scripts/setup-dev.sh`

```bash
# Full setup with verification
bash scripts/setup-dev.sh full

# Quick verification only
bash scripts/setup-dev.sh verify

# Install dependencies only  
bash scripts/setup-dev.sh install

# Check environment only
bash scripts/setup-dev.sh check

# Show help
bash scripts/setup-dev.sh help
```

### Node.js Setup Script: `scripts/setup-dev.js`

Alternative Node.js version for cross-platform compatibility:

```bash
# Full setup
node scripts/setup-dev.js full

# Quick verification
node scripts/setup-dev.js verify

# Install only
node scripts/setup-dev.js install

# Environment check
node scripts/setup-dev.js check
```

### Pre-check Script: `scripts/pre-check.sh`

Automatically created during setup. Runs before dev commands:

```bash
./scripts/pre-check.sh
```

## Troubleshooting

### Missing Dependencies Error

If you see errors like "Cannot find module 'drizzle-orm'":

```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Verify setup
npm run setup:verify

# 3. Check specific dependency
ls node_modules/drizzle-orm
```

### TypeScript Errors

If TypeScript compilation fails:

```bash
# 1. Verify TypeScript installation
npx tsc --version

# 2. Check TypeScript configuration
npm run check

# 3. Clean TypeScript cache
npx tsc --build --clean
```

### Test Framework Issues

If tests fail to run:

```bash
# 1. Verify test frameworks
npx vitest --version
npx jest --version

# 2. Run test verification
npm run setup:verify

# 3. Check test configuration
ls config/build/vitest.config.ts
ls config/build/jest.config.js
```

### Network Restrictions

If your environment restricts network access after initialization:

1. **Ensure all dependencies are installed during container build/setup**
2. **Use `npm ci` instead of `npm install` for reproducible installs**
3. **Include `node_modules` in your deployment if necessary**

Example Dockerfile pattern:
```dockerfile
# Install dependencies with network access
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# No network access needed after this point
RUN npm run build
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Critical: Install dependencies first
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      # Verify setup before running commands
      - run: npm run setup:verify
      
      # Now safe to run all commands
      - run: npm run lint
      - run: npm run check  
      - run: npm run test
      - run: npm run build
```

### Local Development Workflow

```bash
# 1. Clone repository
git clone <repository-url>
cd cleanrylie

# 2. Setup environment (critical first step)
npm run setup

# 3. Setup conversation orchestrator (ADF-W10)
npm run setup:orchestrator setup --test-mode

# 4. Start development
npm run dev

# 5. Run tests (with automatic pre-check)
npm run test

# 6. Build for production
npm run build
```

## ADF-W10 Conversation Orchestrator Setup

After basic environment setup, initialize the conversation orchestrator:

```bash
# Full orchestrator setup
npm run setup:orchestrator setup

# With test data
npm run setup:orchestrator setup --test-mode

# Health check
npm run setup:orchestrator health-check

# Migration only
npm run setup:orchestrator migrate

# Cleanup test data
npm run setup:orchestrator cleanup
```

## Directory Structure

```
cleanrylie/
├── scripts/
│   ├── setup-dev.sh           # Main setup script (bash)
│   ├── setup-dev.js           # Setup script (Node.js)
│   ├── pre-check.sh           # Pre-command verification
│   └── setup-conversation-orchestrator.ts  # ADF-W10 setup
├── config/
│   └── build/
│       ├── vitest.config.ts   # Vitest configuration
│       └── jest.config.js     # Jest configuration
├── server/
│   └── services/
│       ├── conversation-orchestrator.ts    # Main orchestrator
│       ├── prompt-manager.ts              # Prompt management
│       └── metrics-collector.ts           # Metrics collection
├── test/
│   └── conversation-orchestrator.test.ts  # Comprehensive tests
├── migrations/
│   └── 0017_conversation_orchestrator_v2.sql
├── prompts/
│   └── adf/
│       ├── turn1-enhanced.md
│       └── turn2-enhanced.md
└── monitoring/
    └── grafana/
        └── dashboards/
            └── conversation-orchestrator.json
```

## Support

If you encounter setup issues:

1. **Check the setup logs** - The setup script provides detailed output
2. **Run verification** - Use `npm run setup:verify` to diagnose issues
3. **Clean install** - Remove `node_modules` and reinstall
4. **Check Node.js version** - Ensure Node.js 18+ is installed
5. **Verify network access** - Ensure npm can reach the registry during setup

## Development Notes

- **TypeScript strict mode** is enabled for code quality
- **Pre-commit hooks** run verification before commits
- **Automatic dependency checking** prevents runtime errors
- **Network-restriction friendly** setup process
- **Cross-platform compatibility** with both bash and Node.js scripts