#!/bin/bash

# Setup Dependencies Script
# Automatically installs all required dependencies for the Seorylie project

set -e  # Exit on any error

echo "🚀 Setting up Seorylie dependencies..."
echo "======================================"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "   npm install -g pnpm"
    exit 1
fi

echo "✅ pnpm found: $(pnpm --version)"

# Install base dependencies
echo ""
echo "📦 Installing base dependencies..."
pnpm install

# Install critical production dependencies
echo ""
echo "🔧 Installing critical production dependencies..."
pnpm add -w drizzle-kit inquirer archiver bcrypt cookie-parser csv-parser mailparser redis ajv-formats

# Install development dependencies
echo ""
echo "🛠️  Installing development dependencies..."
pnpm add -w -D @playwright/test @testing-library/react jsdom @types/archiver @types/bcrypt @types/cookie-parser @types/mailparser @types/inquirer

# Verify installation
echo ""
echo "🔍 Verifying installation..."

# Check for TypeScript errors
echo "Checking for missing modules..."
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "Cannot find module"; then
    echo "❌ Some modules are still missing:"
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "Cannot find module" | head -10
    exit 1
else
    echo "✅ All modules found successfully"
fi

# Check package list
echo ""
echo "📋 Installed packages:"
pnpm list --depth=0 | grep -E "(drizzle-kit|inquirer|archiver|bcrypt|cookie-parser|csv-parser|mailparser|redis|ajv-formats|@playwright/test|@testing-library/react|jsdom)"

# Security audit
echo ""
echo "🔒 Running security audit..."
if pnpm audit --audit-level moderate; then
    echo "✅ No critical security issues found"
else
    echo "⚠️  Security issues detected. Run 'pnpm audit --fix' to resolve."
fi

echo ""
echo "🎉 Dependencies setup complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "1. Copy environment file: cp .env.example .env"
echo "2. Configure your .env file"
echo "3. Start development: pnpm run dev"
echo ""
echo "For more information, see:"
echo "- README.md"
echo "- DEPENDENCIES.md"