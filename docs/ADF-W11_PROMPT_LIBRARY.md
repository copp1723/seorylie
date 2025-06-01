# ADF Prompt Library – Developer Guide  
*(ADF-W11 Ticket)*  

This document describes the **Adaptive Data Feed (ADF) Prompt Library** introduced in _ADF-W11_.  
It is a single source-of-truth for every prompt used by the **Adaptive Conversation Engine** (ACE) and any other cleanrylie components that require structured prompt templates.

---

## 1. Why a Prompt Library?

| Problem | Solution |
| --------| -------- |
| Ad-hoc prompts scattered in code | Centralised, version-controlled Markdown files |
| Hard to audit or update | JSON metadata + automatic schema validation |
| Multiple experiment tracks | Folder-based **versioning** with feature flag `PROMPT_LIBRARY_VERSION` |
| Runtime performance | **In-memory cache** populated at boot by `server/services/prompt-loader.ts` |

---

## 2. Directory Structure

```
prompts/
└── adf/
    ├── v1/               # Optional explicit version folder
    │   ├── base-system-prompt.md
    │   ├── turn1-initial-contact.md
    │   ├── turn2-engaged.md
    │   ├── ...
    │   └── objections/
    │       └── objection-price.md
    ├── prompt-schema.json
    ├── fast-track-appointment.md
    └── soft-appointment.md
```

Notes  
* If a `v*` folder matching the environment variable **PROMPT_LIBRARY_VERSION** exists, it overrides the root-level files.  
* Non-versioned prompts act as the default (`v1`).  

---

## 3. Metadata Schema (`prompt-schema.json`)

Key fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | kebab-case unique identifier |
| `description` | string | ✅ | 10-500 char purpose summary |
| `tags` | string[] | ✅ | e.g. `turn:1`, `objection:price`, `goal:schedule` |
| `max_turn` | int | 🚫\* | Required **only** when a `turn:N` tag is present |
| `filepath` | string | 🚫 | Auto-populated by loader |
| `version` | string | 🚫 | Defaults to `v1` |
| `active` | boolean | 🚫 | Loader ignores prompts with `false` |

Full schema lives at `prompts/adf/prompt-schema.json` and is enforced by **Ajv** in unit tests.

---

## 4. Prompt File Format

1. **Front-matter (YAML or JSON)** – optional. Only include if you need to override defaults or add metadata that can’t be inferred.  
2. **Markdown body** – human-readable template and documentation sections.  
3. **Tags block** – include a “### Tags” section if not using front-matter.

Example (minimal – all metadata inferred):

```markdown
# Turn 1 – Initial Contact

**Purpose**  
Kick-off the conversation…

---

### Tags  
`turn:1` `stage:prospect` `goal:qualify`
```

Example (explicit front-matter):

```markdown
---
id: turn1-initial-contact
description: Greet lead and gather initial qualification details.
tags:
  - turn:1
  - stage:prospect
  - goal:qualify
author: josh.copp
---

# Turn 1 – Initial Contact
...
```

---

## 5. Editing & Contribution Workflow

1. **Create/Checkout** a ticket branch (`feature/adf-wXX/...`).  
2. **Add or edit** `.md` files under the appropriate version folder.  
3. **Run local validation**  

   ```bash
   # run schema & loader tests
   npm test -- -t "Prompt Loader"
   ```  
4. **Update documentation** here if you add new tags, fields, or patterns.  
5. **Open PR** → CI will execute the same tests plus lint & coverage gate.  

---

## 6. Quality Checklist (✅ = required)

| # | Check | Notes |
|---|-------|-------|
| 1 | ✅ Clear **Purpose** section | 1-2 sentences |
| 2 | ✅ Accurate, concise **template** | Aligns with dealership tone |
| 3 | ✅ Uses **`{{handlebars_style}}`** placeholders | No `${}` or `%s` |
| 4 | ✅ <160 chars per SMS line where applicable | Soft limit |
| 5 | ✅ Contains required **opt-out phrase** placeholder | `{{opt_out_phrase}}` |
| 6 | ✅ Returns valid **JSON structure** if system prompt | See schema |
| 7 | ✅ **Tags** follow `namespace:value` kebab-case | e.g. `goal:reinforce_value` |
| 8 | ✅ Passes **unit tests & schema validation** | `npm test` |
| 9 | 🔄 Includes **author** & **updated_at** fields | Recommended for audit |
|10 | 🔄 Add example lead message + expected reply | Helpful for QA |

---

## 7. Runtime Usage

```ts
import prompts from '@/server/services/prompt-loader';

// fetch by id
const base = await prompts.getPrompt('base-system-prompt');

// fetch by tags
const objections = await prompts.getPromptsByTags(['objection:price']);

// fetch by conversation turn
const turn3 = await prompts.getPromptForTurn(3);
```

Environment control:

```bash
export PROMPT_LIBRARY_VERSION=2   # selects prompts/adf/v2
npm start
```

`prompt-loader` caches all prompts in memory; call `reloadPrompts()` if you need to refresh after hot-editing in dev mode.

---

## 8. Versioning Strategy

| Type | Action |
|------|--------|
| **Minor tweaks** (spelling, opt-out wording) | Edit in current version folder; bump `updated_at`. |
| **Behaviour changes** (new tags, updated JSON spec) | Copy file to `v(N+1)` folder, update, set `active: false` in old file if deprecated. |
| **A/B Experiments** | Keep both versions active with distinct IDs; use feature flags or tag filters in code. |

Release cadence aligns with `v1.0-adf-mvp`, `v1.1`, etc. Tags in Git mirror library version bumps.

---

## 9. FAQ

**Q:** _Can I embed HTML or Markdown in the actual reply text?_  
**A:** Yes for email/webchat prompts, **no** for SMS prompts (plain text only).

**Q:** _How do I reference dealership data?_  
**A:** Use double-handlebars placeholders: `{{dealer_address}}`. Values are injected by the ACE pre-processing layer.

**Q:** _Can prompts call more than one tool?_  
**A:** Follow the constraint in `base-system-prompt.md` – max **one** tool invocation per turn.

---

## 10. Future Extensions

* **Multilingual variants** via additional tag `lang:es` etc.  
* **Dynamic tone profiles** selected by dealership preference.  
* **Automated readability & toxicity scoring** in CI.  
* **Prompt similarity detection** to prevent duplication creep.  

---

_Last updated: 2025-06-01_  
Maintainer: Josh Copp (@copp1723)
