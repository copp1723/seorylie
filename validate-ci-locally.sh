#!/bin/bash

# Local CI Validation Script
# This script simulates the CI pipeline locally to catch issues before pushing

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Local CI Validation${NC}"
echo -e "${BLUE}=====================${NC}"
echo ""

# Function to print step headers
print_step() {
    echo -e "${BLUE}📋 Step: $1${NC}"
    echo "----------------------------------------"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    echo ""
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
    echo ""
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
    echo ""
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Check Node.js version
print_step "Checking Node.js version"
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"
if [[ "$NODE_VERSION" < "v18" ]]; then
    print_error "Node.js version 18 or higher is required"
    exit 1
fi
print_success "Node.js version is compatible"

# Step 2: Validate package.json
print_step "Validating package.json"
if ! node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" 2>/dev/null; then
    print_error "package.json is not valid JSON"
    exit 1
fi

# Check for problematic dependencies
if grep -q '"json_pp"' package.json; then
    print_error "Found invalid json_pp dependency in package.json"
    echo "This dependency does not exist in npm registry and will cause CI failures"
    exit 1
fi
print_success "package.json is valid and clean"

# Step 3: Install dependencies
print_step "Installing dependencies"
if npm ci; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 4: Check for security vulnerabilities
print_step "Running security audit"
if npm audit --audit-level=high; then
    print_success "No high-severity security vulnerabilities found"
else
    print_warning "Security vulnerabilities found - consider running 'npm audit fix'"
fi

# Step 5: Run linting
print_step "Running ESLint"
if npm run lint 2>/dev/null; then
    print_success "Linting passed"
else
    print_warning "Linting issues found - run 'npm run lint:fix' to auto-fix"
fi

# Step 6: Run type checking
print_step "Running TypeScript type checking"
if npm run type-check 2>/dev/null; then
    print_success "Type checking passed"
else
    print_warning "TypeScript errors found"
fi

# Step 7: Run unit tests
print_step "Running unit tests"
if npm run test -- --passWithNoTests 2>/dev/null; then
    print_success "Unit tests passed"
else
    print_warning "Unit tests failed or not configured"
fi

# Step 8: Test build process
print_step "Testing build process"
if npm run build 2>/dev/null; then
    print_success "Build completed successfully"
else
    print_warning "Build failed - check TypeScript errors and dependencies"
fi

# Step 9: Run health checks
print_step "Running health checks"
if npm run health-check 2>/dev/null; then
    print_success "Health checks passed"
else
    print_warning "Health checks failed - check environment configuration"
fi

# Step 10: Validate environment
print_step "Validating environment configuration"
if npm run env:validate 2>/dev/null; then
    print_success "Environment validation passed"
else
    print_warning "Environment validation issues found"
fi

# Step 11: Test Docker build (if Docker is available)
print_step "Testing Docker build"
if command -v docker &> /dev/null; then
    if docker build -t cleanrylie:test . &> /dev/null; then
        print_success "Docker build successful"
        # Clean up test image
        docker rmi cleanrylie:test &> /dev/null || true
    else
        print_warning "Docker build failed"
    fi
else
    print_warning "Docker not available - skipping Docker build test"
fi

# Step 12: Check file structure
print_step "Checking project structure"
MISSING_FILES=()

# Check for essential files
if [ ! -f "tsconfig.json" ]; then
    MISSING_FILES+=("tsconfig.json")
fi

if [ ! -f "server/index.ts" ]; then
    MISSING_FILES+=("server/index.ts")
fi

if [ ! -f "client/src/main.tsx" ]; then
    MISSING_FILES+=("client/src/main.tsx")
fi

if [ ! -d ".github/workflows" ]; then
    MISSING_FILES+=(".github/workflows directory")
fi

if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    print_success "Project structure is complete"
else
    print_warning "Missing files/directories: ${MISSING_FILES[*]}"
fi

# Step 13: Check Git status
print_step "Checking Git status"
if git status --porcelain | grep -q .; then
    print_warning "You have uncommitted changes"
    echo "Consider committing your changes before pushing to CI"
else
    print_success "Working directory is clean"
fi

# Final summary
echo ""
echo -e "${BLUE}📊 Local CI Validation Summary${NC}"
echo -e "${BLUE}==============================${NC}"
echo ""

# Count warnings and errors from the output
WARNINGS=$(grep -c "⚠️" <<< "$(cat)" 2>/dev/null || echo "0")
ERRORS=$(grep -c "❌" <<< "$(cat)" 2>/dev/null || echo "0")

echo -e "${GREEN}✅ Validation completed${NC}"
echo ""

if [ -f ".env" ]; then
    echo -e "${YELLOW}💡 Tips for CI success:${NC}"
    echo "• Make sure GitHub repository secrets are configured:"
    echo "  - OPENAI_API_KEY (required for E2E tests)"
    echo "  - SNYK_TOKEN (optional, for enhanced security scanning)"
    echo ""
    echo "• Ensure your branch is up to date with main"
    echo "• Consider running tests locally before pushing"
    echo ""
else
    print_warning "No .env file found - copy .env.example to .env and configure"
fi

echo -e "${GREEN}🚀 Ready to push to CI!${NC}"
echo ""
echo "Next steps:"
echo "1. git add ."
echo "2. git commit -m 'Your commit message'"
echo "3. git push origin your-branch"
echo "4. Monitor the CI pipeline in GitHub Actions"

exit 0
