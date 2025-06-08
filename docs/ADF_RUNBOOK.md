# ADF Lead-Processing ‑ Production Runbook

_Last updated: 2025-05-30_

---

## 1. System Overview & Architecture

### 1.1 High-Level Flow

```
IMAP Mailbox ─► ADF Email Listener ─► ADF Parser ─► Postgres
                                     │
                                     ├─► Enhanced-AI Service ─► Email/SMS Sender
                                     │                         │
                                     │                         └─► Twilio / SendGrid
                                     └─► Intent Detection ─► Handover Orchestrator
                                                              │
                                                              └─► Sales Dossier Email
```

| Layer         | Key Services / Files                                      | Purpose                              |
| ------------- | --------------------------------------------------------- | ------------------------------------ |
| Email ingest  | `server/services/adf-email-listener.ts`                   | Poll IMAP, drop raw e-mails on queue |
| Parsing       | `adf-parser.ts`, `adf-lead-processor.ts`                  | XML → DB, duplicate guard            |
| AI            | `enhanced-ai-service.ts`                                  | OpenAI wrapper, caching, metrics     |
| Messaging     | `email-service.ts`, `messaging-service.ts`                | SendGrid / MailHog, Twilio SMS       |
| Handover      | `handover-orchestrator.ts`, `handover-dossier-service.ts` | Sales dossier + escalation           |
| Queue         | `queue.ts`, `queue-consumers.ts`                          | BullMQ workers                       |
| DB            | `server/db.ts` + `shared/*schema.ts`                      | Drizzle ORM on Postgres              |
| Observability | `monitoring-routes.ts`, `prometheus-metrics.ts`           | Prometheus exporter, /metrics        |

All services are stateless; state lives in **Postgres**, **Redis**, **S3 (attachments)**.

---

## 2. Deployment Procedures

### 2.1 CI/CD Pipeline

1. **Push to `main`** ➜ GitHub Actions runs:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
2. Docker image built & pushed to `ghcr.io/<org>/adf-backend:<sha>`.
3. ArgoCD detects new image tag in Helm values, rolls out to:
   - **staging** (`main` head)
   - **production** (tagged release)

### 2.2 Helm Upgrade

```
helm upgrade adf charts/adf \
  --namespace adf \
  -f environments/prod.values.yaml \
  --set image.tag=<sha>
```

Rollback:

```
helm rollback adf <REVISION>
```

### 2.3 Blue/Green Toggle

Set `adf.featureFlags.enableBlueGreen=true` and traffic weight via Istio VirtualService.

---

## 3. Environment Variable Configuration

| Variable                                   | Example                                | Notes              |
| ------------------------------------------ | -------------------------------------- | ------------------ |
| `DATABASE_URL`                             | `postgres://adf:***@postgres:5432/adf` | mandatory          |
| `REDIS_URL`                                | `redis://redis:6379`                   | BullMQ queues      |
| `IMAP_HOST` / `IMAP_PORT`                  | `imap.gmail.com` / `993`               | listener           |
| `IMAP_USER` / `IMAP_PASS`                  |                                        | service acct       |
| `EMAIL_PROVIDER`                           | `sendgrid` \| `mailhog`                | prod vs dev        |
| `SENDGRID_API_KEY`                         | `SG.xxx`                               | prod only          |
| `SENDGRID_FROM_EMAIL`                      | `leads@dealer.com`                     |                    |
| `SENDGRID_WEBHOOK_SECRET`                  | `whsec_...`                            | verify HMAC        |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` |                                        | SMS                |
| `OPENAI_API_KEY`                           |                                        | AI calls           |
| `HANDOVER_EMAIL_ENABLED`                   | `true`                                 | rollout flag       |
| `LOG_LEVEL`                                | `info` / `debug`                       | pino logger        |
| `NODE_ENV`                                 | `production`                           | sets express trust |

Use `npm run check-env` locally or `/health` in prod to audit.

---

## 4. Monitoring & Alerting

### 4.1 Prometheus Metrics

| Metric                              | Type      | Description        |
| ----------------------------------- | --------- | ------------------ |
| `adf_leads_processed_total{status}` | counter   | success / error    |
| `ai_response_latency_ms`            | histogram | buckets 10 ms-30 s |
| `handover_dossier_generation_ms`    | histogram | p95 < 8 s SLO      |
| `handover_email_sent_total{status}` | counter   | delivered / failed |
| `adf_imap_disconnections_total`     | counter   | IMAP stability     |

Scrape `/metrics` every 30 s.

### 4.2 Alert Rules (PrometheusRule)

```
- alert: LeadProcessingFailures
  expr: increase(adf_leads_processed_total{status="error"}[10m]) > 5
  for: 5m
  labels: {severity: critical}
  annotations:
    summary: "ADF lead processing failures >5 in 10 min"

- alert: AIDossierLatencyHigh
  expr: histogram_quantile(0.95, sum(rate(handover_dossier_generation_ms_bucket[5m])) by (le))
        > 8
  labels: {severity: warning}
