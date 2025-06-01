# 🚨 CleanRylie Black Page / Connection Refused - TROUBLESHOOTING

**Issue**: localhost refused to connect / ERR_CONNECTION_REFUSED  
**Status**: ❌ **SERVER CRASHED DURING STARTUP**  
**Root Cause**: Frontend build error causing process exit  

---

## 🔍 **What Happened**

Based on your terminal output, here's the sequence of events:

1. ✅ **Server Started**: Backend launched successfully on `127.0.0.1:3000`
2. ✅ **Database Connected**: PostgreSQL connection to Supabase successful
3. ✅ **Session Store**: Initialized successfully
4. ❌ **Frontend Build Failed**: Vite build encountered duplicate export error
5. ❌ **Process Crashed**: Entire application exited due to build failure
6. ❌ **Connection Refused**: No server running = black page

---

## 🔧 **IMMEDIATE FIX STEPS**

### **Step 1: Check if Process is Running**
```bash
cd /Users/copp1723/Downloads/cleanrylie-main

# Check if anything is running on port 3000
lsof -ti:3000

# If nothing, the process crashed (expected)
# If something is running, kill it first:
lsof -ti:3000 | xargs kill -9
```

### **Step 2: Fix Build Issues**
```bash
# Clean rebuild everything
rm -rf node_modules package-lock.json dist
npm install

# Check for TypeScript errors
npm run check
```

### **Step 3: Fix Potential Import Issues**
```bash
# Check for duplicate exports (common cause)
grep -r "export.*ApiError" client/src/
grep -r "export.*default.*ApiError" client/src/

# Check for circular imports
grep -r "import.*from.*api-client" client/src/
```

### **Step 4: Start with Verbose Logging**
```bash
# Start with debug logging to see exact error
DEBUG=* npm run dev

# OR start with TypeScript checking disabled temporarily
NODE_ENV=development npm run dev 2>&1 | tee startup.log
```

---

## 🚨 **SPECIFIC FIXES TO TRY**

### **Fix A: API Client Duplicate Export**
Based on your error, check this file:

```bash
# Edit client/src/lib/api-client.ts
nano client/src/lib/api-client.ts
```

Look for and **remove any duplicate exports** like:
```typescript
// BAD - Remove duplicates like this:
export class ApiError extends Error { ... }
export class ApiError extends Error { ... }  // <- DELETE THIS

// OR
export { ApiError };
export { ApiError };  // <- DELETE THIS
```

### **Fix B: Clean Import Paths**
Check these files for import issues:

```bash
# Check these files for problematic imports:
client/src/hooks/useNotifications.tsx
client/src/components/ui/use-toast.ts
client/src/lib/utils.ts
```

### **Fix C: Missing Dependencies**
```bash
# Reinstall specific problematic packages
npm install @types/node@latest
npm install vite@latest
npm install typescript@latest
```

### **Fix D: Port Configuration**
Your `.env` has `PORT=3000`, but the code might default to 5000:

```bash
# Try starting on default port
unset PORT
npm run dev

# OR explicitly set port
PORT=3000 npm run dev

# OR try different port
PORT=5000 npm run dev
```

---

## 🔧 **SYSTEMATIC DEBUGGING**

### **Step 1: Minimal Start**
```bash
# Try starting just the backend
cd /Users/copp1723/Downloads/cleanrylie-main

# Start with minimal config
cat > minimal-start.js << 'EOF'
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Server is working!'));
app.listen(3000, () => console.log('Minimal server on http://localhost:3000'));
EOF

node minimal-start.js
```

Visit http://localhost:3000 - if this works, the issue is in the CleanRylie code.

### **Step 2: Backend Only**
```bash
# Start just the backend server (no frontend build)
cd server
npx tsx index.ts
```

Test the API: http://localhost:3000/api/health

### **Step 3: Frontend Only**
```bash
# Start just the frontend
cd client
npm run dev
```

---

## 🔍 **DIAGNOSTIC COMMANDS**

