# CleanRylie - Automotive Dealership AI Platform

> This repository contains CleanRylie, a production-ready, multi-service AI platform for automotive dealerships. It's the result of a comprehensive integration and cleanup effort, consolidating features into a robust, scalable, and maintainable system.

## Branching & Release Model

| Branch | Purpose |
|--------|---------|
| **main** | Production baseline (fast-forwarded from golden release candidates) |
| **integration/production-readiness-phase1** | Active development, staging, and release candidate branch |

Developers create short-lived `feat/`, `fix/`, or `chore/` branches off `integration/production-readiness-phase1` and open PRs back to it.
Full details: [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md).

---

## Key Features

- **AI-Powered Conversations**: OpenAI GPT-4 integration with customizable personas
- **Multi-Tenant Architecture**: Secure dealership isolation with role-based access control
- **Real-Time Communication**: Redis-scaled WebSocket chat with live updates
- **Advanced Analytics**: KPI query caching (<50 ms) and performance dashboards
- **Automated Lead Processing**: ADF email parsing and intelligent lead routing
- **Enterprise Security**: JWT, CSRF, rate limiting, AES-256 encryption, audit logging
- **Comprehensive API**: Well-documented endpoints for all core functionalities
- **Developer-Friendly**: Dockerized environment, extensive testing, and clear documentation

---

## 🚀 Quick Start

### ⚠️ Prerequisites

**Before running any lint, check, or test commands, ensure dependencies are installed:**

```bash
npm install
```

To verify vitest is installed, run:
```bash
npx vitest --version
```

If any errors about missing modules occur, repeat `npm install`.

### Development Setup

```bash
# 1. Comprehensive environment setup (recommended)
npm run setup

# 2. Set up environment variables
cp .env.example .env
# IMPORTANT: Edit .env with your actual API keys and configuration values

# 3. Set up database
# Ensure PostgreSQL is running and accessible
# Option 1: Use Drizzle migrations (recommended for most setups)
npm run db:generate # If you made schema changes in shared/schema.ts
npm run db:push     # Applies pending migrations

# Option 2: Use the complete SQL schema (for a fresh start if migrations fail)
# psql your_database_url < supabase-schema.sql # Adjust command as per your DB

# 4. Setup ADF-W10 Conversation Orchestrator
npm run setup:orchestrator setup --test-mode

# 5. Start development server (frontend and backend)
npm run dev
```

The application should now be running on `http://localhost:5173` (frontend) and `http://localhost:3000` (backend API).

### Development Commands

After setup, you can safely run:

```bash
npm run lint       # TypeScript checking (with auto pre-check)
npm run check      # Type checking (with auto pre-check)  
npm run test       # Run tests (with auto pre-check)
npm run build      # Build project (with auto pre-check)
```

**Note:** These commands now include automatic dependency verification. If dependencies are missing, you'll get clear error messages with instructions.

### Environment Restrictions

**If your environment restricts network access after container startup:**
All dependencies must be installed during the setup/init phase. Use:
- `npm ci` for reproducible installs
- `npm run setup` to verify all dependencies
- Include `node_modules` in deployment if necessary

See [SETUP.md](SETUP.md) for comprehensive setup documentation.

---

## 🐳 Docker Compose Setup

Spin up **the entire multi-service AI platform** with a single command.

### Prerequisites
* Docker Desktop (or Docker Engine v24+) installed
* A valid `.env` file in the repository root containing **at least** `OPENAI_API_KEY`, `SESSION_SECRET`, and `DATABASE_URL`. Other service-specific keys might be needed based on enabled features.

### Start the platform

```bash
# From the repository root
docker compose -f docker-compose.platform.yml up -d --build
```

> The first build can take a few minutes while images are built/pulled. Subsequent starts will be faster.

#### What gets started

