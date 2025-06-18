# CDN Configuration Guide for RylieSEO

## Overview
This guide explains how to configure and use the CDN (Content Delivery Network) for optimal asset delivery in production.

## Supported CDN Providers

### 1. Supabase Storage (Default)
- Built-in image transformations
- No additional setup required
- Good for small to medium projects

### 2. Cloudflare
- Global CDN with image optimization
- Automatic WebP conversion
- Polish and Mirage features

### 3. AWS CloudFront
- Integrates with S3
- Lambda@Edge for transformations
- Enterprise-grade performance

### 4. Fastly
- Real-time purging
- Instant configuration changes
- Advanced caching rules

## Environment Configuration

Add these to your `.env` file:

```bash
# CDN Provider (cloudflare, cloudfront, fastly, supabase)
CDN_PROVIDER=supabase

# CDN Base URL
CDN_BASE_URL=https://your-project.supabase.co/storage/v1/object/public

# Optional: Custom domain
CDN_CUSTOM_DOMAIN=https://cdn.yourdomain.com

# React App CDN Config
REACT_APP_CDN_URL=https://your-project.supabase.co/storage/v1/object/public
REACT_APP_CDN_PROVIDER=supabase
```

## Server Setup

The CDN middleware is automatically configured in the server. It provides:
- Proper cache headers (1 year for images, 30 days for CSS/JS)
- Security headers
- Automatic redirects to CDN URLs
- Image optimization parameters

## Frontend Usage

### Using the CDN Hook

```typescript
import { useCDN } from '@/hooks/useCDN';

function MyComponent() {
  const { getCDNUrl, getResponsiveImageUrl, getDeliverableUrl } = useCDN();

  // Basic usage
  const logoUrl = getCDNUrl('/assets/logo.png');

  // With optimization
  const heroImage = getCDNUrl('/images/hero.jpg', {
    width: 1200,
    height: 600,
    quality: 85,
    format: 'webp'
  });

  // Responsive images
  const thumbnail = getResponsiveImageUrl('/images/product.jpg', 'thumb');
  const medium = getResponsiveImageUrl('/images/product.jpg', 'medium');

  // Deliverable URLs
  const pdfUrl = getDeliverableUrl({ file_url: '/deliverables/report.pdf' });
}
```

### Using the Utility Function

```typescript
import { cdnUrl } from '@/hooks/useCDN';

// In non-React contexts
const imageUrl = cdnUrl('/images/banner.jpg', { width: 800, quality: 90 });
```

## Cloudflare Setup

1. Add your domain to Cloudflare
2. Enable these features:
   - Polish (Lossy mode)
   - Mirage
   - Hotlink Protection
   - Always Use HTTPS

3. Create Page Rules:
   ```
   *yourdomain.com/assets/*
   Cache Level: Cache Everything
   Edge Cache TTL: 1 month
   ```

4. Configure Transform Rules for images:
   ```
   /cdn-cgi/image/*
   ```

## Supabase Storage Setup

1. Create buckets in Supabase Dashboard:
   - `assets` - for static assets
   - `deliverables` - for SEO deliverables
   - `images` - for uploaded images

2. Set bucket policies:
   ```sql
   -- Public read access for assets
   CREATE POLICY "Public Access" ON storage.objects
   FOR SELECT USING (bucket_id = 'assets');
   ```

3. Enable image transformations in Supabase Dashboard

## Performance Best Practices

### 1. Image Optimization
- Use WebP format when possible
- Implement responsive images
- Lazy load below-the-fold images
- Use appropriate quality settings (80-85 for most images)

### 2. Asset Organization
```
/assets/
  /css/       # Stylesheets
  /js/        # Scripts
  /fonts/     # Web fonts
  /images/    # Static images
/deliverables/ # SEO deliverables
```

### 3. Cache Headers
Already configured in the middleware:
- Images: 1 year
- CSS/JS: 30 days
- Documents: 1 week

### 4. Preloading Critical Assets
The middleware automatically adds preload headers for:
- Main CSS file
- App JavaScript
- Primary web font

## Monitoring

### Key Metrics to Track
- Cache hit ratio (aim for >90%)
- Bandwidth usage
- Image optimization savings
- Load time improvements

### Tools
- Cloudflare Analytics
- GTmetrix
- WebPageTest
- Chrome DevTools Network tab

## Troubleshooting

### Images not loading from CDN
1. Check environment variables are set
2. Verify CDN_BASE_URL is correct
3. Ensure bucket/storage permissions are public

### Optimization not working
1. Verify CDN_PROVIDER supports transforms
2. Check image format is supported
3. Ensure query parameters are correct

### Cache not updating
1. Use cache busting with version query params
2. Purge CDN cache manually
3. Check cache headers in DevTools

## Migration Checklist

- [ ] Choose CDN provider
- [ ] Set environment variables
- [ ] Configure CDN service (Cloudflare/CloudFront/etc)
- [ ] Update image URLs in components
- [ ] Test image optimization
- [ ] Verify cache headers
- [ ] Monitor performance metrics
- [ ] Update DNS if using custom domain