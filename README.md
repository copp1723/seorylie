# Cleanrylie AI Platform – README

## Table of Contents
1. Introduction  
2. High-Level Architecture  
3. Service Matrix & Port Map  
4. Quick-Start (Local Docker)  
5. Environment Variables  
6. Database & Security (RLS Policies)  
7. API Overview  
8. Monitoring & Observability  
9. Testing & CI/CD  
10. Production Deployment Guide  
11. Troubleshooting & Support  

---

## 1  Introduction
Cleanrylie is a multi-tenant, event-driven **AI Agent Platform** for automotive dealerships.  
It integrates conversational AI, analytics, RPA automation, advertising management and enterprise-grade observability.

The repository now contains **all capabilities delivered in Tasks 1-10**:

| Task | Capability |
|------|------------|
|1 | Multi-service Docker Compose baseline |
|2 | Analytics Client & Tool Registry |
|3 | Sandbox isolation & token rate-limiting |
|4 | Agent Studio UI (visual builder) |
|5 | Observability α (Prometheus + Grafana, budget guardrails) |
|6 | Google Ads API service & OAuth |
|7 | Cross-Service Orchestration v2 (Redis Streams) |
|8 | Advanced Analytics ETL & KPI Layer |
|9 | Production-ready CI, RLS, Tempo traces, security scanning |
|10| External Integrations & Notifications (Slack, email, webhooks) |

---

## 2  High-Level Architecture
```
┌─────────────┐  Web   ┌─────────┐
│ Agent Studio│◀──────▶│ API GW  │
└─────────────┘        │(Express)│
       ▲               └──┬──┬───┘
       │ WS/SSE            │  │
       │                   │  ├──────────┐
       │                   │  │Event Bus │ Redis Streams
       │                   ▼  ▼          ▼
┌────────┐   REST  ┌────────────┐  gRPC/REST   ┌──────────────┐
│Watchdog│◀────────│ Orchestrator│────────────▶│ Vin-Agent RPA│
│Analytics│        │ Tool Reg.   │             └──────────────┘
└────────┘         │ Ads Service │──Google Ads API
          ▲        └────────────┘
          │ETL                ▲
          └──────► Postgres ◄─┘
```

* **Frontend** – React 18, Vite, Tailwind, WebSocket live console.  
* **Backend** – TypeScript Node services (API GW, Ads, Orchestrator, Workers).  
* **Data** – PostgreSQL + Drizzle ORM with RLS, Redis Streams for events, Tempo for traces.  
* **Observability** – Prometheus + Grafana, Loki logs, Tempo traces, Slack alerts.

---

## 3  Service Matrix & Port Map

| Service | Image/Dir | Port | Description |
|---------|-----------|------|-------------|
| cleanrylie-api | `server/` | **3000** | Main REST / WS gateway |
| cleanrylie-frontend | `client/` | **5173** | Agent Studio SPA |
| watchdog-api | external | **8000** | Analytics engine |
| vin-agent | `vin-agent` repo | **5000** | RPA & browser automation |
| ads-service | `server/services/ads-api-service.ts` | **3100** | Google Ads OAuth + campaign ops |
| orchestrator | `server/services/orchestrator.ts` | **3000 (same GW)** | Cross-service workflows |
| redis | official | **6379** | Event Bus & queues |
| postgres | official | **5432** | Primary DB with RLS |
| prometheus | monitoring | **9090** | Metrics store |
| grafana | monitoring | **3001** | Dashboards (`/grafana`) |
| tempo | monitoring | **3200** | Trace storage |
| loki  | monitoring | **3100** | Log aggregation |
| budget-alarm | `monitoring/budget-alarm` | **8080** | Cost guardrail worker |

---

## 4  Quick-Start (Local Docker)

```bash
# clone repo
git clone https://github.com/copp1723/cleanrylie && cd cleanrylie

# copy environment template
cp .env.example .env
# ➜ fill required keys (OpenAI, Google, SendGrid, Slack, DB, encryption)

# build & run all services
docker compose -f docker-compose.platform.yml up -d
docker compose -f docker-compose.monitoring.yml up -d   # observability stack

# apply database migrations
npm run migrate   # inside api container or host

# access
Frontend        → http://localhost:5173
API Gateway     → http://localhost:3000
Prometheus      → http://localhost:9090
Grafana         → http://localhost:3001 (admin/admin)
Tempo Traces    → http://localhost:3200
```

---

## 5  Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `OPENAI_API_KEY` | OpenAI completions |
| `GOOGLE_ADS_CLIENT_ID / SECRET / DEV_TOKEN` | Google Ads OAuth |
| `SENDGRID_API_KEY` | Outbound email |
| `SLACK_WEBHOOK_URL` | Incoming Slack alerts |
| `ENCRYPTION_KEY` | 32-byte key for token encryption |
| `JWT_SECRET` | Auth token signing |
| `PROMETHEUS_PUSHGATEWAY_URL` | (optional) |
| ...see `.env.example` for full list |

