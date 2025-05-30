#!/bin/bash
#
# INT-001 Integration Environment Setup Script
# 
# This script automates the setup of the integration environment for the
# Platform Integration & Consolidation epic. It performs all the necessary
# steps to complete the INT-001 ticket requirements.
#
# Usage: ./scripts/setup-integration-environment.sh [--force]
#   --force: Skip confirmation prompts and proceed with all operations

set -e

# Color definitions for status messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
GOLDEN_BRANCH="droid/platform-integration-tasks"
INTEGRATION_BRANCH="integration/production-readiness-phase1"
TAG_NAME="pre-integration-baseline"
TAG_MESSAGE="Baseline before production readiness integration"
SMART_INTEGRATE_SCRIPT="scripts/smart-integrate.sh"
CONFLICT_REPORTER_SCRIPT="scripts/conflict-reporter.ts"
TEST_BRANCH="C3-database-connection-pooling" # Branch to test conflict reporter with

# Track overall status
ERRORS=0
WARNINGS=0

# Parse command line arguments
FORCE=false
for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown argument: $arg${NC}"
      echo "Usage: ./scripts/setup-integration-environment.sh [--force]"
      exit 1
      ;;
  esac
done

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}${BOLD}$1${NC}"
  echo -e "${BLUE}$(printf '=%.0s' {1..50})${NC}\n"
}

# Function to print success messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning messages
print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

# Function to print error messages
print_error() {
  echo -e "${RED}✗ $1${NC}"
  ERRORS=$((ERRORS + 1))
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to confirm an action
confirm_action() {
  if [ "$FORCE" = true ]; then
    return 0
  fi
  
  read -p "$1 (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    return 0
  else
    return 1
  fi
}

# Print welcome message
print_header "INT-001 Integration Environment Setup"
echo "This script will set up the integration environment for the"
echo "Platform Integration & Consolidation epic, completing the INT-001 ticket."
echo
echo "The following tasks will be performed:"
echo "  1. Check required dependencies"
echo "  2. Make integration scripts executable"
echo "  3. Verify/create integration branch"
echo "  4. Create baseline tag on golden branch"
echo "  5. Test conflict reporter"
echo "  6. Validate smart-integrate script"
echo

if [ "$FORCE" != true ]; then
  if ! confirm_action "Do you want to proceed?"; then
    echo -e "${YELLOW}Setup cancelled by user.${NC}"
    exit 0
  fi
fi

# Step 1: Check required dependencies
print_header "1. Checking Required Dependencies"

# Check Git
if command_exists git; then
  print_success "Git is installed"
  GIT_VERSION=$(git --version | awk '{print $3}')
  echo "   Version: $GIT_VERSION"
else
  print_error "Git is not installed. Please install Git and try again."
  exit 1
fi

# Check Node.js
if command_exists node; then
  print_success "Node.js is installed"
  NODE_VERSION=$(node --version)
  echo "   Version: $NODE_VERSION"
  
  # Check Node.js version (should be >= 20.0.0)
  NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f1 | tr -d 'v')
  if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
    print_warning "Node.js version is less than 20.0.0. Some features may not work correctly."
  fi
else
  print_error "Node.js is not installed. Please install Node.js >= 20.0.0 and try again."
  exit 1
fi

# Check npm
if command_exists npm; then
  print_success "npm is installed"
  NPM_VERSION=$(npm --version)
  echo "   Version: $NPM_VERSION"
else
  print_error "npm is not installed. Please install npm and try again."
  exit 1
fi

# Check tsx
if command_exists tsx; then
  print_success "tsx is installed"
  TSX_VERSION=$(tsx --version 2>&1 | head -n 1)
  echo "   Version: $TSX_VERSION"
else
  print_warning "tsx is not installed globally. Will attempt to install."
  echo "Installing tsx globally..."
  if npm install -g tsx; then
    print_success "tsx installed successfully"
  else
    print_error "Failed to install tsx. Please install manually: npm install -g tsx"
    exit 1
  fi
fi

# Check GitHub CLI
if command_exists gh; then
  print_success "GitHub CLI is installed"
  GH_VERSION=$(gh --version | head -n 1)
  echo "   Version: $GH_VERSION"
  
  # Check if logged in to GitHub
  if gh auth status >/dev/null 2>&1; then
    print_success "Authenticated with GitHub"
  else
    print_warning "Not authenticated with GitHub CLI. Some features may not work."
    echo "   Run 'gh auth login' to authenticate."
  fi
