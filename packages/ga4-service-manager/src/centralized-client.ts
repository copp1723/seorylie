/**
 * @file Centralized GA4 Client
 * @description Enhanced GA4 client that integrates with the service account manager
 */

import { GA4Client, GA4ClientOptions, GA4ReportResult, GA4ReportType } from '@rylie-seo/ga4-reporter';
import { GA4ServiceAccountManager, ServiceAccountConfig } from './service-account-manager';
import { TenantBranding, ReportGenerationOptions, GA4PropertyInfo } from './types';
import { generateCacheKey, calculateCacheTTL, retryWithBackoff } from './utils';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export interface CentralizedClientOptions extends Omit<GA4ClientOptions, 'keyFilePath' | 'credentials'> {
  tenantId: string;
  tenantBranding?: TenantBranding;
  cacheEnabled?: boolean;
  cacheTtlOverride?: number;
}

/**
 * Centralized GA4 Client that uses the service account manager
 */
export class CentralizedGA4Client extends GA4Client {
  private serviceAccountManager: GA4ServiceAccountManager;
  private tenantId: string;
  private tenantBranding: TenantBranding;
  private cacheEnabled: boolean;
  private reportCache: Map<string, { data: any; expiresAt: number }> = new Map();

  constructor(
    options: CentralizedClientOptions,
    serviceAccountManager: GA4ServiceAccountManager
  ) {
    // Initialize parent GA4Client with service account credentials
    super({
      ...options,
      credentials: {
        client_email: serviceAccountManager.getServiceAccountEmail(),
        private_key: '', // Will be set by service account manager
        project_id: serviceAccountManager['config'].projectId,
      },
      whiteLabelName: options.tenantBranding?.companyName || options.whiteLabelName,
      whiteLabelColorPrimary: options.tenantBranding?.primaryColor || options.whiteLabelColorPrimary,
      whiteLabelColorSecondary: options.tenantBranding?.secondaryColor || options.whiteLabelColorSecondary,
    });

    this.serviceAccountManager = serviceAccountManager;
    this.tenantId = options.tenantId;
    this.tenantBranding = options.tenantBranding || {};
    this.cacheEnabled = options.cacheEnabled !== false;

    // Override the analytics client with the service account manager's client
    this['analyticsDataClient'] = serviceAccountManager.getAnalyticsDataClient();
    this['jwtClient'] = serviceAccountManager.getAuthClient();

    logger.info({ tenantId: this.tenantId, propertyId: options.propertyId }, 'CentralizedGA4Client initialized');
  }

  /**
   * Generate a white-labeled report for the tenant
   */
  async generateTenantReport(
    reportType: GA4ReportType,
    options: Partial<ReportGenerationOptions> = {}
  ): Promise<GA4ReportResult> {
    const startTime = Date.now();
    
    try {
      // Check if we can make API calls (quota check)
      if (!this.serviceAccountManager.canMakeApiCall(this.options.propertyId)) {
        throw new Error('API quota exceeded. Please try again later.');
      }

      // Validate property access
      const accessResult = await this.serviceAccountManager.testPropertyAccess(this.options.propertyId);
      if (!accessResult.hasAccess) {
        throw new Error(`No access to GA4 property: ${accessResult.error}`);
      }

      // Generate cache key if caching is enabled
      let cacheKey: string | undefined;
      if (this.cacheEnabled && options.dateRange) {
        cacheKey = generateCacheKey(
          this.options.propertyId,
          reportType,
          options.dateRange,
          { tenantId: this.tenantId }
        );

        // Check cache first
        const cached = this.getCachedReport(cacheKey);
        if (cached) {
          logger.info({ tenantId: this.tenantId, cacheKey }, 'Report served from cache');
          return cached;
        }
      }

      // Generate the report using retry mechanism
      const report = await retryWithBackoff(async () => {
        if (options.dateRange) {
          return await this.generateReport(
            reportType,
            'custom',
            options.dateRange.startDate,
            options.dateRange.endDate
          );
        } else {
          return await this.generateReport(reportType);
        }
      });

      // Apply tenant-specific branding
      this.applyTenantBranding(report);

      // Cache the result if enabled
      if (this.cacheEnabled && cacheKey && options.dateRange) {
        const ttl = options.cacheTtl || calculateCacheTTL(options.dateRange);
        this.setCachedReport(cacheKey, report, ttl);
      }

      logger.info({
        tenantId: this.tenantId,
        propertyId: this.options.propertyId,
        reportType,
        responseTime: Date.now() - startTime,
        cached: false,
      }, 'Report generated successfully');

      return report;
    } catch (error) {
      logger.error({
        tenantId: this.tenantId,
        propertyId: this.options.propertyId,
        reportType,
        error,
        responseTime: Date.now() - startTime,
      }, 'Report generation failed');

      throw error;
    }
  }

