# Production-Readiness Cleanup Ticket Board  
Branch: `integration/production-readiness-phase1`  
Release Target: **MVP hardening / GA-1**

Legend  
🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Nice-to-have

---

## 📐  Ticket Index & Dependencies

| ID  | Area | Priority | Depends on |
|-----|------|----------|-----------|
| PR1 | FE   | 🔴 | — |
| PR2 | BE   | 🔴 | — |
| PR3 | FE   | 🔴 | PR1 |
| PR4 | BE   | 🔴 | PR2 |
| PR5 | FE   | 🟠 | PR1 |
| PR6 | BE   | 🟠 | PR2 |
| PR7 | BE   | 🟡 | PR4 |
| PR8 | FE   | 🟡 | PR3 |
| PR9 | FE   | 🟢 | PR5 |
| PR10| BE   | 🟢 | PR6 |

Parallel-friendly grid:  
- **Wave 1:** PR1 + PR2 (different code areas)  
- **Wave 2:** PR3 / PR4 (+ PR5 / PR6 in parallel)  
- **Wave 3:** PR7 + PR8  
- **Wave 4:** PR9 + PR10  

---

## 🔴  CRITICAL PATH

### PR1 — Resolve Remaining Front-End TypeScript Errors  
*Owners*: 2 FE engineers  
*Estimate*: **4 h**

| Field | Details |
|-------|---------|
| **Description** | Eliminate ~35 TS errors under `client/src/**`. Focus files:<br>• `components/NotificationTestPage.tsx`<br>• `components/prompt-testing/PromptExperimentInterface.tsx`<br>• `lib/api-client.ts`<br>• `pages/system-prompt-*`<br>• `pages/personas.tsx`, `invitations.tsx` |
| **Acceptance Criteria** | `npm run check` shows **0 FE errors**.<br>All modified comps render without runtime errors (`npm run dev`). |
| **Commands** | `npm run check` – until clean<br>`pnpm lint:fix` – ensure no lint errors |
| **Validation** | Cypress smoke: `npm run e2e -- --spec cypress/e2e/smoke/**` passes.<br>Manual visual check of affected pages. |

---

### PR2 — Backend Library & Drizzle ORM Type Fixes  
*Owners*: 2 BE engineers  
*Estimate*: **3 h**

| Field | Details |
|-------|---------|
| **Description** | Fix type incompatibilities raised in `drizzle-orm/*` & `@types/pg`. Update `tsconfig.paths` if needed. Key files:<br>`server/db/**`, any `.d.ts` overrides. |
| **Acceptance Criteria** | No TS errors produced from `node_modules/drizzle-orm/**` when running `npm run check`. |
| **Commands** | `npx npm-check-updates -i "drizzle-orm,*pg*"`<br>`npm run check` |
| **Validation** | Integration tests: `npm run test -- -t "DB"` green.<br>Migration script `scripts/migration-verification.ts` passes. |

---

### PR3 — Duplicate File Removal (Front-End)  
*Depends on*: PR1  
*Owners*: 1 FE engineer  
*Estimate*: **2 h**

| Field | Details |
|-------|---------|
| **Description** | Remove/merge UI duplicates (`* 2.tsx`). Keep canonical:<br>• `ai-analytics-dashboard.tsx` over `ai-analytics-dashboard 2.tsx`<br>• `conversation-logs.tsx` over duplicate.<br>Merge doc comments. |
| **Acceptance Criteria** | `git ls-files '* 2.tsx'` returns **none**.<br>UI still builds. |
| **Commands** | `git rm "client/src/components/**/* 2.tsx"` (after merge)<br>`npm run build` |
| **Validation** | Cypress dashboard suite passes. |

---

### PR4 — Duplicate File Removal (Backend)  
*Depends on*: PR2  
*Owners*: 1 BE engineer  
*Estimate*: **2 h**

| Field | Details |
|-------|---------|
| **Description** | Remove duplicates in `server/routes/` & `server/services/`. Canonical list in PLAN §3. Preserve Swagger docs. |
| **Acceptance Criteria** | `git ls-files '* 2.ts'` returns **none**.<br>Server starts (`docker compose up`) with no missing routes. |
| **Commands** | `git rm "server/**/* 2.ts"`<br>`npm run dev:server` |
| **Validation** | `npm run test -- -t "routes"` green.<br>Postman regression against `/api/v1/**` endpoints. |

