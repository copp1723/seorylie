# GitHub Issue Templates — Production-Readiness Phase 1  
_Copy & paste each section into a new GitHub issue._

---

## PR1 – Resolve Remaining Front-End TypeScript Errors
**Labels:** `frontend` `bug` `critical`  
**Assignees:** _@TBD_  

### Description
Eliminate all remaining TypeScript errors in the front-end codebase (~35).  
Primary files:
- `client/src/components/NotificationTestPage.tsx`
- `client/src/components/prompt-testing/PromptExperimentInterface.tsx`
- `client/src/lib/api-client.ts`
- `client/src/pages/system-prompt-*`
- `client/src/pages/personas.tsx`, `invitations.tsx`

### Acceptance Criteria
- [ ] `npm run check` returns **0 front-end TS errors**  
- [ ] Updated components render without runtime errors in `npm run dev`  
- [ ] Cypress smoke suite passes: `npm run e2e -- --spec cypress/e2e/smoke/**`

### Commands
```bash
npm run check
pnpm lint:fix
```

### Dependencies
None

---

## PR2 – Backend Library & Drizzle ORM Type Fixes
**Labels:** `backend` `bug` `critical`  
**Assignees:** _@TBD_  

### Description
Resolve all type incompatibilities raised from `drizzle-orm/*`, `@types/pg`, and related PG/MySQL drivers.

### Acceptance Criteria
- [ ] `npm run check` shows **0 backend TS errors** originating from `node_modules/drizzle-orm/**`  
- [ ] All database integration tests pass: `npm run test -- -t "DB"`

### Commands
```bash
npx npm-check-updates -i "drizzle-orm,*pg*"
npm install
npm run check
```

### Dependencies
None

---

## PR3 – Duplicate File Removal (Front-End)
**Labels:** `frontend` `cleanup` `high-priority`  
**Assignees:** _@TBD_  

### Description
Merge/retain canonical versions of UI duplicates and delete `* 2.tsx` files.  
Canonical list in `CODE_QUALITY_CLEANUP_PLAN.md` §3.

### Acceptance Criteria
- [ ] `git ls-files '* 2.tsx'` returns empty  
- [ ] `npm run build` succeeds  
- [ ] Affected pages render correctly

### Commands
```bash
git rm "client/src/components/**/* 2.tsx"
npm run build
```

### Dependencies
- Depends on **PR1**

---

## PR4 – Duplicate File Removal (Backend)
**Labels:** `backend` `cleanup` `high-priority`  
**Assignees:** _@TBD_  

### Description
Remove or merge duplicate route/service files (`* 2.ts`). Keep Swagger-documented versions.

### Acceptance Criteria
- [ ] `git ls-files '* 2.ts'` returns empty  
- [ ] Server starts with `npm run dev:server`  
- [ ] Route regression tests pass

### Commands
```bash
git rm "server/**/* 2.ts"
npm run dev:server
npm run test -- -t "routes"
```

### Dependencies
- Depends on **PR2**

---

## PR5 – Front-End Import Path Standardization
**Labels:** `frontend` `enhancement`  
**Assignees:** _@TBD_  

### Description
Normalize all FE import paths to use aliases (`@/`, `@shared/`). Run automation then manual tidy-up.

### Acceptance Criteria
- [ ] `check-imports.cjs` outputs **0** errors  
- [ ] ESLint import-order rule passes

### Commands
```bash
node scripts/fix-imports.js
pnpm lint:fix
```

### Dependencies
- Parallel with **PR3**

---

## PR6 – Backend Import Path Standardization
**Labels:** `backend` `enhancement`  
**Assignees:** _@TBD_  

### Description
Standardize import paths in `server/**` and `scripts/**`.

### Acceptance Criteria
- [ ] `check-imports.cjs --scope=server` passes  
- [ ] Server boots without path errors

### Commands
```bash
node scripts/fix-imports.js --scope=server
npm run dev:server
```

### Dependencies
- Parallel with **PR4**

---

## PR7 – Schema Consolidation (`/shared`)
**Labels:** `backend` `refactor`  
**Assignees:** _@TBD_  

### Description
Merge seven schema files into canonical `shared/schema.ts` and update project imports.

### Acceptance Criteria
- [ ] Only `shared/schema.ts` & `schema-extensions.ts` remain  
- [ ] `npm run check` returns 0 errors  
- [ ] Swagger generation succeeds

### Commands
```bash
git mv shared/schema.ts <merged>
grep -R "@shared/.*schema" -n
npm run check
```

### Dependencies
- Depends on **PR4**

---

## PR8 – Notification Component Type Rigidity
**Labels:** `frontend` `bug`  
**Assignees:** _@TBD_  

### Description
Replace custom `label` prop with Radix Toast `action` object in `NotificationTestPage.tsx` & `api-client.ts`.

### Acceptance Criteria
- [ ] No TS errors referencing `ToastActionElement`  
- [ ] Toast action buttons render & work

### Commands
```bash
npm run check
npm run dev
```

### Dependencies
- Parallel with **PR7**  
- Indirectly depends on **PR1**

---

## PR9 – UI Performance & Bundle Audit
**Labels:** `frontend` `enhancement` `performance`  
**Assignees:** _@TBD_  

### Description
Run bundle analyzer, lazy-load oversized components to keep bundle ≤ 600 kB gzip.

### Acceptance Criteria
- [ ] Build report shows bundle ≤ 600 kB gzip  
- [ ] Lighthouse performance score ≥ 90

### Commands
```bash
npm run build -- --report
npx lighthouse http://localhost:3000
```

### Dependencies
- Depends on **PR5**

---

## PR10 – Database Index Suggestions
**Labels:** `backend` `enhancement` `performance`  
**Assignees:** _@TBD_  

### Description
Generate and apply missing indexes per new FK constraints for top query paths.

### Acceptance Criteria
- [ ] `scripts/db/analyze-schema.ts` recommends no further indexes  
- [ ] `test/performance/run-performance-tests.ts` shows all queries < 50 ms

### Commands
```bash
node scripts/db/analyze-schema.ts
npm run test -- test/performance/run-performance-tests.ts
```

### Dependencies
- Depends on **PR6**

---
