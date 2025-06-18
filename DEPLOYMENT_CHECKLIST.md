# RylieSEO MVP Deployment Checklist

## Pre-Deployment Steps

### 1. Install Dependencies
```bash
# Core dependencies
npm install

# Agent 2's branding dependencies
./scripts/install-branding-deps.sh

# Agent 3's dependencies
npm install pg lru-cache react-colorful axios
```

### 2. Environment Variables (.env for Render)
```env
# Database (Render PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (Render Redis)
REDIS_URL=redis://host:6379

# OpenRouter (Agent 3's chat)
OPEN_ROUTER_API_KEY=your-openrouter-key

# JWT & Security
JWT_SECRET=your-secure-secret
NODE_ENV=production

# API URLs
VITE_API_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.onrender.com

# Storage (if using S3/Cloudinary for deliverables)
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_BUCKET_NAME=rylieseo-deliverables
```

### 3. Database Migrations
```bash
# Run all migrations in order
node server/utils/migration-manager.js up

# Migrations to be applied:
# - 0018_seowerks_queue_tables.sql (Agent 2)
# - 0019_activity_logs.sql (Agent 2)
# - 0019_agency_branding.sql (Agent 3)
# - Plus any existing task tables from Agent 3
```

### 4. Update Server Index
```javascript
// server/index.ts - Add all new routes
import { agencyBrandingRoutes } from './routes/agency-branding';
import { adminSeowerksQueueRoutes } from './routes/admin-seowerks-queue';
import { deliverablesRoutes } from './routes/deliverables';

// Apply routes
app.use('/api/agency', agencyBrandingRoutes);
app.use('/api/admin/seowerks-queue', adminSeowerksQueueRoutes);
app.use('/api/deliverables', deliverablesRoutes);
```

### 5. Update Frontend Routes
```typescript
// client/src/App.tsx - Add new pages
import TaskCreationForm from './components/TaskCreationForm';
import SEOWerksQueue from './pages/admin/seowerks-queue';
import AgencyDeliverables from './pages/agency/deliverables';

// Add routes
<Route path="/tasks/create" component={TaskCreationForm} />
<Route path="/admin/seowerks-queue" component={SEOWerksQueue} />
<Route path="/agency/deliverables" component={AgencyDeliverables} />
```

## Deployment Order on Render

### 1. Database Service
- Create PostgreSQL database on Render
- Note the DATABASE_URL

### 2. Redis Service
- Create Redis instance on Render
- Note the REDIS_URL

### 3. Backend Service
- Repository: Your GitHub repo
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Environment Variables: Add all from .env above
- Health Check Path: `/api/health`

### 4. Frontend Service
- Repository: Same GitHub repo
- Root Directory: `/client` or `/web-console`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variables: `VITE_API_URL`

### 5. Post-Deployment

1. **Run Migrations**
   ```bash
   # SSH into backend or run as one-off job
   node server/utils/migration-manager.js up
   ```

2. **Create Initial Data**
   ```sql
   -- Create test agency
   INSERT INTO agencies (id, name, slug) VALUES 
   ('550e8400-e29b-41d4-a716-446655440001', 'Velocity SEO', 'velocity');
   
   -- Create test branding
   INSERT INTO agency_branding (agency_id, company_name, primary_color) VALUES
   ('550e8400-e29b-41d4-a716-446655440001', 'VelocitySEO', '#dc2626');
   ```

3. **Configure Storage**
   - Create S3 bucket or configure file storage
   - Set up proper CORS policies

4. **Test Core Flows**
   - [ ] Chat interface loads (Agent 3)
   - [ ] Can create task via form (Agent 1)
   - [ ] Can create task via chat (Agent 3)
   - [ ] Admin can view SEOWerks queue (Agent 2)
   - [ ] Can claim and complete tasks (Agent 2)
   - [ ] Can upload deliverables (Agent 2)
   - [ ] Agency branding applies correctly (Agent 3)
   - [ ] Can download white-labeled files (Agent 2)

## Integration Points Between Agents

1. **Database Schema Dependencies**
   - Agent 3's tasks table used by Agent 1's form
   - Agent 3's agencies table used by Agent 2's deliverables
   - Agent 2's queue tables extend Agent 3's task system

2. **Context Sharing**
   - Agent 3's BrandingContext provides agency_id
   - Agent 1's form uses this context
   - Agent 2's deliverable processor uses branding data

3. **API Endpoints**
   - `/api/tasks/*` - Agent 3's task management
   - `/api/agency/*` - Agent 3's white-labeling
   - `/api/admin/seowerks-queue/*` - Agent 2's queue
   - `/api/deliverables/*` - Agent 2's files

## Monitoring & Logs

1. **Check Render Logs**
   - Backend service for API errors
   - Frontend service for build issues
   - Database for connection problems

2. **Performance Metrics**
   - Agent 3's `/api/agency/performance/stats`
   - Redis memory usage
   - Database query performance

3. **Activity Logs**
   - Agent 2's activity_logs table
   - Task state transitions
   - User actions audit trail

## Rollback Plan

If issues arise:
```bash
# Rollback database
node server/utils/migration-manager.js down

# Revert to previous commit
git revert HEAD

# Redeploy previous version on Render
```

---

This checklist combines all three agents' work into a cohesive deployment plan. Follow these steps to deploy the complete RylieSEO MVP with task management, white-labeling, and deliverable processing.
