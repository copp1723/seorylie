# GA4 Multi-Tenant Integration Guide

## Overview

This guide explains how to set up and use the multi-tenant GA4 integration in Rylie SEO. The system uses a single service account to access multiple GA4 properties across different dealerships.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Dealership 1  │────▶│                  │────▶│ GA4 Property 1 │
├─────────────────┤     │                  │     └────────────────┘
│   Dealership 2  │────▶│  Rylie SEO API   │     ┌────────────────┐
├─────────────────┤     │  (One Service    │────▶│ GA4 Property 2 │
│   Dealership 3  │────▶│   Account)       │     └────────────────┘
└─────────────────┘     └──────────────────┘     ┌────────────────┐
                                                  │ GA4 Property 3 │
                                                  └────────────────┘
```

## Service Account Details

- **Email**: `seo-ga4-service@onekeel-seo.iam.gserviceaccount.com`
- **Purpose**: Read-only access to GA4 data for all dealerships
- **Permissions Required**: Viewer role on each GA4 property

## Setup Process

### 1. Initial Setup (One Time)

```bash
# Create the multi-tenant database tables
npm run setup:ga4-tables

# Configure service account credentials
npm run setup:ga4
```

### 2. Onboarding a New Dealership

#### Step 1: Dealership provides GA4 Property ID
The dealership admin needs to:
1. Go to Google Analytics
2. Navigate to Admin > Property Settings
3. Copy the Property ID (numbers only, e.g., `320759942`)

#### Step 2: Dealership grants access
Instructions for the dealership:
1. In GA4 Admin, go to "Property Access Management"
2. Click "+" to add users
3. Add email: `seo-ga4-service@onekeel-seo.iam.gserviceaccount.com`
4. Set role to "Viewer"
5. Click "Add"

#### Step 3: Add property via API

```bash
# Using CURL
curl -X POST https://seorylie.onrender.com/api/ga4/properties \
  -H "Content-Type: application/json" \
  -H "X-Dealership-Id: YOUR_DEALERSHIP_ID" \
  -d '{
    "property_id": "320759942",
    "property_name": "Jay Hatfield Chevrolet",
    "measurement_id": "G-ZJQKZZHVTM",
    "website_url": "https://www.jayhatfieldchevroletvinita.com"
  }'
```

#### Step 4: Test connection

```bash
curl -X POST https://seorylie.onrender.com/api/ga4/properties/test-connection \
  -H "Content-Type: application/json" \
  -H "X-Dealership-Id: YOUR_DEALERSHIP_ID" \
  -d '{"property_id": "320759942"}'
```

## API Endpoints

### Property Management

#### Add GA4 Property
`POST /api/ga4/properties`

#### Test Connection
`POST /api/ga4/properties/test-connection`

#### List Properties
`GET /api/ga4/properties`

#### Update Property
`PATCH /api/ga4/properties/{propertyId}`

#### Remove Property
`DELETE /api/ga4/properties/{propertyId}`

### Reports

#### SEO Metrics Overview
`GET /api/ga4/reports/seo-metrics?days=30`

Returns:
- Sessions by channel
- Total users
- Page views
- Bounce rate
- Average session duration

#### Organic Traffic
`GET /api/ga4/reports/organic-traffic?days=30`

Returns organic search traffic trends

#### Top Landing Pages
`GET /api/ga4/reports/landing-pages?days=30`

Returns top performing landing pages

#### Custom Reports
`POST /api/ga4/reports/custom`

Run custom GA4 reports with specific dimensions and metrics

## Database Schema

### ga4_properties
Maps dealerships to their GA4 properties
- `dealership_id`: Reference to dealership
- `property_id`: GA4 property ID
- `sync_status`: pending, active, error, revoked
- `is_active`: Enable/disable property

### ga4_report_cache
Caches reports for performance
- TTL: 60 minutes by default
- Automatic cache invalidation

### ga4_api_usage
Tracks API usage per dealership
- Request counts
- Response times
- Error tracking

## Testing

### Test single dealership
```bash
npm run test:ga4-multi
```

### Manual testing
```bash
# 1. Add test property
curl -X POST .../api/ga4/properties -d '{"property_id": "320759942"}'

# 2. Test connection
curl -X POST .../api/ga4/properties/test-connection -d '{"property_id": "320759942"}'

# 3. Get reports
curl .../api/ga4/reports/seo-metrics?days=7
```

## Troubleshooting

### Common Issues

#### "Permission denied" error
- **Cause**: Service account not added as Viewer
- **Fix**: Add `seo-ga4-service@onekeel-seo.iam.gserviceaccount.com` to GA4 property

#### "Property not found" error
- **Cause**: Invalid property ID or typo
- **Fix**: Verify property ID in GA4 Admin

#### No data in reports
- **Cause**: New property or no traffic
- **Fix**: Wait 24-48 hours for data to appear

### Debug Commands

```bash
# Check property status
SELECT * FROM ga4_properties WHERE dealership_id = 'YOUR_ID';

# Check API usage
SELECT * FROM ga4_api_usage WHERE dealership_id = 'YOUR_ID' ORDER BY created_at DESC LIMIT 10;

# Clear cache
curl -X POST .../api/ga4/reports/clear-cache
```

## Security

- Service account credentials are stored securely on server
- Each dealership can only access their own properties
- API endpoints require authentication
- Read-only access to GA4 data

## Best Practices

1. **Property Management**
   - Add descriptive property names
   - Keep measurement IDs for client-side tracking
   - Disable inactive properties instead of deleting

2. **Performance**
   - Reports are cached for 60 minutes
   - Use date ranges appropriately
   - Monitor API usage to stay within quotas

3. **Monitoring**
   - Check sync_status regularly
   - Monitor error rates in ga4_api_usage
   - Set up alerts for failed connections

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API logs
3. Contact support with:
   - Dealership ID
   - Property ID
   - Error messages
   - Time of occurrence