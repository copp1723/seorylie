#!/bin/bash

echo "🚀 Starting Seorylie Full Stack"
echo "=============================="

# Kill any existing processes
echo "🧹 Cleaning up old processes..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start backend server
echo "🔧 Starting backend server on port 5000..."
SKIP_REDIS=true NODE_ENV=development npx tsx server/index.ts &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:5000/api/status > /dev/null; then
    echo "✅ Backend is running!"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend with Vite
echo "🎨 Starting frontend on port 3000..."
cd client && npx vite --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend
sleep 3

echo ""
echo "✨ All services started!"
echo "========================"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:5000"
echo "📊 API:      http://localhost:5000/api/status"
echo ""
echo "📝 Login with:"
echo "   Email: admin@alpha.ai"
echo "   Password: admin123"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep script running and handle cleanup
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for background processes
wait