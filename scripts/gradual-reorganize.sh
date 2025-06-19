#!/bin/bash

# Gradual Repository Reorganization Script
# Safely reorganizes files in phases to minimize risk

echo "🗂️  CleanRylie Gradual Repository Reorganization"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to show help
show_help() {
    echo "Usage: $0 [phase]"
    echo ""
    echo "Phases:"
    echo "  1, docs     - Move documentation files"
    echo "  2, config   - Move configuration files"
    echo "  3, database - Move database files"
    echo "  4, tools    - Move development tools"
    echo "  all         - Run all phases (use with caution)"
    echo "  status      - Show current reorganization status"
    echo ""
    echo "Examples:"
    echo "  $0 1        # Move documentation files only"
    echo "  $0 docs     # Same as above"
    echo "  $0 status   # Check what's been moved"
}

# Function to safely move files
safe_move() {
    local source="$1"
    local dest_dir="$2"
    local phase="$3"
    
    if [ -f "$source" ]; then
        mkdir -p "$dest_dir"
        mv "$source" "$dest_dir/"
        echo "   ✅ [$phase] Moved $source → $dest_dir/"
        return 0
    else
        echo "   ⚠️  [$phase] File not found: $source"
        return 1
    fi
}

# Function to show status
show_status() {
    echo "📊 Repository Reorganization Status:"
    echo ""
    
    # Check documentation
    if [ -d "docs/deployment" ] || [ -d "docs/development" ] || [ -d "docs/handoff" ]; then
        echo "✅ Phase 1 (Documentation): COMPLETED"
    else
        echo "⏳ Phase 1 (Documentation): PENDING"
    fi
    
    # Check configuration
    if [ -d "config/environment" ] || [ -d "config/build" ] || [ -d "config/deployment" ]; then
        echo "✅ Phase 2 (Configuration): COMPLETED"
    else
        echo "⏳ Phase 2 (Configuration): PENDING"
    fi
    
    # Check database
    if [ -d "database/schema" ] || [ -d "database/admin" ]; then
        echo "✅ Phase 3 (Database): COMPLETED"
    else
        echo "⏳ Phase 3 (Database): PENDING"
    fi
    
    # Check tools
    if [ -d "tools/testing" ] || [ -d "tools/validation" ] || [ -d "tools/development" ]; then
        echo "✅ Phase 4 (Tools): COMPLETED"
    else
        echo "⏳ Phase 4 (Tools): PENDING"
    fi
    
    echo ""
    echo "📁 Current root directory file count:"
    ls -1 | grep -E '\.(md|ts|js|json|yml|yaml|sql|sh)$' | wc -l | xargs echo "   Files:"
}

# Phase 1: Documentation
phase_1_docs() {
    echo "📁 Phase 1: Moving documentation files..."
    
    safe_move "DEPLOYMENT_AUTOMATION_GUIDE.md" "docs/deployment" "DOCS"
    safe_move "DEPLOYMENT_IMPLEMENTATION_GUIDE.md" "docs/deployment" "DOCS"
    safe_move "DEPLOYMENT_QUICK_START.md" "docs/deployment" "DOCS"
    safe_move "DEPLOYMENT_READINESS_TICKETS.md" "docs/deployment" "DOCS"
    safe_move "DEPLOYMENT_TIMELINE_MATRIX.md" "docs/deployment" "DOCS"
    safe_move "CI_IMPLEMENTATION_GUIDE.md" "docs/development" "DOCS"
    safe_move "AGENT_CAPABILITIES_DOCUMENTATION.md" "docs/development" "DOCS"
    safe_move "HANDOFF_CLEANUP_COMPLETE.md" "docs/handoff" "DOCS"
    safe_move "HANDOFF_DEP-014_DEP-003.md" "docs/handoff" "DOCS"
    safe_move "TICKET_DEPENDENCIES_CLEANUP.md" "docs/handoff" "DOCS"
    
    echo "✅ Phase 1 complete! Documentation files organized."
    echo "💡 Test your documentation links and update any broken references."
}

