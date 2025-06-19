#!/bin/bash

# Quick setup verification script
# Tests that all setup scripts and dependencies are working correctly

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

echo "🔍 Verifying CleanRylie setup..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    log_success "Node.js $NODE_VERSION detected"
else
    log_error "Node.js not found"
    exit 1
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    log_success "npm $NPM_VERSION detected"
else
    log_error "npm not found"
    exit 1
fi

# Check if setup scripts exist
if [ -f "scripts/setup-dev.sh" ]; then
    log_success "Setup script (bash) found"
else
    log_error "scripts/setup-dev.sh not found"
    exit 1
fi

if [ -f "scripts/setup-dev.js" ]; then
    log_success "Setup script (node) found"
else
    log_error "scripts/setup-dev.js not found"
    exit 1
fi

# Check package.json has setup scripts
if grep -q '"setup"' package.json; then
    log_success "Setup npm scripts found in package.json"
else
    log_error "Setup scripts missing from package.json"
    exit 1
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
    log_success "node_modules directory exists"
    
    # Check critical dependencies
    CRITICAL_DEPS=("drizzle-orm" "vitest" "typescript" "tsx" "bull" "ioredis")
    MISSING=()
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ ! -d "node_modules/$dep" ]; then
            MISSING+=("$dep")
        fi
    done
    
    if [ ${#MISSING[@]} -eq 0 ]; then
        log_success "All critical dependencies found"
    else
        log_warn "Missing dependencies: ${MISSING[*]}"
        echo "  Run: npm install"
    fi
else
    log_warn "node_modules not found - dependencies need to be installed"
    echo "  Run: npm install"
fi

# Test TypeScript
if command -v npx >/dev/null 2>&1; then
    if npx tsc --version >/dev/null 2>&1; then
        TS_VERSION=$(npx tsc --version)
        log_success "TypeScript available: $TS_VERSION"
    else
        log_warn "TypeScript not available via npx"
    fi
    
    if npx tsx --version >/dev/null 2>&1; then
        TSX_VERSION=$(npx tsx --version)
        log_success "tsx available: $TSX_VERSION"
    else
        log_warn "tsx not available via npx"
    fi
else
    log_warn "npx not available"
fi

# Test vitest
if command -v npx >/dev/null 2>&1 && npx vitest --version >/dev/null 2>&1; then
    VITEST_VERSION=$(npx vitest --version)
    log_success "Vitest available: $VITEST_VERSION"
else
    log_warn "Vitest not available"
fi

echo ""
echo "📋 Verification Summary:"
echo "========================"

if [ -d "node_modules" ] && [ ${#MISSING[@]} -eq 0 ]; then
    log_success "Environment is ready for development!"
    echo ""
    echo "You can now run:"
    echo "  npm run lint"
    echo "  npm run check"
    echo "  npm run test"
    echo "  npm run build"
    echo "  npm run dev"
else
    log_warn "Environment needs setup"
    echo ""
    echo "To fix issues, run:"
    echo "  npm run setup       # Full setup"
    echo "  npm install         # Install dependencies only"
    echo "  npm run setup:verify # Verify setup"
fi

echo ""
echo "For detailed setup instructions, see SETUP.md"