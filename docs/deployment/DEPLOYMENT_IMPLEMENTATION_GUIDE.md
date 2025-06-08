# DEPLOYMENT IMPLEMENTATION GUIDE

## QUICK START COMMANDS

### Phase 1: Critical Blockers (Day 1-2)

#### DEP-001: Fix Missing Dependencies

```bash
# Install missing dependencies
npm install @tanstack/react-query chalk

# Check if agent-squad is available
npm search agent-squad

# If not available, we'll need to remove references
# Add module type to package.json
echo '"type": "module",' >> package.json.tmp && cat package.json >> package.json.tmp && mv package.json.tmp package.json

# Verify installation
npm ls @tanstack/react-query chalk
```

#### DEP-002: Fix Schema Export Conflicts

```bash
# Run diagnostic to see current conflicts
npm run check 2>&1 | grep "has already exported"

# Create backup before changes
cp shared/index.ts shared/index.ts.backup

# The main fix is to remove duplicate exports in shared/index.ts
# Replace the file content with selective exports instead of export *
```

#### DEP-003: Fix Database Schema Mismatches

```bash
# Check current database schema
npm run db:studio

# Run migration status
npm run migrate:status

# Apply any pending migrations
npm run migrate
```

#### DEP-004: Fix Build Configuration

```bash
# Test current build
npm run build

# After fixes, verify build works
npm run build && echo "Build successful!"

# Test development server
npm run dev
```

### Phase 2: High Priority (Day 3-5)

#### DEP-005: Complete Authentication System

```bash
# Test auth endpoints
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test magic link
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

#### DEP-006: Fix API Endpoint Type Mismatches

```bash
# Run TypeScript check on API files
npx tsc --noEmit client/src/lib/api-client.ts
npx tsc --noEmit shared/api-schemas.ts

# Test API endpoints
npm run test:api
```

#### DEP-007: Fix Frontend Component Issues

```bash
# Check for missing UI components
find client/src -name "*.tsx" -exec grep -l "import.*Tabs" {} \;

# Run frontend type check
npx tsc --noEmit --project client/tsconfig.json
```

## DETAILED IMPLEMENTATION STEPS

### DEP-001: Missing Dependencies Implementation

1. **Install @tanstack/react-query**:

```bash
npm install @tanstack/react-query
```

2. **Install chalk**:

```bash
npm install chalk
```

3. **Handle agent-squad dependency**:

```bash
# Option A: Install if available
npm install agent-squad

# Option B: Remove references if not available
grep -r "agent-squad" server/ --include="*.ts"
# Then manually remove or replace these imports
```

4. **Fix package.json type**:

```json
{
  "type": "module",
  "name": "cleanrylie"
  // ... rest of package.json
}
```

### DEP-002: Schema Export Conflicts Implementation

1. **Create new shared/index.ts**:

```typescript
// Export core schema
export * from "./schema";

// Export specific items from enhanced-schema to avoid conflicts
export {} from // Add only non-conflicting exports from enhanced-schema
"./enhanced-schema";

// Export specific items from lead-management-schema
export {} from // Add only non-conflicting exports
"./lead-management-schema";

// Export API schemas
export * from "./api-schemas";

// Export schema extensions
export * from "./schema-extensions";
```

2. **Fix schema-resolver.ts**:

```typescript
// Import from correct locations
import {
  customers,
  customersRelations,
  insertCustomerSchema,
  Customer,
  InsertCustomer,
} from "./schema";
```

### DEP-003: Database Schema Fixes

1. **Fix authController.ts**:

```typescript
// Replace user.name with user.username
name: user.username || '',

// Replace user.dealership_id with user.dealershipId
dealership_id: user.dealershipId
```

2. **Fix lead-management-schema.ts index syntax**:

```typescript
// Replace invalid index syntax
dossierIdx: index('handovers_dossier_gin').using('gin', table.dossier),
```

### DEP-004: Build Configuration Fixes

1. **Update package.json**:

```json
{
  "type": "module",
  "scripts": {
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=node18"
  }
}
```

2. **Fix postcss.config.js**:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

## TESTING COMMANDS

### Validate Phase 1 Completion:

```bash
# Test dependencies
npm install
npm ls | grep -E "(react-query|chalk)"

# Test build
npm run build

# Test TypeScript compilation
npm run check

# Test server start
timeout 10s npm run dev || echo "Server started successfully"
```

### Validate Phase 2 Completion:

```bash
# Test authentication
npm run test:auth

# Test API endpoints
npm run test:api

# Test frontend compilation
npm run build
```

### Validate Phase 3 Completion:

```bash
# Test all services
npm run test:integration

# Test ADF processing
npm run test:adf

# Test WebSocket
npm run test:websocket
```

## ROLLBACK PROCEDURES

### If Phase 1 Fails:

```bash
# Restore package.json
git checkout package.json

# Remove added dependencies
npm uninstall @tanstack/react-query chalk agent-squad

# Restore schema files
git checkout shared/
```

### If Phase 2 Fails:

```bash
# Restore auth files
git checkout server/routes/auth-routes.ts
git checkout server/services/auth-service.ts
git checkout client/src/hooks/useAuth.tsx
```

### If Phase 3 Fails:

```bash
# Restore service files
git checkout server/services/
git checkout server/ws-server.ts
```

## MONITORING AND VALIDATION

### Health Check Commands:

```bash
# Basic health
curl http://localhost:3000/api/health

# Detailed health
curl http://localhost:3000/api/health/detailed

# Database health
curl http://localhost:3000/api/health/database

# ADF health
curl http://localhost:3000/api/health/adf
```

### Performance Validation:

```bash
# Run performance tests
npm run test:performance

# Check memory usage
node --inspect server/index.ts

# Monitor database connections
npm run db:monitor
```

## COMMON ISSUES AND SOLUTIONS

### Issue: "Cannot find module" errors

**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript compilation errors

**Solution**:

```bash
# Check specific file
npx tsc --noEmit [filename]

# Check with verbose output
npx tsc --noEmit --listFiles
```

### Issue: Database connection failures

**Solution**:

```bash
# Test database connection
npm run env:check

# Check environment variables
echo $DATABASE_URL

# Test direct connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Issue: Build failures

**Solution**:

```bash
# Clean build
npm run clean
npm run build

# Check Vite configuration
npx vite build --debug
```

## DEPLOYMENT VERIFICATION CHECKLIST

### Pre-Deployment:

- [ ] All dependencies installed successfully
- [ ] Build completes without errors
- [ ] TypeScript compilation passes
- [ ] Database connection established
- [ ] Environment variables configured

### Post-Deployment:

- [ ] Health endpoints respond
- [ ] Authentication flow works
- [ ] API endpoints functional
- [ ] Frontend loads correctly
- [ ] ADF processing operational
- [ ] WebSocket connections stable

### Alpha Testing Ready:

- [ ] All core features functional
- [ ] Error handling implemented
- [ ] Logging and monitoring active
- [ ] Performance benchmarks met
- [ ] Security review completed
