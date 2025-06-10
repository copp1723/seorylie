#!/bin/bash
echo "🚨 EMERGENCY DEMO START"
echo "====================="

# Kill EVERYTHING first
killall node 2>/dev/null || true
killall tsx 2>/dev/null || true
killall vite 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend
echo "Starting backend on port 5000..."
SKIP_REDIS=true NODE_ENV=development npx tsx server/index.ts &
sleep 2

# Start frontend with explicit settings
echo "Starting frontend on port 5173..."
cd client && npx vite --host 0.0.0.0 --port 5173 &
cd ..

sleep 2

echo ""
echo "🎯 DEMO READY!"
echo "============="
echo ""
echo "Try these URLs in order:"
echo "1. http://192.168.1.198:5173"
echo "2. http://127.0.0.1:5173"  
echo "3. http://localhost:5173"
echo ""
echo "Login: admin@alpha.ai / admin123"
echo ""

# Keep running
tail -f /dev/null