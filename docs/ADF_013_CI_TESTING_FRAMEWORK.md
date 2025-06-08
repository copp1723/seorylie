# ADF-013 – CI Testing Framework & Mock Infrastructure

_Comprehensive Developer & Dev-Ops Guide_

---

## 1 ▪ Purpose & Scope

ADF-013 introduces a unified mocking and CI testing framework that allows the **ADF Lead-Processing** codebase to be validated locally and in CI without real external credentials.  
The framework guarantees:

- Deterministic, fast, and isolated unit tests (≥ 90 % line coverage)
- Sub-2 minute full end-to-end (E2E) runs in CI
- Zero network calls to IMAP, OpenAI, Twilio, SendGrid, or other paid services
- Re-usable mock services and a lightweight dependency-injection (DI) pattern

---

## 2 ▪ System Overview & Architecture

```
        ┌──────────────────┐     mocks when NODE_ENV=test
Inbound  │  Mock IMAP      │◄──────────────────────────┐
email    └──────────────────┘                          │
                │                                      │
                ▼                                      │
 ┌────────────────────────────┐     real when NODE_ENV≠test
 │  ADF Email Listener (DI)   │◄───────────────────────┘
 └────────────────────────────┘
                │
                ▼
 … (ADF pipeline: Parser → AI → Email/SMS → Handover) …
                │
                ▼
        ┌──────────────────┐
        │Mock Twilio/SendGrid│
        └──────────────────┘
```

- **Service-Factory** chooses **mock** vs **real** class at runtime.
- All tests import concrete instances only through the factory, ensuring swap-ability.

---

## 3 ▪ Mock Services Implementation

| Mock     | Path                                                      | Key Features                                                                      |
| -------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| IMAP     | `test/mocks/imap-server.ts`                               | In-memory mailboxes, raw RFC 822 storage, event emitter (`mail`)                  |
| OpenAI   | `test/mocks/openai.ts`                                    | Pluggable responses by route key (`chat.completions.create`), token usage counter |
| Twilio   | `test/mocks/twilio.ts`                                    | Stub SMS `messages.create()` returning deterministic SID, webhook simulation      |
| SendGrid | Re-uses MailHog (container) or nock stubs (in-unit tests) |

### Usage Pattern

```ts
// Arrange
import { MockOpenAIClient } from 'test/mocks/openai';
MockOpenAIClient.addResponse('chat.completions.create', cannedResponse);

// Act
const res = await serviceFactory.createOpenAIService()
               .createChatCompletion({...});

// Assert
expect(res.choices[0].message.content).toBe('canned');
```

---

## 4 ▪ Dependency Injection Pattern

- **`server/services/service-factory.ts`** exposes `createImapService`, `createOpenAIService`, `createTwilioService`, etc.
- Env flags:
  - `NODE_ENV=test` → mocks by default
  - `USE_MOCK_SERVICES=true` → force mocks even if NODE_ENV≠test (handy for local E2E)
- `forceMockImplementations(boolean)` helper for fine control inside test harness.
- All core services (`adf-email-listener`, `enhanced-ai-service`, `messaging-service`…) import external providers only via the factory.

---

## 5 ▪ Jest Configuration & Test Organisation

File: **`jest.config.js`**

- Preset: **ts-jest** (transpiles TypeScript on-the-fly)
- Projects:
  - **unit** → `test/unit/**/*.test.ts`
  - **integration** → `test/integration/**/*.test.ts`
  - **e2e** → `test/e2e/**/*.test.ts`
- Global test timeout: **120 000 ms** (matches acceptance criteria)
- Coverage threshold (global): **90 % lines / 90 % functions**
- Setup files:
  - `test/setup/set-env-vars.ts` – minimal safe env (no secrets)
  - `test/setup/unit-test-setup.ts` – DI resets, logger silencing
- Reporters: default, **jest-junit** (CI artefacts), **jest-html-reporter** (local HTML).

### Running Selections

```
npm run test:unit          # fast mocks only
npm run test:integration   # mocks + DB/Redis containers
npm run test:e2e           # full pipeline with MailHog/Twilio emulator
```

---

