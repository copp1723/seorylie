# STAB-104 — Performance Tracker Utility  
_Status: Complete_

## 1. Objective  
Expose a reusable helper for measuring API response times and emit first-class Prometheus metrics so latency hotspots are visible in Grafana dashboards and alert rules.

---

## 2. What Was Implemented  
| Item | Description |
|------|-------------|
| `trackPerformance` helper | Wraps any sync/async Express handler, measures wall-clock duration, captures status code, emits Prometheus `http_request_duration_ms` (histogram) and increments `http_requests_total`. |
| `trackPerformanceMiddleware` | Drop-in middleware variant that instruments every downstream route in a router. |
| Route integration | Health endpoints and the entire **/api/v1** surface are now auto-instrumented. |
| Prometheus endpoint upgrade | `/metrics/prometheus` now streams the real registry, making the new metrics scrapeable. |
| Verification script | `scripts/verify-stab-104-performance-tracking.ts` performs end-to-end checks (requests → metrics). |

---

## 3. Files Created / Modified  
| Type | Path |
|------|------|
| **Created** | `monitoring/performance-tracker.ts` |
|          | `scripts/verify-stab-104-performance-tracking.ts` |
| **Modified** | `server/routes/health.ts` |
|          | `server/routes/api-v1.ts` |
|          | `server/routes/monitoring-routes.ts` (real Prometheus dump) |

---

## 4. How the Implementation Works  
1. `trackPerformance` records `Date.now()` before handler execution and overrides `res.json/send/end` to compute duration when the response finalises.  
2. The helper calls `prometheusMetrics.recordHttpRequest()` which feeds the singleton registry defined in `server/services/prometheus-metrics.ts`.  
3. Labels captured:  
   - `method` – HTTP verb (GET/POST/…)  
   - `route` – static route path (`/health`, `/api/v1/validate`, `/:id` placeholders normalised)  
   - `status_code` – integer status  
4. Errors are caught, logged, and still produce a metric with the correct status code (≥500).  
5. `trackPerformanceMiddleware('/api/v1')` automatically instruments **all** v1 endpoints with a one-line router `.use()`.

---

## 5. Integration with Existing Prometheus Metrics  
The utility piggybacks on the existing `PrometheusMetricsService` singleton:  
* Increments `http_requests_total` counter.  
* Observes `http_request_duration_ms` histogram.  

No duplicate registries: the same `register` object is reused, so Grafana dashboards and alert rules continue working.

---

## 6. Metrics Exposed & Access  
| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Throughput / error-rate SLOs |
| `http_request_duration_ms` | Histogram | `method`, `route`, `status_code` | P-95 / P-99 latency tracking |

Prometheus scrape endpoint:  
```
GET /metrics/prometheus
Content-Type: text/plain
```

Existing scrape config (`monitoring/prometheus/prometheus.yml`) already targets `cleanrylie-api:3000/metrics`.

---

## 7. How to Verify  
1. **Local run**  
   ```bash
   pnpm dev
   # or full stack
   docker compose up -d --build
   ```  
2. **Execute verifier**  
   ```bash
   npx tsx scripts/verify-stab-104-performance-tracking.ts
   ```  
   Expected: `✅ STAB-104 VERIFICATION PASSED`.
3. **Manual curl + scrape**  
   ```bash
   curl -s localhost:3000/health
   curl -s localhost:3000/api/v1/health
   curl -s localhost:3000/metrics/prometheus | grep http_requests_total
   ```  
   You should see lines similar to  
   ```
   http_requests_total{method="GET",route="/health",status_code="200"} 1
   http_request_duration_ms_bucket{route="/api/v1/health",le="100"} 1
   ```
4. **Grafana** – Dashboards auto-populate; import panel “API Latency (ms)” if not visible.

---

## 8. Usage Examples  

### Wrap Single Handler  
```ts
router.get('/users/:id', trackPerformance(async (req, res) => {
  const user = await UserService.get(req.params.id);
  res.json(user);
}));
```

### Instrument Whole Router  
```ts
import { trackPerformanceMiddleware } from '../monitoring/performance-tracker';

const router = Router();
router.use(trackPerformanceMiddleware('/api/v2'));
```

No further code changes required.

---

## 9. Benefits  
* **Zero-friction observability** – one-liner to instrument any route.  
* **Unified metric naming** – leverages existing counters/histograms, no new dashboards needed.  
* **Failure visibility** – even 5xx responses emit latency + count metrics.  
* **Performance budgets** – enables alerting on SLA/SLO thresholds (e.g., P-95 < 250 ms).  
* **Foundation for auto-tuning** – latency data will feed future adaptive rate-limit logic (STAB-203).

---

## 10. Next Steps / Follow-Ups  
* Add `trackPerformance` to WebSocket message handlers (STAB-112).  
* Ship Grafana panel preset in `monitoring/grafana/dashboards/api_latency.json`.  
* Introduce RED/GOLD SLO alert rules in `monitoring/prometheus/rules/system_alerts.yml`.

---

_Reviewed & approved by:_ **@TechLead**  
_Date merged:_ 2025-06-01  
_Linked PR:_ `feature/stab-104/performance-tracker`
