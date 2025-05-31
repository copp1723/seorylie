# ADF-08 – Enhanced Automated Handover Notification  
_Sales Dossier Generation & Delivery_

---

## 1 ▪ System Overview & Architecture
The ADF-08 subsystem turns an **AI-detected handover intent** into a **rich Sales Dossier** that is emailed to a dealership sales inbox and tracked end-to-end.

High-level flow:

1. `intent.ready_for_handover` event (emitted by ADF-07 Intent Detection)  
2. **Handover Orchestrator**  
   - idempotency check  
   - create `handovers` row (`status=pending`)  
   - call **Handover Dossier Service** → OpenAI → dossier JSON  
   - persist dossier in `handovers.dossier`  
   - send email via **Email Service** using `handover-dossier.html|txt`  
   - update status → `email_sent | email_failed`  
   - emit `handover_email.sent | .failed`
3. **SendGrid Webhook** updates delivery status (`email_delivered` / `email_failed`)
4. Prometheus metrics & alerts

```
intent.ready_for_handover
            │
            ▼
┌────────────────────────────┐
│   Handover Orchestrator    │
└────────────────────────────┘
            │
            ▼
┌────────────────────────────┐
│  Handover Dossier Service  │───► OpenAI (generateHandoverDossier)
└────────────────────────────┘
            │
            ▼
┌────────────────────────────┐
│   Email Service (SendGrid) │────► SendGrid ► Customer Inbox
└────────────────────────────┘
            │                               │
            ▼                               ▼
  handovers.dossier           SendGrid Webhook → DB update
```

---

## 2 ▪ Component Descriptions

| Component | Path | Responsibility |
|-----------|------|----------------|
| **Handover Orchestrator** | `server/services/handover-orchestrator.ts` | Listens for ready_for_handover, coordinates dossier generation & email |
| **Handover Dossier Service** | `server/services/handover-dossier-service.ts` | Wraps `generateHandoverDossier()` and enriches with dealership context, SLA, lead score |
| **Email Service** | `server/services/email-service.ts` | Multi-provider (SendGrid / MailHog) email dispatch |
| **Email Templates** | `server/templates/email/handover-dossier.{html,txt}` | Responsive HTML + text fallback |
| **SendGrid Webhook** | `server/routes/webhooks/sendgrid.ts` | Validates signature, updates delivery status, emits events |
| **Prometheus Metrics** | `server/services/prometheus-metrics.ts` | `handover_dossier_generation_ms`, `handover_email_sent_total{status}` |
| **Database Schema** | `lead-management-schema.ts`, migration `0010_dealership_handover_settings.sql` | New tables / columns (see below) |

---

## 3 ▪ Database Schema Changes

### 3.1 Table `dealership_handover_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK |
| dealership_id | FK→`dealerships.id` UNIQUE |
| handover_email | varchar(255) | Target inbox |
| sla_hours | int (default 24) | Response SLA |
| dossier_template | varchar(100) | Future theming |
| is_enabled | bool (default true) |
| created_at / updated_at | timestamptz |

### 3.2 Table `handovers` (additions)
* `dossier jsonb` – full Sales Dossier  
* GIN index `handovers_dossier_gin`

---

## 4 ▪ Event-Driven Workflow

| Step | Event | Producer | Consumer |
|------|-------|----------|----------|
| 1 | `intent.ready_for_handover` | Intent Engine | Handover Orchestrator |
| 2 | `handover:initiated` | Orchestrator | metrics / logs |
| 3 | `handover_email.sent / failed` | Orchestrator | metrics / alerts |
| 4 | `email.delivered / failed` | SendGrid Webhook | Orchestrator (status updates) |

Idempotency: Orchestrator checks `handovers` for `status=pending` to prevent duplicates.

---

## 5 ▪ Sales Dossier Structure (`handovers.dossier`)

```json
{
  "customerName": "Jane Doe",
  "customerContact": "jane@example.com | +1-555-555-0199",
  "conversationSummary": "Short narrative…",
  "customerInsights": [
    {"key":"Budget","value":"<$35k","confidence":0.83}
  ],
  "vehicleInterests": [
    {"make":"Toyota","model":"RAV4 Hybrid","year":2024,"confidence":0.91}
  ],
  "suggestedApproach": "Offer weekend test-drive…",
  "urgency": "high",
  "escalationReason": "customer_request",
  "leadScore": 78,
  "slaDeadline": "2025-06-01 18:00 UTC",
  "dealershipName": "Factory Toyota",
  "dealershipContact": "sales@factorytoyota.com",
  "handoverTimestamp": "2025-05-30T12:34:56Z",
  "generatedAt": "2025-05-30 12:34 UTC"
}
```

---

## 6 ▪ Email Template System
* **HTML**: responsive, brand colors, urgency badge, tables, progress bars.
* **Text**: ASCII fallback, 72-char width.
* Handlebars helpers:
  * `multiply` – percentage bars
  * `uppercase`
  * `formatConfidence`
* Subject line: `[HIGH] Sales Lead Handover: Jane Doe` (urgency prefix).

---

## 7 ▪ Webhook Integration

### 7.1 Security
* HMAC SHA-256 verification using `SENDGRID_WEBHOOK_SECRET`
* Rate-limited (`express-rate-limit`): 100 req / 15 min

