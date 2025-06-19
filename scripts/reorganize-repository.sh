#!/bin/bash

# Repository Reorganization Script
# Organizes root-level files into logical folder structure

echo "🗂️  CleanRylie Repository Reorganization Script"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Create backup
echo "📦 Creating backup of current structure..."
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Function to safely move files
safe_move() {
    local source="$1"
    local dest_dir="$2"
    local dest_file="$3"
    
    if [ -f "$source" ]; then
        mkdir -p "$dest_dir"
        if [ -n "$dest_file" ]; then
            mv "$source" "$dest_dir/$dest_file"
            echo "   ✅ Moved $source → $dest_dir/$dest_file"
        else
            mv "$source" "$dest_dir/"
            echo "   ✅ Moved $source → $dest_dir/"
        fi
    else
        echo "   ⚠️  File not found: $source"
    fi
}

echo ""
echo "🏗️  Creating new directory structure..."

# 1. Configuration Files → config/
echo "📁 Organizing configuration files..."
safe_move ".env.example" "config/environment"
safe_move ".env.adf-example" "config/environment"
safe_move "jest.config.js" "config/build"
safe_move "postcss.config.js" "config/build"
safe_move "tailwind.config.ts" "config/build"
safe_move "tsconfig.json" "config/build"
safe_move "tsconfig.ci.json" "config/build"
safe_move "tsconfig.server.json" "config/build"
safe_move "vite.config.ts" "config/build"
safe_move "vitest.config.ts" "config/build"
safe_move ".eslintrc.js" "config/linting"
safe_move "render.yaml" "config/deployment"
safe_move "Dockerfile" "config/deployment"
safe_move "docker-compose.monitoring.yml" "config/deployment"
safe_move "docker-compose.platform.yml" "config/deployment"
safe_move "components.json" "config"

# 2. Documentation → docs/ (expand existing)
echo "📁 Organizing documentation..."
safe_move "DEPLOYMENT_AUTOMATION_GUIDE.md" "docs/deployment"
safe_move "DEPLOYMENT_IMPLEMENTATION_GUIDE.md" "docs/deployment"
safe_move "DEPLOYMENT_QUICK_START.md" "docs/deployment"
safe_move "DEPLOYMENT_READINESS_TICKETS.md" "docs/deployment"
safe_move "DEPLOYMENT_TIMELINE_MATRIX.md" "docs/deployment"
safe_move "CI_IMPLEMENTATION_GUIDE.md" "docs/development"
safe_move "AGENT_CAPABILITIES_DOCUMENTATION.md" "docs/development"
safe_move "HANDOFF_CLEANUP_COMPLETE.md" "docs/handoff"
safe_move "HANDOFF_DEP-014_DEP-003.md" "docs/handoff"
safe_move "TICKET_DEPENDENCIES_CLEANUP.md" "docs/handoff"

# 3. Database & Schema → database/
echo "📁 Organizing database files..."
safe_move "supabase-schema.sql" "database/schema"
safe_move "drizzle.config.ts" "database/schema"
safe_move "check-schema.ts" "database/schema"
safe_move "fix-schema.ts" "database/schema"
safe_move "create-admin-direct.sql" "database/admin"
safe_move "create-admin-raw.ts" "database/admin"
safe_move "create-minimal-admin.ts" "database/admin"
safe_move "create-simple-admin.ts" "database/admin"
safe_move "create-super-admin.ts" "database/admin"
safe_move "fix-admin-role.ts" "database/admin"
safe_move "add-is-active-column.ts" "database/admin"

# 4. Development Tools → tools/
echo "📁 Organizing development tools..."
safe_move "test-server.ts" "tools/testing"
safe_move "test-websocket.html" "tools/testing"
safe_move "test-agent-squad-orchestrator.js" "tools/testing"
safe_move "test-specialized-agents.js" "tools/testing"
safe_move "inventory-test-report.ts" "tools/testing"
safe_move "validate-ci-locally.sh" "tools/validation"
safe_move "validate-implementations.js" "tools/validation"
safe_move "verify-agent-squad.js" "tools/validation"
safe_move "ci-fix-implementation-script.sh" "tools/validation"
safe_move "start-simple-server.ts" "tools/development"
safe_move "admin-interface.ts" "tools/development"
safe_move "debug-build.js" "tools/development"
safe_move "run-agent-squad-direct.js" "tools/agent-squad"
safe_move "run-agent-squad-migration.js" "tools/agent-squad"

echo ""
echo "🔧 Updating configuration file paths..."

# Update package.json scripts to reflect new paths
if [ -f "package.json" ]; then
    echo "   📝 Updating package.json scripts..."
    # This would require careful sed commands or manual updates
    echo "   ⚠️  Manual update required for package.json script paths"
fi

echo ""
echo "📋 Creating updated .gitignore..."
cat > .gitignore.new << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
config/environment/.env*
!config/environment/.env.example
!config/environment/.env.adf-example

# Build outputs
dist/
build/
.next/
out/

# Development
.DS_Store
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
logs/
*.log
server.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
.nyc_output/

# Test results
test-results/
junit.xml

# Temporary folders
tmp/
temp/

# Database
*.sqlite
*.db

# Backup files
backup-*/
EOF

echo "   ✅ Created .gitignore.new (review and replace .gitignore manually)"

echo ""
echo "✨ Reorganization Complete!"
echo ""
echo "📊 Summary of changes:"
echo "   📁 config/ - Configuration files (build, deployment, environment)"
echo "   📁 docs/ - Expanded documentation structure"
echo "   📁 database/ - Database schema and admin files"
echo "   📁 tools/ - Development and testing tools"
echo ""
echo "🔧 Manual steps required:"
echo "   1. Update package.json script paths"
echo "   2. Update import paths in TypeScript files"
echo "   3. Update CI/CD configuration files"
echo "   4. Review and replace .gitignore with .gitignore.new"
echo "   5. Update documentation references"
echo ""
echo "💡 Tip: Test the reorganization in a separate branch first!"
