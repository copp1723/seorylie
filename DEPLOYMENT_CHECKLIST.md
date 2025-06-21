# Deployment Checklist

## Pre-Deployment
- [ ] All tests passing
- [ ] TypeScript build successful
- [ ] No hardcoded secrets in code
- [ ] Environment variables documented

## Render.com Configuration
- [ ] Set NODE_ENV=production
- [ ] Set all required environment variables:
  - [ ] DATABASE_URL (with ?sslmode=require)
  - [ ] JWT_SECRET (32+ characters)
  - [ ] SESSION_SECRET (32+ characters)
  - [ ] ALLOWED_ORIGINS (comma-separated list)
- [ ] Do NOT set PORT (Render provides this)

## Optional Environment Variables
- [ ] OPENAI_API_KEY (for AI features)
- [ ] SENDGRID_API_KEY (for email sending)
- [ ] REDIS_URL (for caching and sessions)
- [ ] GA4_CREDENTIALS_JSON (for analytics)
- [ ] SENTRY_DSN (for error tracking)
- [ ] DATABASE_CA_CERT (if using custom SSL cert)

## Build Verification
- [ ] Run `pnpm run build` locally
- [ ] Verify build output with `pnpm run build:verify`
- [ ] Check that dist/ contains:
  - [ ] dist/index.js
  - [ ] dist/public/index.html
  - [ ] dist/public/assets/

## Database Preparation
- [ ] Run migrations on production database:
  ```bash
  DATABASE_URL=<production-url> pnpm run migrate
  ```
- [ ] Verify Row Level Security (RLS) is enabled
- [ ] Check that migration tracking table exists

## Security Checklist
- [ ] JWT_SECRET is unique and strong (32+ chars)
- [ ] SESSION_SECRET is unique and strong (32+ chars)
- [ ] Database SSL is enabled (sslmode=require)
- [ ] CORS is restricted to specific origins
- [ ] API keys are properly validated
- [ ] No sensitive data in logs

## Deployment Commands
```bash
# Build and verify locally
pnpm run build
pnpm run build:verify

# Test with pre-start checks
NODE_ENV=production pnpm run start:production

# Test health endpoint
curl http://localhost:3000/health
```

## Post-Deployment
- [ ] Run database migrations
- [ ] Verify /health endpoint returns 200
- [ ] Test authentication flow
- [ ] Check error logging
- [ ] Monitor application logs for errors
- [ ] Verify all features are working

## Common Issues & Solutions

### Build Failures
- Check Node.js version (18+ required)
- Ensure all dependencies installed: `pnpm install`
- Verify TypeScript compilation: `pnpm run build:server`
- Check frontend build: `pnpm run build:frontend`

### Environment Variable Issues
- Missing JWT_SECRET: App will refuse to start
- Missing DATABASE_URL: Connection will fail
- Wrong ALLOWED_ORIGINS: CORS will block requests

### Database Connection Issues
- Verify DATABASE_URL includes `?sslmode=require` for production
- Check database is accessible from deployment
- Ensure migrations have been run

## Rollback Plan
- [ ] Keep previous deployment version available
- [ ] Document rollback procedure:
  1. Revert to previous deployment in Render
  2. Run rollback migrations if schema changed
  3. Clear Redis cache if using
  4. Notify team of rollback

## Monitoring
- [ ] Set up uptime monitoring for /health endpoint
- [ ] Configure error alerts (Sentry or similar)
- [ ] Set up performance monitoring
- [ ] Monitor database connection pool

## Documentation
- [ ] Update API documentation if endpoints changed
- [ ] Document new environment variables
- [ ] Update team runbook with any new procedures
- [ ] Record deployment date and version