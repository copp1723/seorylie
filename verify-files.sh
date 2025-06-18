#!/bin/bash

echo "🔍 Verifying all agent files exist before commit..."
echo ""

# Define arrays of files for each agent
agent1_files=(
  "server/utils/migration-manager.js"
  "client/src/components/TaskCreationForm.tsx"
)

agent2_files=(
  "server/routes/admin-seowerks-queue.ts"
  "migrations/0018_seowerks_queue_tables.sql"
  "migrations/0019_activity_logs.sql"
  "client/src/pages/admin/seowerks-queue.tsx"
  "docs/seowerks-queue-system.md"
  "WEEK3_COMPLETION_SUMMARY.md"
  "server/services/brandingTransformer.ts"
  "server/services/deliverableProcessor.ts"
  "server/routes/deliverables.ts"
  "client/src/pages/agency/deliverables.tsx"
  "scripts/install-branding-deps.sh"
  "docs/deliverable-processing-pipeline.md"
)

agent3_files=(
  "migrations/0019_agency_branding.sql"
  "web-console/src/contexts/AgencyBrandingContext.tsx"
  "web-console/src/components/BrandingPreview.tsx"
  "web-console/src/utils/performanceOptimizations.ts"
  "server/routes/agency-branding.ts"
  "docs/AGENCY_WHITE_LABELING.md"
  "docs/white-labeling-dependencies.json"
  "client/src/components/ChatFormIntegration.tsx"
  "client/src/components/TaskCreationFormWithContext.tsx"
  ".env.render.template"
  "docs/AGENT3_WORK_SUMMARY.md"
  "docs/AGENT3_WORK_SUMMARY_POSTGRESQL.md"
)

# Function to check files
check_files() {
  local agent_name=$1
  shift
  local files=("$@")
  local missing=0
  
  echo "Checking $agent_name files..."
  for file in "${files[@]}"; do
    if [ -f "$file" ]; then
      echo "  ✅ $file"
    else
      echo "  ❌ $file (MISSING)"
      missing=$((missing + 1))
    fi
  done
  echo "  Total: ${#files[@]} files, Missing: $missing"
  echo ""
  return $missing
}

# Check each agent's files
total_missing=0

check_files "Agent 1" "${agent1_files[@]}"
total_missing=$((total_missing + $?))

check_files "Agent 2" "${agent2_files[@]}"
total_missing=$((total_missing + $?))

check_files "Agent 3" "${agent3_files[@]}"
total_missing=$((total_missing + $?))

# Summary
echo "================================"
if [ $total_missing -eq 0 ]; then
  echo "✅ All files verified! Ready to commit."
  echo ""
  echo "Run: chmod +x commit-all-agents.sh && ./commit-all-agents.sh"
else
  echo "⚠️  Warning: $total_missing files are missing!"
  echo ""
  echo "Some files may be expected to be missing if agents used different paths."
  echo "Review the missing files and proceed if they're intentionally absent."
fi
echo "================================"
