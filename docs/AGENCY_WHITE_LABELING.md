# Agency White-Labeling Implementation Guide

## Overview
This document describes the agency white-labeling system for RylieSEO, enabling multiple agencies to have their own branded experience while using the same platform.

## Architecture

### Database Schema
The white-labeling system uses the following core tables:

1. **agencies** - Master agency records
2. **agency_branding** - Customization settings per agency
3. **user_agencies** - User-to-agency associations
4. **dealerships** - Dealerships managed by agencies

### Key Features

#### 1. Dynamic Branding
- **CSS Variables**: Primary, secondary, and accent colors
- **Logo & Favicon**: Custom uploads per agency
- **Font Selection**: Multiple font options
- **Theme Support**: Light, dark, and auto modes
- **Custom CSS**: Advanced styling overrides

#### 2. Subdomain Routing
- Agencies can have subdomains: `velocity.rylieseo.com`
- Custom domains: `seo.velocitymotors.com`
- Automatic branding detection based on hostname

#### 3. Performance Optimizations
- **Multi-layer caching**: Memory → SessionStorage → IndexedDB
- **1-hour TTL** for branding data
- **Cache warming** on user login
- **Performance monitoring** built-in

## Implementation Steps

### 1. Run Database Migration
```bash
# Apply the agency branding schema
psql $DATABASE_URL -f migrations/0019_agency_branding.sql
```

### 2. Update Application Providers
```tsx
// In your main App.tsx
import { BrandingProvider } from './contexts/AgencyBrandingContext';

function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        {/* Your app components */}
      </BrandingProvider>
    </AuthProvider>
  );
}
```

### 3. Add Branding Preview Page
```tsx
// In your admin routes
import { BrandingPreview } from './components/BrandingPreview';

<Route path="/admin/branding" element={<BrandingPreview />} />
```

### 4. Configure API Routes
```javascript
// In your Express server
import { agencyBrandingRoutes } from './routes/agency-branding';

app.use('/api/agency', agencyBrandingRoutes);
```

### 5. Set Up Subdomain Routing
For NGINX:
```nginx
server {
    server_name ~^(?<subdomain>.+)\.rylieseo\.com$;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Subdomain $subdomain;
    }
}
```

## Usage Examples

### Creating an Agency
```sql
-- Insert new agency
INSERT INTO agencies (name, slug, status) 
VALUES ('Velocity SEO', 'velocity', 'active');

-- Add branding
INSERT INTO agency_branding (
    agency_id, 
    company_name, 
    primary_color, 
    subdomain
) VALUES (
    '{{agency_id}}', 
    'VelocitySEO', 
    '#dc2626', 
    'velocity'
);
```

### Updating Branding via API
```javascript
// Update agency colors
await fetch('/api/agency/branding/{{agency_id}}', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    primary_color: '#dc2626',
    secondary_color: '#991b1b',
    theme: 'dark'
  })
});
```

### Using the BrandingContext
```tsx
import { useBranding } from '../contexts/AgencyBrandingContext';

function MyComponent() {
  const { branding, updateBranding, previewBranding } = useBranding();
  
  // Access current branding
  console.log(branding.company_name);
  
  // Preview changes
  previewBranding({ primary_color: '#ff0000' });
  
  // Save changes
  await updateBranding({ primary_color: '#ff0000' });
}
```

## Performance Monitoring

### Cache Statistics
```javascript
import { PerformanceMonitor } from '../utils/performanceOptimizations';

const monitor = new PerformanceMonitor();

// Track operations
const start = performance.now();
const branding = await fetchBranding();
monitor.track('branding_fetch', performance.now() - start, wasCached);

// Get report
const report = monitor.getReport();
console.log(report);
// Output: { branding_fetch_hit: { count: 85, avgDuration: 2.5 } }
```

### Monitoring Dashboard
Access performance metrics at: `/api/agency/performance/stats`

## Security Considerations

1. **Row Level Security**: All tables have RLS policies
2. **Role-based Access**: Only agency admins can update branding
3. **Input Validation**: Color formats and file types are validated
4. **CORS**: Subdomain requests are properly handled

## Troubleshooting

### Common Issues

1. **Branding not loading**
   - Check subdomain configuration
   - Verify user has agency access
   - Clear browser cache

2. **Performance issues**
   - Monitor cache hit rates
   - Check IndexedDB storage limits
   - Review custom CSS complexity

3. **Preview mode stuck**
   - Call `resetPreview()` method
   - Refresh the page
   - Check console for errors

### Debug Mode
Enable debug logging:
```javascript
localStorage.setItem('DEBUG_BRANDING', 'true');
```

## Future Enhancements

1. **A/B Testing**: Test different brandings
2. **Branding Templates**: Pre-built themes
3. **Advanced Analytics**: Track branding effectiveness
4. **CDN Integration**: Serve assets from edge locations
5. **Mobile App Support**: React Native integration

## Support
For issues or questions:
- Check logs in Supabase dashboard
- Review browser console errors
- Contact: support@rylieseo.com
