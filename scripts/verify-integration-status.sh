#!/bin/bash
#
# Integration Status Verification Script
# 
# This script verifies the current status of the integration environment
# for the Platform Integration & Consolidation epic. It performs checks
# to ensure that the INT-001 setup is complete and provides guidance
# on next steps for the integration process.
#
# Usage: ./scripts/verify-integration-status.sh [--verbose]
#   --verbose: Show additional details in the output

set -e

# Color definitions for status messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
GOLDEN_BRANCH="droid/platform-integration-tasks"
INTEGRATION_BRANCH="integration/production-readiness-phase1"
TAG_NAME="pre-integration-baseline"
SMART_INTEGRATE_SCRIPT="scripts/smart-integrate.sh"
CONFLICT_REPORTER_SCRIPT="scripts/conflict-reporter.ts"
C3_BRANCH="C3-database-connection-pooling"
C3_FILES=("server/db.ts" "server/routes/monitoring-routes.ts" "test/load/db-pool-load-test.js" "docs/DATABASE_POOL_MONITORING.md")

# Parse command line arguments
VERBOSE=false
for arg in "$@"; do
  case $arg in
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown argument: $arg${NC}"
      echo "Usage: ./scripts/verify-integration-status.sh [--verbose]"
      exit 1
      ;;
  esac
done

# Track overall status
PASSED=0
FAILED=0
WARNINGS=0
TOTAL=0

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}${BOLD}$1${NC}"
  echo -e "${BLUE}$(printf '=%.0s' {1..60})${NC}\n"
}

# Function to print check results
print_check() {
  local status=$1
  local message=$2
  local details=$3
  
  TOTAL=$((TOTAL + 1))
  
  if [ "$status" == "pass" ]; then
    echo -e "${GREEN}✓ $message${NC}"
    PASSED=$((PASSED + 1))
  elif [ "$status" == "warn" ]; then
    echo -e "${YELLOW}⚠ $message${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${RED}✗ $message${NC}"
    FAILED=$((FAILED + 1))
  fi
  
  if [ -n "$details" ] && [ "$VERBOSE" == "true" ]; then
    echo -e "${GRAY}  $details${NC}"
  fi
}

# Function to print verbose information
print_verbose() {
  if [ "$VERBOSE" == "true" ]; then
    echo -e "${GRAY}  $1${NC}"
  fi
}

# Function to print a command's output
print_cmd_output() {
  if [ "$VERBOSE" == "true" ]; then
    echo -e "${GRAY}  $(echo "$1" | sed 's/^/  /')${NC}"
  fi
}

# Check if a branch exists
check_branch_exists() {
  local branch=$1
  if git show-ref --verify --quiet "refs/heads/$branch" || git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
    return 0
  else
    return 1
  fi
}

# Check if a tag exists
check_tag_exists() {
  local tag=$1
  if git show-ref --tags --quiet "refs/tags/$tag"; then
    return 0
  else
    return 1
  fi
}

# Check if a file exists and is executable
check_file_executable() {
  local file=$1
  if [ -f "$file" ]; then
    if [ -x "$file" ]; then
      return 0
    else
      return 2
    fi
  else
    return 1
  fi
}

# Get recent commits for a branch
get_recent_commits() {
  local branch=$1
  local count=$2
  git log --oneline -n "$count" "$branch" 2>/dev/null || echo "Cannot get commits for $branch"
}

# Check if a specific change is in a branch
check_change_in_branch() {
  local branch=$1
  local file=$2
  if git ls-tree -r --name-only "$branch" 2>/dev/null | grep -q "^$file$"; then
    return 0
  else
    return 1
  fi
}

# Print welcome message
print_header "Integration Environment Status Verification"
echo "This script checks the current status of the integration environment"
echo "for the Platform Integration & Consolidation epic. It verifies that"
echo "the INT-001 setup is complete and provides guidance on next steps."
echo
echo "Running checks..."

# Step 1: Check branch structure
print_header "1. Branch Structure"

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "Current branch: ${CYAN}$CURRENT_BRANCH${NC}"

