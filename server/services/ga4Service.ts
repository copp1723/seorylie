import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { format, subDays } from 'date-fns';
import { ga4Auth } from './ga4Auth';

// Initialize the GA4 Data API client (lazy initialization)
let analyticsDataClient: BetaAnalyticsDataClient | null = null;

async function getAnalyticsClient(): Promise<BetaAnalyticsDataClient | null> {
  if (!analyticsDataClient && ga4Auth.isConfigured()) {
    try {
      // Get the auth instance that handles both env vars and files
      const auth = await ga4Auth.getAuthClient();
      analyticsDataClient = new BetaAnalyticsDataClient({
        auth: auth
      });
    } catch (error) {
      console.error('Failed to initialize GA4 analytics client:', error);
      return null;
    }
  }
  return analyticsDataClient;
}

// GA4 property IDs
const GA_PROPERTIES = {
  '320759942': 'Property 1',
  '317592148': 'Property 2'
};

interface GA4QueryParams {
  propertyId: string;
  startDate: string;
  endDate: string;
}

interface MetricValue {
  value: string;
}

interface DimensionValue {
  value: string;
}

interface Row {
  dimensionValues: DimensionValue[];
  metricValues: MetricValue[];
}

export class GA4Service {
  // Check if we should use mock data
  private useMockData(): boolean {
    return !ga4Auth.isConfigured();
  }

  // Get mock data for development/demo
  private getMockSummary() {
    return {
      summary: {
        sessions: 12543,
        users: 8921,
        pageviews: 34567,
        avgSessionDuration: 185.4,
        bounceRate: 42.3,
        conversions: 156
      },
      comparison: {
        sessions: 11234,
        users: 8123,
        pageviews: 31234,
        conversions: 134
      }
    };
  }