  /**
   * Generate multiple reports in batch
   */
  async generateBatchReports(
    reportTypes: GA4ReportType[],
    options: Partial<ReportGenerationOptions> = {}
  ): Promise<Record<GA4ReportType, GA4ReportResult>> {
    const results: Record<string, GA4ReportResult> = {};
    
    // Generate reports sequentially to respect rate limits
    for (const reportType of reportTypes) {
      try {
        results[reportType] = await this.generateTenantReport(reportType, options);
        
        // Small delay between reports
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error({ tenantId: this.tenantId, reportType, error }, 'Batch report generation failed');
        
        // Continue with other reports even if one fails
        results[reportType] = {
          success: false,
          reportId: `failed-${Date.now()}`,
          reportType,
          dateRange: options.dateRange || { startDate: '', endDate: '' },
          metrics: {},
          dimensions: {},
          rows: [],
          totals: {},
          charts: [],
          error: error as Error,
        };
      }
    }

    return results as Record<GA4ReportType, GA4ReportResult>;
  }

  /**
   * Apply tenant-specific branding to the report
   */
  private applyTenantBranding(report: GA4ReportResult): void {
    // Update summary text with tenant branding
    if (report.summaryText && this.tenantBranding.companyName) {
      report.summaryText = report.summaryText.replace(
        /Rylie SEO/g,
        this.tenantBranding.companyName
      );
    }

    // Add tenant metadata to report
    (report as any).tenantBranding = {
      companyName: this.tenantBranding.companyName,
      logoUrl: this.tenantBranding.logoUrl,
      primaryColor: this.tenantBranding.primaryColor,
      secondaryColor: this.tenantBranding.secondaryColor,
      websiteUrl: this.tenantBranding.websiteUrl,
    };

    // Update chart colors if branding colors are provided
    if (this.tenantBranding.primaryColor || this.tenantBranding.secondaryColor) {
      report.charts.forEach(chart => {
        (chart as any).brandingApplied = true;
      });
    }
  }

  /**
   * Get cached report if available and not expired
   */
  private getCachedReport(cacheKey: string): GA4ReportResult | null {
    const cached = this.reportCache.get(cacheKey);
    
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      this.reportCache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Cache a report with TTL
   */
  private setCachedReport(cacheKey: string, report: GA4ReportResult, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.reportCache.set(cacheKey, {
      data: { ...report },
      expiresAt,
    });
    
    // Clean up expired entries periodically
    this.cleanupExpiredCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, value] of this.reportCache.entries()) {
      if (now > value.expiresAt) {
        this.reportCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached reports for this client
   */
  clearCache(): void {
    this.reportCache.clear();
    logger.info({ tenantId: this.tenantId }, 'Report cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    validEntries: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let expiredEntries = 0;
    let validEntries = 0;
    
    for (const [key, value] of this.reportCache.entries()) {
      if (now > value.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return {
      totalEntries: this.reportCache.size,
      expiredEntries,
      validEntries,
      memoryUsage: JSON.stringify([...this.reportCache.entries()]).length,
    };
  }

  /**
   * Test connection to the GA4 property
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    metadata?: any;
  }> {
    try {
      const result = await this.serviceAccountManager.testPropertyAccess(this.options.propertyId);
      
      return {
        success: result.hasAccess,
        error: result.error,
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get current quota usage for this property
   */
  getQuotaUsage() {
    return this.serviceAccountManager.getQuotaUsage(this.options.propertyId);
  }

  /**
   * Get tenant information
   */
  getTenantInfo(): {
    tenantId: string;
    propertyId: string;
    branding: TenantBranding;
    cacheEnabled: boolean;
  } {
    return {
      tenantId: this.tenantId,
      propertyId: this.options.propertyId,
      branding: this.tenantBranding,
      cacheEnabled: this.cacheEnabled,
    };
  }
}

/**
 * Create a new CentralizedGA4Client instance
 */
export function createCentralizedGA4Client(
  options: CentralizedClientOptions,
  serviceAccountManager: GA4ServiceAccountManager
): CentralizedGA4Client {
  return new CentralizedGA4Client(options, serviceAccountManager);
}

export default {
  CentralizedGA4Client,
  createCentralizedGA4Client,
};