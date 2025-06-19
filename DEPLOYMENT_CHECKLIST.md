# Deployment Checklist for Seorylie

## Pre-Deployment Checks

1. **Build Process**
   - [ ] Run `npm run build:client` locally to ensure build succeeds
   - [ ] Verify `dist/public` directory contains built files
   - [ ] Check that all required API endpoints are in `server.js`

2. **Dependencies**
   - [ ] Ensure all production dependencies are in `dependencies` (not `devDependencies`)
   - [ ] Verify `package.json` has correct build scripts
   - [ ] No TypeScript files in JavaScript-only server setup

3. **Configuration**
   - [ ] `render.yaml` matches deployment type (Node.js vs Docker)
   - [ ] Environment variables are properly configured
   - [ ] Database URL is set in Render dashboard

## Deployment Commands

```bash
# Build client locally to test
npm run build:client

# Test server locally
PORT=3000 node server.js

# Test built app
curl http://localhost:3000/
curl http://localhost:3000/api/health
```

## Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Ensure all build dependencies are installed
   - Verify Vite config points to correct paths

2. **Wrong UI Loading**
   - Verify `dist/public` contains latest build
   - Check server.js serves from correct directory
   - Clear browser cache

3. **TypeScript Errors**
   - Remove any `.ts` files from JavaScript-only setup
   - Or add proper TypeScript compilation step

## Post-Deployment

1. Check deployment logs in Render dashboard
2. Test live URL endpoints
3. Verify UI loads correctly
4. Check database connectivity