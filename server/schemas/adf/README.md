# ADF Schema Directory

Location: `server/schemas/adf/`

## 1. Purpose & Directory Structure

ADF (Auto-lead Data Feed) schemas define the **canonical XML contract** for inbound automotive leads used by Cleanrylie services.

```
server/schemas/adf/
├── adf_lead_1.0.xsd   # Active production schema
├── adf_lead_1.1.xsd   # Draft / future version
└── README.md          # This document
```

Each `adf_lead_<version>.xsd` file is self-contained and import-free for easy distribution.

## 2. Version-Management Strategy

| Stage       | Branch          | Flag                     | Notes                                          |
| ----------- | --------------- | ------------------------ | ---------------------------------------------- |
| **Draft**   | feature/\*      | –                        | Iterated by the ADF squad.                     |
| **Staging** | `stabilization` | `ADF_PARSER_XSD_VERSION` | Validated against real traffic.                |
| **GA**      | `main`          | default                  | Older versions remain for fallback ≥ 6 months. |

Only **one GA version** is enforced in strict mode; previous GA stays loadable for fallback parsing.

## 3. Validation Rules & Conventions

- Follows official ADF 1.0 specification; namespace `http://www.adf.org/schema/1.0`.
- `elementFormDefault="qualified"`, **all** business fields are qualified.
- Required elements use explicit `<xs:sequence>` ordering.
- Attributes with booleans use `xs:boolean`.
- Enumerations are avoided—validation policy lives in application layer.

## 4. Adding a New Schema Version

1. Copy existing XSD → `adf_lead_<new>.xsd`.
2. Increment `targetNamespace` suffix to `<new>`.
3. Update changelog header comment.
4. Run `npm run test -- -t "ADF Schema"` to verify compliance.
5. Submit PR; obtain ✅ from _Parser_ & _Lead-Processor_ owners.

## 5. Backward Compatibility

- **No breaking removals** for 1 minor revision.
- New optional elements/attributes only.
- Deprecated nodes remain but are annotated with  
  `<!-- DEPRECATED: use <newElement> -->`.
- Parser v2 fallback accepts 1 previous GA version.

## 6. Testing & Validation Procedures

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `npm run schema:test` | Runs unit fixtures against all XSDs.             |
| `npm run schema:lint` | Checks namespace & required annotation presence. |

CI executes both in `integration-quality-gate.yml`.

## 7. Maintenance Guidelines

- Keep file header with author/date/change summary.
- Prefer **single source of truth**—do NOT scatter schema fragments.
- Clear validator cache after modifying (`adfValidator.clearCache()`).
- Document **why**, not just **what**, in XSD comments.

## 8. Common Validation Errors & Solutions

| Error Code                 | Meaning                       | Fix                                                    |
| -------------------------- | ----------------------------- | ------------------------------------------------------ |
| `MISSING_REQUIRED_ELEMENT` | Required node absent          | Populate element or mark as optional in schema update. |
| `INVALID_XML_SYNTAX`       | Malformed XML                 | Ensure well-formed tags, proper encoding.              |
| `UNSUPPORTED_VERSION`      | `version` attr not recognised | Update parser flag or supply GA version.               |
| `NAMESPACE_ERROR`          | Wrong / missing namespace     | Use `xmlns:adf="http://www.adf.org/schema/1.0"`.       |

## 9. Best Practices for Schema Evolution

- **Small, additive changes**: batch multiple but gated by feature flags.
- Keep **sample XML fixtures** alongside tests for every change.
- Review with downstream teams (Analytics, UI) before merge.
- Run **load tests** with ≥ 100 RPS synthetic leads to spot perf regressions.

## 10. References

- ADF Lead XML Specification v1.0 – AutoLead Data Format Working Group  
  (internal mirror: `docs/specs/adf-1.0.pdf`)
- Cleanrylie Parser v2 Design – `docs/ADF-W02_PARSER_HARDENING.md`
- Prometheus Dashboard – `monitoring/grafana/dashboards/agent_sandbox_overview.json` (row: _ADF Parser_)

---

_Maintainer:_ `@adf-squad` • _Slack:_ `#adf-parser` • _Review cadence:_ quarterly
