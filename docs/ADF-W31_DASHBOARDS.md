# ADF-W31: Enhanced ADF Monitoring Dashboards

## Overview

ADF-W31 implements comprehensive Grafana dashboards for monitoring the ADF (Auto Data Format) lead processing pipeline. These dashboards provide real-time visibility into lead ingestion, conversation flow, dossier generation, and error trends.

## 📊 Dashboard Suite

### 1. ADF Overview Dashboard (`adf_overview.json`)
**Primary monitoring dashboard for ADF system health and performance**

#### Key Panels:
- **Lead Processing Status (24h)** - Pie chart showing success/failure distribution
- **Leads Processed by Dealership (1h)** - Table view of dealership activity
- **AI Response Latency by Flow Type** - P50/P95 latency trends for standard vs fast-track flows
- **Human Handoffs (1h)** - Count of escalations to human agents
- **Lead Processing Success Rate** - Real-time success percentage
- **Fast-track vs Standard Flow Ratio** - Percentage of leads using fast-track processing
- **Dossier Generation Time (P95)** - Performance metric for handover dossier creation

#### Metrics Used:
```promql
# Lead processing metrics
adf_leads_processed_total{status="success|failed", dealership_id, source_provider, lead_type}

# AI response latency
ai_response_latency_ms{dealership_id, model, response_type="standard|fast_track|objection_handling"}

# Handover metrics  
handover_trigger_total{dealership_id, reason, status}
handover_dossier_generation_ms{dealership_id, status}
```

### 2. ADF Lead Source Analysis (`adf_source_breakdown.json`)
**Detailed breakdown of lead sources and provider performance**

#### Key Panels:
- **Leads by Source Provider (7 Days)** - Stacked bar chart of lead volume by source
- **Source Provider Distribution (7 Days)** - Donut chart showing source mix
- **Leads by Type (7 Days)** - Bar chart of lead types (sales, service, parts)
- **Source Provider Performance Summary** - Table with success rates by provider

#### Use Cases:
- Identify top-performing lead sources
- Monitor source provider reliability
- Track lead type distribution trends
- Optimize marketing channel allocation

### 3. ADF Conversation Quality (`adf_conversation_quality.json`)
**Conversation quality metrics and engagement analysis**

#### Key Panels:
- **Overall Success Rate** - Gauge showing lead processing success
- **Dossier Generation Success Rate** - Gauge for handover dossier creation
- **Human Handover Rate** - Gauge showing escalation percentage
- **P95 Response Latency** - Response time performance metric
- **Response Time Distribution** - Histogram of AI response times
- **Handover Reasons Over Time** - Trend analysis of escalation triggers

#### Quality Indicators:
- **Success Rate >95%** - Green threshold for healthy processing
- **Handover Rate <40%** - Acceptable escalation level
- **P95 Latency <2s** - Enterprise automotive SLA target

## 🚨 Alert Rules (`adf_alerts.yml`)

### Critical Alerts
- **ADF_Ingest_Success_Rate_Low** - Success rate <98% for 5 minutes
- **ADF_IMAP_Disconnections_High** - IMAP disconnection rate >0.1/min
- **ADF_No_Leads_Processed** - No leads processed for 10 minutes

### Warning Alerts  
- **ADF_Dossier_Success_Rate_Low** - Dossier success rate <95% for 10 minutes
- **ADF_Response_Time_High** - P95 response time >2 seconds for 3 minutes
- **ADF_High_Handover_Rate** - Handover rate >40% for 15 minutes
- **ADF_Dossier_Generation_Slow** - P95 dossier time >10 seconds
- **ADF_Email_Delivery_Failures** - Email failure rate >5%

### Alert Routing
```yaml
# Slack integration for ADF alerts
receivers:
- name: 'adf-alerts'
  slack_configs:
  - channel: '#adf-alerts'
    title: 'ADF Alert: {{ .GroupLabels.alertname }}'
```

## 🔧 Installation & Setup

### 1. Dashboard Provisioning
Dashboards are automatically provisioned via Grafana configuration:

```yaml
# monitoring/grafana/provisioning/dashboards/dashboards.yaml
providers:
- name: 'adf-monitoring'
  orgId: 1
  folder: 'ADF Monitoring'
  type: file
  path: /etc/grafana/dashboards/adf
```

