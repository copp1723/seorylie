# CleanRylie Stabilization Branching Strategy

> Last updated: **v2.0-stabilization** (post-STAB-502)

---

## 1. Overview

CleanRylie follows a **stabilization git strategy** for controlled feature development and production readiness:

```
main ─┬─► (production)
      │
      └─ stabilization ─► (long-lived integration branch)
          ├─ feature/stab-101/bundle-size-guard
          ├─ feature/stab-102/performance-tracker
          ├─ feature/stab-103/schema-versioning
          └─ feature/stab-<ID>/<description>
```

All feature development happens on `feature/stab-<ID>/<desc>` branches that merge into `stabilization`. Only when STAB-502 production readiness passes does code move to **main**.

---

## 2. Stabilization Branch – `stabilization`

* **Purpose**: Long-lived integration branch for all stabilization features
* **Permissions**: Protected - requires PR review and CI passing
* **Update cadence**: Feature branches merge after quality gates pass
* **Quality gates**: TypeScript compilation, tests, linting, security checks

---

## 3. Feature Branches – `feature/stab-<ID>/<description>`

* **Naming convention**: `feature/stab-<ID>/<short-description>`
* **Examples**:
  - `feature/stab-101/bundle-size-guard`
  - `feature/stab-102/performance-tracker`
  - `feature/stab-103/schema-versioning`
* **Lifespan**: ≤ 5 days, ≤ 500 LOC diff
* **Base branch**: Always branch from `stabilization`

* **Role**: Staging area for all feature and bug-fix work.  
* **Usage rules**
  1. Every PR targets this branch.  
  2. Must pass the _Integration Quality Gate_ workflow (`.github/workflows/integration-quality-gate.yml`) – unit, integration, E2E, type-check, lint, build.  
  3. Use `scripts/conflict-reporter.ts` before starting and `scripts/smart-integrate.sh` for cherry-picking if multiple source branches are involved.  
  4. Tag PR titles with risk emoji (🟢🟡🔴).

---

## 4. `main` Branch – Production Baseline

* **Locked** behind “Require status checks” and “Require PR review” rules.  
* Only maintainers fast-forward from `droid/platform-integration-tasks` after all release checks pass.  
* Protected from force-push; hotfixes allowed (see Section 10).

---

## 5. Creating New Feature Branches

```
git checkout -b feat/TICKET-ID/short-description integration/production-readiness-phase1
```

* Prefix options  
  * **feat/** – new capability  
  * **fix/** – bug fix  
  * **chore/** – tooling/docs  
* Include ticket ID (e.g. `C7`, `INT-016`).  
* Keep lifespan ≤ 5 days and ≤ 500 LOC diff.

---

## 6. Pull Request & Code Review

| Step | Owner | Tooling |
|------|-------|---------|
| Push branch | Developer | `pre-push` hook runs `npm run check` |
| Open PR → integration | Developer | Title: `🟡 INT-016 KPI Alerting` |
| Automatic CI | GitHub Actions | Quality Gate MUST be green |
| Review | 1 peer + maintainer | Focus: scope, tests, security |
| Merge (Squash) | Maintainer | `Squash-merge`, delete branch |

---

## 7. Branch Protection Rules

| Branch | Protections |
|--------|-------------|
| main | ✓ required reviews, ✓ passing checks, ✓ signed commits |
| droid/platform-integration-tasks | ✓ admins only, ✓ no force-push |
| integration/production-readiness-phase1 | ✓ passing checks, ✓ linear history |
| feature/* | none (short-lived) |

---

## 8. CI/CD Integration

* **Quality Gate** workflow executes:
  1. TypeScript strict check (`npm run check`)
  2. ESLint (`npm run lint`)
  3. Unit tests (`vitest`)
  4. Build verification (`vite + esbuild`)
  5. Integration & E2E tests
* **Docker Build & Scan** executed nightly on integration.
* **Release pipeline** triggers on fast-forward to `main`.

---

## 9. Release Management & Tagging

1. Maintainer fast-forwards `main` from golden branch.  
2. Tag as `vX.Y.0-rcN` (e.g., `v1.0-rc1`).  
3. Release candidates soak in staging ≥24 h.  
4. Production tag `vX.Y.0` after sign-off.

---

## 10. Hotfix / Emergency Patch

* Branch from `main`: `hotfix/TICKET-ID/description`  
* PR -> `main` (bypass integration) with 🔴 risk emoji.  
* After release, forward-merge `main` → integration → golden.

---

## 11. Naming Conventions

| Pattern | Example |
|---------|---------|
| `feat/TICKET-ID/summary` | `feat/C8/cache-invalidation` |
| `fix/TICKET-ID/summary` | `fix/H9-null-pointer` |
| `hotfix/TICKET-ID/summary` | `hotfix/SEC-01-jwt-rotation` |
| `integration/*` | reserved |
| `droid/*` | reserved |

---

## 12. Deployment Workflow

1. Merge PRs ➔ `integration` (auto-deploy to staging).  
2. Nightly pipeline pushes green commit to **golden**.  
3. Maintainer bumps version, fast-forwards **main**.  
4. GitOps pipeline deploys to prod with blue-green strategy.

---

## 13. Developer On-Boarding

* Run `npm run setup` – installs deps, validates env, starts Docker stack.  
* Review `docs/TYPESCRIPT_CONVENTIONS.md` & `docs/ERROR_UX_HANDLING_GUIDE.md`.  
* Use `scripts/conflict-reporter.ts` before multibranch integrations.

---

## 14. Migration Guide (Legacy → New Model)

1. **Stop** pushing to legacy branches (`C*`, `H*`, etc.).  
2. Re-create work off `integration` using new naming.  
3. Update local Git remotes:  
   ```
   git fetch --prune
   git branch -m oldbranch feat/TICKET-ID/summary
   ```  
4. Follow new PR process; reference old commits if needed.

---

## 15. Maintenance & Cleanup

* Quarterly run `scripts/branch-cleanup.ts --interactive --verify-integration`.  
* Archive and delete stale branches (>90 days, merged).  
* Review GitHub Actions for obsolescence.  
* Update docs and protection rules as architecture evolves.

---

### Quick Reference Cheat-Sheet

| Action | Command |
|--------|---------|
| Start feature | `git checkout -b feat/INT-016-ui-tweak integration/...` |
| Run conflict check | `tsx scripts/conflict-reporter.ts integration ...` |
| Cherry-pick | `./scripts/smart-integrate.sh sourceBranch` |
| Run full tests | `npm run test && npm run test:integration && playwright test` |
| Cleanup | `tsx scripts/branch-cleanup.ts --dry-run` |

---

Happy coding! 🚀
