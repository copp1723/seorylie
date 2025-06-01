# External API Integration Guards

This document describes the External API Integration Guards feature, which provides feature flags for all external API integrations in the system.

## Overview

External API Integration Guards allow administrators to enable or disable specific external API integrations at runtime. This provides several benefits:

- **Emergency Kill Switch**: Quickly disable problematic integrations during incidents
- **Controlled Rollout**: Gradually enable new integrations in production
- **Testing**: Selectively enable/disable integrations in testing environments
- **Cost Control**: Disable expensive API integrations when not needed

## Available API Flags

The system currently supports the following external API integration flags:

| Flag Name | Description | Default |
|-----------|-------------|---------|
| `google-ads-etl` | Google Ads ETL data integration | Enabled |
| `twilio-sms` | Twilio SMS messaging service | Enabled |
| `sendgrid-email` | SendGrid email delivery service | Enabled |
| `openai-chat` | OpenAI chat completions API | Enabled |
| `adf-integration` | ADF (Auto-lead Data Format) integration | Enabled |

## Usage

### Backend Usage

To check if an external API is enabled in backend code:

```typescript
import { ExternalAPIFlags, isExternalAPIEnabled } from './services/external-api-flags';

// Check if an API is enabled
if (isExternalAPIEnabled(ExternalAPIFlags.TwilioSMS, dealershipId)) {
  // Make Twilio API calls
} else {
  // Use fallback or return appropriate error
}
```

To enable or disable an API programmatically:

```typescript
import { ExternalAPIFlags, enableExternalAPI, disableExternalAPI } from './services/external-api-flags';

// Enable an API
enableExternalAPI(ExternalAPIFlags.OpenAIChat);

// Disable an API with reason
disableExternalAPI(ExternalAPIFlags.TwilioSMS, 'Service outage reported by Twilio');
```

### Frontend Usage

In React components, use the `useExternalAPIFlags` hook:

```typescript
import useExternalAPIFlags, { ExternalAPIFlags } from '../hooks/useExternalAPIFlags';

function MyComponent() {
  const { flags, isLoading, error, isFlagEnabled } = useExternalAPIFlags();
  
  // Check if a specific API is enabled
  const isTwilioEnabled = isFlagEnabled(ExternalAPIFlags.TwilioSMS);
  
  return (
    <div>
      <p>Twilio SMS is {isTwilioEnabled ? 'enabled' : 'disabled'}</p>
    </div>
  );
}
```

## Admin Interface

Administrators can manage external API flags through the admin interface at `/admin/external-api-flags`.

When disabling an API, administrators must provide a reason, which is logged for audit purposes.

## API Endpoints

The following REST API endpoints are available for managing external API flags:

- `GET /api/external-api-flags` - Get status of all flags
- `GET /api/external-api-flags/:flag` - Get status of a specific flag
- `POST /api/external-api-flags/:flag/enable` - Enable a flag
- `POST /api/external-api-flags/:flag/disable` - Disable a flag (requires reason)

## Implementation Details

External API flags are implemented as feature flags in the system's feature flag service. They are initialized at application startup and can be modified at runtime.

Each external API integration checks its corresponding flag before making API calls. If the flag is disabled, the integration will either:

1. Return an appropriate error response
2. Use a fallback mechanism if available
3. Skip the operation entirely

## Monitoring and Alerts

When an external API flag is disabled, the system logs a warning message with the reason. These logs can be monitored for unexpected changes.

## Future Enhancements

Planned enhancements for this feature include:

- Per-dealership API flag configuration
- Scheduled enabling/disabling of APIs
- Automatic disabling based on error rates
- Integration with the monitoring dashboard