  // Fetch summary metrics and comparison data
  async getAnalyticsSummary(params: GA4QueryParams) {
    if (this.useMockData()) {
      return this.getMockSummary();
    }

    const { propertyId, startDate, endDate } = params;
    const client = await getAnalyticsClient();
    
    if (!client) {
      console.warn('GA4 client not available, returning mock data');
      return this.getMockSummary();
    }
    
    // Calculate previous period for comparison
    const currentStartDate = new Date(startDate);
    const currentEndDate = new Date(endDate);
    const daysDiff = Math.ceil((currentEndDate.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const previousStartDate = format(subDays(currentStartDate, daysDiff + 1), 'yyyy-MM-dd');
    const previousEndDate = format(subDays(currentStartDate, 1), 'yyyy-MM-dd');

    // Current period metrics
    const [currentResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate,
        endDate
      }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'conversions' }
      ]
    });

    // Previous period metrics for comparison
    const [previousResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate: previousStartDate,
        endDate: previousEndDate
      }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' }
      ]
    });

    // Extract current period values
    const currentRow = currentResponse.rows?.[0];
    const summary = {
      sessions: parseInt(currentRow?.metricValues?.[0]?.value || '0'),
      users: parseInt(currentRow?.metricValues?.[1]?.value || '0'),
      pageviews: parseInt(currentRow?.metricValues?.[2]?.value || '0'),
      avgSessionDuration: parseFloat(currentRow?.metricValues?.[3]?.value || '0'),
      bounceRate: parseFloat(currentRow?.metricValues?.[4]?.value || '0'),
      conversions: parseInt(currentRow?.metricValues?.[5]?.value || '0')
    };

    // Extract previous period values
    const previousRow = previousResponse.rows?.[0];
    const comparison = {
      sessions: parseInt(previousRow?.metricValues?.[0]?.value || '0'),
      users: parseInt(previousRow?.metricValues?.[1]?.value || '0'),
      pageviews: parseInt(previousRow?.metricValues?.[2]?.value || '0'),
      conversions: parseInt(previousRow?.metricValues?.[3]?.value || '0')
    };

    return { summary, comparison };
  }

  // Get mock daily metrics
  private getMockDailyMetrics(params: GA4QueryParams) {
    const { startDate, endDate } = params;
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const metrics = [];
    
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(endDate), days - i - 1), 'yyyy-MM-dd');
      metrics.push({
        date,
        sessions: Math.floor(Math.random() * 500) + 300,
        users: Math.floor(Math.random() * 400) + 200,
        pageviews: Math.floor(Math.random() * 1500) + 800,
        conversions: Math.floor(Math.random() * 10) + 2
      });
    }
    
    return metrics;
  }

  // Fetch daily metrics for chart
  async getDailyMetrics(params: GA4QueryParams) {
    if (this.useMockData()) {
      return this.getMockDailyMetrics(params);
    }

    const { propertyId, startDate, endDate } = params;
    const client = getAnalyticsClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'date' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' }
      ],
      orderBys: [
        {
          dimension: {
            dimensionName: 'date'
          }
        }
      ]
    });

    return response.rows?.map(row => ({
      date: row.dimensionValues?.[0]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      pageviews: parseInt(row.metricValues?.[2]?.value || '0'),
      conversions: parseInt(row.metricValues?.[3]?.value || '0')
    })) || [];
  }

  // Get mock top pages
  private getMockTopPages() {
    return [
      { pagePath: '/', pageTitle: 'Home - Auto Dealership', pageviews: 5432, avgTimeOnPage: 125, bounceRate: 35.2 },
      { pagePath: '/inventory', pageTitle: 'Vehicle Inventory', pageviews: 3241, avgTimeOnPage: 240, bounceRate: 28.5 },
      { pagePath: '/service', pageTitle: 'Service Department', pageviews: 2156, avgTimeOnPage: 180, bounceRate: 42.1 },
      { pagePath: '/about', pageTitle: 'About Us', pageviews: 1543, avgTimeOnPage: 95, bounceRate: 55.3 },
      { pagePath: '/contact', pageTitle: 'Contact Us', pageviews: 1234, avgTimeOnPage: 150, bounceRate: 38.7 }
    ];
  }

  // Fetch top pages
  async getTopPages(params: GA4QueryParams) {
    if (this.useMockData()) {
      return this.getMockTopPages();
    }

    const { propertyId, startDate, endDate } = params;
    const client = getAnalyticsClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' }
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' }
      ],
      orderBys: [
        {
          metric: {
            metricName: 'screenPageViews'
          },
          desc: true
        }
      ],
      limit: 10
    });

    return response.rows?.map(row => ({
      pagePath: row.dimensionValues?.[0]?.value || '',
      pageTitle: row.dimensionValues?.[1]?.value || '',
      pageviews: parseInt(row.metricValues?.[0]?.value || '0'),
      avgTimeOnPage: parseFloat(row.metricValues?.[1]?.value || '0'),
      bounceRate: parseFloat(row.metricValues?.[2]?.value || '0')
    })) || [];
  }

  // Get mock traffic sources
  private getMockTrafficSources() {
    return [
      { source: 'google', medium: 'organic', sessions: 4532, users: 3421, conversions: 45 },
      { source: 'direct', medium: '(none)', sessions: 2341, users: 1892, conversions: 32 },
      { source: 'facebook', medium: 'social', sessions: 1234, users: 998, conversions: 12 },
      { source: 'bing', medium: 'organic', sessions: 876, users: 654, conversions: 8 },
      { source: 'referral', medium: 'website', sessions: 543, users: 432, conversions: 5 }
    ];
  }

  // Fetch traffic sources
  async getTrafficSources(params: GA4QueryParams) {
    if (this.useMockData()) {
      return this.getMockTrafficSources();
    }

    const { propertyId, startDate, endDate } = params;
    const client = getAnalyticsClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' }
      ],
      orderBys: [
        {
          metric: {
            metricName: 'sessions'
          },
          desc: true
        }
      ],
      limit: 10
    });

    return response.rows?.map(row => ({
      source: row.dimensionValues?.[0]?.value || '',
      medium: row.dimensionValues?.[1]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      conversions: parseInt(row.metricValues?.[2]?.value || '0')
    })) || [];
  }

  // Fetch search queries from Search Console
  async getSearchQueries(params: GA4QueryParams) {
    // Note: This requires Search Console API integration
    // For now, returning mock data structure
    // TODO: Implement actual Search Console API integration
    
    return [
      {
        query: 'auto repair near me',
        impressions: 1250,
        clicks: 125,
        position: 3.2,
        ctr: 0.10
      },
      {
        query: 'oil change service',
        impressions: 850,
        clicks: 102,
        position: 2.8,
        ctr: 0.12
      },
      {
        query: 'brake repair shop',
        impressions: 650,
        clicks: 58,
        position: 4.5,
        ctr: 0.089
      },
      {
        query: 'transmission repair',
        impressions: 420,
        clicks: 42,
        position: 5.2,
        ctr: 0.10
      },
      {
        query: 'auto body shop',
        impressions: 380,
        clicks: 30,
        position: 6.1,
        ctr: 0.079
      }
    ];
  }

  // Main method to get all analytics data
  async getAnalyticsData(params: GA4QueryParams) {
    try {
      const [summary, dailyMetrics, topPages, trafficSources, searchQueries] = await Promise.all([
        this.getAnalyticsSummary(params),
        this.getDailyMetrics(params),
        this.getTopPages(params),
        this.getTrafficSources(params),
        this.getSearchQueries(params)
      ]);

      return {
        ...summary,
        dailyMetrics,
        topPages,
        trafficSources,
        searchQueries
      };
    } catch (error) {
      console.error('Error fetching GA4 data:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }

  // Verify property access
  async verifyPropertyAccess(propertyId: string): Promise<boolean> {
    if (this.useMockData()) {
      // In mock mode, always return true for our known properties
      return ['320759942', '317592148'].includes(propertyId);
    }

    try {
      const client = getAnalyticsClient();
      const [response] = await client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{
          startDate: '2024-01-01',
          endDate: '2024-01-01'
        }],
        metrics: [{ name: 'sessions' }]
      });
      
      return true;
    } catch (error) {
      console.error(`No access to property ${propertyId}:`, error);
      return false;
    }
  }

  // Get real-time data
  async getRealTimeData(propertyId: string) {
    if (this.useMockData()) {
      return this.getMockRealTimeData();
    }

    const client = getAnalyticsClient();
    
    try {
      const [response] = await client.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: [
          { name: 'country' },
          { name: 'city' },
          { name: 'deviceCategory' },
          { name: 'unifiedScreenName' }
        ],
        metrics: [
          { name: 'activeUsers' }
        ]
      });

      // Process the response
      const activeUsers = parseInt(response.rowCount?.toString() || '0');
      const devices = { desktop: 0, mobile: 0, tablet: 0 };
      const locations: any[] = [];
      const topPages: any[] = [];
      const pageViews: { [key: string]: number } = {};

      response.rows?.forEach(row => {
        const country = row.dimensionValues?.[0]?.value || '';
        const city = row.dimensionValues?.[1]?.value || '';
        const device = row.dimensionValues?.[2]?.value || '';
        const page = row.dimensionValues?.[3]?.value || '';
        const users = parseInt(row.metricValues?.[0]?.value || '0');

        // Count devices
        if (device.toLowerCase() === 'desktop') devices.desktop += users;
        else if (device.toLowerCase() === 'mobile') devices.mobile += users;
        else if (device.toLowerCase() === 'tablet') devices.tablet += users;

        // Track locations
        const locationKey = `${city}, ${country}`;
        const existingLocation = locations.find(l => l.city === city && l.country === country);
        if (existingLocation) {
          existingLocation.users += users;
        } else {
          locations.push({ country, city, users });
        }

        // Track pages
        if (pageViews[page]) {
          pageViews[page] += users;
        } else {
          pageViews[page] = users;
        }
      });

      // Sort and format top pages
      Object.entries(pageViews)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([page, users]) => {
          topPages.push({
            page,
            users,
            percentage: (users / activeUsers) * 100
          });
        });

      // Sort locations by users
      locations.sort((a, b) => b.users - a.users);

      return {
        activeUsers,
        pageViewsPerMinute: Math.round(activeUsers * 2.5), // Estimate
        avgSessionDuration: 185, // Estimate in seconds
        topPages,
        devices,
        locations: locations.slice(0, 10),
        activeUsersList: [] // Privacy: don't return individual user data
      };
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      return this.getMockRealTimeData();
    }
  }

  // Get mock real-time data
  private getMockRealTimeData() {
    return {
      activeUsers: 24,
      pageViewsPerMinute: 62,
      avgSessionDuration: 245,
      topPages: [
        { page: '/inventory', users: 12, percentage: 50 },
        { page: '/', users: 8, percentage: 33.3 },
        { page: '/service', users: 3, percentage: 12.5 },
        { page: '/contact', users: 1, percentage: 4.2 }
      ],
      devices: {
        desktop: 14,
        mobile: 8,
        tablet: 2
      },
      locations: [
        { country: 'United States', city: 'New York', users: 5 },
        { country: 'United States', city: 'Los Angeles', users: 4 },
        { country: 'United States', city: 'Chicago', users: 3 },
        { country: 'Canada', city: 'Toronto', users: 2 },
        { country: 'United Kingdom', city: 'London', users: 2 }
      ],
      activeUsersList: []
    };
  }

  // Get geographic data
  async getGeographicData(params: GA4QueryParams) {
    if (this.useMockData()) {
      return this.getMockGeographicData();
    }

    const { propertyId, startDate, endDate } = params;
    const client = getAnalyticsClient();

    // Fetch country data
    const [countryResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'country' },
        { name: 'countryId' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' }
      ],
      orderBys: [{
        metric: { metricName: 'sessions' },
        desc: true
      }],
      limit: 50
    });

    // Fetch city data
    const [cityResponse] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate,
        endDate
      }],
      dimensions: [
        { name: 'city' },
        { name: 'region' },
        { name: 'country' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' }
      ],
      orderBys: [{
        metric: { metricName: 'sessions' },
        desc: true
      }],
      limit: 50
    });

    // Process country data
    const totalSessions = countryResponse.rows?.reduce((sum, row) => 
      sum + parseInt(row.metricValues?.[0]?.value || '0'), 0) || 1;

    const countries = countryResponse.rows?.map(row => ({
      country: row.dimensionValues?.[0]?.value || '',
      countryCode: row.dimensionValues?.[1]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      newUsers: parseInt(row.metricValues?.[2]?.value || '0'),
      bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
      avgSessionDuration: parseFloat(row.metricValues?.[4]?.value || '0'),
      conversions: parseInt(row.metricValues?.[5]?.value || '0'),
      percentage: (parseInt(row.metricValues?.[0]?.value || '0') / totalSessions) * 100
    })) || [];

    // Process city data
    const totalCitySessions = cityResponse.rows?.reduce((sum, row) => 
      sum + parseInt(row.metricValues?.[0]?.value || '0'), 0) || 1;

    const cities = cityResponse.rows?.map(row => ({
      city: row.dimensionValues?.[0]?.value || '',
      region: row.dimensionValues?.[1]?.value || '',
      country: row.dimensionValues?.[2]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      conversions: parseInt(row.metricValues?.[2]?.value || '0'),
      percentage: (parseInt(row.metricValues?.[0]?.value || '0') / totalCitySessions) * 100
    })) || [];

    return {
      countries,
      cities,
      summary: {
        totalCountries: countries.length,
        totalCities: cities.length,
        topCountry: countries[0]?.country || 'N/A',
        topCity: cities[0]?.city || 'N/A'
      }
    };
  }

  // Get mock geographic data
  private getMockGeographicData() {
    const countries = [
      {
        country: 'United States',
        countryCode: 'US',
        sessions: 8543,
        users: 6234,
        newUsers: 4532,
        bounceRate: 42.3,
        avgSessionDuration: 245,
        conversions: 123,
        percentage: 65.2
      },
      {
        country: 'Canada',
        countryCode: 'CA',
        sessions: 2341,
        users: 1876,
        newUsers: 1234,
        bounceRate: 38.5,
        avgSessionDuration: 198,
        conversions: 34,
        percentage: 17.9
      },
      {
        country: 'United Kingdom',
        countryCode: 'GB',
        sessions: 1234,
        users: 987,
        newUsers: 654,
        bounceRate: 45.2,
        avgSessionDuration: 176,
        conversions: 12,
        percentage: 9.4
      }
    ];

    const cities = [
      {
        city: 'New York',
        region: 'New York',
        country: 'United States',
        sessions: 2341,
        users: 1876,
        conversions: 45,
        percentage: 17.9
      },
      {
        city: 'Los Angeles',
        region: 'California',
        country: 'United States',
        sessions: 1876,
        users: 1432,
        conversions: 32,
        percentage: 14.3
      },
      {
        city: 'Toronto',
        region: 'Ontario',
        country: 'Canada',
        sessions: 1234,
        users: 987,
        conversions: 23,
        percentage: 9.4
      }
    ];

    return {
      countries,
      cities,
      summary: {
        totalCountries: countries.length,
        totalCities: cities.length,
        topCountry: countries[0].country,
        topCity: cities[0].city
      }
    };
  }
}

export const ga4Service = new GA4Service();