## 6 ▪ CI/CD Workflow (`.github/workflows/ci.yml`)

Key points:

- **Services**: Postgres, Redis, MailHog (SMTP/web UI), LocalStack or Twilio-dev server
- **Steps**
  1. `npm ci`
  2. `npm run lint && npm run typecheck`
  3. `npm run db:migrate`
  4. `npm run test:unit` (fast)
  5. `npm run test:e2e` (≤ 2 min, `USE_MOCK_SERVICES=true`)
- No secret keys required – mocks guarantee isolation.
- Coverage and junit XML uploaded as artefacts.

---

## 7 ▪ Test Execution & Coverage Requirements

| Layer                       | Command                    | Target Time                   | Coverage                |
| --------------------------- | -------------------------- | ----------------------------- | ----------------------- |
| Unit                        | `npm run test:unit`        | ≤ 15 s                        | ≥ 90 % lines            |
| Integration                 | `npm run test:integration` | ≤ 45 s                        | n/a                     |
| E2E                         | `npm run test:e2e`         | ≤ 120 s                       | business flow validated |
| Full CI (`npm run test:ci`) | ≤ 2 min 30 s               | fails if coverage < threshold |

---

## 8 ▪ Environment Setup & Configuration

Minimal `.env.test` (autogenerated):

```
NODE_ENV=test
USE_MOCK_SERVICES=true
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/adf_test
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=dummy
SENDGRID_API_KEY=dummy
TWILIO_ACCOUNT_SID=dummy
TWILIO_AUTH_TOKEN=dummy
```

### Local Test Containers

```
docker compose up -d postgres redis mailhog
npm run db:migrate
npm run test:e2e
```

---

## 9 ▪ Troubleshooting Guide

| Symptom                               | Likely Cause                                     | Resolution                                             |
| ------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| “ECONNREFUSED localhost:993” in tests | Real IMAP instantiated                           | Ensure `USE_MOCK_SERVICES=true` or factory overridden  |
| E2E test exceeds 2 min                | Container images not warmed / DB indexes missing | Pre-pull images, run `npm run db:migrate` before tests |
| Coverage < 90 %                       | New code paths untested                          | Add unit tests or mock edge cases                      |
| Jest hangs at exit                    | Unawaited timers / open handles                  | Use `--detectOpenHandles` and close redis/imap mocks   |

---

## 10 ▪ Best Practices for Testing

- **Always go through the factory**; never `new IMAP()` in production code.
- **One mock per external border**; keep internal logic real to maximise coverage.
- **Avoid `setTimeout` in tests**; prefer deterministically resolved promises from mocks.
- **Snapshot tests** only for email/html output – keep snapshots small.
- **Fail fast** – CI uses `--ci` to abort on first failure.

---

## 11 ▪ Maintenance Procedures

1. **Adding a New External Service**
   - Create `test/mocks/<service>.ts`
   - Register in `service-factory.ts`
   - Update docs & coverage thresholds.
2. **Updating Coverage Thresholds**
   - Adjust in `jest.config.js` **only after** raising real coverage.
3. **CI Service Versions**
   - Bump container tags in `.github/workflows/ci.yml` + `docker-compose.yml`
   - Run full E2E locally before merging.
4. **Mock Behaviour Drift**
   - Sync contracts by recording real interactions in staging, update mock stubs.

---

## 12 ▪ Running the Full Suite

Local development:

```
npm run lint
npm run db:migrate
npm run test         # all jest projects
npm run test:e2e     # fastest feedback on full flow
```

GitHub Actions:

```
Push → PR → CI runs .github/workflows/ci.yml
 • Unit tests (mock only)
 • E2E in <2 min
 • Coverage check
 • Lint + build
```

---

## 13 ▪ Reference Links

- Jest docs: https://jestjs.io/
- ts-jest: https://kulshekhar.github.io/ts-jest/
- Bottleneck: https://github.com/SGrondin/bottleneck
- Mock Service Template: `test/mocks/_template.ts`

---

### 🎉 Framework Ready

Developers can now iterate with confidence: quick unit cycles locally, deterministic E2E in CI, and zero reliance on paid APIs during tests. Welcome to the ADF high-quality test ecosystem!
