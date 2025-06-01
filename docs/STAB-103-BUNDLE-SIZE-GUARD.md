# STAB-103: Bundle-Size Guard

## Overview

The Bundle-Size Guard automatically fails CI builds if the JavaScript bundle size exceeds a defined limit. This prevents accidental introduction of large dependencies or code that could negatively impact application performance.

## Implementation

### Components

1. **Bundle Size Checker Script** (`scripts/check-bundle-size.ts`)
   - Analyzes both client and server bundle sizes
   - Compares against baseline stored in `.stabilization/perf.baseline.json`
   - Provides detailed reporting and suggestions
   - Exits with status 1 if size exceeds limits

2. **CI Integration** (`.github/workflows/stabilization-gates.yml`)
   - Runs after the build step
   - Uses the TypeScript script for consistent checking
   - Fails the build if bundle size exceeds limits

3. **Package Scripts** (`package.json`)
   - `npm run check:bundle-size` - Run bundle size check manually
   - `npm run test:bundle-size-guard` - Test the guard functionality

### Configuration

The bundle size limits are configured in `.stabilization/perf.baseline.json`:

```json
{
  "validation_rules": {
    "max_bundle_size_bytes": 1945000,
    "fail_on_size_increase": true,
    "tolerance_percentage": 5
  }
}
```

- `max_bundle_size_bytes`: Maximum allowed total bundle size
- `tolerance_percentage`: Percentage tolerance above the max (default: 5%)
- `fail_on_size_increase`: Whether to fail on any size increase

### Bundle Analysis

The script analyzes:
- **Client Bundle**: All files in `dist/public/assets/`
- **Server Bundle**: The `dist/index.js` file
- **Total Bundle**: Combined size of client and server bundles

### Output Example

**Success Case:**
```
📊 Bundle Size Analysis
========================
Client Bundle: 1.05 MB
Server Bundle: 514.94 KB
Total Bundle:  1.55 MB

📏 Size Limits:
Baseline:      1.85 MB
Max Allowed:   1.85 MB
With Tolerance (5%): 1.95 MB
Current Total: 1.55 MB

✅ Bundle Size Check Passed
Bundle size is within acceptable limits
Utilization: 83.8% of maximum
Remaining: 403.09 KB before limit
```

**Failure Case:**
```
❌ Bundle Size Check Failed
Bundle size (2.13 MB) exceeds maximum allowed (1.95 MB)
Excess: 182.9 KB (+14.6%)

💡 Suggestions:
  - Review recent changes for large additions
  - Check for accidentally included large files
  - Consider code splitting for large components
  - Analyze bundle with "npm run analyze" if available
  - Update baseline if increase is intentional
```

## Usage

### Local Development

```bash
# Check current bundle size
npm run check:bundle-size

# Test the guard functionality
npm run test:bundle-size-guard

# Build and check in one command
npm run build && npm run check:bundle-size
```

### CI/CD

The bundle size check runs automatically in the CI pipeline as part of the stabilization gates. If the check fails:

1. Review the CI output for detailed size analysis
2. Identify what caused the size increase
3. Either optimize the code or update the baseline if the increase is intentional

### Updating the Baseline

If a legitimate size increase is needed:

1. Update `.stabilization/perf.baseline.json`
2. Modify the `max_bundle_size_bytes` value
3. Document the reason for the increase
4. Commit the changes

## Testing

The implementation includes comprehensive testing:

```bash
# Run the test suite
npm run test:bundle-size-guard
```

The test:
1. Verifies normal bundle size passes
2. Adds dummy content to trigger failure
3. Confirms the check fails with exit code 1
4. Restores original bundle and verifies it passes again

## Benefits

- **Performance Protection**: Prevents accidental introduction of large bundles
- **Early Detection**: Catches size issues before deployment
- **Detailed Reporting**: Provides actionable insights when limits are exceeded
- **Configurable**: Easily adjustable limits and tolerance
- **CI Integration**: Automated checking in the build pipeline

## Troubleshooting

### Common Issues

1. **Build artifacts not found**
   - Ensure `npm run build` completes successfully before running the check
   - Verify `dist/` directory exists and contains expected files

2. **Baseline file missing**
   - Ensure `.stabilization/perf.baseline.json` exists
   - Check that the file contains valid JSON with required fields

3. **False positives**
   - Review the tolerance percentage setting
   - Consider if the baseline needs updating for legitimate changes

### Debugging

Enable verbose output by examining the detailed file-by-file breakdown in the script output. This helps identify which specific files are contributing to size increases.