| Service                | Image / Context                       | Port | Notes                                    |
|------------------------|---------------------------------------|------|------------------------------------------|
| PostgreSQL             | `postgres:15-alpine`                  | 5432 | Primary relational DB                    |
| Redis                  | `redis:alpine`                        | 6379 | Caching / messaging / session store      |
| cleanrylie-api         | `./Dockerfile` (target `server`)      | 3000 | Express backend (`/api/*` routes)        |
| cleanrylie-frontend    | `./Dockerfile` (target `client`)      | 5173 | React/Vite frontend                      |
| watchdog-api           | `final_watchdog/backend`              | 8000 | FastAPI analytics & insights             |
| MindsDB (optional)     | `mindsdb/mindsdb:latest`              |47334 | AutoML / SQL-over-AI gateway             |
| mock-imap              | `./Dockerfile` (target `testing`)     | 1143 | Mock IMAP server for email testing       |
| mock-openai            | `./Dockerfile` (target `testing`)     | 3001 | Mock OpenAI API for AI testing           |
| mock-twilio            | `./Dockerfile` (target `testing`)     | 3002 | Mock Twilio API for SMS testing          |
| test-runner            | `./Dockerfile` (target `testing`)     | -    | CI test runner for automated testing     |

You can access the running stack at:

* Frontend   → http://localhost:5173  
* cleanrylie API → http://localhost:3000  
* Watchdog API → http://localhost:8000  
* MindsDB UI  → http://localhost:47334 (if enabled)

### Health checks

After the containers are up, verify every service is healthy:

```bash
./scripts/wait-for-health.sh
```

The script polls:
* `POSTGRES` readiness via `pg_isready`
* `redis-cli ping`
* `http://localhost:3000/api/health` (CleanRylie API)
* `http://localhost:8000/api/health` (Watchdog API, if applicable)
* `http://localhost:47334/api/health` (MindsDB, if applicable)

### One-shot integration test (Example)

```bash
# Example: npx tsx scripts/test-integration.ts
# (This script may need to be adapted to current platform capabilities)
```
This type of script would typically simulate an agent question, analytics call, and insight response to confirm cross-service communication.

> **Troubleshooting**: Run `docker compose -f docker-compose.platform.yml logs -f <service_name>` to inspect logs for any failing container (e.g., `cleanrylie-api`).

## 🧪 Testing Framework (ADF-013)

The platform includes a comprehensive testing framework with mock services for reliable, deterministic testing without external dependencies.

### Overview

The ADF-013 testing framework provides:

- **Mock Services**: Fully functional mocks for IMAP, OpenAI, and Twilio
- **Deterministic Testing**: Predictable test results without external API costs or rate limits
- **CI Integration**: GitHub Actions workflow with parallel test execution
- **Test Fixtures**: Validated test data for consistent test scenarios
- **Coverage Reporting**: Comprehensive test coverage metrics

### Running Tests with Mock Services

Enable mocks by setting the environment variable:

```bash
# In your .env file or command line
USE_MOCKS=true
```

Run tests with mocks:

```bash
# Run all tests with mocks
npm run test:mocks

# Run integration tests with mock services
npm run test:integration-mocks

# Run ADF pipeline tests with mocks
npm run test:adf-mocks
```

### Available Testing Commands

| Command | Description |
|---------|-------------|
| `npm run test:mocks` | Run all mock service tests |
| `npm run test:integration-mocks` | Run integration tests with mock services |
| `npm run test:adf-mocks` | Test ADF pipeline with mock services |
| `npm run test:fixtures` | Validate test fixtures for completeness |
| `npm run test:ci` | Run all tests with coverage reporting (CI mode) |
| `npm run test:ci-framework` | Test the CI framework itself |

### Testing with Docker Compose

The `docker-compose.platform.yml` includes a complete testing environment:

```bash
# Start the platform with mock services
docker compose -f docker-compose.platform.yml up -d

# Run tests in the test-runner container
docker compose -f docker-compose.platform.yml run test-runner

# Run specific test suite
docker compose -f docker-compose.platform.yml run test-runner npm run test:adf-mocks
```

### CI Integration

The GitHub Actions workflow (`.github/workflows/ci.yml`) provides:

- **Parallel Testing**: Multiple test jobs run concurrently
- **Dependency Caching**: Faster CI runs with npm cache
- **Artifact Storage**: Test results and coverage reports preserved
- **Environment Isolation**: Clean test environment for each run
- **Codecov Integration**: Automated coverage reporting

### Mock Services

