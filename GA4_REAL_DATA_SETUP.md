# GA4 Real Data Setup Guide

## Prerequisites

1. **PostgreSQL Database** (Render PostgreSQL)
   - `DATABASE_URL` environment variable set

2. **Google Cloud Project**
   - GA4 Data API enabled
   - Service account created
   - Credentials JSON file downloaded

## Environment Variables Required

```bash
# PostgreSQL (Render)
DATABASE_URL=postgresql://user:password@host:5432/database

# Google Cloud / GA4
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GA4_KEY_FILE_PATH=/path/to/service-account-key.json
GA4_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
```

## Setup Steps

### 1. Check Your Current Setup
```bash
npm run check:ga4
```

This will verify:
- ✅ Environment variables are configured
- ✅ Service account file exists and is valid
- ✅ GA4 API client can be initialized
- ✅ Test property can be accessed

### 2. Connect Real Dealerships
```bash
npm run setup:real-ga4
```

This interactive script will:
1. Connect to your PostgreSQL database
2. List all dealerships
3. Prompt for GA4 property IDs for each
4. Verify service account has access
5. Store the configuration in the database
6. Test real data fetching

### 3. Grant Access (Per Dealership)

For each dealership's GA4 property:
1. Go to **[GA4] → Admin → Property Access Management**
2. Click **"+"** to add user
3. Enter your service account email (shown in the setup script)
4. Select **"Viewer"** role
5. Click **"Add"**

## What You Need From Each Dealership

1. **GA4 Property ID** 
   - Found in GA4 → Admin → Property Settings
   - Format: 9-digit number (e.g., "320759942")

2. **Access Permission**
   - They must grant your service account viewer access
   - Service account email: Check with `npm run check:ga4`

3. **Conversion Events Setup** (recommended)
   - Form submissions
   - Phone calls
   - Chat interactions
   - Test drive requests

## Database Schema

The setup will create/update these tables:

```sql
-- Dealerships table (updates ga4_property_id)
UPDATE dealerships 
SET ga4_property_id = ?, 
    ga4_connected = true,
    ga4_connected_at = NOW()
WHERE id = ?;

-- GA4 properties table
INSERT INTO ga4_properties (
  dealership_id,
  property_id, 
  property_name,
  website_url,
  is_active,
  last_sync,
  configuration
) VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (dealership_id) 
DO UPDATE SET ...;
```

## Testing Real Data

Once connected, the GA4 service will automatically:
1. Switch from mock data to real data
2. Cache results for performance
3. Respect API quotas (50,000 requests/day)

### Quick Test
```bash
# Check a specific dealership's data
curl http://localhost:3001/api/ga4/analytics/summary \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Dealership-ID: YOUR_DEALERSHIP_ID"
```

## Troubleshooting

### "Permission denied" error
- Ensure service account has Viewer role on the GA4 property
- Verify property ID is correct

### "API not enabled" error
- Enable Google Analytics Data API in Google Cloud Console
- Wait 5 minutes for propagation

### No data returned
- Check if the property has data for the requested date range
- Verify the website has GA4 tracking code installed

## Demo Data (Optional)

If you need demo data for testing:
```bash
npm run seed:demo
```

This will create:
- 4 demo dealerships
- Sample tasks in various states
- Mock deliverables
- 30 days of performance metrics

## Support

For issues with:
- **GA4 Access**: Check property permissions
- **Database**: Verify DATABASE_URL is correct
- **API Errors**: Check Google Cloud Console quotas