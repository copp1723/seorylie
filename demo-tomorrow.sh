#!/bin/bash

echo "🚀 Starting Seorylie Demo"
echo "========================"

# Kill any existing processes
pkill -f "node.*5000" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Start backend
echo "Starting backend..."
SKIP_REDIS=true NODE_ENV=development npx tsx server/index.ts &
sleep 3

# Start frontend on port 8080 (less likely to have conflicts)
echo "Starting frontend..."
npx vite --host 0.0.0.0 --port 8080 &

sleep 2

echo ""
echo "✅ Demo Ready!"
echo "============="
echo "Access at: http://192.168.1.198:8080"
echo "Or try:    http://localhost:8080"
echo ""
echo "Login: admin@alpha.ai / admin123"
echo ""
echo "Press Ctrl+C to stop"

wait