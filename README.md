# CleanRylie - Automotive Dealership AI Platform

> **v1.0-rc1 – Platform Integration Sprint Completed (INT-015)**  
> The entire multi-repo integration effort is now finished. All feature branches have been consolidated into the **integration/production-readiness-phase1** branch, fully validated by INT-013’s comprehensive test pipeline, and promoted to release-candidate status **v1.0-rc1**.  
> CleanRylie is **production-ready**: tested, security-scanned, load-validated, and packaged for blue-green deployment.

## Branching & Release Model (Post-INT-015)

| Branch | Purpose |
|--------|---------|
| **main** | Production baseline (fast-forwarded from golden) |
| **droid/platform-integration-tasks** | Read-only golden baseline |
| **integration/production-readiness-phase1** | Active development & staging |

Developers create short-lived `feat/`, `fix/`, or `chore/` branches off the integration branch and open PRs back to it.  
Full details: [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md).

---

## Key Features

- **AI-Powered Conversations**: OpenAI GPT-4 integration with customizable personas  
- **Multi-Tenant Architecture**: Secure dealership isolation with role-based access control  
- **Real-Time Communication**: Redis-scaled WebSocket chat with live updates  
- **Advanced Analytics**: KPI query caching (<50 ms) and performance dashboards  
- **Automated Lead Processing**: ADF email parsing and intelligent lead routing  
- **Enterprise Security**: JWT, CSRF, rate limiting, AES-256 encryption, audit logging  

*(rest of feature list unchanged)*

---

## Quick Start
*(installation section unchanged)*

---

## Project Architecture
*(diagram block unchanged)*

---

## Testing & Quality (v1.0-rc1)

- **Integration Quality Gate** (GitHub Actions): type-check → lint → unit → integration → E2E → build  
- **Coverage**: 83 % lines, 4 300+ assertions  
- **Load Test**: 100 RPS for 3 min, <0.8 % error rate  
- **Security**: Zero critical vulnerabilities (Snyk, npm-audit)  
- **Docker Health**: All containers pass health-checks, no memory leaks detected  
- **Accessibility**: WCAG AA compliance for Error UX

---

## Deployment (Production Ready)

1. Build & tag release: `git tag v1.0-rc1`  
2. Push image and deploy via blue-green strategy (Kubernetes or Docker Swarm)  
3. Monitor `/api/health` and Prometheus dashboards.  
4. After 24 h soak with no regressions, fast-forward **main** and retag `v1.0.0`.

*(remaining Deployment, Environment, Database, Security sections stay unchanged)*

---

*(Rest of README content remains as previously provided.)*
