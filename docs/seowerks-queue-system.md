# SEOWerks Queue Management System

## Overview
The SEOWerks Queue Management System is a task workflow system that allows SEOWerks team members to claim, work on, and complete SEO tasks for dealerships. Tasks are prioritized by package tier (Platinum > Gold > Silver) and organized by status.

## Components Built

### Frontend Components

#### 1. SEOWerks Queue Dashboard (`/client/src/pages/admin/seowerks-queue.tsx`)
- **Purpose**: Main dashboard for SEOWerks team to view and manage tasks
- **Features**:
  - Task listing with priority-based sorting (Platinum > Gold > Silver)
  - Real-time updates every 30 seconds
  - Filter by status (submitted, in_progress, review) and task type
  - Search functionality for dealership/agency names
  - Task claiming and completion workflows
  - Stats cards showing queue metrics
  - Modal view for detailed task information

#### 2. Task Details Modal
- Shows complete task information including:
  - Agency and dealership details
  - Task parameters (specific requirements)
  - Priority and package tier
  - Claimed by information
  - Creation and due dates
- Actions available:
  - Claim Task (for unclaimed tasks)
  - Mark Complete (for tasks you've claimed)

### Backend Components

#### 1. API Routes (`/server/routes/admin-seowerks-queue.ts`)
- **GET /api/admin/seowerks-queue**: Fetch queue tasks with filters
- **POST /api/admin/seowerks-queue/:id/claim**: Claim a task
- **POST /api/admin/seowerks-queue/:id/complete**: Mark task as complete
- **POST /api/admin/seowerks-queue/:id/unclaim**: Release a claimed task
- **GET /api/admin/seowerks-queue/stats**: Get queue statistics

#### 2. Middleware
- `requireSEOWerksRole`: Ensures only SEOWerks team members and super admins can access queue endpoints

### Database Schema

#### 1. Tasks Table Extensions (`0018_seowerks_queue_tables.sql`)
```sql
- claimed_by: UUID reference to user who claimed the task
- claimed_at: Timestamp when task was claimed
- completed_by: UUID reference to user who completed the task
- completed_at: Timestamp when task was completed
- queue_position: Integer for queue ordering
```

#### 2. Deliverables Table
```sql
- Stores file information for task deliverables
- Tracks original (SEOWerks branded) and processed (agency branded) versions
- Processing status tracking (pending, processing, completed, failed)
- Version control and metadata storage
```

#### 3. Activity Logs Table (`0019_activity_logs.sql`)
```sql
- Audit trail for all user actions
- Tracks task claims, completions, and other system events
- Stores metadata and context for each action
```

#### 4. SEOWerks Queue View
- Optimized database view for queue dashboard
- Joins tasks with agency, dealership, and user information
- Sorted by package priority and creation date

## User Flow

### For SEOWerks Team Members:

1. **View Queue**: Navigate to Admin > SEOWerks Queue
2. **Find Tasks**: Use filters and search to find relevant tasks
3. **Claim Task**: Click on an available task and press "Claim Task"
4. **Work on Task**: Task moves to "In Progress" status
5. **Complete Task**: When done, mark task as complete
6. **Review**: Task moves to "Review" status for quality check

### Task States:
- **Submitted**: New tasks waiting to be claimed
- **In Progress**: Tasks being actively worked on
- **Review**: Completed tasks awaiting quality review

## Security

- Row Level Security (RLS) policies ensure:
  - SEOWerks team can view all deliverables
  - Agencies can only view their own deliverables
- All actions are logged in the activity_logs table
- Role-based access control via middleware

## Next Steps

### Week 5 Deliverables (Not Yet Implemented):
1. **Deliverable Processing Pipeline**:
   - File upload functionality for completed work
   - Automated processing to strip SEOWerks branding
   - Replace with agency-specific branding
   - Storage organization in Supabase

2. **Agency Download Portal**:
   - UI for agencies to view completed deliverables
   - Download functionality with proper permissions
   - Deliverable versioning and history

3. **Enhanced Queue Features**:
   - Bulk task operations
   - Task templates for common work types
   - Performance metrics and SLA tracking
   - Automated task assignment based on workload

## Configuration

### Environment Variables Needed:
- Database connection (Supabase)
- Authentication tokens
- Storage bucket configuration (for deliverables)

### User Roles:
- `seowerks_team`: Can access queue and manage tasks
- `super_admin`: Full access to all features
- Agency roles: Can view their completed deliverables only

## Testing

To test the queue system:
1. Create test users with `seowerks_team` role
2. Generate sample tasks via the onboarding system
3. Practice claiming and completing tasks
4. Verify activity logs are being created

## API Examples

### Fetch Queue Tasks
```bash
GET /api/admin/seowerks-queue?status=submitted&type=landing_page
Authorization: Bearer <token>
```

### Claim a Task
```bash
POST /api/admin/seowerks-queue/{task-id}/claim
Authorization: Bearer <token>
```

### Complete a Task
```bash
POST /api/admin/seowerks-queue/{task-id}/complete
Authorization: Bearer <token>
```

## Troubleshooting

1. **Tasks not appearing**: Check database view and ensure tasks have correct status
2. **Can't claim tasks**: Verify user role is `seowerks_team` or `super_admin`
3. **Queue not updating**: Check 30-second refresh interval is working
4. **Permission errors**: Verify RLS policies are correctly applied