# SEOWerks API Integration Documentation

## Overview
The Rylie SEO platform provides webhook endpoints for SEOWerks to push task updates and blog post completions.

## Authentication
All API endpoints (except health check) require authentication via API key.

**Header:** `x-api-key: YOUR_API_KEY`

## Base URL
- **Production:** `https://seorylie.onrender.com/api/seoworks`
- **Local Development:** `http://localhost:3003/api/seoworks`

## Endpoints

### 1. Health Check
**GET** `/health`

No authentication required. Used to verify the API is accessible.

**Response:**
```json
{
  "status": "ok",
  "service": "SEOWerks Integration",
  "timestamp": "2024-06-17T14:30:00.000Z",
  "version": "1.0.0"
}
```

### 2. Task Webhook
**POST** `/task`

Main endpoint for receiving task updates from SEOWerks.

**Request Body:**
```json
{
  "id": "unique-task-id",
  "task_type": "blog_post",
  "status": "completed",
  "dealership_id": "dealer-123",
  "post_title": "10 Tips for Car Maintenance",
  "post_url": "https://dealership.com/blog/car-maintenance",
  "completion_date": "2024-06-17T14:30:00Z",
  "completion_notes": "Successfully published",
  "payload": {
    "word_count": 1200,
    "keywords": ["car maintenance", "auto care"],
    "meta_description": "Learn the top 10 tips..."
  }
}
```

**Required Fields:**
- `id` (string): Unique identifier for the task
- `task_type` (string): Type of task (e.g., "blog_post", "page_update")
- `status` (string): One of: "pending", "in_progress", "completed", "failed"

**Optional Fields:**
- `dealership_id` (string): ID of the associated dealership
- `post_title` (string): Title of the blog post
- `post_url` (string): URL where the content was published
- `completion_date` (string): ISO 8601 date when task was completed (e.g., "2024-06-17T14:30:00Z")
- `completion_notes` (string): Any notes about the completion
- `payload` (object): Additional data specific to the task

**Response:**
```json
{
  "status": "success",
  "message": "Task received and stored",
  "task": {
    "id": "unique-task-id",
    "status": "completed",
    "updated_at": "2024-06-17T14:30:00.000Z"
  }
}
```

### 3. Get Task Status
**GET** `/task/{taskId}`

Retrieve the current status of a specific task.

**Response:**
```json
{
  "status": "success",
  "task": {
    "id": "unique-task-id",
    "task_type": "blog_post",
    "status": "completed",
    "dealership_id": "dealer-123",
    "post_title": "10 Tips for Car Maintenance",
    "post_url": "https://dealership.com/blog/car-maintenance",
    "created_at": "2024-06-17T14:00:00.000Z",
    "updated_at": "2024-06-17T14:30:00.000Z"
  }
}
```

### 4. List Tasks
**GET** `/tasks`

Retrieve a paginated list of tasks.

**Query Parameters:**
- `limit` (number): Number of results per page (default: 50)
- `offset` (number): Number of results to skip (default: 0)
- `status` (string): Filter by status
- `dealership_id` (string): Filter by dealership

**Response:**
```json
{
  "status": "success",
  "tasks": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Invalid API key"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": [
    {
      "field": "status",
      "message": "Invalid enum value"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Failed to process task webhook"
}
```

## Testing

### Using the Test Script
```bash
# Set your API key in .env
echo "SEO_WORKS_API_KEY=your-api-key-here" >> .env

# Run the test suite
npm run test:seoworks
```

### Using CURL

#### Health Check
```bash
curl https://seorylie.onrender.com/api/seoworks/health
```

#### Send a Task Update
```bash
curl -X POST https://seorylie.onrender.com/api/seoworks/task \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-001",
    "task_type": "blog_post",
    "status": "completed",
    "post_title": "Test Blog Post"
  }'
```

## Integration Flow

1. **Task Creation**: When SEOWerks creates a new task, send a webhook with status "pending"
2. **Progress Updates**: As work progresses, send updates with status "in_progress"
3. **Completion**: When finished, send final update with status "completed" or "failed"
4. **Blog Posts**: For blog posts, include `post_title` and `post_url` in the completion webhook

## Rate Limits
- No hard rate limits currently implemented
- Please be reasonable with request frequency
- Batch updates when possible

## Support
For API issues or questions:
- Check server status at `/health` endpoint
- Contact Josh for API key or access issues
- Include request/response details when reporting problems