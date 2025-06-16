# Seorylie Deployment Guide (Render.com)

_Last updated: 2025-06-16_

This guide walks you through launching the **seorylie** platform to production on [Render](https://render.com) **today**.

---

## 1. Prerequisites & Requirements

| Requirement | Notes |
|-------------|-------|
| Render account | Free to create. Upgrade to Starter or above for production uptime. |
| GitHub repository | `https://github.com/copp1723/seorylie` must be accessible to Render |
| Docker experience | Basic familiarity (Render builds from `Dockerfile`) |
| Billing enabled on Render | Needed for persistent Postgres & higher instance sizes |
| Domain (optional) | If you plan to map a custom domain (`seorylie.com`) |

Local tools (optional for verification):
```bash
npm i -g render-cli        # verify deployments
curl, jq                   # test endpoints
```

---

## 2. Step-by-Step Deployment on Render

1. **Fork / push latest code**  
   ```bash
   git clone https://github.com/copp1723/seorylie.git
   cd seorylie
   # ensure `main` is up-to-date, push any local commits
   git push origin main
   ```

2. **Create a PostgreSQL service**  
   - Render Dashboard → "New → PostgreSQL"  
   - Region: same as app (e.g., Oregon)  
   - Plan: Starter or above  
   - Copy the `Internal Database URL` (will be your `DATABASE_URL`).

3. **(Optional) Create a Redis service**  
   - Needed for caching & sessions (recommended).  
   - Render → "New → Redis" → Starter plan.  
   - Copy the Redis URL (`REDIS_URL`).

4. **Add the Web Service**  
   Render auto-detects the `render.yaml` in the repo:

   - Dashboard → "New +" → "Blueprint"  
   - Point to your GitHub repo, branch `main`.  
   - Render shows the single **Web Service** defined in `render.yaml`.  
   - Click **Create Resources**.  
   - First build will take ~3-5 min (multi-stage Docker).

5. **Populate environment variables**  
   During creation Render prompts for variables flagged `sync: false`. Paste real values (see section 3).

6. **Run initial database migrations**  
   After the web service is live, open a Render **Shell** for the service and execute:
   ```bash
   npm run migrate          # runs drizzle migrations
   npm run db:seed          # optional initial data
   ```

7. **Verify deployment** (section 5).  
   Your API is now reachable at `https://<service-name>.onrender.com`.

---

## 3. Environment Variables

| Key | Required | Description |
|-----|----------|-------------|
| `NODE_ENV` | yes | Must be `production` (render.yaml sets this). |
| `PORT` | yes | Render sets automatically (`$PORT`). Keep `3000` fallback. |
| `DATABASE_URL` | yes | Render Postgres **Internal** URL. |
| `SESSION_SECRET` | yes | `openssl rand -base64 32` |
| `JWT_SECRET` | yes | `openssl rand -base64 32` |
| `OPENAI_API_KEY` | yes | From OpenAI dashboard. |
| `SENDGRID_API_KEY` | yes if email needed | From SendGrid dashboard. |
| `REDIS_URL` | optional | Render Redis internal URL. |
| `FRONTEND_URL` | optional | Public site URL (used for CORS, emails). |
| `CORS_ORIGIN` | optional | Usually same as `FRONTEND_URL`. |
| `LOG_LEVEL` | optional | `info` (default) or `debug`. |

🚩 **Secrets:** mark as **Sync = OFF** in Render.

---

## 4. Database Setup

1. Render Postgres is provisioned empty.  
2. The Docker image already contains migration scripts (`migrations/*.sql`).  
3. Run `npm run migrate` once (see step 6 above).  
4. For local debugging:  
   ```bash
   docker exec -it <container-id> psql $DATABASE_URL
   ```
5. If you later enable Row Level Security (RLS) scripts keep using `npm run migrate` which calls `drizzle-kit`.

---

## 5. Post-Deployment Verification

```bash
BASE=https://<service-name>.onrender.com
curl -s $BASE/health | jq           # should return {"status":"ok", ...}

# Auth route ping (returns 401 when unauthenticated – expected)
curl -I $BASE/api/v1/auth/status

# Metrics (Prometheus format)
curl -s $BASE/metrics | head
```

Browser checks:
1. Open `$BASE` – you should see **API OK** message.  
2. Navigate to `$BASE/api-docs` – Swagger UI should load.  
3. If using the React client, confirm static assets load from `/` path.

---

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Build fails on **tailwindcss dynamic require** | Old cache or mixed ES/CJS | Render rebuild → "Clear build cache" then redeploy |
| `DATABASE_URL` not found | Secret missing | Add env var & redeploy |
| 502 / healthcheck fails | App crashed on start | Check "Logs" tab, ensure migrations complete, secrets valid |
| `ECONNREFUSED` to Postgres | Using **External** DB URL on Render | Switch to **Internal** URL |
| Emails not sent | Missing `SENDGRID_API_KEY` | Add key or disable email features |

---

## 7. Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic liveness + uptime |
| `GET /api/health/services` | Detailed service statuses |
| `GET /metrics` | Prometheus metrics |
| `GET /healthz` (worker) | ADF worker container (if separated) |

`render.yaml` already points Render's health check to `/health`.

---

## 8. Scaling Considerations

### Vertical

- Starter instance supports **512 MB / 0.5 CPU**; upgrade to **Standard** for heavy ADF parsing or high traffic.
- Increase **Memory** if OpenAI streaming or PDF generation fails with OOM.

### Horizontal

- Render Autoscale: enable **Auto-Deploy + Pull Request Previews**.
- For chat scale: separate **WebSocket service** (use the same Dockerfile but different start command).
- Background workers:  
  ```yaml
  type: worker
  dockerCommand: npm run start:adf-worker
  ```
  Create 1–3 worker instances depending on email volume.

Monitoring via built-in metrics or external Prometheus/Grafana (Tempo config included in repo).

---

## You're Live!

🎉 Your seorylie production API is ready.  
Update DNS to point `<your-domain>` to Render's CNAME, flip `FRONTEND_URL`, and start sending ADF leads 🚗.
