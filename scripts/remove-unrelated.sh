#!/bin/bash

# Remove files not related to SEO project
# This cleans up components from other projects

echo "🗑️  RylieSEO - Removing Unrelated Files"
echo "========================================"

# Check if we're in the right directory
if [ ! -d "client" ] || [ ! -d "server" ]; then
  echo "❌ Error: Must be run from project root directory"
  exit 1
fi

# Create backup
echo "📦 Creating backup..."
BACKUP_DIR=".backup/remove-unrelated-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Function to safely remove with backup
safe_remove() {
  if [ -e "$1" ]; then
    echo "  - Removing: $1"
    mv "$1" "$BACKUP_DIR/" 2>/dev/null || true
  fi
}

echo ""
echo "🧹 Removing non-SEO components..."

# Remove prompt experiment stuff (email agent components)
safe_remove "client/src/components/prompt-testing"
safe_remove "scripts/test-prompt-experiments.ts"

# Remove oversized generic components
safe_remove "client/src/components/loading/SkeletonLoader.tsx"
safe_remove "client/src/components/feature-tour"
safe_remove "client/src/components/command-palette"
safe_remove "client/src/components/bulk-operations"

# Remove unrelated test files
safe_remove "test/unit/prompt-loader/prompt-loader.test.ts"
safe_remove "test/agent-squad/prompt-template.spec.ts"

# Remove agent studio if it exists (not SEO related)
safe_remove "client/src/pages/agent-studio.tsx"

echo ""
echo "🔍 Checking what remains..."
echo ""

# Show remaining large files
echo "📊 Remaining large files (over 500 lines):"
echo "-----------------------------------------"
find client server -name "*.tsx" -o -name "*.ts" 2>/dev/null | while read file; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    if [ "$lines" -gt 500 ]; then
      printf "%-60s %5d lines\n" "$file" "$lines"
    fi
  fi
done | sort -k2 -nr | head -10

echo ""
echo "✅ Cleanup Complete!"
echo "==================="
echo "- Removed email agent components"
echo "- Removed oversized UI components"
echo "- Removed feature tour"
echo "- Removed command palette"
echo ""
echo "📁 Backups saved to: $BACKUP_DIR/"
echo ""
echo "💡 This is now a focused SEO platform with:"
echo "  - SEO task management"
echo "  - Deliverable processing"
echo "  - Analytics integration"
echo "  - SEOWerks chat assistant"
echo ""
echo "🎯 Next: Run 'npm run build' to see bundle size reduction"