else
  print_warning "GitHub CLI is not installed. Some features may not work."
  echo "   See https://cli.github.com/ for installation instructions."
fi

# Step 2: Make integration scripts executable
print_header "2. Making Integration Scripts Executable"

# Check if scripts exist
if [ -f "$SMART_INTEGRATE_SCRIPT" ]; then
  echo "Making $SMART_INTEGRATE_SCRIPT executable..."
  chmod +x "$SMART_INTEGRATE_SCRIPT"
  print_success "$SMART_INTEGRATE_SCRIPT is now executable"
else
  print_error "$SMART_INTEGRATE_SCRIPT does not exist"
  exit 1
fi

if [ -f "$CONFLICT_REPORTER_SCRIPT" ]; then
  echo "Making $CONFLICT_REPORTER_SCRIPT executable..."
  chmod +x "$CONFLICT_REPORTER_SCRIPT"
  print_success "$CONFLICT_REPORTER_SCRIPT is now executable"
else
  print_error "$CONFLICT_REPORTER_SCRIPT does not exist"
  exit 1
fi

# Step 3: Verify/create integration branch
print_header "3. Verifying Integration Branch"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we're in a clean state
if ! git diff --quiet && git diff --staged --quiet; then
  print_warning "You have uncommitted changes. It's recommended to commit or stash them first."
  if ! confirm_action "Continue anyway?"; then
    echo -e "${YELLOW}Setup paused. Please commit or stash your changes and try again.${NC}"
    exit 0
  fi
fi

# Check if golden branch exists
if git show-ref --verify --quiet "refs/heads/$GOLDEN_BRANCH"; then
  print_success "Golden branch '$GOLDEN_BRANCH' exists"
else
  print_error "Golden branch '$GOLDEN_BRANCH' does not exist"
  exit 1
fi

# Check if integration branch exists
if git show-ref --verify --quiet "refs/heads/$INTEGRATION_BRANCH"; then
  print_success "Integration branch '$INTEGRATION_BRANCH' already exists"
  
  # Check if integration branch is up to date with golden branch
  git fetch origin "$GOLDEN_BRANCH" --quiet
  GOLDEN_SHA=$(git rev-parse "origin/$GOLDEN_BRANCH")
  INTEGRATION_MERGE_BASE=$(git merge-base "origin/$INTEGRATION_BRANCH" "origin/$GOLDEN_BRANCH")
  
  if [ "$GOLDEN_SHA" != "$INTEGRATION_MERGE_BASE" ]; then
    print_warning "Integration branch is not up to date with golden branch"
    if confirm_action "Do you want to update the integration branch?"; then
      echo "Updating integration branch..."
      git checkout "$INTEGRATION_BRANCH"
      git pull origin "$INTEGRATION_BRANCH"
      git merge "origin/$GOLDEN_BRANCH" --no-edit
      print_success "Integration branch updated"
    fi
  else
    print_success "Integration branch is up to date with golden branch"
  fi
else
  print_warning "Integration branch '$INTEGRATION_BRANCH' does not exist"
  if confirm_action "Do you want to create it?"; then
    echo "Creating integration branch..."
    git checkout "$GOLDEN_BRANCH"
    git pull origin "$GOLDEN_BRANCH"
    git checkout -b "$INTEGRATION_BRANCH"
    git push -u origin "$INTEGRATION_BRANCH"
    print_success "Integration branch '$INTEGRATION_BRANCH' created and pushed"
  else
    print_error "Integration branch is required for the integration process"
    exit 1
  fi
fi

# Step 4: Create baseline tag on golden branch
print_header "4. Creating Baseline Tag"

# Check if tag already exists
if git show-ref --tags --quiet "refs/tags/$TAG_NAME"; then
  print_warning "Tag '$TAG_NAME' already exists"
  if confirm_action "Do you want to force update the tag?"; then
    echo "Force updating tag..."
    git checkout "$GOLDEN_BRANCH"
    git pull origin "$GOLDEN_BRANCH"
    git tag -f -a "$TAG_NAME" -m "$TAG_MESSAGE"
    git push origin "$TAG_NAME" -f
    print_success "Tag '$TAG_NAME' force updated"
  else
    print_success "Using existing tag '$TAG_NAME'"
  fi
