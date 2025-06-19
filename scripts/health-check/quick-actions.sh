#!/bin/bash
# Seorylie Health Check - Quick Actions Script

echo "🏥 Seorylie Health Check - Quick Actions"
echo "========================================"
echo ""
echo "This script will guide you through the immediate fixes needed."
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "   Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules/typescript" ]; then
    echo "Installing TypeScript and ts-node..."
    npm install --save-dev typescript ts-node @types/node
fi

echo ""
echo "🔍 Health Check Report Generated"
echo "   See: HEALTH_CHECK_REPORT.md"
echo ""

echo "📋 Available Health Check Commands:"
echo ""
echo "1. View duplicate files:"
echo "   npm run health:duplicates"
echo ""
echo "2. Check async/await issues:"
echo "   npm run health:async"
echo ""
echo "3. Fix async/await issues automatically:"
echo "   npm run health:fix-async"
echo ""
echo "4. Analyze large files:"
echo "   npm run health:large-files"
echo ""
echo "5. Preview file reorganization:"
echo "   npm run health:reorganize-preview"
echo ""
echo "6. Consolidate server entry points:"
echo "   npm run health:consolidate-servers"
echo ""
echo "7. Consolidate authentication:"
echo "   npm run health:consolidate-auth"
echo ""
echo "8. Implement security patterns:"
echo "   npm run health:security"
echo ""
echo "9. Generate modular architecture:"
echo "   npm run health:modular"
echo ""

echo "🚀 Recommended Action Sequence:"
echo ""
echo "Week 1 (Critical):"
echo "  1. npm run health:consolidate-servers"
echo "  2. npm run health:consolidate-auth"
echo "  3. npm run health:fix-async"
echo ""
echo "Week 2 (Structural):"
echo "  4. npm run health:modular"
echo "  5. npm run health:security"
echo ""
echo "Week 3 (Optimization):"
echo "  6. npm run health:reorganize-preview"
echo "  7. npm run health:reorganize"
echo ""

echo "⚠️  Important Notes:"
echo "- Always backup before running consolidation scripts"
echo "- Test thoroughly after each change"
echo "- Review generated guides before proceeding"
echo ""

# Create a simple menu
echo "What would you like to do?"
echo "1) Run full health check"
echo "2) Start Week 1 fixes"
echo "3) View documentation"
echo "4) Exit"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo "Running full health check..."
        npm run health:check
        ;;
    2)
        echo "Starting Week 1 fixes..."
        echo "This will:"
        echo "- Consolidate server entry points"
        echo "- Consolidate authentication"
        echo "- Fix async patterns"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            npm run health:consolidate-servers
            npm run health:consolidate-auth
            npm run health:fix-async
        fi
        ;;
    3)
        echo "Opening health check report..."
        if command -v open &> /dev/null; then
            open HEALTH_CHECK_REPORT.md
        else
            cat HEALTH_CHECK_REPORT.md | less
        fi
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Done! Check the output above for any issues."