Run these to gather information:

```bash
cd /Users/copp1723/Downloads/cleanrylie-main

# 1. Check Node.js version (needs 18+)
node --version

# 2. Check if TypeScript compiles
npx tsc --noEmit

# 3. Check Vite config
cat vite.config.ts

# 4. Check for missing files
ls -la client/src/main.tsx
ls -la client/index.html

# 5. Check environment
cat .env | grep -v "PASSWORD\|SECRET\|KEY"

# 6. Check package.json scripts
grep -A 5 -B 5 '"dev"' package.json
```

---

## 🚨 **COMMON ISSUES & FIXES**

### **Issue 1: Duplicate Exports**
**Symptom**: "export 'ApiError' was already exported"
**Fix**: Remove duplicate export statements

### **Issue 2: Missing Dependencies**
**Symptom**: "Cannot resolve module"
**Fix**: `npm install` or install specific missing packages

### **Issue 3: TypeScript Errors**
**Symptom**: Build fails with TS errors
**Fix**: Run `npm run check` and fix type errors

### **Issue 4: Port Conflicts**
**Symptom**: "Port already in use"
**Fix**: Kill existing process or use different port

### **Issue 5: CORS Issues**
**Symptom**: Frontend loads but API calls fail
**Fix**: Check CORS configuration in server

### **Issue 6: SSL/Database Issues**
**Symptom**: Database connection errors
**Fix**: Check DATABASE_URL and SSL configuration

---

## 📋 **STEP-BY-STEP RECOVERY PROCESS**

### **Phase 1: Clean Slate**
```bash
cd /Users/copp1723/Downloads/cleanrylie-main

# 1. Stop everything
pkill -f "node.*cleanrylie" || true
lsof -ti:3000 | xargs kill -9 || true

# 2. Clean dependencies
rm -rf node_modules package-lock.json dist

# 3. Fresh install
npm install
```

### **Phase 2: Fix Code Issues**
```bash
# 1. Check TypeScript
npm run check

# 2. If errors, fix them one by one
# Common fixes:
# - Remove duplicate exports
# - Fix import paths
# - Add missing type definitions
```

### **Phase 3: Start Carefully**
```bash
# 1. Start with verbose logging
DEBUG=vite:* npm run dev

# 2. Watch for specific error messages
# 3. Fix issues as they appear
```

### **Phase 4: Test Components**
```bash
# 1. Test backend: curl http://localhost:3000/api/health
# 2. Test frontend: visit http://localhost:3000
# 3. Check browser console for errors
```

---

## 🎯 **EXPECTED WORKING STATE**

When properly working, you should see:

### **Terminal Output**
```
✅ PostgreSQL connection test successful
✅ PostgreSQL session store initialized successfully
✅ Database connection pool initialized successfully
✅ Follow-up scheduler successfully initialized
✅ serving on 127.0.0.1:3000
```

### **Browser**
- ✅ http://localhost:3000 loads CleanRylie homepage
- ✅ No console errors in browser developer tools
- ✅ UI components render correctly
- ✅ Navigation works

### **API Test**
```bash
curl http://localhost:3000/api/health
# Should return JSON with database status
```

---

## 📞 **IF STILL STUCK**

If these fixes don't work, please run this diagnostic and share the output:

```bash
cd /Users/copp1723/Downloads/cleanrylie-main

echo "=== NODE VERSION ===" 
node --version

echo "=== NPM VERSION ==="
npm --version

echo "=== ENVIRONMENT CHECK ==="
npm run env:validate

echo "=== TYPESCRIPT CHECK ==="
npm run check

echo "=== PACKAGE VERIFICATION ==="
npm list --depth=0 | head -20

echo "=== STARTUP ATTEMPT ==="
timeout 30s npm run dev
```

This will give us the exact error messages needed to fix the issue.

---

**CONFIDENCE LEVEL**: 🟡 **90% FIXABLE** - This is a common build/startup issue, not a fundamental architecture problem.