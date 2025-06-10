# Seorylie Demo Instructions

## Quick Start (Recommended)

Simply run this command from the project root:

```bash
./start-demo.sh
```

This script will:
- ✅ Install dependencies if needed
- ✅ Fix PostCSS configuration issues
- ✅ Create a minimal .env file if missing
- ✅ Clear any port conflicts
- ✅ Start the server without Redis dependency
- ✅ Make the UI accessible on both localhost and network IP

## Access the Demo

Once the server starts, you'll see:

```
🎉 Demo Server Ready!

📍 Local:    http://localhost:3000
📍 Network:  http://0.0.0.0:3000
📍 Health:   http://localhost:3000/health
📍 API:      http://localhost:3000/api/status
```

### For your demo, you can access:
1. **Main Dashboard**: http://localhost:3000
2. **Health Check**: http://localhost:3000/health
3. **API Status**: http://localhost:3000/api/status

## Manual Start (Alternative)

If you prefer to start manually:

```bash
# 1. Ensure dependencies are installed
npm install

# 2. Set environment variables
export SKIP_REDIS=true
export NODE_ENV=development

# 3. Run the demo startup script
npx tsx scripts/demo-startup.ts
```

## Troubleshooting

### Port 3000 Already in Use
The startup script automatically kills processes on port 3000. If issues persist:
```bash
lsof -ti:3000 | xargs kill -9
```

### PostCSS Module Error
The script creates `postcss.config.cjs` automatically. If you see module errors:
```bash
rm postcss.config.js
cp postcss.config.cjs postcss.config.js
```

### Database Connection Issues
The demo runs without database by default. To connect to a database:
1. Edit `.env` file
2. Update `DATABASE_URL` with your PostgreSQL connection string
3. Update Supabase credentials if using Supabase

### Can't Access from Network
Make sure your firewall allows connections on port 3000:
- **macOS**: System Preferences → Security & Privacy → Firewall
- **Windows**: Windows Defender Firewall → Allow an app
- **Linux**: `sudo ufw allow 3000`

## What's Included in Demo Mode

✅ **Working Features:**
- Main UI Dashboard
- Navigation and routing
- Basic API endpoints
- Static asset serving
- CORS enabled for all origins

❌ **Disabled Features (for reliability):**
- Redis caching
- WebSocket connections
- Background workers
- Email services
- SMS services

## Demo Tips

1. **Best Browser**: Use Chrome or Firefox for best compatibility
2. **Screen Resolution**: Optimized for 1920x1080 or higher
3. **Network Access**: If demoing to others on the network, share the Network URL
4. **Performance**: First load may be slower as Vite builds assets

## Quick Commands

```bash
# Start the demo
./start-demo.sh

# Check if server is running
curl http://localhost:3000/health

# View logs
# Logs appear in the terminal where you started the server

# Stop the server
# Press Ctrl+C in the terminal
```

## Emergency Fallback

If all else fails, use the minimal no-Redis startup:

```bash
npx tsx scripts/start-app-no-redis.ts
```

## Support

For demo day issues:
1. Check the terminal for error messages
2. Ensure all dependencies are installed: `npm install`
3. Try the emergency fallback command above
4. Access via IP address if localhost doesn't work: http://127.0.0.1:3000

Good luck with your demo! 🚀