# Check golden branch
if check_branch_exists "$GOLDEN_BRANCH"; then
  print_check "pass" "Golden branch '$GOLDEN_BRANCH' exists" "This is the protected source branch"
  GOLDEN_COMMITS=$(get_recent_commits "$GOLDEN_BRANCH" 3)
  print_verbose "Recent commits on golden branch:"
  print_cmd_output "$GOLDEN_COMMITS"
else
  print_check "fail" "Golden branch '$GOLDEN_BRANCH' does not exist" "This is the required source branch for integration"
fi

# Check integration branch
if check_branch_exists "$INTEGRATION_BRANCH"; then
  print_check "pass" "Integration branch '$INTEGRATION_BRANCH' exists" "This is your working integration branch"
  INTEGRATION_COMMITS=$(get_recent_commits "$INTEGRATION_BRANCH" 3)
  print_verbose "Recent commits on integration branch:"
  print_cmd_output "$INTEGRATION_COMMITS"
  
  # Check if integration branch is based on golden branch
  if git merge-base --is-ancestor "$(git rev-parse "$GOLDEN_BRANCH" 2>/dev/null || echo "invalid")" "$(git rev-parse "$INTEGRATION_BRANCH" 2>/dev/null || echo "invalid")" 2>/dev/null; then
    print_check "pass" "Integration branch is properly based on golden branch"
  else
    print_check "warn" "Integration branch may not be properly based on golden branch" "This could cause integration issues"
  fi
else
  print_check "fail" "Integration branch '$INTEGRATION_BRANCH' does not exist" "This branch is required for your integration work"
fi

# Step 2: Check baseline tag
print_header "2. Baseline Tag"

if check_tag_exists "$TAG_NAME"; then
  print_check "pass" "Baseline tag '$TAG_NAME' exists"
  
  # Check which commit the tag points to
  TAG_COMMIT=$(git rev-parse "$TAG_NAME" 2>/dev/null)
  TAG_BRANCH=$(git branch --contains "$TAG_COMMIT" | grep -v "detached" | head -n 1 | sed 's/^[ *]*//')
  
  if [ -n "$TAG_BRANCH" ]; then
    print_check "pass" "Tag is attached to a branch" "Branch: $TAG_BRANCH"
  else
    print_check "warn" "Tag is not clearly attached to a branch" "This might be a detached HEAD state"
  fi
  
  # Check tag message
  TAG_MESSAGE=$(git tag -l --format='%(contents)' "$TAG_NAME" 2>/dev/null)
  if [ -n "$TAG_MESSAGE" ]; then
    print_verbose "Tag message: $TAG_MESSAGE"
  fi
else
  print_check "fail" "Baseline tag '$TAG_NAME' does not exist" "This tag is required to mark the pre-integration state"
fi

# Step 3: Check integration scripts
print_header "3. Integration Scripts"

# Check smart-integrate script
SMART_INTEGRATE_STATUS=$(check_file_executable "$SMART_INTEGRATE_SCRIPT"; echo $?)
if [ "$SMART_INTEGRATE_STATUS" -eq 0 ]; then
  print_check "pass" "Smart-integrate script exists and is executable" "$SMART_INTEGRATE_SCRIPT"
elif [ "$SMART_INTEGRATE_STATUS" -eq 2 ]; then
  print_check "warn" "Smart-integrate script exists but is not executable" "Run: chmod +x $SMART_INTEGRATE_SCRIPT"
else
  print_check "fail" "Smart-integrate script does not exist" "This script is required for cherry-picking"
fi

# Check conflict-reporter script
CONFLICT_REPORTER_STATUS=$(check_file_executable "$CONFLICT_REPORTER_SCRIPT"; echo $?)
if [ "$CONFLICT_REPORTER_STATUS" -eq 0 ]; then
  print_check "pass" "Conflict-reporter script exists and is executable" "$CONFLICT_REPORTER_SCRIPT"
elif [ "$CONFLICT_REPORTER_STATUS" -eq 2 ]; then
  print_check "warn" "Conflict-reporter script exists but is not executable" "Run: chmod +x $CONFLICT_REPORTER_SCRIPT"
else
  print_check "fail" "Conflict-reporter script does not exist" "This script is required for detecting semantic conflicts"
fi

# Step 4: Check C3 integration status
print_header "4. C3 Integration Status"

