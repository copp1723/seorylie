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

## 🐳 Docker Compose Setup

Spin up **the entire multi-service AI platform** with a single command.

### Prerequisites
* Docker Desktop (or Docker Engine v24+) installed  
* A valid `.env` in the repo root containing **at least**  
  `OPENAI_API_KEY`, `SESSION_SECRET` (and optionally `JWT_SECRET`, etc.)

### Start the platform

```bash
# from repo root
docker compose -f docker-compose.platform.yml up -d
```

> The first build can take a few minutes while images are built/pulled.

#### What gets started

| Service                | Image / Context                       | Port | Notes                                    |
|------------------------|---------------------------------------|------|------------------------------------------|
| PostgreSQL             | `postgres:15-alpine`                  | 5432 | Primary relational DB                    |
| Redis                  | `redis:alpine`                        | 6379 | Caching / messaging                      |
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
./scripts/wait-for-health.sh            # waits (≤90 s) for 200 responses
```

The script polls:

* `POSTGRES` readiness via `pg_isready`
* `redis-cli ping`
* `http://localhost:3000/api/metrics/health`
* `http://localhost:8000/api/health`
* `http://localhost:47334/api/health`

### One-shot integration test

```bash
npx tsx scripts/test-integration.ts
```

This simulates an agent question → analytics call → insight response and confirms cross-service communication.

> **Troubleshooting** – run `docker compose logs -f <service>` to inspect any failing container.

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
├── client/           # React frontend
├── server/           # Express.js backend  
├── shared/           # Shared TypeScript schemas and types
├── migrations/       # Database migration files
├── test/             # Test suite (rebuilt for quality)
├── docs/             # Essential documentation
└── scripts/          # Utility scripts
```

## 🔧 Key Changes from Original
... (rest of file unchanged) ...
