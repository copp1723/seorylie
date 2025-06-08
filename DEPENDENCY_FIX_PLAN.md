# Dependency Fix Plan

## Current Issues

### 1. Chart.js Version Conflict

- **Problem**: chartjs-node-canvas@4.1.6 requires chart.js@^3.5.1, but project has chart.js@^4.3.0
- **Solution**: Update chartjs-node-canvas to a version compatible with Chart.js v4

### 2. Canvas System Dependencies

- **Problem**: Missing pixman-1 system library for canvas package
- **Solution**: Install system dependencies or remove canvas if not needed

### 3. Security Vulnerabilities

- **9 vulnerabilities found**: 2 low, 4 moderate, 3 high
- **Key issues**: cookie, esbuild, semver packages

## Step-by-Step Fix Plan

### Step 1: Install System Dependencies (macOS)

```bash
# Install required system libraries for canvas
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
```

### Step 2: Fix Chart.js Conflict

```bash
# Update chartjs-node-canvas to latest version
npm install chartjs-node-canvas@latest --save
```

### Step 3: Install Dependencies

```bash
# Try installing with legacy peer deps
npm install --legacy-peer-deps
```

### Step 4: Fix Security Vulnerabilities

```bash
# Fix non-breaking vulnerabilities
npm audit fix

# Fix breaking vulnerabilities (review changes first)
npm audit fix --force
```

### Step 5: Initialize Husky

```bash
# Initialize Husky hooks
npm run prepare

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

### Step 6: Test Everything

```bash
# Run linting
npm run lint

# Run tests
npm test

# Check formatting
npm run format
```

## Alternative: Remove Canvas Dependency

If canvas is not essential, consider removing it:

1. Check where canvas is used in the codebase
2. Remove chartjs-node-canvas dependency
3. Use alternative chart generation methods

## Verification Checklist

- [ ] System dependencies installed
- [ ] npm install completes successfully
- [ ] All vulnerabilities addressed
- [ ] Husky hooks working
- [ ] Pre-commit hooks running
- [ ] CI pipeline passing
- [ ] Tests running successfully
