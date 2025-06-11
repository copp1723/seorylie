#!/bin/bash

# Ultra-simple demo startup - uses existing minimal server
echo "🚀 Quick Demo Startup"
echo "===================="

# Set environment variables
export SKIP_REDIS=true
export NODE_ENV=development
export SUPPRESS_NO_CONFIG_WARNING=true

# Create CommonJS PostCSS config if needed
if [ ! -f "postcss.config.cjs" ]; then
    echo "module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}" > postcss.config.cjs
fi

# Kill any existing process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo ""
echo "Starting server..."
echo ""

# Use the existing minimal server that we know works
npx tsx server/minimal-server.ts