# CleanRylie Stabilization Workflow Guide

> **Current Strategy**: Stabilization-focused development with automated quality gates
> **Last Updated**: v2.0-stabilization (post-STAB-502)

---

## 🎯 Overview

CleanRylie uses a **stabilization git strategy** designed for controlled feature development and production readiness. This workflow ensures all changes go through comprehensive validation before reaching production.

## 🌳 Branch Structure

```
main ─┬─► (production - protected)
      │
      └─ stabilization ─► (long-lived integration branch)
          ├─ feature/stab-101/bundle-size-guard
          ├─ feature/stab-102/performance-tracker
          ├─ feature/stab-103/schema-versioning
          └─ feature/stab-<ID>/<description>
```

### Branch Roles

| Branch | Purpose | Protection Level | Update Process |
|--------|---------|------------------|----------------|
| `main` | Production baseline | **High** - Requires STAB-502 validation | Fast-forward from `stabilization` only |
| `stabilization` | Integration branch | **Medium** - Requires CI + review | Feature branches merge here |
| `feature/stab-*` | Development work | **Low** - Short-lived | Branch from `stabilization` |

---

## 🚀 Development Workflow

### 1. Setup Your Environment

```bash
# Clone and setup
git clone <repository-url>
cd cleanrylie
npm run setup  # Handles all dependencies and validation
```

### 2. Create Feature Branch

```bash
# Always start from stabilization
git checkout stabilization
git pull origin stabilization
git checkout -b feature/stab-<ID>/<short-description>

# Examples:
git checkout -b feature/stab-101/bundle-size-guard
git checkout -b feature/stab-102/performance-tracker
```

### 3. Development Process

```bash
# Make your changes
# ... code, test, document ...

# Run quality gates before committing
npm run setup        # Validates environment
npm run check        # TypeScript compilation
npm run test         # Unit tests
npm run build        # Build verification
```

### 4. Submit Pull Request

```bash
# Push your branch
git push origin feature/stab-<ID>/<description>

# Create PR targeting 'stabilization' branch
# Title format: "feat: [STAB-101] Bundle size monitoring guard"
```

### 5. Merge Process

1. **CI Validation**: All quality gates must pass
2. **Code Review**: Peer review + maintainer approval
3. **Merge**: Fast-forward merge to `stabilization`
4. **Cleanup**: Feature branch deleted

---

## 🔒 Quality Gates

All changes must pass these automated checks:

### Pre-Development
- ✅ `npm run setup` - Environment validation
- ✅ Dependencies installed and verified
- ✅ Database schema up to date

### Pre-Commit
- ✅ `npm run check` - TypeScript compilation
- ✅ `npm run lint` - Code quality checks
- ✅ `npm run test` - Unit test suite

### Pre-Merge (CI)
- ✅ TypeScript strict mode compilation
- ✅ Unit tests (>90% coverage)
- ✅ Integration tests
- ✅ Build verification
- ✅ Security audit

### Pre-Production (STAB-502)
- ✅ Performance testing
- ✅ End-to-end validation
- ✅ Production readiness checklist
- ✅ Deployment verification

---

## 📋 Naming Conventions

### Branch Names
| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/stab-<ID>/<desc>` | `feature/stab-101/bundle-size-guard` |
| Bug Fix | `fix/stab-<ID>/<desc>` | `fix/stab-102/memory-leak` |
| Chore | `chore/stab-<ID>/<desc>` | `chore/stab-103/update-deps` |

### Commit Messages
```
feat: [STAB-101] add bundle size monitoring guard
fix: [STAB-102] resolve memory leak in chat service
chore: [STAB-103] update TypeScript to v5.0
test: [STAB-104] add performance test suite
docs: [STAB-105] update API documentation
```

### PR Titles
```
feat: [STAB-101] Bundle size monitoring guard
fix: [STAB-102] Memory leak in chat service
chore: [STAB-103] TypeScript v5.0 upgrade
```

---

## 🔄 Production Release Process

### 1. Stabilization Validation
All features merged to `stabilization` undergo continuous validation:
- Automated testing every 30 minutes
- Performance monitoring
- Security scanning
- Integration verification

### 2. Production Readiness (STAB-502)
Before merging to `main`, validate:
- [ ] All STAB tickets completed
- [ ] Performance targets met
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Deployment scripts tested

### 3. Production Deployment
```bash
# Only maintainers can merge to main
git checkout main
git merge --ff-only stabilization
git push origin main

# Auto-deploys to production
# Monitoring and rollback procedures active
```

---

## 🛠️ Developer Commands

### Daily Development
```bash
npm run setup           # Full environment setup
npm run dev            # Start development server
npm run check          # TypeScript validation
npm run test           # Run test suite
npm run build          # Build for production
```

### Quality Assurance
```bash
npm run test:coverage  # Test coverage report
npm run test:e2e       # End-to-end tests
npm run deploy:check   # Deployment readiness
npm run env:validate   # Environment validation
```

### Validation & Monitoring
```bash
npm run validation:run    # Manual validation check
npm run validation:daemon # Start continuous validation
npm run health           # System health check
```

---

## 📊 Monitoring & Metrics

### Continuous Validation
- **Frequency**: Every 30 minutes
- **Scope**: Health, schema, performance, code quality
- **Output**: Validation reports in `validation/reports/`
- **Alerts**: Automatic notifications on failures

### Performance Targets
- API response times: <1 second under 50 concurrent users
- Database queries: <50ms for cached KPIs
- WebSocket latency: <100ms for real-time features
- Build time: <5 minutes for full deployment

### Quality Metrics
- Test coverage: >90% across all modules
- TypeScript compilation: Zero errors
- Security vulnerabilities: Zero high/critical
- Code quality: All linting rules passing

---

## 🚨 Emergency Procedures

### Hotfix Process
```bash
# Branch from main for critical fixes
git checkout main
git checkout -b hotfix/stab-<ID>/<critical-fix>

# Make minimal changes
# Test thoroughly
# Create PR to main (bypass stabilization)
# Requires emergency approval

# After merge, forward-merge to stabilization
git checkout stabilization
git merge main
```

### Rollback Process
```bash
# Automated rollback available
npm run deploy:rollback

# Manual rollback if needed
git checkout main
git reset --hard <previous-commit>
git push --force-with-lease origin main
```

---

## 📚 Additional Resources

- [Setup Guide](../SETUP.md) - Detailed environment setup
- [Validation Checklist](./VALIDATION_CHECKLISTS.md) - Quality gate details
- [API Documentation](./API_DOCUMENTATION.md) - API reference
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

---

**Questions?** Check the documentation or ask in the team chat. Happy coding! 🚀
