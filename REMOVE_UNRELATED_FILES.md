# 🗑️ Files to Remove - Not Related to SEO Project

## Confirmed Removals (Not SEO-Related)

### 1. **Prompt Experiment Files** (Email follow-up agent stuff)
```bash
# Already removed:
✅ client/src/components/prompt-testing/PromptExperimentInterface.tsx (2,321 lines!)

# Should also remove:
rm -rf client/src/components/prompt-testing/
rm -f scripts/test-prompt-experiments.ts
```

### 2. **Oversized Generic Components**
```bash
# 2,082 line skeleton loader - way overkill for SEO dashboards
rm -f client/src/components/loading/SkeletonLoader.tsx
# Keep the simple one: client/src/components/ui/skeleton.tsx
```

### 3. **Feature Tour** (Not needed for SEO platform)
```bash
rm -rf client/src/components/feature-tour/
```

### 4. **Command Palette** (1,104 lines - overcomplicated for SEO)
```bash
rm -rf client/src/components/command-palette/
```

### 5. **Bulk Operations Panel** (1,384 lines - too generic)
```bash
rm -rf client/src/components/bulk-operations/
```

## Files to KEEP (SEO-Related)

### ✅ Keep These Prompt Files:
- `server/routes/simple-prompt-test.ts` - Used by SEOWerks chat
- `server/services/system-prompts/seoworks-assistant.ts` - SEO knowledge base
- Anything related to SEOWerks chat functionality

### ✅ Keep These Components:
- Task management components
- SEOWerks queue components
- Analytics dashboards
- Deliverable processing
- Chat interface

## Quick Removal Script

```bash
#!/bin/bash
echo "🗑️ Removing non-SEO files..."

# Remove prompt experiment stuff
rm -rf client/src/components/prompt-testing/
rm -f scripts/test-prompt-experiments.ts

# Remove oversized generic components
rm -f client/src/components/loading/SkeletonLoader.tsx
rm -rf client/src/components/feature-tour/
rm -rf client/src/components/command-palette/
rm -rf client/src/components/bulk-operations/

# Remove test files from other projects
rm -f test/unit/prompt-loader/prompt-loader.test.ts
rm -f test/agent-squad/prompt-template.spec.ts

echo "✅ Cleanup complete!"
```

## Estimated Impact

- **Code removed**: ~7,000+ lines
- **Bundle size reduction**: ~300KB
- **Build time improvement**: 20-30% faster
- **Clarity**: No more confusion about what belongs

## What This Is

This is **RylieSEO** - A white-label SEO task management platform:
- ✅ SEO task creation and management
- ✅ Deliverable processing
- ✅ GA4 analytics integration
- ✅ SEOWerks chat assistant
- ❌ NOT an email agent
- ❌ NOT a prompt experimentation tool
- ❌ NOT a generic UI component library

Let's keep it focused and lean!