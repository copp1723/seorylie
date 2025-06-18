import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { pool } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { createHash } from 'crypto';

interface GA4ReportRequest {
  dealershipId: string;
  reportType: string;
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions?: string[];
  metrics?: string[];
  orderBys?: Array<{ metric?: { metricName: string }; desc?: boolean }>;
  limit?: number;
}

interface GA4Property {
  id: string;
  property_id: string;
  dealership_id: string;
  is_active: boolean;
  sync_status: string;
}

class GA4MultiTenantService {
  private analyticsClient: BetaAnalyticsDataClient;
  
  constructor() {
    this.analyticsClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GA4_KEY_FILE_PATH || './server/config/ga4-service-account-key.json'
    });
  }

  /**
   * Get GA4 property for a dealership
   */
  private async getPropertyForDealership(dealershipId: string): Promise<GA4Property | null> {
    const result = await pool.query(
      `SELECT * FROM ga4_properties 
       WHERE dealership_id = $1 AND is_active = true AND sync_status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealershipId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Generate cache key for report
   */
  private generateCacheKey(request: GA4ReportRequest): string {
    const cacheData = {
      dealershipId: request.dealershipId,
      reportType: request.reportType,
      dateRanges: request.dateRanges,
      dimensions: request.dimensions?.sort(),
      metrics: request.metrics?.sort()
    };
    
    return createHash('sha256')
      .update(JSON.stringify(cacheData))
      .digest('hex');
  }

  /**
   * Check cache for existing report
   */
  private async getCachedReport(cacheKey: string): Promise<any | null> {
    const result = await pool.query(
      `SELECT report_data FROM ga4_report_cache 
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey]
    );
    
    return result.rows[0]?.report_data || null;
  }

  /**
   * Save report to cache
   */
  private async cacheReport(
    request: GA4ReportRequest,
    propertyId: string,
    reportData: any,
    cacheKey: string,
    ttlMinutes: number = 60
  ): Promise<void> {
    await pool.query(
      `INSERT INTO ga4_report_cache (
        property_id, dealership_id, report_type, date_range_start, date_range_end,
        dimensions, metrics, report_data, cache_key, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '${ttlMinutes} minutes')
      ON CONFLICT (cache_key) DO UPDATE SET
        report_data = EXCLUDED.report_data,
        expires_at = EXCLUDED.expires_at`,
      [
        propertyId,
        request.dealershipId,
        request.reportType,
        request.dateRanges[0].startDate,
        request.dateRanges[0].endDate,
        JSON.stringify(request.dimensions || []),
        JSON.stringify(request.metrics || []),
        JSON.stringify(reportData),
        cacheKey
      ]
    );
  }

  /**
   * Track API usage
   */
  private async trackApiUsage(
    dealershipId: string,
    propertyId: string,
    method: string,
    responseTimeMs: number,
    statusCode: number,
    errorMessage?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO ga4_api_usage (
        dealership_id, property_id, api_method, response_time_ms, 
        status_code, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [dealershipId, propertyId, method, responseTimeMs, statusCode, errorMessage]
    );
  }

  /**
   * Run a GA4 report for a specific dealership
   */
  async runReport(request: GA4ReportRequest): Promise<any> {
    const startTime = Date.now();
    let statusCode = 200;
    let errorMessage: string | undefined;

    try {
      // 1. Get property for dealership
      const property = await this.getPropertyForDealership(request.dealershipId);
      
      if (!property) {
        throw new Error('No active GA4 property found for this dealership');
      }

      // 2. Check cache
      const cacheKey = this.generateCacheKey(request);
      const cachedData = await this.getCachedReport(cacheKey);
      
      if (cachedData) {
        logger.info('Returning cached GA4 report', {
          dealershipId: request.dealershipId,
          propertyId: property.property_id
        });
        return cachedData;
      }

      // 3. Build GA4 request
      const ga4Request: any = {
        property: `properties/${property.property_id}`,
        dateRanges: request.dateRanges,
        dimensions: request.dimensions?.map(name => ({ name })),
        metrics: request.metrics?.map(name => ({ name })),
        orderBys: request.orderBys,
        limit: request.limit || 10
      };

      // 4. Run report
      const [response] = await this.analyticsClient.runReport(ga4Request);

      // 5. Process response
      const reportData = {
        dimensionHeaders: response.dimensionHeaders,
        metricHeaders: response.metricHeaders,
        rows: response.rows?.map(row => ({
          dimensions: row.dimensionValues?.map(d => d.value),
          metrics: row.metricValues?.map(m => m.value)
        })) || [],
        rowCount: response.rowCount || 0,
        metadata: response.metadata
      };

      // 6. Cache the report
      await this.cacheReport(request, property.property_id, reportData, cacheKey);

      // 7. Track usage
      const responseTime = Date.now() - startTime;
      await this.trackApiUsage(
        request.dealershipId,
        property.property_id,
        'runReport',
        responseTime,
        statusCode
      );

      logger.info('GA4 report completed', {
        dealershipId: request.dealershipId,
        propertyId: property.property_id,
        responseTimeMs: responseTime
      });

      return reportData;

    } catch (error: any) {
      statusCode = error.code === 7 ? 403 : 500;
      errorMessage = error.message;
      
      logger.error('GA4 report error', {
        dealershipId: request.dealershipId,
        error: errorMessage
      });

      // Track failed request
      const responseTime = Date.now() - startTime;
      await this.trackApiUsage(
        request.dealershipId,
        '',
        'runReport',
        responseTime,
        statusCode,
        errorMessage
      );

      throw error;
    }
  }

  /**
   * Get common SEO metrics for a dealership
   */
  async getSEOMetrics(dealershipId: string, days: number = 30): Promise<any> {
    return this.runReport({
      dealershipId,
      reportType: 'seo_metrics',
      dateRanges: [{
        startDate: `${days}daysAgo`,
        endDate: 'today'
      }],
      dimensions: ['sessionDefaultChannelGroup', 'date'],
      metrics: [
        'sessions',
        'totalUsers',
        'screenPageViews',
        'averageSessionDuration',
        'bounceRate'
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
    });
  }

  /**
   * Get organic search traffic
   */
  async getOrganicTraffic(dealershipId: string, days: number = 30): Promise<any> {
    return this.runReport({
      dealershipId,
      reportType: 'organic_traffic',
      dateRanges: [{
        startDate: `${days}daysAgo`,
        endDate: 'today'
      }],
      dimensions: ['date', 'sessionSourceMedium'],
      metrics: ['sessions', 'totalUsers', 'newUsers'],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
    });
  }

  /**
   * Get top landing pages
   */
  async getTopLandingPages(dealershipId: string, days: number = 30): Promise<any> {
    return this.runReport({
      dealershipId,
      reportType: 'landing_pages',
      dateRanges: [{
        startDate: `${days}daysAgo`,
        endDate: 'today'
      }],
      dimensions: ['landingPage'],
      metrics: ['sessions', 'bounceRate', 'averageSessionDuration'],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20
    });
  }

  /**
   * Clear cache for a dealership
   */
  async clearCache(dealershipId: string): Promise<void> {
    await pool.query(
      'DELETE FROM ga4_report_cache WHERE dealership_id = $1',
      [dealershipId]
    );
    
    logger.info('Cleared GA4 cache for dealership', { dealershipId });
  }

  /**
   * Get API usage stats for a dealership
   */
  async getUsageStats(dealershipId: string, days: number = 30): Promise<any> {
    const result = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
       FROM ga4_api_usage
       WHERE dealership_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [dealershipId]
    );
    
    return result.rows;
  }
}

// Export singleton instance
export const ga4MultiTenantService = new GA4MultiTenantService();