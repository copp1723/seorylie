# GitHub Actions Workflows

This directory contains the CI/CD workflows for the Rylie SEO project.

## Workflows

### 1. **ci.yml** - Main CI Pipeline
- Runs on push to main and pull requests
- Executes build, lint, type check, and tests
- Includes dependency caching for faster runs
- Provides job summaries

### 2. **pull-request.yml** - Pull Request Status Checks
- Specific checks for pull requests
- Includes both `pull_request` and `push` event handlers
- Matches the GitHub status check names

### 3. **lint-and-type-check.yml** - Code Quality Checks
- Runs ESLint and TypeScript type checking
- Triggered on code changes
- Uses increased heap size for large codebases

### 4. **database-migration.yml** - Database Migration Tests
- Tests database migrations in isolated environment
- Uses PostgreSQL service container
- Only runs when database-related files change

### 5. **dependency-scan.yml** - Security Vulnerability Scanning
- Runs npm audit for security vulnerabilities
- Scheduled weekly scans
- Triggers on dependency changes

### 6. **manual-trigger.yml** - Manual Workflow Dispatch
- Allows manual triggering of CI checks
- Configurable options for what to run

## Common Issues and Solutions

### 1. Heap Out of Memory
- Solution: Added `NODE_OPTIONS="--max-old-space-size=4096"` to memory-intensive tasks

### 2. Missing Dependencies
- Solution: Use `npm ci` instead of `npm install` for consistent installs

### 3. Failing Tests with No Tests
- Solution: Added `--passWithNoTests` flag to Jest

### 4. Workflow Timeouts
- Solution: Added explicit error handling and continue-on-error where appropriate

## Best Practices

1. **Use `npm ci`** for faster, more reliable installs in CI
2. **Cache dependencies** to speed up workflow runs
3. **Use matrix builds** for testing multiple Node versions
4. **Add job summaries** for better visibility
5. **Handle errors gracefully** with proper exit codes

## Monitoring

- Check the Actions tab in GitHub for workflow runs
- Enable notifications for failed workflows
- Review workflow run times and optimize as needed