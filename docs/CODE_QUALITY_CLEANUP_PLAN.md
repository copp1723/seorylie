# CleanRylie Code Quality Cleanup Plan

Branch: `integration/production-readiness-phase1`  
Maintainer: Josh Copp (copp1723)  
Last updated: <!-- Factory will insert timestamp -->

---

## 1. COMPLETED (Phase 1 – committed in `89f54c74`)

| Area               | Description                                   | Files                                                   |
| ------------------ | --------------------------------------------- | ------------------------------------------------------- |
| Import Fix         | Repaired malformed import in server bootstrap | `server/index.ts`                                       |
| Missing Components | Created Radix-style UI primitives             | `client/src/components/ui/checkbox.tsx`, `slider.tsx`   |
| Utilities          | Added `formatCurrency` helper                 | `client/src/lib/utils.ts`                               |
| Export Hygiene     | Corrected default vs named exports            | `client/src/components/index.ts`                        |
| Type Hygiene       | Removed first batch of `any` errors           | `monitoring-dashboard.tsx`, `simple-prompt-testing.tsx` |
| Build Validation   | Reduced TS error count from 60 + to ≈ 35      |

---

## 2. REMAINING CRITICAL (Phase 2 & 3)

| Priority | Task                                                                                                                               | Owner | Estimate |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| 🔴 1     | Resolve remaining TS errors in **PromptExperimentInterface**, **NotificationTestPage**, **api-client.ts**, pages under `/system-*` | FE    | 4 h      |
| 🔴 2     | Validate & fix Drizzle ORM type conflicts (MySQL & PG packages)                                                                    | BE    | 3 h      |
| 🔴 3     | Remove/merge duplicate files (see §3)                                                                                              | BE/FE | 2 h      |
| 🔴 4     | Consolidate `/shared` schemas (see §4)                                                                                             | BE    | 2 h      |
| 🟠 5     | Re-run full test suite (`npm run test`) & address failures                                                                         | QA    | 2 h      |
| 🟢 6     | Run lint/format + import-order script (`pnpm lint:fix`)                                                                            | FE    | 0.5 h    |

---

## 3. DUPLICATE FILES TO CLEAN UP

(keep the **first** file unless noted; merge docs/comments where useful)

| Path A (keep)                                                     | Path B (delete)                    | Notes                              |
| ----------------------------------------------------------------- | ---------------------------------- | ---------------------------------- |
| `server/routes/conversation-logs-routes.ts`                       | `conversation-logs-routes 2.ts`    | A has full Swagger docs            |
| `client/src/components/ai-analytics-dashboard.tsx`                | `ai-analytics-dashboard 2.tsx`     | Keep A                             |
| `client/src/components/conversation-logs.tsx`                     | `conversation-logs 2.tsx`          | Merge styling tweaks then remove B |
| `server/services/conversation-logs-service.ts`                    | `conversation-logs-service 2.ts`   | Keep A                             |
| `server/services/escalation-triggers.ts`                          | `default-escalation-triggers 2.ts` | Consolidate logic                  |
| `client/src/components/enhanced-persona-management 2.tsx`         | (none)                             | Remove entirely (legacy POC)       |
| plus any `* 2.ts*` or `* 2.tsx` matched by `git ls-files '* 2.*'` |

---

## 4. SCHEMA CONSOLIDATION PLAN

Current files:  
`schema.ts`, `schema-resolver.ts`, `api-schemas.ts`, `adf-schema.ts`, `enhanced-schema.ts`, `lead-management-schema.ts`, `schema-extensions.ts`

Action steps:

1. Identify active exports via `git grep -R \"from '@shared/.*schema' --shared`.
2. Create **`shared/index.ts`** re-exporting ONE canonical `SchemaRegistry` object.
3. Merge overlapping Zod/JSON-Schema definitions; prefer latest field sets.
4. Move extension helpers into `schema-extensions.ts` and keep.
5. Delete obsolete files; update imports to `@shared/schema`.
6. Run `npm run check` & integration tests.

---

## 5. COMMANDS TO RUN

| Phase            | Command                            | Purpose             |
| ---------------- | ---------------------------------- | ------------------- |
| Duplicate scan   | `git ls-files '* 2.*'`             | List duplicates     |
| Delete dup       | `git rm "<file 2>"`                | Remove after merge  |
| Schema usage map | `git grep -R \"@shared/.*schema\"` | Find consumers      |
| Type check       | `npm run check`                    | Must reach 0 errors |
| Fix imports      | `node scripts/fix-imports.js`      | Enforce alias paths |
| Build            | `npm run build`                    | Vite + tsc emit     |
| Unit tests       | `npm run test`                     | Jest                |
| E2E              | `npm run e2e`                      | Cypress             |
| Lint/format      | `pnpm lint:fix`                    | eslint + prettier   |

---

## 6. SUCCESS CRITERIA

1. `npm run check`, `npm run build`, `npm run test` all exit 0.
2. `git ls-files '*<<<<<<<*'` returns empty.
3. `git ls-files '* 2.*'` returns empty.
4. No unused / duplicated schema exports (CI script passes).
5. Coverage ≥ 80 %, CI pipeline green.
6. PR to `main` passes review & deploys to staging.

---

## 7. ESTIMATED TIME LINE

| Phase                | Tasks                  | ETA      |
| -------------------- | ---------------------- | -------- |
| Phase 2 (TS errors)  | Critical FE/BE fixes   | 4 h      |
| Phase 3 (Duplicates) | Merge & delete files   | 2 h      |
| Phase 4 (Schemas)    | Consolidate & refactor | 2 h      |
| Validation           | Build, tests, lint     | 2 h      |
| Buffer               | Unexpected issues      | 1 h      |
| **Total**            | —                      | **11 h** |

---

### Next Git Steps

```bash
# after completing each logical chunk
git add -A
git commit -m "fix: [PRODUCTION-READINESS] <summary>"
git push --set-upstream origin integration/production-readiness-phase1
```

> Keep commits small & descriptive to simplify PR review.
