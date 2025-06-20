# CleanRylie Validation Checklists

> **Purpose**: Comprehensive validation procedures for stabilization workflow
> **Last Updated**: v2.0-stabilization

---

## 🎯 Overview

This document provides detailed checklists for validating CleanRylie at different stages of the stabilization workflow. Each checklist ensures quality, performance, and production readiness.

---

## 🔧 Pre-Development Validation

### Environment Setup Checklist

Run before starting any development work:

```bash
npm run setup  # Automated validation
```

**Manual Verification:**

- [ ] **Node.js Version**: 18+ installed (`node --version`)
- [ ] **Dependencies**: All packages installed (`npm list --depth=0`)
- [ ] **Environment Variables**: Required vars set (`npm run env:validate`)
- [ ] **Database Connection**: Supabase accessible (`npm run health`)
- [ ] **TypeScript**: Compilation passes (`npm run check`)

### Development Environment

- [ ] **Git Configuration**: User name and email set
- [ ] **Branch Strategy**: Working from `stabilization` branch
- [ ] **IDE Setup**: TypeScript support enabled
- [ ] **Testing Framework**: Vitest and Jest configured
- [ ] **Build Tools**: Vite and esbuild working

---

## 🧪 Pre-Commit Validation

### Code Quality Gates

Run before every commit:

```bash
npm run check    # TypeScript compilation
npm run lint     # Code quality
npm run test     # Unit tests
```

**Detailed Checklist:**

- [ ] **TypeScript Errors**: Zero compilation errors
- [ ] **Type Safety**: No `any` types without justification
- [ ] **Import/Export**: All imports resolve correctly
- [ ] **Unit Tests**: All tests passing
- [ ] **Test Coverage**: New code has >90% coverage
- [ ] **Code Style**: Consistent formatting applied

### Security & Performance

- [ ] **Secrets**: No hardcoded API keys or passwords
- [ ] **Dependencies**: No high/critical vulnerabilities
- [ ] **Performance**: No obvious performance regressions
- [ ] **Memory Leaks**: No obvious memory leak patterns
- [ ] **Error Handling**: Proper error boundaries implemented

---

## 🔄 Pre-Merge Validation (CI)

### Automated CI Checks

GitHub Actions automatically validates:

```yaml
# .github/workflows/stabilization-gates.yml
- TypeScript strict compilation
- Unit test suite (>90% coverage)
- Integration tests
- Build verification
- Security audit
```

**Manual Review Checklist:**

- [ ] **CI Status**: All GitHub Actions passing
- [ ] **Test Results**: No flaky or skipped tests
- [ ] **Build Artifacts**: Dist files generated correctly
- [ ] **Documentation**: README and docs updated
- [ ] **Breaking Changes**: Properly documented and justified

### Code Review Requirements

- [ ] **Peer Review**: At least one team member approval
- [ ] **Maintainer Review**: Core team member approval
- [ ] **Scope Validation**: Changes match ticket requirements
- [ ] **Test Quality**: Tests cover edge cases and error paths
- [ ] **Security Review**: No security vulnerabilities introduced

---

## 🚀 Pre-Production Validation (STAB-502)

### Production Readiness Checklist

Before merging `stabilization → main`:

#### System Health

```bash
npm run validation:run     # Comprehensive validation
npm run deploy:check      # Deployment readiness
npm run test:performance  # Performance testing
```

- [ ] **Health Checks**: All endpoints responding
- [ ] **Database**: Schema migrations applied
- [ ] **Redis**: Cache and sessions working
- [ ] **External APIs**: OpenAI, SendGrid, Twilio configured
- [ ] **WebSocket**: Real-time features functional

#### Performance Targets

- [ ] **API Response**: <1 second under 50 concurrent users
- [ ] **Database Queries**: <50ms for cached KPIs
- [ ] **WebSocket Latency**: <100ms for real-time features
- [ ] **Memory Usage**: Within acceptable limits
- [ ] **CPU Usage**: Stable under normal load

#### Feature Validation

- [ ] **Conversation System**: Multi-turn conversations working
- [ ] **ADF Processing**: Lead ingestion functional
- [ ] **Multi-Tenant**: Dealership isolation secure
- [ ] **Authentication**: JWT and session management
- [ ] **Authorization**: Role-based access control

#### Security Audit