---

## 🟠  HIGH PRIORITY

### PR5 — Frontend Import Path Standardization  
*Parallel*: PR3  
*Owners*: 1 FE engineer  
*Estimate*: **1 h**

| Field | Details |
|-------|---------|
| **Description** | Run `node scripts/fix-imports.js` then manually standardize unresolved paths to `@/`, `@shared/`. |
| **Acceptance Criteria** | `check-imports.cjs` outputs **0** errors.<br>ESLint import-order rule passes. |
| **Commands** | `node scripts/fix-imports.js`<br>`pnpm lint:fix` |
| **Validation** | `npm run build` succeeds. |

---

### PR6 — Backend Import Path Standardization  
*Parallel*: PR4  
*Owners*: 1 BE engineer  
*Estimate*: **1 h**

| Field | Details |
|-------|---------|
| **Description** | Same as PR5 for `server/**`, `scripts/**`. Remove `../../` chains. |
| **Acceptance Criteria** | `check-imports.cjs` passes in server scope. |
| **Commands** | `node scripts/fix-imports.js --scope=server` |
| **Validation** | Server loads without stack-trace path errors. |

---

## 🟡  MEDIUM

### PR7 — Schema Consolidation (`/shared`)  
*Depends on*: PR4  
*Owners*: 1 BE engineer  
*Estimate*: **2 h**

| Field | Details |
|-------|---------|
| **Description** | Merge 7 schema files into canonical `shared/schema.ts` + `schema-extensions.ts`. Update imports project-wide. |
| **Acceptance Criteria** | `git grep -R "@shared/.*schema" | wc -l` equals **≤2**.<br>All integration tests compile. |
| **Commands** | `npm run check` (0 errors)<br>`npm run test` |
| **Validation** | Swagger docs still generate via `scripts/generate-openapi.ts`. |

---

### PR8 — Notification Component Type Rigidity  
*Parallel*: PR7  
*Owners*: 1 FE engineer  
*Estimate*: **1 h**

| Field | Details |
|-------|---------|
| **Description** | Replace custom `label` prop with Radix Toast `action` object. Fix TS2353 errors in `NotificationTestPage.tsx` + `api-client.ts`. |
| **Acceptance Criteria** | No TS errors referencing `ToastActionElement`. |
| **Commands** | `npm run check` |
| **Validation** | Trigger toasts in UI; buttons render. |

---

## 🟢  NICE-TO-HAVE

### PR9 — UI Performance & Bundle Audit  
*Depends on*: PR5  
*Owners*: 1 FE engineer  
*Estimate*: **1 h**

| Field | Details |
|-------|---------|
| **Description** | Run `vite --report` to analyze vendor bundles, lazy-load large components (`PromptExperimentInterface`). |
| **Acceptance Criteria** | Total bundle ≤ 600 kB gzip. |
| **Commands** | `npm run build -- --report` |
| **Validation** | Lighthouse score ≥ 90. |

---

### PR10 — Database Index Suggestions  
*Depends on*: PR6  
*Owners*: 1 BE engineer  
*Estimate*: **1 h**

| Field | Details |
|-------|---------|
| **Description** | Use `scripts/db/analyze-schema.ts` to generate missing index recommendations for new FK constraints. |
| **Acceptance Criteria** | `EXPLAIN ANALYZE` for top 5 queries shows **<50 ms**. |
| **Commands** | `node scripts/db/analyze-schema.ts` |
| **Validation** | `test/performance/run-performance-tests.ts` passes thresholds. |

---

## 🛠  Validation Gate

When **PR1 … PR8** are merged:  
```bash
npm run check       # 0 errors  
npm run build       # succeeds  
npm run test        # all green  
git grep -R "<<<<<<<"  # returns nothing  
git ls-files '* 2.*'   # returns nothing
```

Finished tickets lead to PR against `main` under **“Production Readiness Phase 1”** epic.  
