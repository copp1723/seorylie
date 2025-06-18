# 🧹 Code Optimization & Cleanup Plan

## 🚨 Critical Issues Found

### 1. **Duplicate Components** (Quick Wins)
- **3 different toast implementations** → Consolidate to one
- **2 identical branding pages** (903 lines each) → Remove duplicate
- **Multiple auth hooks** → Unify authentication

### 2. **Oversized Files** (Need Splitting)
```
PromptExperimentInterface.tsx - 2,321 lines ❌
SkeletonLoader.tsx           - 2,082 lines ❌
orchestrator.ts              - 2,433 lines ❌
rylie-retriever.ts          - 1,914 lines ❌
websocket-service.ts        - 1,858 lines ❌
```

### 3. **Performance Concerns**
- Heavy skeleton loader could be lazy-loaded
- Large components importing everything upfront
- No code splitting implemented

## 🎯 Immediate Actions (1-2 hours)

### 1. Consolidate Toast Implementation
```bash
# Remove duplicates, keep only one:
rm client/src/components/ui/use-toast.ts
rm client/src/hooks/use-toast.tsx
# Keep: client/src/components/ui/use-toast.tsx
```

### 2. Remove Duplicate Pages
```bash
# Remove duplicate branding page
rm client/src/pages/branding.tsx
# Keep: client/src/pages/admin/branding.tsx
```

### 3. Quick Import Cleanup
```typescript
// Replace in all files:
import { useToast } from "@/hooks/use-toast" 
// With:
import { useToast } from "@/components/ui/use-toast"
```

## 📦 Bundle Size Optimization (2-3 hours)

### 1. Split Large Components
```typescript
// PromptExperimentInterface.tsx → Split into:
- PromptEditor.tsx
- ExperimentResults.tsx
- PromptHistory.tsx
- PromptSettings.tsx
```

### 2. Lazy Load Heavy Components
```typescript
// Before:
import { SkeletonLoader } from './components/loading/SkeletonLoader';

// After:
const SkeletonLoader = lazy(() => import('./components/loading/SkeletonLoader'));
```

### 3. Icon Optimization
```typescript
// Before:
import { Home, User, Settings, ... } from 'lucide-react';

// After:
import Home from 'lucide-react/dist/esm/icons/home';
import User from 'lucide-react/dist/esm/icons/user';
```

## 🏗️ Architecture Improvements (4-6 hours)

### 1. Service Layer Refactoring
```
orchestrator.ts (2,433 lines) → Split into:
├── orchestrator/
│   ├── index.ts
│   ├── conversation-manager.ts
│   ├── agent-coordinator.ts
│   ├── message-processor.ts
│   └── types.ts
```

### 2. Component Library Structure
```
components/
├── ui/           # Base UI components
├── features/     # Feature-specific components
├── layouts/      # Layout components
└── shared/       # Shared utilities
```

### 3. Import Path Aliases
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@ui/*": ["./src/components/ui/*"],
      "@features/*": ["./src/components/features/*"],
      "@services/*": ["./src/services/*"]
    }
  }
}
```

## 📊 Estimated Impact

### Bundle Size Reduction
- **Current**: ~2.5MB (estimated)
- **After optimization**: ~1.2MB (50% reduction)
- **Load time improvement**: 2-3 seconds faster

### Code Maintainability
- **File size**: No file over 500 lines
- **Import depth**: Max 2 levels
- **Component reuse**: 40% less duplicate code

### Developer Experience
- **Build time**: 30% faster
- **Type checking**: 40% faster
- **Code navigation**: Much easier

## 🚀 Quick Cleanup Script

```bash
#!/bin/bash
# cleanup-duplicates.sh

echo "🧹 Starting cleanup..."

# Remove duplicate toast implementations
echo "Removing duplicate toast hooks..."
rm -f client/src/components/ui/use-toast.ts
rm -f client/src/hooks/use-toast.tsx

# Remove duplicate branding page
echo "Removing duplicate branding page..."
rm -f client/src/pages/branding.tsx

# Update imports
echo "Updating toast imports..."
find client -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|@/hooks/use-toast|@/components/ui/use-toast|g'

# Remove unused test files
echo "Cleaning up old test files..."
find . -name "*.test.tsx.old" -delete
find . -name "*.test.ts.old" -delete

echo "✅ Cleanup complete!"
```

## 📈 Monitoring

After optimization, monitor:
1. **Bundle size**: Use `npm run build` and check dist size
2. **Load time**: Measure with Lighthouse
3. **Build time**: Track CI/CD duration
4. **Type check time**: `time npm run typecheck`

## 🎯 Priority Order

1. **Now** (15 mins): Remove duplicates
2. **Today** (2 hours): Split `PromptExperimentInterface.tsx`
3. **This Week** (4 hours): Implement lazy loading
4. **Next Sprint** (8 hours): Full service layer refactor

This will make the codebase much more maintainable and performant!