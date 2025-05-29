# Database Connection Pool Monitoring Guide

*For operations & SRE teams monitoring the CleanRylie production cluster.*

---

## 1  Overview of the C3 Enhanced Connection Pool

| Feature | Value | Benefit |
| ------- | ----- | ------- |
| **Max Connections** | 20 (`DB_POOL_MAX_CONNECTIONS=20`) | Doubles throughput from the legacy pool (10) while keeping CPU/RAM in check |
| **Idle Timeout** | 30 s (`DB_POOL_IDLE_TIMEOUT_MS=30000`) | Frees unused connections quickly, reducing idle resource cost |
| **Prometheus Metrics** | `prom-client` integration | First-class observability, zero-config scrape by Prometheus |
| **Real-Time Stats Endpoint** | `/api/metrics/database/pool` | JSON snapshot for dashboards & scripts |
| **Graceful Back-pressure** | Built-in queue for waiting clients | Prevents “too many connections” database errors |
| **Load-Tested Baseline** | 100 RPS for 3 min @ <1 % error | Verified capacity for typical production peaks |

---

## 2  Key Metrics & Meaning

| Metric | Description | Healthy Range |
| ------ | ----------- | ------------- |
| `db_pool_active_connections` | Current in-use connections | 0 → `DB_POOL_MAX_CONNECTIONS`<br>Alert if consistently > 80 % |
| `db_pool_idle_connections` | Available connections ready to serve | ≥ 1 during off-peak |
| `db_pool_waiting_connections` | Clients waiting for a free connection | Should be **0** most of the time; spikes indicate saturation |
| `db_pool_max_connections` | Hard limit (20) | Config value – if gauge ≠ 20 investigate |
| `db_pool_connection_acquire_duration_seconds` *¹ | Time to obtain a connection | p95 < 50 ms |
| `process_open_fds` / `nodejs_eventloop_lag_seconds` | System health (indirect) | Monitor for back-pressure side-effects |

*¹ Optional histogram metric – enable via `ENABLE_DB_POOL_DURATION_METRIC=true`.*

---

## 3  Monitoring End-points

| Path | Method | Auth | Response (✓ = 200 OK) | Notes |
| ---- | ------ | ---- | ---------------------- | ----- |
| `/api/metrics/database/pool` | GET | Internal token | `{ data: { active, idle, max, waiting, status } }` | Lightweight JSON |
| `/api/metrics/database/performance` | GET | Internal token | Aggregated latency & error stats | Uses real-time pool stats |
| `/metrics` | GET | None | Prometheus format | Exposes **all** app metrics |

_Example curl_  
```bash
curl -s http://prod-api:3000/api/metrics/database/pool | jq
```

---

## 4  Prometheus Integration

1. **Service Discovery** – Ensure the API pods are labelled `app=cleanrylie` and expose port **3000**.
2. **Scrape Config**
   ```yaml
   scrape_configs:
     - job_name: 'cleanrylie-db-pool'
       metrics_path: /metrics
       scheme: http        # HTTPS if behind TLS ingress
       static_configs:
         - targets: ['cleanrylie-api:3000']
   ```
3. **Dashboards**
   * Import Grafana dashboard template `cleanrylie-db-pool.json`.
   * Key panels: Active vs Idle Connections, Waiting Queue, Acquire Latency p95.

---

## 5  Performance Tuning Guidelines

| Scenario | Setting | Guidance |
| -------- | ------- | -------- |
| **High CPU, low DB utilisation** | Decrease `DB_POOL_MAX_CONNECTIONS` (e.g., 15) | Reduces context-switch overhead |
| **Frequent Waiting Connections** | Increase pool size incrementally (2-3 at a time) | Monitor PG CPU & `pg_stat_activity` |
| **Connection Storms after Deploys** | Stagger pod rollout; set `maxSurge=1` | Prevents thundering-herd |
| **Memory Pressure** | Lower `idleTimeout` to 15 s | Drops unused sockets faster |

_Note_: Always run `test/load/db-pool-load-test.js` in staging after changes.

---

## 6  Troubleshooting Common Issues

| Symptom | Likely Cause | Resolution |
| ------- | ------------ | ---------- |
| `ECONNREFUSED` / `ENETUNREACH` errors | DB credentials / network | Check `DATABASE_URL`, SG rules |
| `remaining connections = 0` in logs | Pool exhausted | Increase pool size **or** optimise queries |
| High `waiting_connections` but low DB CPU | Long-running transactions | Kill or optimise offending queries (`pg_stat_activity`) |
| Metrics endpoint 500 | Prom client registry conflict | Restart pod (bug in prom-client <14) |
| Spikes in `connection_acquire_duration` | PG I/O stall | Investigate storage, VACUUM, autovacuum settings |

---

## 7  Alert Recommendations

| Alert | Expression | Severity | Note |
| ----- | ---------- | -------- | ---- |
| **Pool Saturation** | `db_pool_active_connections / db_pool_max_connections > 0.9` for 5 m | high | Scale app / pool |
| **Waiting Clients** | `db_pool_waiting_connections > 0` for 1 m | high | Immediate saturation |
| **Acquire Latency** | `histogram_quantile(0.95, rate(db_pool_connection_acquire_duration_seconds_bucket[5m])) > 0.05` | medium | Latency > 50 ms |
| **Prom Metrics Missing** | `absent(db_pool_active_connections)` | critical | Exporter down |
| **Error Rate** | `rate(http_server_requests_errors_total[5m]) > 0.01` | medium | Watch for cascading failures |

---

## 8  Best Practices for Pool Configuration

1. **Environment-based Sizing**  
   * Dev/CI: `max=5`, Idle 10 s  
   * Staging: `max=10`  
   * Production: start at `max=20`, adjust based on load tests.

2. **One Pool per Process** – Re-use the singleton in `server/db.ts`; never create ad-hoc pools.

3. **Disable Autocommit in Long Tasks** – Use explicit transactions to avoid holding connections.

4. **Query Timeouts** – Set `statement_timeout` (e.g., 5 s) to free connections quickly.

5. **Graceful Shutdown** – Handle `SIGTERM` to `pool.end()` before pod termination.

6. **Observe Before Tuning** – Change **one variable at a time**, re-run load tests, compare Grafana graphs.

---

### ☑️ Quick Operational Checklist

- [ ] Dashboards show < 80 % active utilisation under typical load.  
- [ ] `waiting_connections` consistently **0**.  
- [ ] Alerts configured & tested.  
- [ ] Load test executed after every pool configuration change.  
- [ ] Pool settings documented in runbook and `.env`.  

---

**Need help?** Ping `#oncall-backend` or consult the [Integration Guide](INTEGRATION_GUIDE.md) for rollback steps.  
*Document version: 1.0 — Last updated {{DATE}}.*  