#### Mock IMAP Server (Port 1143)
- Simulates email server for ADF lead processing tests
- Provides deterministic email delivery for testing
- Configurable mailboxes and email templates

#### Mock OpenAI (Port 3001)
- Simulates OpenAI API responses without API costs
- Configurable response templates and latency
- Supports streaming and non-streaming responses

#### Mock Twilio (Port 3002)
- Simulates SMS sending and delivery status updates
- Configurable delivery delays and status callbacks
- Records all sent messages for verification

---

## 📁 Project Structure

```
cleanrylie/
├── client/           # React frontend (Vite)
├── server/           # Express.js backend (TypeScript)
├── shared/           # Shared TypeScript schemas, types, and Drizzle ORM schema
├── migrations/       # Database migration files (Drizzle Kit)
├── test/             # Test suite (Vitest, Jest for specific cases)
├── docs/             # Essential documentation
├── scripts/          # Utility and automation scripts
├── .env.example      # Example environment variables
├── Dockerfile        # Multi-stage Dockerfile for client and server
├── docker-compose.platform.yml # Docker Compose for full platform
└── package.json      # Project dependencies and scripts
```

---

## Testing & Quality (v1.0-rc1 Baseline)

- **Integration Quality Gate** (GitHub Actions): Type-check → Lint → Unit Tests → Integration Tests → E2E Tests → Build
- **Coverage Target**: Aiming for >80% line coverage, tracked via Vitest/Jest coverage reports.
- **Load Testing**: Performed using k6, targeting key API endpoints and WebSocket connections. Example: 100 RPS for 3 min, <1% error rate.
- **Security Scans**: Regular audits using Snyk, npm-audit, and Docker image scanning.
- **Docker Health**: All containers include health-checks; memory and CPU usage monitored.
- **Accessibility**: Aiming for WCAG AA compliance for UI components.

---

## Deployment (Production Ready)

1.  Ensure the `integration/production-readiness-phase1` branch is stable and all tests pass.
2.  Create a release tag (e.g., `git tag v1.0.0-rcX`).
3.  Build production Docker images (can be done via CI/CD).
4.  Push images to a container registry (e.g., Docker Hub, ECR, GCR).
5.  Deploy to a production-like environment (e.g., Kubernetes, Docker Swarm, managed PaaS) using a blue-green or canary strategy.
6.  Monitor application health via `/api/health`, Prometheus metrics, and centralized logging.
7.  After a soak period with no regressions, merge the release candidate into `main` and create a final release tag (e.g., `v1.0.0`).

---

## Environment Variables

Key environment variables are listed in `.env.example`. Ensure all required variables are set in your `.env` file or deployment environment. Critical variables include:

- `DATABASE_URL`: Connection string for PostgreSQL.
- `REDIS_URL`: Connection string for Redis.
- `OPENAI_API_KEY`: For AI model access.
- `SESSION_SECRET`: For Express session management.
- `JWT_SECRET`: For JWT authentication.
- `NODE_ENV`: Set to `production` for deployed environments.

Refer to `docs/ENVIRONMENT_CONFIGURATION.md` for a detailed guide.

---

## Database

- **ORM**: Drizzle ORM for type-safe SQL queries and schema management.
- **Migrations**: Handled by Drizzle Kit. See `migrations/` directory.
  - To generate migrations: `npm run db:generate`
  - To apply migrations: `npm run db:push`
- **Schema**: Defined in `shared/schema.ts`.

---

## Security Considerations

- **Authentication**: JWT-based for API access, session-based for frontend interactions.
- **Authorization**: Role-based access control (RBAC) implemented at the API and service layers.
- **Input Validation**: Using Zod for request body and parameter validation.
- **Rate Limiting**: Applied to sensitive endpoints to prevent abuse.
- **CSRF Protection**: Implemented for relevant frontend forms and state-changing requests.
- **Secrets Management**: Use environment variables; never commit secrets to the repository. Consider a secrets manager for production.

---

## Contributing

Please refer to `CONTRIBUTING.md` (if available) or follow standard Gitflow practices. Ensure code is linted, tested, and documented before submitting pull requests.
# CI Status: Fixed TypeScript and test command issues Fri May 30 13:57:29 CDT 2025
