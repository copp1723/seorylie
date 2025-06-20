# Response to Jeff - SEOWerks API Update

Jeff,

Perfect! I've updated the API to include the completion date field as you requested. Here's what's ready:

## Updated Task Structure

```json
{
  "id": "unique-task-id",
  "task_type": "blog_post",
  "status": "completed",
  "dealership_id": "dealer-123",
  "post_title": "Your Blog Post Title",
  "post_url": "https://dealerwebsite.com/blog/post-slug",
  "completion_date": "2024-06-17T14:30:00Z",
  "completion_notes": "Optional notes about the task",
  "payload": {
    "any_additional_data": "you want to include"
  }
}
```

## Key Updates:
1. **Added `completion_date` field** - Use ISO 8601 format (e.g., "2024-06-17T14:30:00Z")
2. **Weekly endpoint** - I'll create a separate `/api/seoworks/weekly-rollup` endpoint as you suggested
3. **Testing first** - Yes, please send a few test tasks before sending all of them!

## API Details:
- **Endpoint**: `https://seorylie.onrender.com/api/seoworks/task`
- **API Key**: `[REDACTED_API_KEY]`
- **Method**: POST
- **Headers**: 
  - `x-api-key: [your api key]`
  - `Content-Type: application/json`

## Test Example:
```bash
curl -X POST https://seorylie.onrender.com/api/seoworks/task \
  -H "x-api-key: [REDACTED_API_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-001",
    "task_type": "blog_post",
    "status": "completed",
    "post_title": "5 Tips for Winter Car Maintenance",
    "post_url": "https://example-dealer.com/blog/winter-car-maintenance",
    "completion_date": "2024-06-17T10:30:00Z",
    "completion_notes": "Published and optimized for local SEO"
  }'
```

## Next Steps:
1. Send 3-5 test tasks so we can verify everything is working
2. Check the response to ensure they're being stored correctly
3. Once confirmed, you can start sending all tasks
4. I'll work on the weekly rollup endpoint while you're testing

Sound good? Looking forward to seeing the test data!

Josh