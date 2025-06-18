#!/bin/bash

# Code Cleanup Script
# Removes duplicate components and fixes imports

echo "🧹 RylieSEO Code Cleanup Script"
echo "================================"

# Check if we're in the right directory
if [ ! -d "client" ] || [ ! -d "server" ]; then
  echo "❌ Error: Must be run from project root directory"
  exit 1
fi

# Backup first
echo "📦 Creating backup..."
mkdir -p .backup/cleanup-$(date +%Y%m%d-%H%M%S)

# Remove duplicate toast implementations
echo "🔧 Removing duplicate toast implementations..."
if [ -f "client/src/components/ui/use-toast.ts" ]; then
  mv client/src/components/ui/use-toast.ts .backup/cleanup-$(date +%Y%m%d-%H%M%S)/
  echo "  - Removed use-toast.ts"
fi

if [ -f "client/src/hooks/use-toast.tsx" ]; then
  mv client/src/hooks/use-toast.tsx .backup/cleanup-$(date +%Y%m%d-%H%M%S)/
  echo "  - Removed hooks/use-toast.tsx"
fi

# Remove duplicate branding page
echo "🔧 Removing duplicate branding page..."
if [ -f "client/src/pages/branding.tsx" ]; then
  mv client/src/pages/branding.tsx .backup/cleanup-$(date +%Y%m%d-%H%M%S)/
  echo "  - Removed duplicate branding.tsx"
fi

# Update imports for toast
echo "🔄 Updating toast imports..."
find client -name "*.tsx" -o -name "*.ts" | while read file; do
  if grep -q "@/hooks/use-toast" "$file" 2>/dev/null; then
    sed -i.bak 's|@/hooks/use-toast|@/components/ui/use-toast|g' "$file"
    rm "${file}.bak"
    echo "  - Updated: $file"
  fi
done

# Remove old test files
echo "🗑️  Removing old test files..."
find . -name "*.test.tsx.old" -o -name "*.test.ts.old" | while read file; do
  rm "$file"
  echo "  - Removed: $file"
done

# Check for oversized files
echo ""
echo "📊 Large files that need attention:"
echo "-----------------------------------"
find client server -name "*.tsx" -o -name "*.ts" | while read file; do
  lines=$(wc -l < "$file" 2>/dev/null || echo 0)
  if [ "$lines" -gt 500 ]; then
    printf "%-60s %5d lines\n" "$file" "$lines"
  fi
done | sort -k2 -nr | head -10

# Check for potential duplicates
echo ""
echo "🔍 Potential duplicate files:"
echo "-----------------------------"
find client -name "*.tsx" -o -name "*.ts" | xargs -I {} basename {} | sort | uniq -d | while read dup; do
  echo "Duplicate filename: $dup"
  find client -name "$dup" | sed 's/^/  - /'
done

# Summary
echo ""
echo "✅ Cleanup Summary:"
echo "==================="
echo "- Toast implementations consolidated"
echo "- Duplicate pages removed"
echo "- Imports updated"
echo "- Old test files cleaned"
echo ""
echo "📁 Backups saved to: .backup/cleanup-$(date +%Y%m%d-%H%M%S)/"
echo ""
echo "🎯 Next steps:"
echo "1. Split files over 500 lines into smaller components"
echo "2. Review and consolidate duplicate filenames"
echo "3. Run 'npm run typecheck' to verify no import errors"