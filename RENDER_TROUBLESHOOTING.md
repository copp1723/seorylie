# Render Deployment Troubleshooting Guide  
_This guide targets the **seorylie** services (`seorylie`, `seorylie-production`) currently failing to deploy on Render._

---

## 1. Validate Environment Variables

| Critical Var | Where to Get It | Notes |
|--------------|-----------------|-------|
| `DATABASE_URL` | Render ➜ PostgreSQL ➜ **Internal** connection URL | Required **before build**. |
| `SESSION_SECRET`, `JWT_SECRET` | Local terminal → `openssl rand -base64 32` | Mark **Sync OFF**. |
| `OPENAI_API_KEY` | OpenAI dashboard | Mark **Sync OFF**. |
| `SENDGRID_API_KEY` | SendGrid dashboard (if email) | Optional; mark **Sync OFF**. |

### Steps  
1. Render Dashboard → _Service_ → **Environment**.  
2. Click **Add/Override** → paste values above.  
3. **Save** → trigger **Manual Deploy**.

> 🔍 Tip: Missing or wrong secrets are the #1 cause of "exited with status 1 while building your code".

---

## 2. Verify Docker Build Settings

1. Dashboard → _Service_ → **Settings**.  
2. Confirm:
   * **Runtime** = Docker  
   * **Dockerfile** path = `Dockerfile`  
   * **Context** = root of repo  
   * **Docker Command** = `npm run start`  
3. If you changed any value, click **Save** then **Manual Deploy**.

---

## 3. Inspect Deployment Logs

1. Dashboard → _Service_ → **Events** → click the latest **Deploy failed** entry.  
2. Press **View Logs**.  
3. Match the error pattern:

| Log Snippet | Quick Fix |
|-------------|-----------|
| `Error: Missing env var ...` | Add it in Environment tab, redeploy. |
| `npm ERR!` or `esbuild ERROR` | Pull latest code (`main`), ensure your service uses that branch, redeploy. |
| `Cannot connect to ... postgres` | See section 5 (DB connectivity). |
| `Exited with status 137 / OOM` | Upgrade plan or lower memory use. |

---

## 4. Resolve Common **502** Errors

502 on Render almost always means **the container started but the app crashed**.

| Check | Command (Service → Shell) |
|-------|---------------------------|
| App listening on port `$PORT`? | `curl localhost:$PORT/health` |
| Health endpoint returns JSON? | Should include `"status":"ok"` |
| Node error stack traces | `cat /opt/render/project/src/logs/*` |

Fixes:
1. Port mismatch → ensure your server uses `process.env.PORT` (already handled in `minimal-production-server.js`).  
2. Unhandled promise rejection → check logs, patch code, redeploy.  
3. Missing DB migrations → run `npm run migrate` (see §5).

---

## 5. Verify Database Connectivity

Inside the running container (Shell):

```bash
env | grep DATABASE_URL         # confirm URL
apt-get update && apt-get install -y postgresql-client
pg_isready -d "$DATABASE_URL"   # should report "accepting connections"
```

If **not accepting**:
- PostgreSQL service not provisioned or sleeping → open its page, ensure **Status = Running**.  
- Wrong password/host → copy **Internal Connection String** again.

Run migrations once:

```bash
npm run migrate
npm run db:seed   # optional demo data
```

---

## 6. Manual Deployment (when Auto-Deploy fails)

1. Dashboard → _Service_ → top-right **Manual Deploy ▾** → **Deploy latest commit**.  
2. If you need to test a local fix quickly:  
   ```bash
   # from repo root
   git checkout -b hotfix/render-fix
   # commit & push
   git push origin hotfix/render-fix
   ```
   Then set **Branch** (Settings → Build & Deploy) to `hotfix/render-fix` and hit **Manual Deploy**.  
3. After success, merge hot-fix back into `main`, reset service branch to `main`, deploy again.

---

## Quick Checklist Before Re-Deploy

- [ ] All critical env vars present and **Sync OFF**.  
- [ ] Dockerfile path & command correct.  
- [ ] `npm run build:server` passes locally.  
- [ ] `render.yaml` matches service name or service updated to new name.  
- [ ] Database reachable & migrations applied.  
- [ ] **Manual Deploy** triggered.

> Follow the list top-to-bottom; 90% of first-deploy failures clear after steps 1-3.

---

**Need more help?**  
- Render → left sidebar **Shell** for live debugging.  
- Render docs: <https://render.com/docs/troubleshooting>  
- Contact support (_Dashboard → ? Help → Contact Support_) with latest deploy ID.