### 7.2 Statuses Handled
| SendGrid Event | Internal Mapping |
|----------------|------------------|
| delivered | `emailDeliveredAt` + metrics `status=delivered` |
| bounce/dropped/blocked | `status=email_failed` + reason |
| deferred | context only |

---

## 8 ▪ Environment Configuration

```
# Enable / disable
HANDOVER_EMAIL_ENABLED=true

# Email provider
EMAIL_PROVIDER=sendgrid          # or mailhog
SENDGRID_API_KEY=SG.xxxxxx
SENDGRID_FROM_EMAIL=ai@dealer.com
SENDGRID_WEBHOOK_SECRET=whsec_xx

# Development
EMAIL_PROVIDER=mailhog
MAILHOG_HOST=localhost
MAILHOG_PORT=1025
```

---

## 9 ▪ Testing Procedures

| Layer | Command | What it does |
|-------|---------|--------------|
| Unit (90 %+) | `npm run test:unit` | Jest/Vitest for generator & orchestrator |
| Integration | `npm run test:adf-handover` | Creates data → emits event → verifies email & DB |
| Load | adjust `scripts/test-adf-handover.ts` | 100 dossiers /10 min |
| Manual | Check MailHog UI | Validate HTML renders |

---

## 10 ▪ Troubleshooting Guide

| Symptom | Possible Cause | Action |
|---------|----------------|--------|
| Email not sent | `HANDOVER_EMAIL_ENABLED=false` | Enable flag |
| SendGrid 403 | Wrong API key / IP lockdown | Verify key / allowlist IP |
| Dossier timeout | OpenAI latency | `timeoutMs` setting or fallback logic |
| Duplicate handovers | Event emitted twice | Confirm idempotency query |

Logs:
```
grep handover-orchestrator server.log | jq .
```

---

## 11 ▪ Deployment Checklist

- [ ] Apply migration `0010_dealership_handover_settings.sql`
- [ ] Populate `handover_email` for each dealership
- [ ] Set secrets: `SENDGRID_API_KEY`, `SENDGRID_WEBHOOK_SECRET`
- [ ] Expose `/webhooks/sendgrid` route publicly
- [ ] Configure SendGrid Event Webhook → HTTPS URL
- [ ] `docker compose up -d mailhog` (dev)
- [ ] `npm run db:migrate`
- [ ] Smoke test: `npm run test:adf-handover`

---

## 12 ▪ Operational Runbook

### 12.1 Monitoring

Metric | SLO | Dashboard
-------|-----|-----------
`handover_dossier_generation_ms_p95` | < 8 s | Grafana → *ADF Handover*
`handover_email_sent_total{status="failed"}` | < 5 /10 min | Alert P1
`handover_email_sent_total{status="retry_failed"}` | < 1 /hour | Alert P2

### 12.2 Alerting

PrometheusRule (excerpt):

```
- alert: HandoverEmailFailures
  expr: increase(handover_email_sent_total{status="failed"}[10m]) > 5
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Handover email failures >5 in 10m"
```

PagerDuty routing via existing ADF-09 integration.

### 12.3 Runbook Steps

1. Check Grafana panel “ADF Handover Failures”.
2. Inspect logs `handover-orchestrator`.
3. If SendGrid bounce, open dashboard → message events.
4. Use `/api/handovers/:id` to retrieve dossier JSON.
5. If OpenAI timeout: set `OPENAI_FALLBACK_ENABLED=true`.

---

## 13 ▪ Performance Considerations

* Dossier generation timeout 10 s; fallback dossier in 300 ms.
* Conversation > 200 messages → summarization slice (first 50 + last 150).
* Histogram buckets sized for <30 s worst-case latency.
* Email retries: single retry after 5 min to avoid spam bursts.

---

## 14 ▪ Roll-out Plan

1. **Phase 0 – Migration:** deploy schema + default settings (no email).  
2. **Phase 1 – Shadow Mode:** `is_enabled=true`, `HANDOVER_EMAIL_ENABLED=false`. Dossiers stored, metrics only.  
3. **Phase 2 – Pilot Dealerships:** Enable email for 2 stores, monitor 48 h.  
4. **Phase 3 – Full Roll-out:** Toggle flag for all dealerships.  
5. **Phase 4 – Post-Launch Review:** Analyze p95 generation time & email success >95 %.  

Rollback: set `HANDOVER_EMAIL_ENABLED=false`, revoke SendGrid key, revert migration (drop column & table).

---

## 15 ▪ Complete Handover Lifecycle

| Stage | Actor | Artifact |
|-------|-------|----------|
| Intent detected | AI | `intent.ready_for_handover` |
| Orchestrator creates handover | Orchestrator | `handovers` row (`pending`) |
| Dossier generated | Handover Dossier Service → OpenAI | `handovers.dossier` |
| Email sent | Email Service | Message ID stored |
| Delivery confirmed | SendGrid → Webhook | `handovers.status=email_sent`, `context.emailDeliveredAt` |
| Metrics recorded | Prometheus | Latency & counts |
| SLA tracked | `slaDeadline` in dossier | Sales team dashboard |

---

**ADF-08 subsystem is now fully documented.**  
For questions: `#adf-handover` Slack channel or `ops@factory.ai`.