```

PagerDuty integration via Alertmanager; severities map to P1/P2.

### 4.3 Grafana Dashboards

Import JSON: `dashboards/adf-overview.json`  
Panels: pipeline throughput, latency, queue depth, recent failures.

---

## 5. Troubleshooting Guides

| Symptom               | Checklist                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/health` returns 500 | • DB up? `kubectl exec … psql -c '\l'`<br>• Redis ping<br>• Disk pressure                                                      |
| No leads parsed       | • IMAP creds valid?<br>• `adf-email-listener` pod logs: connection,<br>• Mailbox has `UNSEEN`?                                 |
| AI timeouts           | • `ai_response_latency_ms_p99` > 10 s?<br>• OpenAI rate limits 429?<br>• Fallback minimal dossier triggered                    |
| Emails not sent       | • `handover_email_sent_total{status="failed"}` increase?<br>• SendGrid dashboard suppression list<br>• Check webhook signature |
| High queue backlog    | • Redis slow log<br>• `bullmq` UI <http://host:3001>                                                                           |

---

## 6. Common Issues & Solutions

| Issue                 | Root Cause               | Fix                                                    |
| --------------------- | ------------------------ | ------------------------------------------------------ |
| Duplicate leads       | same externalId          | Parser de-dupe flag; clean older message               |
| IMAP disconnect loops | mail server idle timeout | increase `pollingIntervalSeconds`, enable keepalive    |
| TLS cert error        | corporate MITM           | set `IMAP_TLS_REJECT_UNAUTHORIZED=false` (last resort) |
| SendGrid 401          | rotated API key          | update secret, `kubectl rollout restart`               |

---

## 7. Performance Tuning

1. **Queue Concurrency**  
   `WORKER_CONCURRENCY` (default 4) – adjust per CPU.
2. **OpenAI Caching (Redis)**  
   Tune `OPENAI_CACHE_TTL` (s). Hit ratio via metric `cache_hits_total`.
3. **DB Indexes**  
   Ensure GIN indexes on `handovers.dossier`, B-tree on `adf_leads.external_id`.
4. **Batch Size**  
   `EMAIL_BATCH_SIZE` for SendGrid – start 50.

---

## 8. Backup & Recovery Procedures

| Asset          | Method                     | Frequency                | Restore Test |
| -------------- | -------------------------- | ------------------------ | ------------ |
| Postgres       | `pg_dump` to S3 via Velero | hourly WAL, nightly full | quarterly    |
| Redis          | RDB snapshot to PVC        | 30 min                   | monthly      |
| S3 Attachments | Cross-region replication   | real time                | yearly       |

Disaster scenario ➜ Provision new DB from latest snapshot, update `DATABASE_URL`, redeploy.

---

## 9. Security Considerations

- **Secrets** in Kubernetes `SealedSecret`; never in git.
- **HMAC validation** for SendGrid/Twilio webhooks (`*_WEBHOOK_SECRET`).
- PII redaction in logs (`logger.redactPaths`).
- Least-privilege DB roles: app user `adf_app`, readonly `adf_ro`.
- TLS enforced on IMAP/SMTP; allow plain only in staging.
- OWASP headers via `helmet` middleware.

---

## 10. Routine Maintenance Tasks

| Frequency | Task                          | Command           |
| --------- | ----------------------------- | ----------------- |
| daily     | Verify `/health` & `/metrics` | curl /health      |
| weekly    | Check OpenAI usage quota      | billing dashboard |
| weekly    | Review failed email/sms queue | SQL / Bull UI     |
| monthly   | Rotate API keys & credentials | Vault             |
| quarterly | Disaster-recovery drill       | follow §8         |

CronJob `cleanup_adf_logs` prunes logs > 30 days.

---

## 11. Escalation Procedures

| Level          | When to Escalate           | Contact / Action                   |
| -------------- | -------------------------- | ---------------------------------- |
| L1 (on-call)   | Alertmanager page P2       | Triage, attempt fix < 30 min       |
| L2 (team lead) | P1 alert or 1 h unresolved | Slack `#adf-alerts`, join war-room |
| L3 (CTO)       | Data loss, security breach | Phone escalation tree              |

Incident doc template in `docs/INCIDENT_TEMPLATE.md`.

---

## 12. Emergency Response Protocols

1. **Identify** severity via alerts / logs.
2. **Contain** – scale to zero faulty workers, disable email sending (`EMAIL_PROVIDER=mailhog`).
3. **Communicate** – post status in `#status-adf`, update status page.
4. **Remediate** – rollback Helm release or hot-fix.
5. **Verify** – run `npm run test:adf-e2e` against staging.
6. **Postmortem** within 24 h; record action items.

---

## 13. Appendix

- **Port map**: 3000 API, 3001 BullMQ UI, 9090 Prometheus scrape, 1025 MailHog SMTP, 8025 MailHog UI.
- **Run locally**: `docker compose up -d postgres redis mailhog` ➜ `npm run dev:server`.
- **Full test suite**: `npm run test:unit`, `npm run test:adf-e2e` (< 2 min).

Happy Operations! 🚀
