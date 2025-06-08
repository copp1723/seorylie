# Staging Redis Connection Fix

## Problem Summary

Your staging deployment shows a white screen due to Redis connection failures. The logs show:

```
[ioredis] Unhandled error event: Error: connect ECONNREFUSED 127.0.0.1:6379
```

## Root Cause

1. **Redis Service Unavailable**: Your staging environment doesn't have Redis running or properly configured
2. **Missing Fallback Configuration**: The app tries to connect to Redis without proper fallback handling
3. **Blocking Initialization**: Redis connection failures prevent the server from starting properly

## Immediate Solution

### Step 1: Set Environment Variable in Render

1. Go to your [Render Dashboard](https://dashboard.render.com)
2. Navigate to your CleanRylie service
3. Click on the **Environment** tab
4. Add or update this environment variable:
   - **Key**: `SKIP_REDIS`
   - **Value**: `true`
5. Click **Save Changes**
6. **Redeploy** your service

### Step 2: Verify the Fix

After redeployment, check your logs for these success messages:

```
✅ Redis disabled via SKIP_REDIS environment variable
✅ Using mock Redis client for development
✅ Server running on http://0.0.0.0:PORT
```

### Step 3: Test Your Application

Run our verification script:

```bash
# Replace with your actual staging URL
STAGING_URL=https://your-app.onrender.com node scripts/verify-staging-fix.js
```

Or manually test:

- Visit your staging URL
- Check `/api/health` endpoint
- Verify no white screen appears

## Technical Details

### What the Fix Does

1. **Disables Redis**: Sets `SKIP_REDIS=true` to bypass Redis initialization
2. **Enables Fallback**: Uses in-memory storage instead of Redis
3. **Non-blocking Startup**: Server starts even without Redis

### Code Changes Made

1. **Enhanced Redis Initialization** (`server/lib/redis.ts`):

   - Added `SKIP_REDIS` environment variable check
   - Improved error handling with timeouts
   - Better cleanup of failed connections

2. **Non-blocking Server Startup** (`server/index.ts`):

   - Wrapped Redis initialization in try-catch
   - Server continues startup even if Redis fails

3. **Updated Deployment Config** (`render.yaml`):
   - Added `SKIP_REDIS` option for staging environment
   - Commented out Redis service for staging

### Performance Impact

- **Minimal**: In-memory fallback provides similar performance for small-scale staging
- **Limitations**: No persistence across server restarts (acceptable for staging)
- **Scaling**: For production, keep Redis enabled for proper scaling

## Alternative Solutions

### Option 1: Fix Redis Service (More Complex)

If you prefer to keep Redis:

1. **Enable Redis Service in Render**:

   - Uncomment Redis service in `render.yaml`
   - Ensure `REDIS_URL` environment variable is set

2. **Update Environment Variables**:
   - Set `SKIP_REDIS=false`
   - Verify `REDIS_URL` points to your Redis instance

### Option 2: Local Development

For local development with Redis disabled:

```bash
# Add to your .env file
SKIP_REDIS=true

# Or run with environment variable
SKIP_REDIS=true npm run dev
```

## Monitoring and Maintenance

### Health Checks

Monitor these endpoints:

- `/api/health` - Overall application health
- `/` - Homepage functionality

### Log Monitoring

Watch for these log patterns:

```bash
# Success patterns
✅ "Redis disabled via SKIP_REDIS"
✅ "Using mock Redis client"
✅ "Server running on"

# Warning patterns (acceptable with SKIP_REDIS=true)
⚠️ "Redis connection failed - running without Redis cache"
⚠️ "Using in-memory store fallback"

# Error patterns (investigate these)
❌ "Failed to start server"
❌ "Database connection failed"
```

## Troubleshooting

### Still Getting White Screen?

1. **Check Environment Variable**:

   ```bash
   # Verify in Render dashboard that SKIP_REDIS=true is set
   ```

2. **Check Deployment Logs**:

   - Look for Redis-related error messages
   - Verify server startup messages

3. **Database Issues**:

   - Ensure `DATABASE_URL` is properly set
   - Check database connection in logs

4. **Build Issues**:
   - Verify build completed successfully
   - Check for TypeScript compilation errors

### Common Issues

| Issue                 | Solution                                                      |
| --------------------- | ------------------------------------------------------------- |
| White screen persists | Verify `SKIP_REDIS=true` is set and redeploy                  |
| 500 errors            | Check database connection and API logs                        |
| Build failures        | Review build logs for compilation errors                      |
| Slow responses        | Normal with in-memory fallback, consider Redis for production |

## Scripts and Tools

### Quick Fix Script

```bash
./scripts/fix-staging-redis.sh
```

### Verification Script

```bash
node scripts/verify-staging-fix.js https://your-staging-url.onrender.com
```

### Manual Testing

```bash
# Test health endpoint
curl https://your-staging-url.onrender.com/api/health

# Test homepage
curl https://your-staging-url.onrender.com/
```

## Production Considerations

- **Keep Redis Enabled**: For production, use Redis for proper scaling and persistence
- **Monitor Performance**: In-memory fallback is suitable for staging but not production scale
- **Environment Separation**: Use different configurations for staging vs production

## Support

If issues persist:

1. Check Render service logs
2. Verify all environment variables are set correctly
3. Ensure the latest code changes are deployed
4. Test locally with `SKIP_REDIS=true` to isolate the issue