# Check if C3 branch exists
if check_branch_exists "$C3_BRANCH"; then
  print_check "pass" "C3 branch '$C3_BRANCH' exists" "This is the source branch for database connection pooling"
else
  print_check "warn" "C3 branch '$C3_BRANCH' does not exist or is not visible" "This branch contains the database connection pooling changes"
fi

# Check if C3 files exist in integration branch
C3_INTEGRATED=true
C3_INTEGRATED_FILES=0
C3_MISSING_FILES=()

for file in "${C3_FILES[@]}"; do
  if check_change_in_branch "$INTEGRATION_BRANCH" "$file"; then
    C3_INTEGRATED_FILES=$((C3_INTEGRATED_FILES + 1))
    print_verbose "Found C3 file in integration branch: $file"
  else
    C3_INTEGRATED=false
    C3_MISSING_FILES+=("$file")
  fi
done

if [ "$C3_INTEGRATED" = true ]; then
  print_check "pass" "C3 database connection pooling appears to be integrated" "Found all $C3_INTEGRATED_FILES expected files"
else
  print_check "warn" "C3 database connection pooling may not be fully integrated" "Missing ${#C3_MISSING_FILES[@]} of ${#C3_FILES[@]} expected files"
  if [ "$VERBOSE" = true ] && [ ${#C3_MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${GRAY}  Missing files:${NC}"
    for file in "${C3_MISSING_FILES[@]}"; do
      echo -e "${GRAY}    - $file${NC}"
    done
  fi
fi

# Check for specific C3 indicators in code
if check_branch_exists "$INTEGRATION_BRANCH"; then
  # Try to check db.ts for pool configuration
  if git show "$INTEGRATION_BRANCH:server/db.ts" 2>/dev/null | grep -q "max: 20"; then
    print_check "pass" "Found enhanced pool configuration (max: 20) in db.ts"
  else
    print_check "warn" "Could not find enhanced pool configuration in db.ts" "Expected 'max: 20' setting"
  fi
  
  # Check for Prometheus metrics
  if git show "$INTEGRATION_BRANCH:server/db.ts" 2>/dev/null | grep -q "prom-client"; then
    print_check "pass" "Found Prometheus metrics integration in db.ts"
  else
    print_check "warn" "Could not find Prometheus metrics integration in db.ts" "Expected 'prom-client' import"
  fi
  
  # Check for pool monitoring endpoint
  if git show "$INTEGRATION_BRANCH:server/routes/monitoring-routes.ts" 2>/dev/null | grep -q "database/pool"; then
    print_check "pass" "Found pool monitoring endpoint in monitoring-routes.ts"
  else
    print_check "warn" "Could not find pool monitoring endpoint in monitoring-routes.ts" "Expected '/database/pool' route"
  fi
fi

# Step 5: Check GitHub workflow
print_header "5. CI/CD Integration"

# Check if GitHub workflow file exists
if [ -f ".github/workflows/integration-quality-gate.yml" ]; then
  print_check "pass" "Integration quality gate workflow exists"
  
  # Check if workflow contains expected content
  if grep -q "integration-quality-gate" ".github/workflows/integration-quality-gate.yml" 2>/dev/null; then
    print_check "pass" "Workflow file contains expected configuration"
  else
    print_check "warn" "Workflow file may not be properly configured" "Check the workflow file content"
  fi
else
  print_check "warn" "Integration quality gate workflow does not exist" "This workflow is required for CI/CD integration"
fi

# Check if GitHub CLI is available to check secrets
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    # Check for required secrets
    if gh secret list 2>/dev/null | grep -q "SNYK_TOKEN"; then
      print_check "pass" "SNYK_TOKEN secret is configured"
    else
      print_check "warn" "SNYK_TOKEN secret is not configured" "This is required for security scanning"
    fi
    
    if gh secret list 2>/dev/null | grep -q "SLACK_WEBHOOK"; then
      print_check "pass" "SLACK_WEBHOOK secret is configured"
    else
      print_check "warn" "SLACK_WEBHOOK secret is not configured" "This is required for notifications"
    fi
  else
    print_check "warn" "Not authenticated with GitHub CLI" "Cannot verify GitHub secrets"
  fi
else
  print_check "warn" "GitHub CLI not available" "Cannot verify GitHub secrets"
fi

# Print summary
print_header "Integration Status Summary"

PASS_PERCENT=$((PASSED * 100 / TOTAL))
echo -e "Total Checks: ${BOLD}$TOTAL${NC}"
echo -e "Passed: ${GREEN}${BOLD}$PASSED${NC} (${GREEN}${BOLD}${PASS_PERCENT}%${NC})"
echo -e "Warnings: ${YELLOW}${BOLD}$WARNINGS${NC}"
echo -e "Failed: ${RED}${BOLD}$FAILED${NC}"
echo

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✓ Integration environment is fully set up and ready!${NC}"
  NEXT_STEP="Start integrating the next feature branch"
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}${BOLD}⚠ Integration environment is set up with warnings${NC}"
  NEXT_STEP="Address warnings and then continue with integration"
else
  echo -e "${RED}${BOLD}✗ Integration environment setup is incomplete${NC}"
  NEXT_STEP="Complete the INT-001 setup before proceeding"
fi

# Determine C3 integration status for recommendations
if [ "$C3_INTEGRATED" = true ]; then
  C3_STATUS="integrated"
else
  C3_STATUS="pending"
fi

# Print next steps
print_header "Recommended Next Steps"

echo -e "${BOLD}Primary Action:${NC} $NEXT_STEP"
echo

if [ $FAILED -gt 0 ]; then
  echo -e "${BOLD}To complete INT-001 setup:${NC}"
  echo "1. Create the integration branch if missing:"
  echo "   git checkout $GOLDEN_BRANCH"
  echo "   git pull origin $GOLDEN_BRANCH"
  echo "   git checkout -b $INTEGRATION_BRANCH"
  echo "   git push -u origin $INTEGRATION_BRANCH"
  echo
  echo "2. Create the baseline tag if missing:"
  echo "   git checkout $GOLDEN_BRANCH"
  echo "   git tag -a $TAG_NAME -m \"Baseline before production readiness integration\""
  echo "   git push origin $TAG_NAME"
  echo
  echo "3. Make scripts executable if needed:"
  echo "   chmod +x $SMART_INTEGRATE_SCRIPT"
  echo "   chmod +x $CONFLICT_REPORTER_SCRIPT"
  echo
elif [ "$C3_STATUS" = "pending" ]; then
  echo -e "${BOLD}To integrate C3 database connection pooling:${NC}"
  echo "1. Switch to the integration branch:"
  echo "   git checkout $INTEGRATION_BRANCH"
  echo "   git pull origin $INTEGRATION_BRANCH"
  echo
  echo "2. Run the conflict reporter:"
  echo "   tsx $CONFLICT_REPORTER_SCRIPT $INTEGRATION_BRANCH $C3_BRANCH"
  echo
  echo "3. Use smart-integrate to cherry-pick the changes:"
  echo "   ./$SMART_INTEGRATE_SCRIPT $C3_BRANCH"
  echo
  echo "4. Verify the integration:"
  echo "   npm run dev"
  echo "   curl http://localhost:3000/api/metrics/database/pool"
  echo
elif [ "$C3_STATUS" = "integrated" ]; then
  echo -e "${BOLD}C3 is integrated. Next tickets to consider:${NC}"
  echo "1. INT-003: Integrate H1 Execution History"
  echo "2. INT-004: Integrate I1 Event Schema Validation"
  echo "3. INT-005: Integrate C4 Foreign Keys Rollback"
  echo
  echo "To start the next integration:"
  echo "   git checkout $INTEGRATION_BRANCH"
  echo "   git pull origin $INTEGRATION_BRANCH"
  echo "   tsx $CONFLICT_REPORTER_SCRIPT $INTEGRATION_BRANCH <next-ticket-branch>"
  echo "   ./$SMART_INTEGRATE_SCRIPT <next-ticket-branch>"
  echo
fi

echo -e "${BOLD}For ongoing integration work:${NC}"
echo "1. Always work on the $INTEGRATION_BRANCH branch"
echo "2. Run conflict-reporter before each integration"
echo "3. Use smart-integrate.sh for cherry-picking"
echo "4. Test thoroughly after each integration"
echo "5. Update the Slack thread with your progress"
echo

echo -e "${BLUE}${BOLD}Run this verification script again after making changes to check status.${NC}"
