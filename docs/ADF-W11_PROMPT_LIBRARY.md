# ADF-W11 Prompt Library

Comprehensive reference for developers and content-creators working with the Adaptive Data-Feed (ADF) **Prompt Library** that powers the Adaptive Conversation Engine (ADF-W13).

---

## 1. Purpose & Scope
The Prompt Library is a version-controlled collection of Markdown templates that drive all AI responses for automotive sales conversations.

Goals  
* Centralise **system**, **turn-specific**, and **intent / objection** prompts  
* Enable **safe collaboration** between writers & engineers with strict schema-validated metadata  
* Support **A/B evolution** through folder-level versioning (`v1`, `v2`, …) guarded by a `PROMPT_LIBRARY_VERSION` feature flag  
* Provide a robust **loader utility** that indexes, validates and caches prompts at runtime

---

## 2. Directory Layout
```
prompts/
└── adf/
    ├── prompt-schema.json          ← JSON Schema for metadata validation
    ├── base-system-prompt.md
    ├── turn1-initial-contact.md
    ├── turn2-engaged.md
    ├── turn3-pricing-incentives.md
    ├── turn4-test-drive-offer.md
    ├── turn5-appointment-close.md
    ├── fast-track-appointment.md
    ├── soft-appointment.md
    └── objections/
        ├── objection-price.md
        ├── objection-timing.md
        └── objection-competition.md
```

### Version Folders  
To introduce new prompt iterations without disrupting production, place files inside `prompts/adf/v2/`, `v3/`, etc.  
The loader selects the folder **`v${PROMPT_LIBRARY_VERSION}`** when present, falling back to the root.

---

## 3. Metadata Schema (`prompt-schema.json`)
Key fields:

| Field        | Type    | Required | Description                                   |
|--------------|---------|----------|-----------------------------------------------|
| `id`         | string  | ✓        | Kebab-case unique key (auto-generated when omitted) |
| `description`| string  | ✓        | Human-readable summary (≤ 500 chars)          |
| `tags`       | string[]| ✓        | Categorisation e.g. `turn:1`, `objection:price` |
| `max_turn`   | int     | –        | Highest conversation turn this prompt should be used |
| `filepath`   | string  | ✓        | Relative markdown path                        |
| `version`    | string  | –        | Logical version label (`v1`, `v2.1`, …)       |
| `created_at` | ISO     | –        | Auto-filled by loader                         |
| `updated_at` | ISO     | –        | Auto-filled by loader                         |

Validation is enforced by **Ajv** in `server/services/prompt-loader.ts`. Any file that fails schema validation is **skipped and logged**.

---

## 4. Writing & Editing Guidelines
1. **Markdown First** – write prompts in plain Markdown; avoid HTML.  
2. **Header Title** – start with level-1 heading describing the prompt (e.g., `# Turn 3 – Pricing & Incentives Discussion`).  
3. **Purpose Block** – immediately follow with a bold `**Purpose**` section (one concise paragraph).  
4. **Prompt Template Section** – prefix with `## Prompt Template`; actual text goes here.  
5. **Tags Section** – always include `### Tags` followed by back-ticked tags.  
6. **Placeholders** – wrap dynamic variables in `{{double_curly}}`. Never leak internal variable names in live replies.  
7. **Length Discipline** – SMS replies ≤ 160 chars when possible; use emojis sparingly.  
8. **Compliance** – first outbound SMS must append `{{opt_out_phrase}}`.  
9. **No System Revelations** – the agent must not expose tools, schema or policies.  
10. **Tone** – warm, professional, helpful; mirror dealership branding.

---

## 5. Quality Checklist (pre-merge)
- [ ] Title & Purpose present and meaningful  
- [ ] At least one tag; correct `turn:` or `objection:` prefix  
- [ ] All placeholders wrapped in `{{ }}`  
- [ ] Reads naturally when placeholders are substituted  
- [ ] Passes `npm run test -- -t "Prompt Loader"` (schema compliance)  
- [ ] Spelling / grammar checked (US English)  
- [ ] No extraneous Markdown (tables close properly, lists well-formed)  
- [ ] CI green on branch

---

## 6. Loader Usage

```ts
import { promptLoader, getPrompt } from '../services/prompt-loader';

await promptLoader.initialize();               // one-time bootstrap
const tpl = getPrompt('turn-3-pricing-incentives');
console.log(tpl?.content);                     // ready-to-render template
```

### Feature Flag
Set `PROMPT_LIBRARY_VERSION` in environment:

```
# .env
PROMPT_LIBRARY_VERSION=2
```

If the specified folder does not exist, the loader defaults to root prompts.

### Hot Reload (development)
```ts
await promptLoader.refresh();  // Clears cache and rescans disk
```

---

## 7. Testing

1. **Unit Tests**  
   ```
   npm run test -- -t "Prompt Loader"
   ```
   Ensures loading, schema validation, and cache operations work (coverage ≥ 90 %).

2. **Manual Listing**  
   ```
   node -e "require('./server/services/prompt-loader').debugList()"
   ```
   Prints all registered prompts with metadata.

---

## 8. Contribution Workflow

| Step | Actor | Command / Action |
|------|-------|------------------|
| 1. Create branch | Dev/Writer | `git checkout -b feature/adf-w11/my-new-prompt` |
| 2. Add/modify `.md` files | Writer | Follow guidelines above |
| 3. Run tests locally | Dev | `npm t` |
| 4. Commit | Dev | `feat: [ADF-W11] add {{prompt_name}} prompt` |
| 5. Open PR to `stabilization` | Dev | CI must pass |
| 6. Reviewer QA | Lead | Use checklist, suggest edits |
| 7. Merge → `stabilization` | Maintainer | Fast-forward |
| 8. Release | Ops | `stabilization` → `main` → tag `v1.0-adf-mvp` |

---

## 9. Common Pitfalls & Solutions
| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Missing tags | Loader skips file | Add `### Tags` section with at least one tag |
| Placeholder typos | Runtime JSON errors | Run template through integration tests |
| Long SMS | Messages split unexpectedly | Use char counter; trim fluff |
| Unescaped JSON braces | Broken JSON in response | Double-wrap with `{{ }}` in template, escape outer braces in docs |

---

## 10. FAQ

**Q:** Can I embed images or HTML?  
**A:** No. Only plain Markdown; conversations are text-only.

**Q:** How do I retire a prompt?  
**A:** Delete the `.md` file in a branch; loader will drop it automatically. Keep history in Git.

**Q:** Can prompts call multiple tools?  
**A:** The system prompt enforces *one tool per turn* – keep templates aligned.

---

Happy Prompting!  
*– ADF Engineering & Content Team*