- [ ] **Vulnerability Scan**: Zero high/critical issues
- [ ] **Dependency Audit**: All packages up to date
- [ ] **Environment Secrets**: Properly configured
- [ ] **HTTPS/TLS**: Secure connections enforced
- [ ] **Input Validation**: All user inputs sanitized

---

## 📊 Staging Validation

### Deployment Verification

After deploying to staging:

```bash
# Health checks
curl https://staging.cleanrylie.com/api/health
curl https://staging.cleanrylie.com/api/metrics

# Core endpoints
curl https://staging.cleanrylie.com/api/conversations
curl https://staging.cleanrylie.com/api/dealerships
```

**Endpoint Validation:**

- [ ] **Health Endpoint**: Returns 200 with system status
- [ ] **Metrics Endpoint**: Prometheus metrics available
- [ ] **API Endpoints**: All core APIs responding
- [ ] **WebSocket**: Real-time connections working
- [ ] **Static Assets**: Frontend loading correctly

### Integration Testing

- [ ] **Database Operations**: CRUD operations working
- [ ] **External Services**: Third-party integrations functional
- [ ] **Email System**: SendGrid sending emails
- [ ] **SMS System**: Twilio sending messages
- [ ] **AI Services**: OpenAI API responding

### User Acceptance Testing

- [ ] **Login Flow**: Authentication working
- [ ] **Dashboard**: Metrics and data displaying
- [ ] **Chat System**: Conversations functional
- [ ] **Lead Management**: ADF processing working
- [ ] **Admin Features**: Management interfaces working

---

## 🔍 Continuous Validation

### Automated Monitoring

The validation daemon runs every 30 minutes:

```bash
npm run validation:daemon  # Start continuous monitoring
```

**Validation Scope:**

- [ ] **API Health**: All endpoints responding
- [ ] **Database Schema**: Consistency checks
- [ ] **Performance Baselines**: Response time monitoring
- [ ] **Code Quality**: TypeScript errors, circular dependencies
- [ ] **System Resources**: Disk space, memory usage

### Alert Thresholds

- **API Response Time**: >1 second
- **Database Query Time**: >50ms for cached queries
- **Error Rate**: >1% of requests
- **Memory Usage**: >80% of available
- **Disk Space**: <10% free space

---

## 🚨 Failure Response

### Validation Failure Process

When validation fails:

1. **Immediate**: Stop deployment process
2. **Investigate**: Review logs and error details
3. **Fix**: Address root cause
4. **Re-validate**: Run full validation suite
5. **Document**: Update procedures if needed

### Common Issues & Solutions

| Issue                  | Symptoms            | Solution                               |
| ---------------------- | ------------------- | -------------------------------------- |
| TypeScript Errors      | Compilation fails   | Fix type issues, update imports        |
| Test Failures          | CI pipeline fails   | Fix failing tests, update mocks        |
| Performance Regression | Slow response times | Optimize queries, add caching          |
| Security Vulnerability | Audit warnings      | Update dependencies, fix code          |
| Environment Issues     | Health checks fail  | Verify configuration, restart services |

---

## 📋 Validation Reports

### Report Generation

Validation results are automatically saved:

```
validation/reports/
├── health-check-YYYY-MM-DD-HH-mm.json
├── schema-validation-YYYY-MM-DD-HH-mm.json
├── performance-baseline-YYYY-MM-DD-HH-mm.json
└── continuous-validation-YYYY-MM-DD-HH-mm.json
```

### Report Analysis

- [ ] **Trends**: Monitor performance over time
- [ ] **Patterns**: Identify recurring issues
- [ ] **Thresholds**: Adjust alert levels as needed
- [ ] **Improvements**: Optimize based on data

---

## 🎯 Success Criteria

### Quality Targets

- ✅ **Test Coverage**: >90% across all modules
- ✅ **TypeScript**: Zero compilation errors
- ✅ **Security**: Zero high/critical vulnerabilities
- ✅ **Performance**: All targets met
- ✅ **Functionality**: All features working

### Process Targets

- ✅ **Automation**: All checks automated
- ✅ **Speed**: Validation completes in <10 minutes
- ✅ **Reliability**: <1% false positive rate
- ✅ **Coverage**: All critical paths validated
- ✅ **Documentation**: All procedures documented

---

**Need Help?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) or contact the team.
