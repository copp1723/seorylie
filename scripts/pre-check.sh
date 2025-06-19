#!/bin/bash
# Pre-check script to verify environment before running commands

set -e

echo "🔍 Verifying development environment..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Running npm install..."
    npm install
fi

# Verify critical dependencies exist
CRITICAL_DEPS=("drizzle-orm" "vitest" "typescript" "tsx")
MISSING=()

for dep in "${CRITICAL_DEPS[@]}"; do
    if [ ! -d "node_modules/$dep" ]; then
        MISSING+=("$dep")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "❌ Missing dependencies: ${MISSING[*]}"
    echo "Run: npm install"
    exit 1
fi

echo "✅ All critical dependencies verified"
echo "✅ Environment verification complete"
