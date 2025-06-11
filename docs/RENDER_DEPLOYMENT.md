# Render Deployment Guide for Rylie SEO Hub

This guide covers deploying the Rylie SEO Hub application to Render.

## 🚀 Quick Start

1. **Fork or Connect Repository**

   - Ensure your GitHub repository is connected to Render
   - The `render.yaml` file in the root will automatically configure services

2. **Create New Blueprint**
   - Go to Render Dashboard
   - Click "New" → "Blueprint"
   - Select your repository and branch
   - Render will automatically detect the `render.yaml` file

## 📋 Architecture on Render

The application deploys as two main services:

### 1. Backend API Service (`rylie-seo-api`)

- **Type**: Web Service
- **Runtime**: Node.js
- **URL**: `https://rylie-seo-api.onrender.com`
- **Port**: 3000
- **Auto-scaling**: Available on paid plans

### 2. Frontend Web Console (`rylie-seo-console`)

- **Type**: Static Site
- **Build**: Vite + React
- **URL**: `https://rylie-seo-console.onrender.com`
- **CDN**: Automatic global distribution

### 3. PostgreSQL Database (`rylie-seo-db`)

- **Type**: PostgreSQL 14+
- **Plan**: Starter (upgradeable)
- **Backups**: Daily automatic backups
- **Region**: Oregon (change in render.yaml if needed)

## 🔧 Configuration

### Environment Variables

The following environment variables are automatically configured:

**Auto-generated:**

- `DATABASE_URL` - From PostgreSQL database
- `JWT_SECRET` - Randomly generated

**Required (set in Render Dashboard):**

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://rylie-seo-console.onrender.com

# External Services
OPENAI_API_KEY=sk-your-openai-key
GA4_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GA4_PROJECT_ID=your-project-id
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GA4_KEY_ID=your-key-id
GA4_ENCRYPTION_KEY=your-32-character-encryption-key

# Optional Services
SENDGRID_API_KEY=your-sendgrid-key
STRIPE_SECRET_KEY=sk_live_your-stripe-key
REDIS_URL=redis://your-redis-url
```

### Build Configuration

The build process is configured in `render.yaml`:

**Backend Build:**

```bash
npm install && npm run build
```

**Frontend Build:**

```bash
cd web-console && npm install && npm run build
```

## 📦 Deployment Process

### Initial Deployment

1. **Connect Repository**

   ```
   - Go to Render Dashboard
   - Click "New" → "Blueprint"
   - Select repository
   - Review services configuration
   - Click "Apply"
   ```

2. **Configure Environment Variables**

   ```
   - Navigate to each service
   - Go to "Environment" tab
   - Add required variables
   - Save changes
   ```

3. **Run Database Migrations**
   ```bash
   # SSH into the API service
   # Run migrations
   npm run migrate
   ```

### Updating the Application

**Automatic Deployments:**

- Push to the configured branch (main)
- Render automatically builds and deploys

**Manual Deployments:**

- Go to service dashboard
- Click "Manual Deploy"
- Select commit or branch

## 🔍 Monitoring & Logs

### Viewing Logs

```
Dashboard → Service → Logs tab
```

### Metrics

```
Dashboard → Service → Metrics tab
```

### Health Checks

- Backend: `https://rylie-seo-api.onrender.com/health`
- Frontend: Automatic static site monitoring

## 🚨 Troubleshooting

### Build Failures

**Issue**: TypeScript compilation errors

```bash
# Solution: Ensure all dependencies are in package.json
npm install --save-dev @types/node @types/express
```

**Issue**: Memory errors during build

```bash
# Add to render.yaml under buildCommand:
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Runtime Issues

**Issue**: Database connection failures

```bash
# Check DATABASE_URL is correctly set
# Ensure database is in same region as service
```

**Issue**: CORS errors

```bash
# Update ALLOWED_ORIGINS to include your frontend URL
ALLOWED_ORIGINS=https://rylie-seo-console.onrender.com,https://custom-domain.com
```

## 🔒 Security Configuration

### SSL/TLS

- Automatic HTTPS for all services
- Managed SSL certificates
- Force HTTPS redirects enabled

### Headers

Configure security headers in `render.yaml`:

```yaml
headers:
  - path: /*
    name: X-Frame-Options
    value: SAMEORIGIN
  - path: /*
    name: X-Content-Type-Options
    value: nosniff
  - path: /*
    name: Strict-Transport-Security
    value: max-age=31536000; includeSubDomains
```

## 🎯 Performance Optimization

### Backend Optimization

1. **Enable Auto-scaling** (paid plans)
2. **Configure Health Checks**
3. **Use Redis for Caching**

### Frontend Optimization

1. **Static Site Benefits**

   - Global CDN distribution
   - Automatic compression
   - Browser caching headers

2. **Build Optimization**
   ```json
   // vite.config.ts adjustments
   {
     "build": {
       "minify": "terser",
       "rollupOptions": {
         "output": {
           "manualChunks": {
             "vendor": ["react", "react-dom"],
             "utils": ["lodash", "date-fns"]
           }
         }
       }
     }
   }
   ```

## 📝 Custom Domain Setup

1. **Add Custom Domain**

   ```
   Service Dashboard → Settings → Custom Domains
   Add domain: app.yourdomain.com
   ```

2. **Configure DNS**

   ```
   Type: CNAME
   Name: app
   Value: your-service.onrender.com
   ```

3. **Update Environment**
   ```bash
   ALLOWED_ORIGINS=https://app.yourdomain.com
   ```

## 🔄 CI/CD Integration

### GitHub Actions Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Render
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST \
            -H "Authorization: Bearer $RENDER_API_KEY" \
            https://api.render.com/v1/services/$SERVICE_ID/deploys
```

## 📊 Scaling Guidelines

### When to Scale

**Upgrade Database:**

- \> 1GB data
- \> 97 connections
- Slow query performance

**Upgrade Web Service:**

- Response time > 1s
- Memory usage > 80%
- CPU usage > 70%

### Scaling Options

1. **Vertical Scaling**

   - Upgrade to higher tier
   - More CPU/Memory

2. **Horizontal Scaling**
   - Enable auto-scaling
   - Configure min/max instances

## 🆘 Support Resources

- **Render Documentation**: https://render.com/docs
- **Render Status**: https://status.render.com
- **Community Forum**: https://community.render.com
- **Support**: support@render.com

## 🎉 Next Steps

1. Monitor initial deployment
2. Set up alerts for failures
3. Configure backups
4. Plan for scaling
5. Set up staging environment

---

This deployment is optimized for Render's platform and provides a production-ready configuration for the Rylie SEO Hub application.
