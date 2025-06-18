# Rylie SEO API Integration Guide

## 🚀 Live API Endpoints

Base URL: `https://seorylie-production.onrender.com`

### For Jeff (SEOWerks)

#### 1. Webhook Endpoint
**POST** `/api/seoworks/webhook`

Send task updates to this endpoint:
```json
{
  "id": "unique-task-id",
  "task_type": "seo_audit",
  "status": "completed",
  "completion_date": "2025-06-17T20:00:00Z",
  "data": {
    // Any additional task data
  }
}
```

**Important**: Include the `completion_date` field as requested!

#### 2. View All Tasks
**GET** `/api/seoworks/tasks`

Returns all webhook data we've received.

#### 3. Weekly Rollup (NEW!)
**GET** `/api/seoworks/weekly-rollup`

Returns:
- Weekly task summaries for the last 4 weeks
- Completion rates
- Average time to complete
- Current week breakdown by task type

### For Rowdy (GA4 Integration)

#### 1. List GA4 Properties
**GET** `/api/ga4/properties`

Returns all configured GA4 properties.

#### 2. Add GA4 Property
**POST** `/api/ga4/properties`

```json
{
  "dealership_id": "uuid-here",
  "property_id": "320759942",
  "property_name": "Dealership Name",
  "measurement_id": "G-XXXXXXX",
  "website_url": "https://dealership.com"
}
```

### Chat Assistant

**GET** `/chat`

Interactive SEO assistant interface with:
- Keyword research help
- Analytics insights
- "Submit Request to SEO Team" functionality

## 🔧 Setup Instructions

### For GA4 Integration:

1. **Add Service Account Key**
   - Upload your `ga4-service-account-key.json` to the server
   - Run: `npm run setup:ga4`

2. **Share with Dealerships**
   - Service account email will be displayed after setup
   - Dealerships must add this email as "Viewer" to their GA4 properties

3. **Test Properties Ready**
   - Property ID: 320759942
   - Property ID: 317592148

### Testing the Integration:

```bash
# Test all endpoints
curl https://seorylie-production.onrender.com/health

# Test webhook
curl -X POST https://seorylie-production.onrender.com/api/seoworks/webhook \
  -H "Content-Type: application/json" \
  -d '{"id": "test-123", "task_type": "seo_audit", "status": "completed", "completion_date": "2025-06-17T20:00:00Z"}'

# View weekly rollup
curl https://seorylie-production.onrender.com/api/seoworks/weekly-rollup
```

## 📊 Database Schema

### SEOWerks Tasks Table
- `id` - UUID primary key
- `external_id` - Your task ID (unique)
- `task_type` - Type of SEO task
- `status` - Task status
- `data` - JSONB for any additional data
- `completion_date` - When task was completed
- `created_at` - When we received the webhook
- `updated_at` - Last update time

### GA4 Properties Table
- `id` - UUID primary key
- `dealership_id` - Dealership identifier
- `property_id` - GA4 property ID
- `property_name` - Friendly name
- `measurement_id` - GA4 measurement ID
- `website_url` - Associated website
- `is_active` - Active/inactive flag
- `created_at` - When added

## 🎯 Next Steps

1. **Jeff**: Start sending webhooks to test the integration
2. **Rowdy**: Add the service account email to your GA4 properties
3. **Both**: Test the chat interface at `/chat`

## 📞 Support

If you encounter any issues:
1. Check the health endpoint: `/health`
2. Review the API response for error messages
3. Contact support with the error details

---

*Last updated: June 17, 2025*