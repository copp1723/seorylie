# STAB-402: Continuous Validation Suite

This directory contains the implementation of the Continuous Validation Suite, a daemon that executes health, schema, and performance checks every 30 minutes.

## Overview

The Continuous Validation Suite provides automated monitoring and validation of:

- API health and response times
- Database schema consistency and migration status
- Performance baselines and resource utilization
- Code quality metrics (TypeScript errors, circular dependencies)
- System health (disk space, memory, environment variables)

## Files

- **`continuous-checks.ts`** - Main validation script that performs all checks
- **`daemon.ts`** - Daemon process that runs validation every 30 minutes
- **`test-acceptance.ts`** - Acceptance test script to verify implementation
- **`latest.json`** - Latest validation results (generated automatically)
- **`history.json`** - Historical validation results
- **`daemon.log`** - Daemon process logs

## Usage

### Run Single Validation

```bash
npm run validation:run
```

### Start Daemon (runs every 30 minutes)

```bash
npm run validation:daemon
```

### Run Acceptance Tests

```bash
npm run validation:test
```

## Daemon Features

- **Scheduled Execution**: Runs every 30 minutes using cron schedule
- **Health Check Endpoint**: `http://localhost:8082/health`
- **Status Endpoint**: `http://localhost:8082/status`
- **Graceful Shutdown**: Handles SIGINT, SIGTERM, and SIGUSR2
- **Log Rotation**: Automatically rotates logs when they exceed 10MB
- **Error Handling**: Comprehensive error handling and retry logic

## Validation Checks

### API Health

- Tests all configured endpoints for response time and status
- Configurable timeouts and retry logic
- Tracks response times and HTTP status codes

### Database Schema

- Validates migration consistency
- Checks for missing rollback files
- Monitors database connection performance
- Detects pending migrations

### Performance Baselines

- Memory usage monitoring
- CPU usage tracking
- Response time validation
- Resource utilization checks

### Code Quality

- TypeScript error detection
- Circular dependency analysis
- Code metrics collection
- Build validation

### System Health

- Disk space monitoring
- Process health checks
- Environment variable validation
- System resource monitoring

## Configuration

The validation suite is configured through the `CONFIG` object in `continuous-checks.ts`:

```typescript
const CONFIG = {
  outputFile: "validation/latest.json",
  historyFile: "validation/history.json",
  maxHistoryEntries: 100,
  timeoutMs: 30000,
  retryAttempts: 3,
  retryDelay: 1000,

  thresholds: {
    apiResponseTime: 2000, // ms
    memoryUsage: 80, // percentage
    cpuUsage: 75, // percentage
    dbConnectionTime: 1000, // ms
    errorRate: 0.05, // 5%
    typeScriptErrors: 0, // strict
    circularDependencies: 5, // max allowed
  },

  endpoints: [
    { path: "/health", method: "GET", timeout: 5000 },
    { path: "/api/health", method: "GET", timeout: 5000 },
    // ... more endpoints
  ],
};
```

## Output Format

The validation results are saved to `validation/latest.json` with the following structure:

```json
{
  "timestamp": "2025-06-01T04:23:29.790Z",
  "duration": 11440,
  "status": "pass|fail|warning",
  "checks": [
    {
      "name": "Check Name",
      "category": "api|database|performance|code|system",
      "status": "pass|fail|warning",
      "duration": 123,
      "message": "Human readable message",
      "details": {
        /* additional data */
      },
      "severity": "low|medium|high|critical"
    }
  ],
  "summary": {
    "total": 27,
    "passed": 11,
    "failed": 1,
    "warnings": 15
  },
  "violations": ["List of violation messages"],
  "metadata": {
    "nodeVersion": "v22.14.0",
    "platform": "darwin",
    "memoryUsage": {
      /* Node.js memory usage */
    },
    "uptime": 11.619358625
  }
}
```

## GitHub Actions Integration

The validation suite includes a GitHub Actions workflow (`.github/workflows/validation-daemon.yml`) that:

- Runs nightly at 2 AM UTC
- Supports manual dispatch with configurable options
- Tests daemon functionality
- Validates output file generation
- Tests violation detection

## Acceptance Criteria

✅ **First run generates validation/latest.json ≥1 KB**

- The validation script generates a comprehensive JSON report
- File size is typically 8-10KB with detailed check results

✅ **Second run exits 0 when no new violations**

- Subsequent runs maintain consistent violation counts
- No new violations are introduced between runs

✅ **Introduce fake violation → exit 1 & GitHub Action fails**

- System correctly detects and reports new violations
- Exit codes properly indicate validation status

## Monitoring

The daemon provides several monitoring capabilities:

### Health Check

```bash
curl http://localhost:8082/health
```

### Status Check

```bash
curl http://localhost:8082/status
```

### Log Monitoring

```bash
tail -f validation/daemon.log
```

## Troubleshooting

### Common Issues

1. **Validation fails with TypeScript errors**

   - Run `npm run check` to see specific TypeScript issues
   - Fix TypeScript errors or adjust thresholds

2. **Database connection failures**

   - Verify database is running and accessible
   - Check DATABASE_URL environment variable

3. **API endpoint failures**

   - Ensure the application server is running
   - Check endpoint configurations in CONFIG

4. **Daemon won't start**
   - Check if port 8082 is already in use
   - Verify node-cron dependency is installed

### Debug Mode

Set `NODE_ENV=development` for more verbose logging:

```bash
NODE_ENV=development npm run validation:run
```

## Development

To modify the validation suite:

1. Update checks in `continuous-checks.ts`
2. Adjust configuration thresholds as needed
3. Test changes with `npm run validation:test`
4. Update documentation as needed

The validation suite is designed to be extensible - new checks can be added by implementing the `ValidationCheck` interface and adding them to the validation pipeline.