# Phase 2: Configuration
phase_2_config() {
    echo "📁 Phase 2: Moving configuration files..."
    
    safe_move ".env.example" "config/environment" "CONFIG"
    safe_move ".env.adf-example" "config/environment" "CONFIG"
    safe_move "jest.config.js" "config/build" "CONFIG"
    safe_move "postcss.config.js" "config/build" "CONFIG"
    safe_move "tailwind.config.ts" "config/build" "CONFIG"
    safe_move "tsconfig.ci.json" "config/build" "CONFIG"
    safe_move "tsconfig.server.json" "config/build" "CONFIG"
    safe_move "vite.config.ts" "config/build" "CONFIG"
    safe_move "vitest.config.ts" "config/build" "CONFIG"
    safe_move ".eslintrc.js" "config/linting" "CONFIG"
    safe_move "render.yaml" "config/deployment" "CONFIG"
    safe_move "docker-compose.monitoring.yml" "config/deployment" "CONFIG"
    safe_move "docker-compose.platform.yml" "config/deployment" "CONFIG"
    safe_move "components.json" "config" "CONFIG"
    
    echo "✅ Phase 2 complete! Configuration files organized."
    echo "⚠️  IMPORTANT: Update package.json scripts to use new config paths!"
    echo "   Example: 'vitest' → 'vitest --config config/build/vitest.config.ts'"
}

# Phase 3: Database
phase_3_database() {
    echo "📁 Phase 3: Moving database files..."
    
    safe_move "supabase-schema.sql" "database/schema" "DATABASE"
    safe_move "drizzle.config.ts" "database/schema" "DATABASE"
    safe_move "check-schema.ts" "database/schema" "DATABASE"
    safe_move "fix-schema.ts" "database/schema" "DATABASE"
    safe_move "create-admin-direct.sql" "database/admin" "DATABASE"
    safe_move "create-admin-raw.ts" "database/admin" "DATABASE"
    safe_move "create-minimal-admin.ts" "database/admin" "DATABASE"
    safe_move "create-simple-admin.ts" "database/admin" "DATABASE"
    safe_move "create-super-admin.ts" "database/admin" "DATABASE"
    safe_move "fix-admin-role.ts" "database/admin" "DATABASE"
    safe_move "add-is-active-column.ts" "database/admin" "DATABASE"
    
    echo "✅ Phase 3 complete! Database files organized."
    echo "💡 Update any scripts that reference these database files."
}

# Phase 4: Tools
phase_4_tools() {
    echo "📁 Phase 4: Moving development tools..."
    
    safe_move "test-server.ts" "tools/testing" "TOOLS"
    safe_move "test-websocket.html" "tools/testing" "TOOLS"
    safe_move "test-agent-squad-orchestrator.js" "tools/testing" "TOOLS"
    safe_move "test-specialized-agents.js" "tools/testing" "TOOLS"
    safe_move "inventory-test-report.ts" "tools/testing" "TOOLS"
    safe_move "validate-ci-locally.sh" "tools/validation" "TOOLS"
    safe_move "validate-implementations.js" "tools/validation" "TOOLS"
    safe_move "verify-agent-squad.js" "tools/validation" "TOOLS"
    safe_move "ci-fix-implementation-script.sh" "tools/validation" "TOOLS"
    safe_move "start-simple-server.ts" "tools/development" "TOOLS"
    safe_move "admin-interface.ts" "tools/development" "TOOLS"
    safe_move "debug-build.js" "tools/development" "TOOLS"
    safe_move "run-agent-squad-direct.js" "tools/agent-squad" "TOOLS"
    safe_move "run-agent-squad-migration.js" "tools/agent-squad" "TOOLS"
    
    echo "✅ Phase 4 complete! Development tools organized."
    echo "💡 Update any scripts that reference these tool files."
}

# Main script logic
case "${1:-help}" in
    "1"|"docs")
        phase_1_docs
        ;;
    "2"|"config")
        phase_2_config
        ;;
    "3"|"database")
        phase_3_database
        ;;
    "4"|"tools")
        phase_4_tools
        ;;
    "all")
        echo "⚠️  Running all phases. This will move many files!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            phase_1_docs
            echo ""
            phase_2_config
            echo ""
            phase_3_database
            echo ""
            phase_4_tools
            echo ""
            echo "🎉 All phases complete!"
        else
            echo "❌ Cancelled."
        fi
        ;;
    "status")
        show_status
        ;;
    "help"|*)
        show_help
        ;;
esac

echo ""
echo "📋 Next steps after each phase:"
echo "   1. Test that everything still works"
echo "   2. Update any broken file references"
echo "   3. Commit the changes"
echo "   4. Run the next phase"
