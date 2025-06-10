#!/bin/bash
# Emergency start script for demo

# Start backend first
echo "Starting backend..."
SKIP_REDIS=true NODE_ENV=development tsx server/index.ts &
BACKEND_PID=$!

# Wait for backend
sleep 3

# Start frontend
echo "Starting frontend..."
vite --host 0.0.0.0 --port 4000

# Keep running
wait