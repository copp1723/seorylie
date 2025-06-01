# STAB-301 — Schema Versioning Framework  
*Status: Completed*  

---

## 1  Objective  
Enable side-by-side support for both **v1** (current production) and **v2** (dual-mode/extended) database schemas so that code, migrations, and tooling can safely reference either version while we transition to the new data model.

---

## 2  What Was Implemented  
| Area | Summary |
|------|---------|
| **Framework** | Central `schemaVersions` export exposing `v1` and `v2` Drizzle ORM table sets. |
| **Versioned Tables** | Baseline tables (`users`, `conversations`, etc.) shared by reference; divergent tables (`dealerships`, `vehicles`) re-declared per version. |
| **Types** | `SchemaVersions` TypeScript interface + `v1Schema`/`v2Schema` named exports for ergonomic imports. |
| **Tests & Validation** | Vitest unit suite ensuring version separation and column/index deltas. |
| **CLI Verification** | Script `scripts/verify-stab-301-schema-versioning.ts` for local/CI one-shot checks. |

---

## 3  Files Created & Purpose  
| File | Purpose |
|------|---------|
| **`db/schema-versions.ts`** | Single source-of-truth registry for versioned schemas. Re-exports shared tables, defines version-specific ones, exports helpers (`schemaVersions`, `v1Schema`, `v2Schema`). |
| **`test/schema-versions.test.ts`** | Vitest suite validating that v1/v2 objects exist, differ where expected, and share common tables by reference. |
| **`scripts/verify-stab-301-schema-versioning.ts`** | Human-readable verification script (chalk output) used in CI and local runs (`npx tsx …`). |
| **`docs/tickets/STAB-301_SCHEMA_VERSIONING_IMPLEMENTATION_SUMMARY.md`** | *← you are here* – implementation summary for audit & hand-off. |

---

## 4  How the Dual-Schema Framework Works  
1. **Shared Baseline**  
   - Tables that remain identical across versions (`users`, `conversations`, etc.) are imported once from `shared/schema.ts` and assigned to **both** `v1` and `v2` objects – preserving referential equality.  
2. **Version-Specific Tables**  
   - Tables that diverge reside in each version namespace with independent `pgTable` declarations.  
   - Naming strategy keeps physical table names identical (`vehicles`, `dealerships`) so no migration churn; only TypeScript shape changes.  
3. **Exports**  
   ```ts
   import { schemaVersions, v1Schema, v2Schema } from 'db/schema-versions';
   ```  
   - `schemaVersions.v1` / `schemaVersions.v2` for dynamic selection.  
   - `v1Schema`, `v2Schema` for tree-shaking & explicit imports.  
4. **Type Safety**  
   - `SchemaVersions` interface enforces presence of both versions and required tables.

---

## 5  Key Differences Between v1 & v2  
| Table | v1 Columns | v2 Additions |
|-------|------------|--------------|
| **vehicles** | core inventory fields (vin, make, model, year, price, status, images) | `operationMode`, `aiConfig`, `leadScore`, `lifecycleStage`, `lastInteractionAt`, counts (view/inquiry/testDrive), `recommendationScore`, `customAttributes` |
| **dealerships** | basic business profile, `settings` | `operationMode`, `aiConfig`, `agentConfig`, `leadRouting` |

Indexes were expanded accordingly (`lifecycleIdx`, `operationModeIdx`, etc.).

---

## 6  How to Use  
```ts
// Choose schema at runtime
const schema = useV2 ? schemaVersions.v2 : schemaVersions.v1;
db.select().from(schema.vehicles) …

// Static import when targeting a specific version
import { v2Schema } from 'db/schema-versions';
```
Guidelines:  
1. New code targeting dual-mode features must import **v2**.  
2. Legacy modules remain on **v1** until refactored.  
3. Migrations altering shared tables must remain backward compatible.

---

## 7  Test & Verification Process  
1. **Unit Test**  
   ```bash
   npm test -- -t "Schema Versioning Framework"
   ```  
   Pass criteria: all Vitest assertions green.  
2. **CLI Script**  
   ```bash
   npx tsx scripts/verify-stab-301-schema-versioning.ts
   ```  
   Outputs PASS/FAIL summary and returns non-zero on failure – wired into CI.  

Both checks are executed in the stabilization branch quality-gate workflow.

---

## 8  Benefits  
- **Zero-Downtime Migration** – code can incrementally adopt v2 without table renames.  
- **Type-Safe Isolation** – prevents accidental mixing of v1/v2 column sets.  
- **CI Enforced** – guarantees schema divergence remains intentional and tested.  
- **Developer Ergonomics** – simple import surface, clear namespace semantics.

---

## 9  Future Extensibility  
- **v3+ Support** – add new keys to `schemaVersions` without touching consumers.  
- **Automatic Deprecation Warnings** – lint rule can flag v1 imports post-transition.  
- **Runtime Selector** – env-flag driven schema injection for A/B testing.  
- **GraphQL/OpenAPI Generation** – feed selected version into code-gen for versioned APIs.

---

## 10  Next Steps / Owners  
| Action | Owner | Due |
|--------|-------|-----|
| Integrate script into `integration-quality-gate.yml` | Dev Ops | Done |
| Update docs for migration workflow | DBA | T-2 days |
| Begin module-by-module port to v2 | Backend squad | STAB-4xx tickets |

*Point of contact:* **@TechLead** – see `CODEOWNERS` for detailed ownership map.

---

*CleanRylie is architected as an agent-first automation platform—today for dealers, tomorrow for any AI workflow.*  