---

## 6  Database & Security

### Migrations of Interest
- `0009_tool_registry.sql` – tools & agent_tools  
- `0010_sandboxes_and_rate_limiting.sql` – token caps  
- `0011_gads_accounts.sql` – Google Ads creds  
- `0012_daily_spend_logs.sql` – Ads KPI storage  
- `0013_rls_security_policies.sql` – **Row-Level Security**

### RLS Highlights
```sql
-- prevent cross-sandbox access
CREATE POLICY sandbox_isolation ON gads_campaigns
USING ( sandbox_id = current_setting('app.current_sandbox')::int );

-- token usage logs
CREATE POLICY token_log_isolation ON token_usage_logs
USING ( sandbox_id = current_setting('app.current_sandbox')::int );
```

---

## 7  API Overview (Key Endpoints)

### Auth / User
`POST /auth/login` – obtain JWT  
`POST /auth/refresh`

### Sandbox
`POST /sandboxes` • `GET /sandboxes/:id` • `PUT /sandboxes/:id/pause`

### Tool Registry
`GET /tools` – list tools  
`POST /tools/execute` – generic execution

### Google Ads
```
POST /ads/auth/url
GET  /ads/auth/callback
GET  /ads/accounts           # list CIDs
POST /ads/campaigns          # create search campaign (dryRun?)
```

### KPI
`GET /kpi/ads/:cid?period=30d` – ROAS, CPA, CTR

### Webhooks
`POST /webhooks/ads/spend` (HMAC-SHA256)

Full OpenAPI spec is generated at **`/api-docs`**.

---

## 8  Monitoring & Observability

| Metric / Trace | Source | Grafana Panel |
|----------------|--------|---------------|
| Token usage per sandbox | Prometheus (`rylie_tokens_total`) | **agent_sandbox_overview.json** |
| P95 latency per tool | Histogram metric `tool_latency_seconds` | same dashboard |
| OpenAI cost/day | `openai_cost_usd_total` | budget section |
| Traces | OTEL → Tempo | Service Map & Flamegraph |
| Logs | Loki | Explore tab |

### Alerts
* **Budget > $5 / 24 h** → Slack `#ai-platform-alerts`  
* **RateLimitExceeded** events → Slack  
* **Error rate > 5 %** per service → PagerDuty (optional)  

---

## 9  Testing & CI/CD

| Layer | Command | Notes |
|-------|---------|-------|
| Unit   | `npm run test:unit`    | Jest |
| Integration | `npm run test:int` | Uses test containers |
| E2E (API) | `npm run test:e2e`  | Supertest |
| Cypress (UI) | `npm run cypress` |
| Load (k6) | `npm run load` |
| Security   | Trivy + Snyk in CI workflow |

GitHub Actions workflow **`.github/workflows/ci.yml`**
- Matrix build (api, frontend, ads, workers)  
- Runs all tests, scans, lint, build < **10 min**

---

## 10  Production Deployment Guide

### Container Images
Images are published via CI and tagged with Git SHA.  
Use **Helm chart** in `deployment/helm/cleanrylie`.

```bash
helm upgrade --install cleanrylie \
  deployment/helm/cleanrylie \
  --set image.tag=v1.0.0 \
  --set environment=production
```

### Scaling
* API Gateway – HPA target CPU 70 %  
* Workers     – Scaled by Redis stream lag  
* WebSocket   – Use Redis adapter for multi-pod  
* Postgres    – Prefer managed (RDS/Aurora) with read replicas  
* Redis       – Use Redis Cluster or Elasticache  

### Certificates & Ingress
- Traefik / Nginx Ingress with Let’s Encrypt  
- TLS termination at load balancer  

### Backups & DR
- Postgres WAL backups (pgBackRest)  
- Redis snapshot (AOF)  
- S3 object storage for PDF reports  

---

## Troubleshooting

| Symptom | Possible Cause | Resolution |
|---------|----------------|------------|
| 429 Too Many Tokens | Sandbox token cap reached | Increase cap or wait/hourly reset |
| Google Ads “AUTH_ERROR” | Token expired | `/ads/auth/url` to relink |
| ETL job timeout | API quota or slow network | Increase `ADS_ETL_TIMEOUT` or retry |
| No traces in Grafana | Tempo not running or OTLP exporter mis-set | Check `docker-compose.monitoring.yml` ports 4317/4318 |

---

### Support
• Slack: `#cleanrylie-dev`  
• Email: **support@cleanrylie.io**  
• Docs: `docs/` directory  

Happy building! 🚗🤖
