# TypeScript Strict-Mode Conventions  
_cleanrylie / final_watchdog / vin-agent / vautoskill_

This document codifies the rules, patterns, and migration strategies that accompany the **T1 “strict” TypeScript rollout** (INT-009).  
All new code **MUST** comply, and legacy code **SHOULD** be migrated opportunistically.

---

## 1. Strict Compiler Options

| Option | Purpose | Our Default |
| ------ | ------- | ----------- |
| `strict` | Enables all strict flags | `true` |
| `noImplicitAny` | Disallow implicit `any` | `true` |
| `strictNullChecks` | Distinguish `null`/`undefined` | `true` |
| `strictFunctionTypes` | Safer callback variance | `true` |
| `strictPropertyInitialization` | Class fields initialized | `true` |
| `noUncheckedIndexedAccess` | Arrays/maps return `T \| undefined` | `true` |
| `noImplicitReturns` | All code paths return | `true` |
| `noImplicitOverride` | `override` keyword required | `true` |
| `noUnusedLocals / noUnusedParameters` | Dead-code detection | `true` |

See `tsconfig.json` for the full matrix.

---

## 2. Handling `null` / `undefined`

### Golden rules
1. **Design APIs to avoid returning `null`.** Prefer empty collections (`[]`) or `Option<T>` patterns (`T \| undefined`).
2. **Use early-exit or Zod validation** to narrow types at the boundary.

```ts
import { z } from 'zod';

const LeadSchema = z.object({ id: z.string(), email: z.string().email() });

export function parseLead(payload: unknown): Lead {
  const lead = LeadSchema.parse(payload);        // throws if invalid
  return lead;                                   // strongly typed, non-null
}
```

### Utility helpers

```ts
export const assertDefined = <T>(
  val: T | null | undefined,
  msg = 'Expected value to be defined'
): T => {
  if (val == null) throw new Error(msg);
  return val;
};
```

---

## 3. Strict Property Initialization

Always initialize class fields or mark them `!` (rare).

```ts
class CacheEntry<T> {
  createdAt = Date.now();
  constructor(public readonly value: T) {}
}
```

---

## 4. Annotation & Pattern Examples

### Good
```ts
const redis = new Redis(process.env.REDIS_URL as string);

export async function getOrSetJson<T>(
  key: string,
  compute: () => Promise<T>,
  ttl = 30_000
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const value = await compute();
  await redis.set(key, JSON.stringify(value), 'PX', ttl);
  return value;
}
```

### Avoid
```ts
// BAD: implicit any, throws away types
export const bad = (data) => JSON.parse(data);
```

---

## 5. Error-Handling Patterns

* Use `AppError` (`server/utils/error-codes.ts`) for all thrown errors.
* Catch unknown errors with `handleError(error: unknown): AppError`.
* Express routes wrap handlers with `asyncHandler` to surface type-safe errors.

```ts
router.post('/leads', asyncHandler(async (req, res) => {
  const lead = parseLead(req.body);   // zod validation
  await LeadService.create(lead);
  ResponseHelper.success(res, lead);
}));
```

---

## 6. Database & API Response Types

* **DB layer** — Drizzle infers return types. Export public DTOs to prevent leaking internal columns.
* **API layer** — Define `type LeadResponse = z.infer<typeof LeadSchema>;` and reuse in Swagger/OpenAPI.
* Use branded IDs:

```ts
type LeadId = string & { __brand: 'LeadId' };
```

---

## 7. WebSocket & Service Typing

```ts
export interface WsMessage<T = unknown> {
  type: 'agent:update' | 'chat:message';
  payload: T;
  traceId: string;
}

wsServer.broadcast<LeadUpdate>('agent:update', { id, status });
```

Service singletons expose **facade types** (`WebSocketService`, `UnifiedCacheService`) to avoid leaking implementation details.

---

## 8. Migrating Legacy Code

1. **Enable `strict` locally** (`tsc --noEmit --strict`).
2. **Fix highest-impact errors first**  
   * implicit `any` in public APIs  
   * nullability issues in critical paths
3. Use `// TODO(strict):` comments for low-risk follow-ups.
4. Submit small, incremental PRs behind feature flags when necessary.

---

## 9. Performance Considerations

* Incremental builds (`incremental: true`) + isolated modules keeps compile time reasonable (~3-6 s).
* CI caches `.tsbuildinfo`.

---

## 10. Testing with Strict Types

* **Vitest** shares ts-node context; `npm run check` runs before tests in CI.
* Prefer `as const` fixtures to lock types.
* Use generics in reusable test helpers:

```ts
export function mockResponse<TExpected>() {
  const res = {} as unknown as Response<TExpected>;
  return res;
}
```

---

## 11. Troubleshooting Strict Mode

| Error | Cause | Fix |
| ----- | ----- | --- |
| `Object is possibly undefined` | Missing null guard | Add `assertDefined` / optional-chaining |
| `Implicit any` | Missing annotation | Specify type or enable inference |
| `Property has no initializer` | Field not set | Initialize or mark `!` |

---

## 12. Utility Types

* `DeepPartial<T>` – recursive optional  
* `Nullable<T>` – `T | null`  
* `Brand<T, U>` – nominal typing  
* Located in `shared/types/utility.ts`.

---

## 13. Path Mapping & Module Resolution

* `@server/*`, `@shared/*`, `@/*` map to respective folders (see `tsconfig.json` > `paths`).
* Always import via aliases to avoid brittle relative paths.

---

## 14. Deprecation & Upgrade Strategy

* Mark APIs with `/** @deprecated Use XService */`.
* Enable `reportDeprecated` to surface usages.
* Provide migration codemods when large-scale changes are needed.

---

## 15. Best Practices Checklist

- [ ] Validate inputs with **Zod** at boundaries.
- [ ] Avoid `any` & `unknown` leaks—narrow ASAP.
- [ ] Keep side-effects out of type guards.
- [ ] Prefer readonly data structures where possible.
- [ ] Document complex generics with JSDoc.
- [ ] Incrementally migrate; never disable strict flags globally.

---

_Adhering to these conventions ensures compile-time safety, runtime stability, and long-term maintainability across the cleanrylie platform._  
For questions, ping `#typescript-strict-help` on Slack or review the examples in `scripts/test-*` for real-world patterns.
