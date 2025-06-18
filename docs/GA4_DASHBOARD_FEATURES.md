# GA4 Dashboard Features

## Overview

The enhanced GA4 dashboard provides real-time analytics, geographic insights, and performance metrics with advanced visualizations.

## New Features

### 1. Enhanced Analytics Dashboard
- **Route**: `/agency/analytics-enhanced`
- **Components**: Real-time traffic, metric cards with sparklines, geographic distribution
- **Auto-refresh**: Every 5 minutes (30 seconds for real-time data)

### 2. Real-Time Traffic Widget
Shows live visitor data including:
- Active users counter with pulse animation
- Device breakdown (desktop/mobile/tablet)
- Top active pages with user counts
- Geographic locations of current visitors
- Recent activity feed

### 3. Enhanced Metric Cards
- Sparkline visualizations for 7-day trends
- Trend indicators (up/down/neutral)
- Multiple format support:
  - Numbers with localization
  - Currency formatting
  - Percentage display
  - Duration (minutes:seconds)

### 4. Geographic Traffic Distribution
- Country-level analytics with detailed metrics
- City-level breakdown with conversion tracking
- Interactive tabs for different views
- Progress bars showing relative traffic

### 5. Performance Optimizations
- Server-side caching (5 minutes for analytics, 30 seconds for real-time)
- Cache headers for debugging (`X-Cache`, `X-Cache-TTL`)
- Automatic cache cleanup
- Reduced API calls by ~80%

## API Endpoints

### New Endpoints

1. **Real-Time Data**
   ```
   GET /api/ga4/realtime?propertyId={propertyId}
   ```
   Returns active users, device breakdown, top pages, and locations

2. **Geographic Data**
   ```
   GET /api/ga4/geographic?propertyId={propertyId}&startDate={date}&endDate={date}
   ```
   Returns country and city-level traffic data

### Enhanced Endpoints

All GA4 endpoints now include caching:
- `/api/ga4/analytics` - 5 minute cache
- `/api/ga4/metrics/:metric` - 5 minute cache
- `/api/ga4/export` - CSV export functionality

## Component Usage

### RealTimeTraffic
```tsx
import { RealTimeTraffic } from '@/components/dashboard/RealTimeTraffic';

<RealTimeTraffic propertyId="493777160" />
```

### MetricCardWithSparkline
```tsx
import { MetricCardWithSparkline } from '@/components/dashboard/MetricCardWithSparkline';

<MetricCardWithSparkline
  title="Total Sessions"
  value={12543}
  change={15.3}
  changeLabel="vs last period"
  icon={<Eye />}
  trend="up"
  sparklineData={[{value: 100}, {value: 120}, ...]}
  format="number" // or "currency", "percentage", "duration"
/>
```

### GeographicTraffic
```tsx
import { GeographicTraffic } from '@/components/dashboard/GeographicTraffic';

<GeographicTraffic 
  propertyId="493777160"
  dateRange={{ startDate: new Date(), endDate: new Date() }}
/>
```

## Configuration

### Property IDs
Update the property ID in the analytics page:
```tsx
const [selectedProperty, setSelectedProperty] = useState('493777160');
```

### Mock Data
The system automatically falls back to mock data when GA4 credentials aren't configured. This allows development without GA4 access.

### Caching
Adjust cache TTL in `server/middleware/ga4-cache.ts`:
```ts
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REALTIME_CACHE_TTL = 30 * 1000; // 30 seconds
```

## Dependencies

New dependencies added:
- `recharts` - Chart visualizations
- `@radix-ui/react-progress` - Progress bars

## Migration Notes

1. The enhanced dashboard coexists with the original analytics page
2. No breaking changes to existing GA4 functionality
3. All new features are opt-in via the new route
4. Backward compatible with existing GA4 service

## Performance Considerations

- Real-time data updates every 30 seconds (configurable)
- Geographic data can be heavy - limited to top 50 countries/cities
- Sparkline data limited to last 7 days to reduce payload
- Server-side caching significantly reduces GA4 API usage

## Future Enhancements

1. Custom date range picker
2. Conversion funnel visualization
3. User flow analysis
4. Custom event tracking
5. Alert system for traffic anomalies
6. Export to PDF reports