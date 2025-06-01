#!/bin/bash

# Development Environment Setup Script
# Ensures all dependencies are installed before running lint/typecheck/test commands
# Critical for environments with network restrictions after initialization

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_progress() {
    echo -e "${BLUE}🔄${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify Node.js installation
check_node() {
    log_progress "Checking Node.js installation..."
    
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        log_warn "Node.js version $NODE_VERSION detected. Recommended: Node 18+"
    else
        log_info "Node.js version $NODE_VERSION ✓"
    fi
}

# Verify npm installation
check_npm() {
    log_progress "Checking npm installation..."
    
    if ! command_exists npm; then
        log_error "npm is not installed. Please install Node.js with npm"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    log_info "npm version $NPM_VERSION ✓"
}

# Install dependencies
install_dependencies() {
    log_progress "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        log_info "Using npm ci (package-lock.json found)"
        npm ci
    else
        log_info "Using npm install (no package-lock.json)"
        npm install
    fi
    
    log_info "Dependencies installed successfully"
}

# Verify critical dependencies
verify_dependencies() {
    log_progress "Verifying critical dependencies..."
    
    CRITICAL_DEPS=(
        "drizzle-orm"
        "vitest" 
        "typescript"
        "tsx"
        "jest"
        "express"
        "bull"
        "ioredis"
        "handlebars"
        "prom-client"
        "uuid"
        "zod"
    )
    
    MISSING_DEPS=()
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ ! -d "node_modules/$dep" ]; then
            MISSING_DEPS+=("$dep")
        fi
    done
    
    if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${MISSING_DEPS[*]}"
        log_error "Try running: npm install"
        exit 1
    fi
    
    log_info "All ${#CRITICAL_DEPS[@]} critical dependencies verified ✓"
}

# Verify TypeScript setup
verify_typescript() {
    log_progress "Verifying TypeScript setup..."
    
    if ! npx tsc --version >/dev/null 2>&1; then
        log_error "TypeScript not properly installed"
        exit 1
    fi
    
    if ! npx tsx --version >/dev/null 2>&1; then
        log_error "tsx not properly installed"
        exit 1
    fi
    
    log_info "TypeScript and tsx verified ✓"
}

# Verify testing frameworks
verify_testing() {
    log_progress "Verifying testing frameworks..."
    
    VITEST_VERSION=$(npx vitest --version 2>/dev/null || echo "not found")
    if [ "$VITEST_VERSION" != "not found" ]; then
        log_info "Vitest $VITEST_VERSION ✓"
    else
        log_error "Vitest not properly installed"
        exit 1
    fi
    
    JEST_VERSION=$(npx jest --version 2>/dev/null || echo "not found")
    if [ "$JEST_VERSION" != "not found" ]; then
        log_info "Jest $JEST_VERSION ✓"
    else
        log_warn "Jest not found - some tests may not work"
    fi
}

# Run type check
run_typecheck() {
    log_progress "Running TypeScript type check..."
    
    if npm run check >/dev/null 2>&1; then
        log_info "TypeScript type check passed ✓"
    else
        log_warn "TypeScript type check failed - this may be expected during setup"
    fi
}

# Create pre-check script
create_precheck_script() {
    log_progress "Creating pre-check script..."
    
    mkdir -p scripts
    
    cat > scripts/pre-check.sh << 'EOF'
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
EOF

    chmod +x scripts/pre-check.sh
    log_info "Created scripts/pre-check.sh"
}

# Generate environment report
generate_report() {
    echo ""
    log_info "Setup Summary:"
    echo "=================================================="
    
    echo ""
    log_info "🎉 Setup completed successfully!"
    echo ""
    echo "You can now run:"
    echo "  npm run lint     # TypeScript checking"
    echo "  npm run check    # Type checking" 
    echo "  npm run test     # Run tests"
    echo "  npm run build    # Build project"
    echo ""
    
    echo "Environment Info:"
    echo "  Node: $(node --version)"
    echo "  npm: $(npm --version)"
    echo "  Platform: $(uname -s)"
    echo "  Arch: $(uname -m)"
    echo "  PWD: $(pwd)"
    echo ""
    
    echo "Next steps:"
    echo "  1. Run './scripts/pre-check.sh' before any dev commands"
    echo "  2. Use 'npm run setup:verify' to check environment"
    echo "  3. See README.md for full development workflow"
}

# Main function
main() {
    echo "🚀 Starting development environment setup..."
    echo ""
    
    check_node
    check_npm
    install_dependencies
    verify_dependencies
    verify_typescript
    verify_testing
    create_precheck_script
    
    # Optional checks
    run_typecheck
    
    generate_report
}

# Handle command line arguments
case "${1:-full}" in
    "verify")
        log_info "Quick verification mode"
        verify_dependencies
        verify_typescript
        verify_testing
        ;;
    "install")
        log_info "Install mode"
        install_dependencies
        ;;
    "check") 
        log_info "Check mode"
        check_node
        check_npm
        verify_dependencies
        ;;
    "full"|"")
        main
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  full     - Full setup (default)"
        echo "  verify   - Quick verification of existing setup"
        echo "  install  - Install dependencies only"
        echo "  check    - Check environment only"
        echo "  help     - Show this help"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac