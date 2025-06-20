# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for both Continuous Integration (CI) and Continuous Deployment (CD) with a streamlined, efficient pipeline.

## CI Pipeline (`.github/workflows/ci.yml`)

### Triggers
- Push to `main`, `develop`, `feature/*` branches
- Pull requests to `main`, `develop` branches

### Pipeline Stages

1. **Setup & Install Dependencies**
   - Uses `pnpm install --frozen-lockfile` with caching
   - Caches both pnpm store and node_modules for subsequent jobs

2. **Lint Code**
   - Runs `npm run lint`
   - Depends on setup job completion

3. **Type Check**
   - Runs `npx tsc --noEmit` for TypeScript type checking
   - Depends on lint job completion

4. **Run Tests**
   - Runs `npm run test:coverage` with PostgreSQL and Redis services
   - Uploads coverage to Codecov with failure gate enabled
   - Depends on type-check job completion

5. **Build Docker Image**
   - Builds multi-platform Docker image (linux/amd64, linux/arm64)
   - Pushes to GitHub Container Registry (GHCR) only on `main` branch
   - Uses GitHub Actions cache for build layers

6. **Security Scan** (main branch only)
   - Runs Trivy vulnerability scanner on Docker image
   - Uploads results to GitHub Security tab

### Environment Variables
- `NODE_VERSION`: "20"
- `REGISTRY`: ghcr.io
- `IMAGE_NAME`: seorylie

### Required Secrets
- `CODECOV_TOKEN`: For coverage upload
- `GITHUB_TOKEN`: For GHCR access (automatically provided)

## CD Pipeline (`.github/workflows/cd.yml`)

### Triggers
- Push to tags matching `v*.*.*` or `release/*`

### Pipeline Stages

1. **Build Release Image**
   - Builds and pushes tagged Docker image to GHCR
   - Supports semantic versioning tags
   - Multi-platform build (linux/amd64, linux/arm64)

2. **Security Scan Release Image**
   - Strict vulnerability scanning with exit on CRITICAL/HIGH
   - Results uploaded to GitHub Security tab

3. **Prepare Helm Values**
   - Generates staging and production Helm values
   - Templates environment-specific configurations
   - Creates Helm artifacts for deployment

4. **Deploy to Staging**
   - Deploys to Kubernetes staging environment using Helm
   - Requires `KUBE_CONFIG_STAGING` secret

5. **SSH Deploy (Alternative)**
   - Alternative deployment method via SSH
   - Triggered by input parameter or tag containing 'ssh-deploy'
   - Includes rollback on health check failure

6. **Deploy to Production**
   - Canary deployment strategy (10% traffic first)
   - Full production deployment after canary validation
   - Auto-scaling enabled

7. **Create GitHub Release**
   - Generates release notes with deployment details
   - Marks pre-releases for alpha/beta/rc versions

### Deployment Methods

#### Kubernetes (Primary)
- Uses Helm charts for deployment
- Canary deployment strategy for production
- Auto-scaling and resource management
- SSL/TLS termination with cert-manager

#### SSH (Alternative)
- Docker-based deployment on remote servers
- Health checks and automatic rollback
- Blue-green deployment pattern

### Required Secrets

#### For Kubernetes Deployment
- `KUBE_CONFIG_STAGING`: Base64-encoded kubeconfig for staging
- `KUBE_CONFIG_PRODUCTION`: Base64-encoded kubeconfig for production
- `STAGING_DB_HOST`, `STAGING_DB_NAME`, `STAGING_DB_USER`, `STAGING_DB_PASSWORD`
- `STAGING_REDIS_URL`, `STAGING_JWT_SECRET`
- `PRODUCTION_DB_HOST`, `PRODUCTION_DB_NAME`, `PRODUCTION_DB_USER`, `PRODUCTION_DB_PASSWORD`
- `PRODUCTION_REDIS_URL`, `PRODUCTION_JWT_SECRET`

#### For SSH Deployment
- `SSH_PRIVATE_KEY`: SSH private key for server access
- `SSH_HOST`: Target server hostname
- `SSH_USER`: SSH username
- `PRODUCTION_DATABASE_URL`: Full database connection string
- `PRODUCTION_REDIS_URL`: Redis connection string
- `PRODUCTION_JWT_SECRET`: JWT signing secret

## Helm Chart Structure

```
helm/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default values
├── values-staging.yaml     # Generated staging values
├── values-production.yaml  # Generated production values
└── templates/
    ├── _helpers.tpl        # Template helpers
    ├── deployment.yaml     # Kubernetes deployment
    └── service.yaml        # Kubernetes service
```

## Key Features

### Performance Optimizations
- **pnpm with frozen lockfile**: Ensures consistent, fast installs
- **Multi-layer caching**: pnpm store, node_modules, Docker layers
- **Parallel job execution**: Lint, type-check, and test run in sequence but efficiently
- **Multi-platform builds**: Support for both x64 and ARM architectures

### Security
- **Vulnerability scanning**: Trivy scanner for Docker images
- **Coverage gates**: Fail CI if coverage thresholds not met
- **Strict security contexts**: Non-root containers, read-only filesystems
- **Secret management**: Proper handling of sensitive data

### Reliability
- **Health checks**: Comprehensive liveness and readiness probes
- **Rollback capabilities**: Automatic rollback on deployment failures
- **Canary deployments**: Gradual rollout in production
- **Resource limits**: CPU and memory constraints

## Usage

### Triggering CI
```bash
# Push to main (runs full CI + Docker build)
git push origin main

# Create PR (runs CI without Docker push)
git push origin feature/my-feature
```

### Triggering CD
```bash
# Create and push a version tag
git tag v1.2.3
git push origin v1.2.3

# Or create a release tag
git tag release/v1.2.3
git push origin release/v1.2.3
```

### Manual Deployment
You can also trigger deployments manually through GitHub Actions UI with custom parameters.

## Monitoring

- **GitHub Actions**: View pipeline status and logs
- **GitHub Security**: Review vulnerability scan results
- **Codecov**: Monitor test coverage trends
- **Kubernetes Dashboard**: Monitor application health and resources

## Troubleshooting

### Common Issues

1. **pnpm cache miss**: Clear cache in GitHub Actions settings
2. **Type check failures**: Ensure all TypeScript files compile
3. **Coverage gate failures**: Increase test coverage or adjust thresholds
4. **Docker build failures**: Check Dockerfile and build context
5. **Helm deployment issues**: Verify kubeconfig and secrets

### Debug Commands
```bash
# Local type checking
npx tsc --noEmit

# Local coverage check
npm run test:coverage

# Local Docker build
docker build . -t seorylie:local

# Helm dry run
helm install seorylie ./helm --dry-run --debug
```

