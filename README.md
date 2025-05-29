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
| **vin-agent**          | `vin-agent/Dockerfile`                | 5000 | Playwright-powered RPA / automation      |
| MindsDB (optional)     | `mindsdb/mindsdb:latest`              |47334 | AutoML / SQL-over-AI gateway             |

You can access the running stack at:

* Frontend   → http://localhost:5173  
* cleanrylie API → http://localhost:3000  
* Watchdog API → http://localhost:8000  
* **Vin-Agent API** → http://localhost:5000  
* MindsDB UI  → http://localhost:47334 (if enabled)

### Health checks

After the containers are up, verify every service is healthy:

```bash
./scripts/wait-for-health.sh            # waits (≤90 s) for 200 responses (now also checks vin-agent)
```

The script polls:

* `POSTGRES` readiness via `pg_isready`
* `redis-cli ping`
* `http://localhost:3000/api/metrics/health`
* `http://localhost:8000/api/health`
* `http://localhost:5000/health`
* `http://localhost:47334/api/health`

### One-shot integration test

```bash
npx tsx scripts/test-integration.ts
```

This simulates an agent question → analytics call → insight response and confirms cross-service communication.

> **Troubleshooting** – run `docker compose logs -f <service>` to inspect any failing container.

---

## 🧠 Agent Orchestration (Week 2 Feature)

The **Agent Orchestrator** enables **cross-service workflows** that blend analytics (Watchdog) with automation (Vin-Agent).

### Core Endpoints

| Method & Path | Purpose |
|---------------|---------|
| `POST /api/agents/execute` | Start a predefined or custom workflow |
| `GET  /api/agents/workflows` | List available workflows |
| `GET  /api/agents/execution/:id` | Poll workflow status/results |
| `POST /api/agents/services/analytics` | Raw pass-through call to Watchdog |
| `POST /api/agents/services/automation` | Raw pass-through call to Vin-Agent |
| `GET  /api/agents/status` | Health/status of orchestrator & dependencies |

### Example – Sales Analysis → VinSolutions Update

```bash
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "sales-analysis-update",
    "agentId": "dealer-bot-42",
    "agentType": "SALES_ANALYTICS",
    "parameters": {
      "uploadId": "your_watchdog_upload_uuid",
      "notifyUsers": ["gm@dealer.com"]
    },
    "dealershipId": "1234"
}'
```

1. **Watchdog** analyzes sales KPIs  
2. Issues found → **Vin-Agent** automates updates in VinSolutions  
3. A summary report is generated back in Watchdog  
4. Poll `/api/agents/execution/:id` to track progress

Create your own workflows via:

```http
POST /api/agents/workflows/register   (admin only)
```

Define steps that call either service, include conditions, retries, and error handling – all in one JSON payload.

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