else
  echo "Creating tag '$TAG_NAME' on branch '$GOLDEN_BRANCH'..."
  git checkout "$GOLDEN_BRANCH"
  git pull origin "$GOLDEN_BRANCH"
  git tag -a "$TAG_NAME" -m "$TAG_MESSAGE"
  git push origin "$TAG_NAME"
  print_success "Tag '$TAG_NAME' created and pushed"
fi

# Return to integration branch
git checkout "$INTEGRATION_BRANCH"

# Step 5: Test conflict reporter
print_header "5. Testing Conflict Reporter"

echo "Running conflict reporter against test branch '$TEST_BRANCH'..."
if tsx "$CONFLICT_REPORTER_SCRIPT" "$INTEGRATION_BRANCH" "$TEST_BRANCH"; then
  print_success "Conflict reporter executed successfully"
else
  print_warning "Conflict reporter reported potential conflicts"
  echo "   This is normal if there are actual conflicts to resolve."
  echo "   Please review the conflicts and resolve them during integration."
fi

# Step 6: Validate smart-integrate script
print_header "6. Validating Smart-Integrate Script"

echo "Running smart-integrate in dry-run mode for branch '$TEST_BRANCH'..."
if "./$SMART_INTEGRATE_SCRIPT" "$TEST_BRANCH" --dry-run; then
  print_success "Smart-integrate script validated successfully"
else
  print_error "Smart-integrate script failed in dry-run mode"
  echo "   Please check the script and try again."
  ERRORS=$((ERRORS + 1))
fi

# Step 7: Setup GitHub secrets if GitHub CLI is available
if command_exists gh; then
  print_header "7. GitHub Secrets Setup"
  
  echo "Checking for required GitHub secrets..."
  
  # Check if repository has SNYK_TOKEN secret
  if gh secret list 2>/dev/null | grep -q "SNYK_TOKEN"; then
    print_success "SNYK_TOKEN secret exists"
  else
    print_warning "SNYK_TOKEN secret does not exist"
    if confirm_action "Do you want to set up SNYK_TOKEN now?"; then
      read -p "Enter your Snyk token: " SNYK_TOKEN
      if [ -n "$SNYK_TOKEN" ]; then
        gh secret set SNYK_TOKEN --body "$SNYK_TOKEN"
        print_success "SNYK_TOKEN secret set"
      else
        print_warning "No token provided, skipping SNYK_TOKEN setup"
      fi
    fi
  fi
  
  # Check if repository has SLACK_WEBHOOK secret
  if gh secret list 2>/dev/null | grep -q "SLACK_WEBHOOK"; then
    print_success "SLACK_WEBHOOK secret exists"
  else
    print_warning "SLACK_WEBHOOK secret does not exist"
    if confirm_action "Do you want to set up SLACK_WEBHOOK now?"; then
      read -p "Enter your Slack webhook URL: " SLACK_WEBHOOK
      if [ -n "$SLACK_WEBHOOK" ]; then
        gh secret set SLACK_WEBHOOK --body "$SLACK_WEBHOOK"
        print_success "SLACK_WEBHOOK secret set"
      else
        print_warning "No webhook URL provided, skipping SLACK_WEBHOOK setup"
      fi
    fi
  fi
else
  print_warning "Skipping GitHub secrets setup (GitHub CLI not available)"
fi

# Print summary
print_header "Setup Complete"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All tasks completed successfully!${NC}"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}${BOLD}Setup completed with $WARNINGS warning(s).${NC}"
  echo "Please review the warnings above."
else
  echo -e "${RED}${BOLD}Setup completed with $ERRORS error(s) and $WARNINGS warning(s).${NC}"
  echo "Please fix the errors and try again."
fi

echo
echo -e "${BLUE}${BOLD}Next Steps:${NC}"
echo "1. Start integrating feature branches using:"
echo "   ./scripts/smart-integrate.sh <branch-name>"
echo
echo "2. After integration, test the changes thoroughly"
echo
echo "3. When all features are integrated and tested, create a PR from:"
echo "   $INTEGRATION_BRANCH → $GOLDEN_BRANCH"
echo

if [ $ERRORS -gt 0 ]; then
  exit 1
else
  exit 0
fi
