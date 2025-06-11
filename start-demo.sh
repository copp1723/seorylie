#!/bin/bash

# Demo Startup Script
# Ensures reliable server startup for demos

echo "🚀 Seorylie Demo Startup Script"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    npm install
fi

# Ensure PostCSS config is in CommonJS format
if [ -f "postcss.config.js" ] && [ ! -f "postcss.config.cjs" ]; then
    echo -e "${YELLOW}📝 Creating CommonJS PostCSS config...${NC}"
    echo "module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}" > postcss.config.cjs
fi

# Create a minimal .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating minimal .env file...${NC}"
    cat > .env << EOF
# Minimal environment configuration for demo
NODE_ENV=development
PORT=3000
SKIP_REDIS=true
SESSION_SECRET=demo-secret-key-$(date +%s)

# Database (update these if needed)
DATABASE_URL=postgresql://localhost:5432/seorylie
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional services (disabled for demo)
ENABLE_WEBSOCKET=false
ENABLE_MONITORING=false
EOF
    echo -e "${GREEN}✅ Created .env file - please update database credentials if needed${NC}"
fi

# Kill any existing processes on port 3000
echo -e "${YELLOW}🔍 Checking for existing processes on port 3000...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Clear any module cache
echo -e "${YELLOW}🧹 Clearing module cache...${NC}"
rm -rf .tsbuildinfo node_modules/.cache 2>/dev/null || true

# Make the TypeScript startup script executable
chmod +x scripts/demo-startup.ts

# Start the server
echo -e "${GREEN}🚀 Starting demo server...${NC}"
echo ""

# Use tsx to run the TypeScript file directly
npx tsx scripts/demo-startup.ts