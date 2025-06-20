# Deployment Troubleshooting Guide

## Common Build & Deployment Issues

### 1. Build Output Path Issues ✅ FIXED
**Problem:** Frontend builds to `web-console/dist` but server expects `dist/public`
**Solution:** Created new build script that copies files to correct location

### 2. Missing Environment Variables
**Required for Render deployment:**
```
DATABASE_URL=postgresql://...
SESSION_SECRET=<generate-secure-secret>
JWT_SECRET=<generate-secure-secret>
OPENAI_API_KEY=<your-api-key>
```

### 3. Port Configuration
**Issue:** Render sets PORT env variable, ensure your app reads it correctly
```javascript
// Your server correctly uses:
const PORT = getPort(); // This should read process.env.PORT || 3000
```

### 4. Database Connection Issues
**Symptoms:**
- "Database connection failed" in logs
- Health check failing

**Solutions:**
- Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
- Check if database allows connections from Render IPs
- Ensure SSL is configured if required

### 5. Build Command for Render
**Update render.yaml to use new build script:**
```yaml
buildCommand: npm install && npm run build
```

### 6. Memory Issues During Build
**If build fails with "JavaScript heap out of memory":**
```yaml
buildCommand: NODE_OPTIONS="--max-old-space-size=4096" npm install && npm run build
```

### 7. TypeScript Import Errors
**Your esbuild config handles aliases, but check for:**
- Missing `.ts` extensions in imports
- Circular dependencies
- Incorrect path aliases

### 8. Static File Serving Issues
**Verify in production:**
- Check browser console for 404 errors
- Ensure all assets have correct paths
- Clear CDN cache if using one

## Quick Deployment Checklist

1. **Local Testing:**
   ```bash
   # Install dependencies
   npm install
   
   # Run new build script
   npm run build
   
   # Test production build locally
   NODE_ENV=production npm start
   ```

2. **Verify Build Output:**
   ```bash
   # Check these files exist:
   ls -la dist/index.js
   ls -la dist/public/index.html
   ls -la dist/public/assets/
   ```

3. **Environment Variables:**
   - Set all required vars in Render dashboard
   - Don't commit sensitive .env files

4. **Logs to Check:**
   - Build logs in Render dashboard
   - Runtime logs for startup errors
   - Browser console for frontend errors

## Debugging Commands

```bash
# Test build locally
npm run build

# Check what files are created
find dist -type f -name "*.js" -o -name "*.html" | head -20

# Test server can find static files
NODE_ENV=production node dist/index.js

# Check if all dependencies are listed correctly
npm ls --prod
```

## Next Steps

1. Install fs-extra: `npm install --save-dev fs-extra`
2. Run the new build script: `npm run build`
3. Test locally: `NODE_ENV=production npm start`
4. Deploy to Render
5. Monitor logs for any errors

## If Deployment Still Fails

Check for:
1. Node version mismatch (Render uses Node 20 by default)
2. Missing production dependencies (should be in "dependencies" not "devDependencies")
3. Database connection timeouts
4. Health check endpoint returning errors