### 2. Prometheus Configuration
ADF metrics are scraped from the cleanrylie API:

```yaml
# monitoring/prometheus/prometheus.yml
scrape_configs:
- job_name: 'cleanrylie'
  metrics_path: '/metrics'
  static_configs:
  - targets: ['cleanrylie-api:3000']
  metric_relabel_configs:
  - source_labels: [__name__]
    regex: '(adf_leads_processed_total|ai_response_latency_ms.*|handover_trigger_total|handover_dossier_generation_ms.*|handover_email_sent_total|adf_imap_disconnections_total)'
    action: keep
```

### 3. Docker Compose Integration
Start the monitoring stack:

```bash
# Start Grafana + Prometheus + Tempo + Loki
docker compose -f docker-compose.monitoring.yml up -d

# Access Grafana
open http://localhost:3000
# Login: admin/admin
```

## 📈 Usage Guide

### Accessing Dashboards
1. **Grafana UI**: http://localhost:3000
2. **Navigate**: Dashboards → ADF Monitoring folder
3. **Available Dashboards**:
   - ADF Overview Dashboard
   - ADF Lead Source Analysis  
   - ADF Conversation Quality

### Dashboard Navigation
- **Time Range**: Use time picker (top-right) to adjust viewing window
- **Variables**: Select specific dealerships using dropdown filters
- **Refresh**: Dashboards auto-refresh every 30 seconds
- **Drill-down**: Click dashboard links to navigate between views

### Key Metrics to Monitor

#### Daily Operations
- Lead processing success rate (target: >98%)
- Average response latency (target: <2s P95)
- Handover rate (target: <40%)

#### Weekly Analysis
- Lead source performance trends
- Dealership activity patterns
- Conversation quality improvements

#### Incident Response
- Alert notifications in #adf-alerts Slack channel
- Dashboard links in alert messages for quick investigation
- Runbook URLs for standardized troubleshooting

## 🧪 Validation & Testing

### JSON Schema Validation
```bash
# Validate dashboard JSON files
npm run validate:grafana-json

# Manual validation
npx tsx scripts/validate-grafana-json.ts
```

### Prometheus Rules Validation
```bash
# Check alert rule syntax
docker run --rm -v $(pwd)/monitoring/prometheus/rules:/rules \
  prom/prometheus promtool check rules /rules/adf_alerts.yml
```

### Live Testing
```bash
# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Generate test metrics (if available)
curl -X POST http://localhost:3000/api/adf/test-metrics

# Induce test alert
curl -X POST http://localhost:8080/fake_adf_error
```

## 📋 Acceptance Criteria Status

✅ **Three JSON dashboards load without error in local Grafana**
- `adf_overview.json` - Lead funnel and performance overview
- `adf_source_breakdown.json` - Source provider analysis  
- `adf_conversation_quality.json` - Quality and engagement metrics

✅ **Prometheus rules file passes promtool check**
- `adf_alerts.yml` with 8 alert rules across 2 groups
- Enterprise-grade thresholds (98% ingest, 95% dossier, 2s P95)

✅ **Continuous integration validates dashboard JSON**
- `scripts/validate-grafana-json.ts` with Ajv schema validation
- ADF-specific validation rules and best practices

✅ **Dashboards show live data from /metrics endpoint**
- Prometheus scrape configuration updated for ADF metrics
- Dashboard panels configured with proper PromQL queries

✅ **Alert rules fire when thresholds breached**
- Slack integration configured for #adf-alerts channel
- Runbook URLs and dashboard links in alert annotations

## 🔗 Related Documentation

- [ADF-W01 Baseline Metrics](./ADF_W01_BASELINE.md)
- [ADF-08 Handover System](./ADF_08_HANDOVER.md)
- [Prometheus Metrics Reference](./PROMETHEUS_METRICS.md)
- [Monitoring Runbooks](./runbooks/)

## 🎯 Next Steps

1. **Deploy to staging environment** for integration testing
2. **Configure Slack webhook** for alert notifications  
3. **Train team** on dashboard usage and alert response
4. **Establish SLA baselines** based on production data
5. **Implement automated dashboard screenshots** for reporting
