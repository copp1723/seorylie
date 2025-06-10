#!/bin/bash

echo "🚀 Starting SEO RYLIE..."
echo "================================"
echo ""

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f vite 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 1

# Start Vite for the frontend
echo "🎨 Starting SEO Dashboard UI..."
npx vite --host 0.0.0.0 --port 3000 &
VITE_PID=$!

# Wait for Vite to start
sleep 3

echo ""
echo "✅ SEO RYLIE is running!"
echo "================================"
echo ""
echo "📱 Access the demo at:"
echo "   • Local:   http://localhost:3000"
echo "   • Network: http://0.0.0.0:3000"
echo ""
echo "🎯 Demo Features:"
echo "   • AI Content Optimization"
echo "   • Keyword Research Tool"
echo "   • Performance Analytics"
echo "   • SEO Reports Generator"
echo ""
echo "⚡ Press Ctrl+C to stop the demo"
echo ""

# Keep the script running
wait $VITE_PID