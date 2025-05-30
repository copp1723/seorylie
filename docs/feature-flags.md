# Feature Flag System Documentation

## Overview

The feature flag system provides runtime feature toggles for safe rollout and quick rollback of new functionality. It supports environment-based toggling, user-based rollouts, and administrative controls.

## Feature Flag Naming Conventions

### Naming Format
- Use kebab-case: `feature-name-description`
- Keep names concise but descriptive
- Include scope when relevant: `service-feature-name`

### Categories and Prefixes

#### Authentication & Security
- `jwt-*`: JWT and authentication related features
- `auth-*`: General authentication features
- `security-*`: Security enhancements

#### AI & Agent Features  
- `agent-*`: AI agent functionality
- `ai-*`: General AI features
- `squad-*`: Multi-agent features

#### Infrastructure & Performance
- `redis-*`: Redis-related features
- `websocket-*`: WebSocket functionality
- `sandbox-*`: Sandbox environment features
- `performance-*`: Performance optimizations

#### Data & Analytics
- `event-*`: Event processing features
- `schema-*`: Data schema features
- `trace-*`: Tracing and monitoring
- `analytics-*`: Analytics features

#### UI & User Experience
- `ui-*`: User interface features
- `ux-*`: User experience improvements
- `loading-*`: Loading states and progress

#### Testing & Development
- `test-*`: Testing features
- `dev-*`: Development tools
- `debug-*`: Debugging features

### Examples
```
✅ Good names:
- jwt-refresh-rotation
- agent-squad-integration
- redis-websocket-scaling
- ui-loading-progress
- event-schema-validation

❌ Bad names:
- newFeature
- test_feature
- FEATURE_1
- coolNewThing
```

## Usage Examples

### Backend Usage

```typescript
import { isFeatureEnabled } from '../services/feature-flags';

// Simple check
if (isFeatureEnabled('agent-squad-integration')) {
  // Enable multi-agent features
}

// User-based rollout
if (isFeatureEnabled('redis-websocket-scaling', userId)) {
  // Enable for specific users based on rollout percentage
}

// Middleware usage
app.use('/api/new-feature', requireFeatureFlag('new-feature'), handler);

// Conditional middleware
app.use(conditionalFeatureFlag(
  'enhanced-auth',
  enhancedAuthMiddleware,
  basicAuthMiddleware
));
```

### Express Request Usage

```typescript
// Available on all requests via middleware
app.get('/api/data', (req, res) => {
  if (req.featureFlags.isEnabled('enhanced-data-processing')) {
    // Use enhanced processing
  }
  
  // Get all flags for client
  const flags = req.featureFlags.getAll();
  res.json({ data, _featureFlags: flags });
});
```

### Environment Variable Overrides

```bash
# Override specific flags
FEATURE_AGENT_SQUAD_INTEGRATION=true
FEATURE_REDIS_WEBSOCKET_SCALING=false
FEATURE_TYPESCRIPT_STRICT_MODE=true
```

## Administration

### API Endpoints

```bash
# Get all feature flags
GET /api/admin/feature-flags

# Get current status
GET /api/admin/feature-flags/status

# Toggle a flag
POST /api/admin/feature-flags/jwt-refresh-rotation/toggle
{
  "enabled": true
}

# Create new flag
POST /api/admin/feature-flags
{
  "name": "new-feature",
  "enabled": false,
  "description": "Description of the new feature",
  "environments": ["development", "staging"]
}

# Check specific flag
GET /api/admin/feature-flags/agent-squad-integration/check?userId=user123

# Deprecate flag
POST /api/admin/feature-flags/old-feature/deprecate

# Cleanup deprecated flags
DELETE /api/admin/feature-flags/cleanup?days=30
```

### Authentication

All admin endpoints require admin privileges:
- User role: `admin`
- Permission: `manage-feature-flags`
- Admin API key via `X-Admin-Key` header

## Configuration Structure

```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  deprecated?: boolean;
  deprecationDate?: string;
  rolloutPercentage?: number;  // 0-100 for gradual rollout
  environments?: string[];     // Restrict to specific environments
}
```

## Best Practices

### Development Workflow

1. **Create Flag**: Always create flags for new features
2. **Start Disabled**: Begin with flags disabled
3. **Environment Progression**: Enable in dev → staging → production
4. **Gradual Rollout**: Use rolloutPercentage for gradual user rollout
5. **Monitor**: Watch metrics and logs during rollout
6. **Clean Up**: Deprecate and remove flags after stable rollout

### Flag Lifecycle

```
Created (disabled) → Development → Staging → Production (gradual) → Full Rollout → Deprecated → Removed
```

### Code Review Checklist

- [ ] Flag name follows naming conventions
- [ ] Flag has clear description
- [ ] Default state is appropriate (usually disabled)
- [ ] Environment restrictions are set correctly
- [ ] Rollout strategy is defined
- [ ] Monitoring/metrics are in place
- [ ] Cleanup timeline is planned

### Deprecation Process

1. **Mark as Deprecated**: Use API to mark flag as deprecated
2. **Update Code**: Remove flag checks from code
3. **Wait Period**: Allow 30 days for rollout safety
4. **Remove**: Clean up deprecated flags
5. **Update Documentation**: Remove from active flag lists

## Integration with CI/CD

### Pre-commit Hooks
- Validate flag names match conventions
- Check for deprecated flag usage
- Ensure new flags are documented

### Build Pipeline
- Environment-specific flag validation
- Flag consistency checks across environments
- Automated cleanup of old deprecated flags

## Monitoring

### Metrics to Track
- Flag toggle frequency
- Flag evaluation performance
- Feature adoption rates (when enabled)
- Error rates during flag rollouts

### Alerts
- Flag configuration changes
- High error rates after flag toggles
- Deprecated flags approaching cleanup date

## Security Considerations

- Admin API requires authentication
- Environment variable overrides for sensitive environments
- Audit logging for all flag changes
- Rate limiting on admin endpoints
- No sensitive data in flag names or descriptions