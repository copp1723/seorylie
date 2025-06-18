# Database Setup Guide - PostgreSQL (Render)

## 📋 Prerequisites

1. **Render Account** with PostgreSQL database created
2. **Database Connection String** from Render dashboard
3. **Node.js** installed locally for running scripts

## 🚀 Quick Setup

### 1. Get Your Render Database URL

1. Log into [Render Dashboard](https://dashboard.render.com)
2. Go to your PostgreSQL database
3. Copy the **External Database URL**

It looks like:
```
postgresql://username:password@dpg-xxxxx.render.com:5432/database_name
```

### 2. Configure Environment

Create `.env` file (for local development):
```bash
cp .env.example .env
```

Edit `.env` and add your Render database URL:
```env
DATABASE_URL=postgresql://your_actual_render_url_here
```

### 3. Verify Database Connection

```bash
npm run check:db
```

This will show:
- ✅ Connection status
- 📊 Existing tables
- 📦 Data summary
- 🌐 GA4 connections

### 4. Run Migrations (First Time Only)

```bash
npm run db:migrate
```

This creates all required tables:
- `dealerships` - Dealership accounts
- `seo_tasks` - SEO work items
- `deliverables` - Task deliverables
- `users` - User accounts
- `ga4_properties` - GA4 configurations
- `performance_metrics` - Analytics data
- `reports` - Generated reports
- And more...

### 5. Seed Demo Data (Optional)

```bash
npm run seed:demo
```

Creates:
- 4 demo dealerships (Platinum, Gold, Silver)
- Sample tasks in various states
- Mock deliverables
- 30 days of performance data
- Demo user accounts

## 🔧 Troubleshooting

### "Connection failed" Error

1. **Check Render Dashboard**
   - Is the database active?
   - Are there any alerts?

2. **Verify Connection String**
   - No typos in DATABASE_URL
   - Includes all parts: `postgresql://user:pass@host:port/dbname`

3. **Check IP Whitelist**
   - Render allows all IPs by default
   - If restricted, add your IP

### "Table does not exist" Error

Run migrations:
```bash
npm run db:migrate
```

### "Permission denied" Error

- Ensure your database user has full permissions
- Check Render dashboard for user roles

## 📑 Environment Variables

### Required for Production

```env
# Database (Render PostgreSQL)
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=your-secret-key
NODE_ENV=production

# Google Analytics
GOOGLE_APPLICATION_CREDENTIALS=/path/to/ga4-key.json
GA4_SERVICE_ACCOUNT_EMAIL=service@project.iam
```

### Local Development

For local PostgreSQL:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/seorylie_dev
```

## 🌈 Complete Setup Flow

```bash
# 1. Check environment
npm run check:db

# 2. Run migrations (if needed)
npm run db:migrate

# 3. Seed demo data (optional)
npm run seed:demo

# 4. Connect GA4 properties
npm run setup:real-ga4

# 5. Verify everything
npm run check:db
npm run check:ga4
```

## 📦 Database Schema Overview

```sql
-- Core Tables
dealerships         -- Client dealerships
seo_tasks          -- SEO work items
deliverables       -- Task outputs
users             -- All users

-- Analytics
ga4_properties     -- GA4 configurations
performance_metrics -- Daily metrics
reports           -- Generated reports

-- System
notifications     -- User notifications
api_usage        -- API tracking
agency_settings  -- Global settings
schema_migrations -- Migration tracking
```

## 🔒 Security Notes

1. **Never commit `.env` files**
2. **Use strong passwords**
3. **Rotate credentials regularly**
4. **Enable SSL in production** (Render does this automatically)
5. **Backup regularly** (Render provides daily backups)

## 🆘 Support

If you're still having issues:
1. Check Render status page
2. Review database logs in Render dashboard
3. Ensure all dependencies are installed: `npm install`
4. Try the individual steps instead of combined commands