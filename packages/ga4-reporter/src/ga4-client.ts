/**
 * @file Google Analytics 4 Client for fetching and processing analytics data
 * @description Provides a comprehensive client for GA4 API with authentication, data fetching, and report generation
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { JWT } from "google-auth-library";
import { google } from "googleapis";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { format, subDays } from "date-fns";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { GA4Report } from "@rylie-seo/seo-schema";

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

/**
 * Configuration options for GA4 client
 */
export interface GA4ClientOptions {
  // Authentication options
  keyFilePath?: string;
  credentials?: {
    client_email: string;
    private_key: string;
    project_id: string;
  };

  // GA4 property options
  propertyId: string;
  viewId?: string;

  // Reporting options
  defaultDateRange?: "last7days" | "last30days" | "last90days" | "custom";
  customStartDate?: string;
  customEndDate?: string;

  // Branding options
  whiteLabelName?: string;
  whiteLabelLogoPath?: string;
  whiteLabelColorPrimary?: string;
  whiteLabelColorSecondary?: string;

  // Output options
  outputDir?: string;

  // Chart options
  chartWidth?: number;
  chartHeight?: number;
  chartBackgroundColor?: string;
  chartFontFamily?: string;
}

/**
 * GA4 Report Type
 */
export enum GA4ReportType {
  OVERVIEW = "overview",
  TRAFFIC = "traffic",
  ENGAGEMENT = "engagement",
  CONVERSION = "conversion",
  PAGES = "pages",
  KEYWORDS = "keywords",
  DEVICES = "devices",
  CUSTOM = "custom",
}

/**
 * GA4 Metric Type
 */
export enum GA4MetricType {
  // Traffic metrics
  SESSIONS = "sessions",
  USERS = "users",
  NEW_USERS = "newUsers",
  PAGE_VIEWS = "pageViews",

  // Engagement metrics
  ENGAGEMENT_RATE = "engagementRate",
  AVERAGE_SESSION_DURATION = "averageSessionDuration",
  PAGES_PER_SESSION = "pagesPerSession",
  BOUNCE_RATE = "bounceRate",

  // Conversion metrics
  CONVERSIONS = "conversions",
  CONVERSION_RATE = "conversionRate",
  GOAL_COMPLETIONS = "goalCompletions",
  GOAL_VALUE = "goalValue",

  // Ecommerce metrics
  TRANSACTIONS = "transactions",
  REVENUE = "revenue",
  AVERAGE_ORDER_VALUE = "averageOrderValue",
  ECOMMERCE_CONVERSION_RATE = "ecommerceConversionRate",
}

/**
 * GA4 Dimension Type
 */
export enum GA4DimensionType {
  DATE = "date",
  WEEK = "week",
  MONTH = "month",

  // Traffic sources
  SOURCE = "source",
  MEDIUM = "medium",
  CAMPAIGN = "campaign",

  // Content
  PAGE_PATH = "pagePath",
  PAGE_TITLE = "pageTitle",
  LANDING_PAGE = "landingPage",
  EXIT_PAGE = "exitPage",

  // User
  DEVICE_CATEGORY = "deviceCategory",
  BROWSER = "browser",
  OPERATING_SYSTEM = "operatingSystem",
  COUNTRY = "country",
  CITY = "city",

  // Custom
  CUSTOM_DIMENSION = "customDimension",
}

/**
 * GA4 Report Result
 */
export interface GA4ReportResult {
  success: boolean;
  reportId: string;
  reportType: GA4ReportType;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: Record<string, number | string>;
  dimensions: Record<string, string[]>;
  rows: Record<string, any>[];
  totals: Record<string, number | string>;
  charts: {
    filePath?: string;
    base64Data?: string;
    chartType: string;
    title: string;
  }[];
  summaryText?: string;
  error?: Error;
}

/**
 * GA4 Client for fetching and processing analytics data
 */
export class GA4Client {
  private analyticsDataClient!: BetaAnalyticsDataClient;
  private analyticsAdmin: any;
  private jwtClient!: JWT;
  private options: GA4ClientOptions;
  private chartJSCanvas: ChartJSNodeCanvas;

  /**
   * Create a new GA4Client instance
   * @param options Configuration options for GA4 client
   */
  constructor(options: GA4ClientOptions) {
    this.options = {
      defaultDateRange: "last30days",
      whiteLabelName: "Rylie SEO",
      whiteLabelColorPrimary: "#4A90E2",
      whiteLabelColorSecondary: "#50E3C2",
      outputDir: path.join(process.cwd(), "reports"),
      chartWidth: 800,
      chartHeight: 400,
      chartBackgroundColor: "#FFFFFF",
      chartFontFamily: "Arial, sans-serif",
      ...options,
    };

    // Initialize Google Analytics clients
    this.initializeClients();

    // Initialize ChartJS canvas
    this.chartJSCanvas = new ChartJSNodeCanvas({
      width: this.options.chartWidth || 800,
      height: this.options.chartHeight || 400,
      backgroundColour: this.options.chartBackgroundColor || "#FFFFFF",
    });
  }

  /**
   * Initialize Google Analytics clients
   */
  private initializeClients(): void {
    try {
      // Initialize JWT client for authentication
      if (this.options.keyFilePath) {
        // Use key file if provided
        this.jwtClient = new JWT({
          keyFile: this.options.keyFilePath,
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        });
      } else if (this.options.credentials) {
        // Use credentials if provided
        this.jwtClient = new JWT({
          email: this.options.credentials.client_email,
          key: this.options.credentials.private_key,
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        });
      } else {
        // Use application default credentials
        this.jwtClient = new JWT({
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        });
      }

      // Initialize Analytics Data API client
      this.analyticsDataClient = new BetaAnalyticsDataClient({
        auth: this.jwtClient as any,
      });

      // Initialize Analytics Admin API client
      this.analyticsAdmin = google.analyticsadmin({
        version: "v1alpha",
        auth: this.jwtClient,
      });

      logger.info("GA4Client initialized successfully");
    } catch (error) {
      logger.error({ error }, "Failed to initialize GA4Client");
      throw new Error(
        `Failed to initialize GA4Client: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get date range for GA4 queries
   * @param dateRange Date range option
   * @param customStartDate Custom start date (YYYY-MM-DD)
   * @param customEndDate Custom end date (YYYY-MM-DD)
   * @returns Object with startDate and endDate
   */
  private getDateRange(
    dateRange: "last7days" | "last30days" | "last90days" | "custom" = this
      .options.defaultDateRange || "last30days",
    customStartDate?: string,
    customEndDate?: string,
  ): { startDate: string; endDate: string } {
    const today = new Date();
    const endDate = format(today, "yyyy-MM-dd");
    let startDate: string;

    switch (dateRange) {
      case "last7days":
        startDate = format(subDays(today, 7), "yyyy-MM-dd");
        break;
      case "last30days":
        startDate = format(subDays(today, 30), "yyyy-MM-dd");
        break;
      case "last90days":
        startDate = format(subDays(today, 90), "yyyy-MM-dd");
        break;
      case "custom":
        if (!customStartDate || !customEndDate) {
          throw new Error(
            "Custom date range requires customStartDate and customEndDate",
          );
        }
        startDate = customStartDate;
        return { startDate, endDate: customEndDate };
      default:
        startDate = format(subDays(today, 30), "yyyy-MM-dd");
    }

    return { startDate, endDate };
  }

  /**
   * Run a GA4 report query
   * @param metrics Array of metrics to query
   * @param dimensions Array of dimensions to query
   * @param dateRange Date range option
   * @param customStartDate Custom start date (YYYY-MM-DD)
   * @param customEndDate Custom end date (YYYY-MM-DD)
   * @param filters Optional filters to apply
   * @returns Promise with report data
   */
  public async runReport(
    metrics: string[],
    dimensions: string[] = [],
    dateRange: "last7days" | "last30days" | "last90days" | "custom" = this
      .options.defaultDateRange || "last30days",
    customStartDate?: string,
    customEndDate?: string,
    filters: any = {},
  ): Promise<any> {
    try {
      const { startDate, endDate } = this.getDateRange(
        dateRange,
        customStartDate,
        customEndDate,
      );

      // Format metrics and dimensions for GA4 API
      const formattedMetrics = metrics.map((metric) => ({
        name: metric,
      }));

      const formattedDimensions = dimensions.map((dimension) => ({
        name: dimension,
      }));

      // Build request
      const request = {
        property: `properties/${this.options.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: formattedMetrics,
        dimensions: formattedDimensions,
      };

      // Add filters if provided
      if (Object.keys(filters).length > 0) {
        (request as any).dimensionFilter = this.buildDimensionFilter(filters);
      }

      // Run the report
      const [response] = await this.analyticsDataClient.runReport(request);

      // Process the response
      return this.processReportResponse(response);
    } catch (error) {
      logger.error(
        { error, metrics, dimensions, dateRange },
        "Failed to run GA4 report",
      );
      throw new Error(`Failed to run GA4 report: ${(error as Error).message}`);
    }
  }

  /**
   * Build dimension filter for GA4 API
   * @param filters Object with filter conditions
   * @returns Dimension filter object for GA4 API
   */
  private buildDimensionFilter(filters: Record<string, any>): any {
    const dimensionFilterClauses = [];

    // Process each filter
    for (const [dimension, value] of Object.entries(filters)) {
      if (typeof value === "string") {
        // Simple string filter
        dimensionFilterClauses.push({
          filter: {
            fieldName: dimension,
            stringFilter: {
              matchType: "EXACT",
              value,
            },
          },
        });
      } else if (Array.isArray(value)) {
        // Array of values (IN operator)
        dimensionFilterClauses.push({
          filter: {
            fieldName: dimension,
            inListFilter: {
              values: value,
            },
          },
        });
      } else if (typeof value === "object") {
        // Complex filter with operator
        const { operator, value: filterValue } = value;

        if (operator === "REGEXP") {
          dimensionFilterClauses.push({
            filter: {
              fieldName: dimension,
              stringFilter: {
                matchType: "REGEXP",
                value: filterValue,
              },
            },
          });
        } else if (operator === "BEGINS_WITH") {
          dimensionFilterClauses.push({
            filter: {
              fieldName: dimension,
              stringFilter: {
                matchType: "BEGINS_WITH",
                value: filterValue,
              },
            },
          });
        } else if (operator === "CONTAINS") {
          dimensionFilterClauses.push({
            filter: {
              fieldName: dimension,
              stringFilter: {
                matchType: "CONTAINS",
                value: filterValue,
              },
            },
          });
        }
      }
    }

    // Return filter expression
    return {
      andGroup: {
        expressions: dimensionFilterClauses,
      },
    };
  }

  /**
   * Process GA4 report response
   * @param response Response from GA4 API
   * @returns Processed report data
   */
  private processReportResponse(response: any): any {
    // Extract dimensions and metrics
    const dimensionHeaders = response.dimensionHeaders.map(
      (header: any) => header.name,
    );
    const metricHeaders = response.metricHeaders.map(
      (header: any) => header.name,
    );

    // Process rows
    const rows = [];

    if (response.rows) {
      for (const row of response.rows) {
        const rowData: any = {};

        // Process dimensions
        row.dimensionValues.forEach((value: any, index: number) => {
          rowData[dimensionHeaders[index]] = value.value;
        });

        // Process metrics
        row.metricValues.forEach((value: any, index: number) => {
          rowData[metricHeaders[index]] = value.value;
        });

        rows.push(rowData);
      }
    }

    // Process totals
    const totals: any = {};

    if (response.totals && response.totals.length > 0) {
      response.totals[0].metricValues.forEach((value: any, index: number) => {
        totals[metricHeaders[index]] = value.value;
      });
    }

    // Return processed data
    return {
      dimensions: dimensionHeaders,
      metrics: metricHeaders,
      rows,
      totals,
      rowCount: rows.length,
    };
  }

  /**
   * Generate a GA4 report with charts and summary
   * @param reportType Type of report to generate
   * @param dateRange Date range for the report
   * @param customStartDate Custom start date (YYYY-MM-DD)
   * @param customEndDate Custom end date (YYYY-MM-DD)
   * @returns Promise with report result
   */
  public async generateReport(
    reportType: GA4ReportType = GA4ReportType.OVERVIEW,
    dateRange: "last7days" | "last30days" | "last90days" | "custom" = this
      .options.defaultDateRange || "last30days",
    customStartDate?: string,
    customEndDate?: string,
  ): Promise<GA4ReportResult> {
    try {
      const reportId = uuidv4();
      const { startDate, endDate } = this.getDateRange(
        dateRange,
        customStartDate,
        customEndDate,
      );

      // Initialize result object
      const result: GA4ReportResult = {
        success: false,
        reportId,
        reportType,
        dateRange: { startDate, endDate },
        metrics: {},
        dimensions: {},
        rows: [],
        totals: {},
        charts: [],
      };

      // Run appropriate report based on type
      switch (reportType) {
        case GA4ReportType.OVERVIEW:
          await this.generateOverviewReport(result);
          break;
        case GA4ReportType.TRAFFIC:
          await this.generateTrafficReport(result);
          break;
        case GA4ReportType.ENGAGEMENT:
          await this.generateEngagementReport(result);
          break;
        case GA4ReportType.CONVERSION:
          await this.generateConversionReport(result);
          break;
        case GA4ReportType.PAGES:
          await this.generatePagesReport(result);
          break;
        case GA4ReportType.KEYWORDS:
          await this.generateKeywordsReport(result);
          break;
        case GA4ReportType.DEVICES:
          await this.generateDevicesReport(result);
          break;
        case GA4ReportType.CUSTOM:
          // Custom reports should be handled separately
          throw new Error(
            "Custom reports should be generated using runReport method",
          );
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Generate summary text
      result.summaryText = await this.generateSummaryText(result);

      // Mark as successful
      result.success = true;

      return result;
    } catch (error) {
      logger.error(
        { error, reportType, dateRange },
        "Failed to generate GA4 report",
      );

      return {
        success: false,
        reportId: uuidv4(),
        reportType,
        dateRange: this.getDateRange(dateRange, customStartDate, customEndDate),
        metrics: {},
        dimensions: {},
        rows: [],
        totals: {},
        charts: [],
        error: error as Error,
      };
    }
  }

  /**
   * Generate overview report
   * @param result Report result object to update
   */
  private async generateOverviewReport(result: GA4ReportResult): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run sessions by date report
    const sessionsReport = await this.runReport(
      [
        "sessions",
        "users",
        "newUsers",
        "engagementRate",
        "averageSessionDuration",
      ],
      ["date"],
      "custom",
      startDate,
      endDate,
    );

    // Run traffic source report
    const trafficSourceReport = await this.runReport(
      ["sessions", "users"],
      ["sessionSource", "sessionMedium"],
      "custom",
      startDate,
      endDate,
    );

    // Run top pages report
    const topPagesReport = await this.runReport(
      ["screenPageViews", "averageSessionDuration"],
      ["pageTitle", "pagePath"],
      "custom",
      startDate,
      endDate,
    );

    // Run device category report
    const deviceReport = await this.runReport(
      ["sessions", "users"],
      ["deviceCategory"],
      "custom",
      startDate,
      endDate,
    );

    // Update result with report data
    result.rows = [...sessionsReport.rows];
    result.totals = { ...sessionsReport.totals };

    // Add dimensions
    result.dimensions = {
      dates: sessionsReport.rows.map((row: any) => row.date),
      trafficSources: trafficSourceReport.rows.map(
        (row: any) => `${row.sessionSource} / ${row.sessionMedium}`,
      ),
      pages: topPagesReport.rows.slice(0, 10).map((row: any) => row.pageTitle),
      devices: deviceReport.rows.map((row: any) => row.deviceCategory),
    };

    // Add metrics
    result.metrics = {
      sessions: sessionsReport.totals.sessions,
      users: sessionsReport.totals.users,
      newUsers: sessionsReport.totals.newUsers,
      engagementRate: sessionsReport.totals.engagementRate,
      averageSessionDuration: sessionsReport.totals.averageSessionDuration,
    };

    // Generate charts
    const sessionsTrendChart = await this.generateLineChart(
      "Sessions Trend",
      sessionsReport.rows.map((row: any) => row.date),
      [
        {
          label: "Sessions",
          data: sessionsReport.rows.map((row: any) => row.sessions),
          borderColor: this.options.whiteLabelColorPrimary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorPrimary || "#4A90E2",
            0.1,
          ),
        },
        {
          label: "Users",
          data: sessionsReport.rows.map((row: any) => row.users),
          borderColor: this.options.whiteLabelColorSecondary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorSecondary || "#50E3C2",
            0.1,
          ),
        },
      ],
    );

    const trafficSourceChart = await this.generatePieChart(
      "Traffic Sources",
      trafficSourceReport.rows
        .slice(0, 5)
        .map((row: any) => `${row.sessionSource} / ${row.sessionMedium}`),
      trafficSourceReport.rows.slice(0, 5).map((row: any) => row.sessions),
    );

    const deviceChart = await this.generatePieChart(
      "Device Categories",
      deviceReport.rows.map((row: any) => row.deviceCategory),
      deviceReport.rows.map((row: any) => row.sessions),
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "line",
        title: "Sessions Trend",
        base64Data: sessionsTrendChart,
      },
      {
        chartType: "pie",
        title: "Traffic Sources",
        base64Data: trafficSourceChart,
      },
      {
        chartType: "pie",
        title: "Device Categories",
        base64Data: deviceChart,
      },
    ];
  }

  /**
   * Generate traffic report
   * @param result Report result object to update
   */
  private async generateTrafficReport(result: GA4ReportResult): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run sessions by date report
    const sessionsReport = await this.runReport(
      ["sessions", "users", "newUsers", "bounceRate"],
      ["date"],
      "custom",
      startDate,
      endDate,
    );

    // Run traffic source report
    const trafficSourceReport = await this.runReport(
      ["sessions", "users", "newUsers", "bounceRate"],
      ["sessionSource", "sessionMedium"],
      "custom",
      startDate,
      endDate,
    );

    // Run referral report
    const referralReport = await this.runReport(
      ["sessions", "users"],
      ["sessionSource"],
      "custom",
      startDate,
      endDate,
      { sessionMedium: "referral" },
    );

    // Update result with report data
    result.rows = [...trafficSourceReport.rows];
    result.totals = { ...sessionsReport.totals };

    // Add dimensions
    result.dimensions = {
      dates: sessionsReport.rows.map((row: any) => row.date),
      trafficSources: trafficSourceReport.rows.map(
        (row: any) => `${row.sessionSource} / ${row.sessionMedium}`,
      ),
      referrals: referralReport.rows.map((row: any) => row.sessionSource),
    };

    // Add metrics
    result.metrics = {
      sessions: sessionsReport.totals.sessions,
      users: sessionsReport.totals.users,
      newUsers: sessionsReport.totals.newUsers,
      bounceRate: sessionsReport.totals.bounceRate,
    };

    // Generate charts
    const sessionsTrendChart = await this.generateLineChart(
      "Traffic Trend",
      sessionsReport.rows.map((row: any) => row.date),
      [
        {
          label: "Sessions",
          data: sessionsReport.rows.map((row: any) => row.sessions),
          borderColor: this.options.whiteLabelColorPrimary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorPrimary || "#4A90E2",
            0.1,
          ),
        },
        {
          label: "Users",
          data: sessionsReport.rows.map((row: any) => row.users),
          borderColor: this.options.whiteLabelColorSecondary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorSecondary || "#50E3C2",
            0.1,
          ),
        },
      ],
    );

    const trafficSourceChart = await this.generatePieChart(
      "Traffic Sources",
      trafficSourceReport.rows
        .slice(0, 5)
        .map((row: any) => `${row.sessionSource} / ${row.sessionMedium}`),
      trafficSourceReport.rows.slice(0, 5).map((row: any) => row.sessions),
    );

    const referralChart = await this.generateBarChart(
      "Top Referrals",
      referralReport.rows.slice(0, 10).map((row: any) => row.sessionSource),
      [
        {
          label: "Sessions",
          data: referralReport.rows
            .slice(0, 10)
            .map((row: any) => row.sessions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "line",
        title: "Traffic Trend",
        base64Data: sessionsTrendChart,
      },
      {
        chartType: "pie",
        title: "Traffic Sources",
        base64Data: trafficSourceChart,
      },
      {
        chartType: "bar",
        title: "Top Referrals",
        base64Data: referralChart,
      },
    ];
  }

  /**
   * Generate engagement report
   * @param result Report result object to update
   */
  private async generateEngagementReport(
    result: GA4ReportResult,
  ): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run engagement by date report
    const engagementReport = await this.runReport(
      [
        "engagementRate",
        "averageSessionDuration",
        "screenPageViewsPerSession",
        "bounceRate",
      ],
      ["date"],
      "custom",
      startDate,
      endDate,
    );

    // Run page engagement report
    const pageEngagementReport = await this.runReport(
      ["screenPageViews", "averageSessionDuration", "bounceRate"],
      ["pagePath", "pageTitle"],
      "custom",
      startDate,
      endDate,
    );

    // Run event report
    const eventReport = await this.runReport(
      ["eventCount"],
      ["eventName"],
      "custom",
      startDate,
      endDate,
    );

    // Update result with report data
    result.rows = [...pageEngagementReport.rows.slice(0, 20)];
    result.totals = { ...engagementReport.totals };

    // Add dimensions
    result.dimensions = {
      dates: engagementReport.rows.map((row: any) => row.date),
      pages: pageEngagementReport.rows
        .slice(0, 20)
        .map((row: any) => row.pageTitle),
      events: eventReport.rows.map((row: any) => row.eventName),
    };

    // Add metrics
    result.metrics = {
      engagementRate: engagementReport.totals.engagementRate,
      averageSessionDuration: engagementReport.totals.averageSessionDuration,
      screenPageViewsPerSession:
        engagementReport.totals.screenPageViewsPerSession,
      bounceRate: engagementReport.totals.bounceRate,
    };

    // Generate charts
    const engagementTrendChart = await this.generateLineChart(
      "Engagement Trend",
      engagementReport.rows.map((row: any) => row.date),
      [
        {
          label: "Engagement Rate",
          data: engagementReport.rows.map(
            (row: any) => parseFloat(row.engagementRate) * 100,
          ),
          borderColor: this.options.whiteLabelColorPrimary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorPrimary || "#4A90E2",
            0.1,
          ),
          yAxisID: "y",
        },
        {
          label: "Bounce Rate",
          data: engagementReport.rows.map(
            (row: any) => parseFloat(row.bounceRate) * 100,
          ),
          borderColor: this.options.whiteLabelColorSecondary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorSecondary || "#50E3C2",
            0.1,
          ),
          yAxisID: "y",
        },
      ],
      {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Rate (%)",
          },
          min: 0,
          max: 100,
        },
      },
    );

    const topPagesChart = await this.generateBarChart(
      "Top Pages by Views",
      pageEngagementReport.rows
        .slice(0, 10)
        .map((row: any) => this.truncateString(row.pageTitle, 30)),
      [
        {
          label: "Page Views",
          data: pageEngagementReport.rows
            .slice(0, 10)
            .map((row: any) => row.screenPageViews),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    const topEventsChart = await this.generatePieChart(
      "Top Events",
      eventReport.rows.slice(0, 10).map((row: any) => row.eventName),
      eventReport.rows.slice(0, 10).map((row: any) => row.eventCount),
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "line",
        title: "Engagement Trend",
        base64Data: engagementTrendChart,
      },
      {
        chartType: "bar",
        title: "Top Pages by Views",
        base64Data: topPagesChart,
      },
      {
        chartType: "pie",
        title: "Top Events",
        base64Data: topEventsChart,
      },
    ];
  }

  /**
   * Generate conversion report
   * @param result Report result object to update
   */
  private async generateConversionReport(
    result: GA4ReportResult,
  ): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run conversions by date report
    const conversionsReport = await this.runReport(
      ["conversions", "conversionRate"],
      ["date"],
      "custom",
      startDate,
      endDate,
    );

    // Run conversion by source report
    const conversionSourceReport = await this.runReport(
      ["conversions", "conversionRate"],
      ["sessionSource", "sessionMedium"],
      "custom",
      startDate,
      endDate,
    );

    // Run conversion by page report
    const conversionPageReport = await this.runReport(
      ["conversions", "conversionRate"],
      ["pagePath"],
      "custom",
      startDate,
      endDate,
    );

    // Update result with report data
    result.rows = [...conversionSourceReport.rows];
    result.totals = { ...conversionsReport.totals };

    // Add dimensions
    result.dimensions = {
      dates: conversionsReport.rows.map((row: any) => row.date),
      sources: conversionSourceReport.rows.map(
        (row: any) => `${row.sessionSource} / ${row.sessionMedium}`,
      ),
      pages: conversionPageReport.rows.map((row: any) => row.pagePath),
    };

    // Add metrics
    result.metrics = {
      conversions: conversionsReport.totals.conversions,
      conversionRate: conversionsReport.totals.conversionRate,
    };

    // Generate charts
    const conversionTrendChart = await this.generateLineChart(
      "Conversion Trend",
      conversionsReport.rows.map((row: any) => row.date),
      [
        {
          label: "Conversions",
          data: conversionsReport.rows.map((row: any) => row.conversions),
          borderColor: this.options.whiteLabelColorPrimary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorPrimary || "#4A90E2",
            0.1,
          ),
          yAxisID: "y",
        },
        {
          label: "Conversion Rate",
          data: conversionsReport.rows.map(
            (row: any) => parseFloat(row.conversionRate) * 100,
          ),
          borderColor: this.options.whiteLabelColorSecondary,
          backgroundColor: this.hexToRgba(
            this.options.whiteLabelColorSecondary || "#50E3C2",
            0.1,
          ),
          yAxisID: "y1",
        },
      ],
      {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Conversions",
          },
          min: 0,
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Conversion Rate (%)",
          },
          min: 0,
          max: 100,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    );

    const conversionSourceChart = await this.generateBarChart(
      "Conversions by Source",
      conversionSourceReport.rows
        .slice(0, 10)
        .map((row: any) => `${row.sessionSource} / ${row.sessionMedium}`),
      [
        {
          label: "Conversions",
          data: conversionSourceReport.rows
            .slice(0, 10)
            .map((row: any) => row.conversions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    const conversionPageChart = await this.generateBarChart(
      "Conversions by Page",
      conversionPageReport.rows
        .slice(0, 10)
        .map((row: any) => this.truncateString(row.pagePath, 30)),
      [
        {
          label: "Conversions",
          data: conversionPageReport.rows
            .slice(0, 10)
            .map((row: any) => row.conversions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "line",
        title: "Conversion Trend",
        base64Data: conversionTrendChart,
      },
      {
        chartType: "bar",
        title: "Conversions by Source",
        base64Data: conversionSourceChart,
      },
      {
        chartType: "bar",
        title: "Conversions by Page",
        base64Data: conversionPageChart,
      },
    ];
  }

  /**
   * Generate pages report
   * @param result Report result object to update
   */
  private async generatePagesReport(result: GA4ReportResult): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run pages report
    const pagesReport = await this.runReport(
      ["screenPageViews", "averageSessionDuration", "bounceRate"],
      ["pagePath", "pageTitle"],
      "custom",
      startDate,
      endDate,
    );

    // Run landing pages report
    const landingPagesReport = await this.runReport(
      ["sessions", "bounceRate", "conversions"],
      ["landingPage", "landingPagePlusQueryString"],
      "custom",
      startDate,
      endDate,
    );

    // Run exit pages report
    const exitPagesReport = await this.runReport(
      ["sessions", "exits"],
      ["exitPage"],
      "custom",
      startDate,
      endDate,
    );

    // Update result with report data
    result.rows = [...pagesReport.rows.slice(0, 50)];
    result.totals = {
      screenPageViews: pagesReport.totals.screenPageViews,
      averageSessionDuration: pagesReport.totals.averageSessionDuration,
      bounceRate: pagesReport.totals.bounceRate,
    };

    // Add dimensions
    result.dimensions = {
      pages: pagesReport.rows.slice(0, 50).map((row: any) => row.pageTitle),
      landingPages: landingPagesReport.rows
        .slice(0, 20)
        .map((row: any) => row.landingPage),
      exitPages: exitPagesReport.rows
        .slice(0, 20)
        .map((row: any) => row.exitPage),
    };

    // Add metrics
    result.metrics = {
      screenPageViews: pagesReport.totals.screenPageViews,
      averageSessionDuration: pagesReport.totals.averageSessionDuration,
      bounceRate: pagesReport.totals.bounceRate,
    };

    // Generate charts
    const topPagesChart = await this.generateBarChart(
      "Top Pages by Views",
      pagesReport.rows
        .slice(0, 10)
        .map((row: any) => this.truncateString(row.pageTitle, 30)),
      [
        {
          label: "Page Views",
          data: pagesReport.rows
            .slice(0, 10)
            .map((row: any) => row.screenPageViews),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    const landingPagesChart = await this.generateBarChart(
      "Top Landing Pages",
      landingPagesReport.rows
        .slice(0, 10)
        .map((row: any) => this.truncateString(row.landingPage, 30)),
      [
        {
          label: "Sessions",
          data: landingPagesReport.rows
            .slice(0, 10)
            .map((row: any) => row.sessions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    const exitPagesChart = await this.generateBarChart(
      "Top Exit Pages",
      exitPagesReport.rows
        .slice(0, 10)
        .map((row: any) => this.truncateString(row.exitPage, 30)),
      [
        {
          label: "Exits",
          data: exitPagesReport.rows.slice(0, 10).map((row: any) => row.exits),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "bar",
        title: "Top Pages by Views",
        base64Data: topPagesChart,
      },
      {
        chartType: "bar",
        title: "Top Landing Pages",
        base64Data: landingPagesChart,
      },
      {
        chartType: "bar",
        title: "Top Exit Pages",
        base64Data: exitPagesChart,
      },
    ];
  }

  /**
   * Generate keywords report
   * @param result Report result object to update
   */
  private async generateKeywordsReport(result: GA4ReportResult): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run search console report if available
    // let searchConsoleReport = null;
    try {
      // This is a placeholder for Search Console API integration
      // In a real implementation, you would connect to the Search Console API
      // and fetch keyword data
      // searchConsoleReport = {
      //   rows: [],
      //   totals: {},
      // };
    } catch (error) {
      logger.warn({ error }, "Failed to fetch Search Console data");
    }

    // Run organic search report
    const organicSearchReport = await this.runReport(
      ["sessions", "conversions"],
      ["sessionSource", "sessionMedium"],
      "custom",
      startDate,
      endDate,
      { sessionMedium: "organic" },
    );

    // Run landing page report for organic traffic
    const organicLandingReport = await this.runReport(
      ["sessions", "bounceRate"],
      ["landingPage"],
      "custom",
      startDate,
      endDate,
      { sessionMedium: "organic" },
    );

    // Update result with report data
    result.rows = [...organicSearchReport.rows];
    result.totals = {
      organicSessions: organicSearchReport.rows
        .filter((row: any) => row.sessionMedium === "organic")
        .reduce((sum: any, row: any) => sum + parseInt(row.sessions), 0),
    };

    // Add dimensions
    result.dimensions = {
      organicSources: organicSearchReport.rows
        .filter((row: any) => row.sessionMedium === "organic")
        .map((row: any) => row.sessionSource),
      landingPages: organicLandingReport.rows.map(
        (row: any) => row.landingPage,
      ),
    };

    // Add metrics
    result.metrics = {
      organicSessions: result.totals.organicSessions,
    };

    // Generate charts
    const organicSourcesChart = await this.generatePieChart(
      "Organic Traffic Sources",
      organicSearchReport.rows
        .filter((row: any) => row.sessionMedium === "organic")
        .slice(0, 10)
        .map((row: any) => row.sessionSource),
      organicSearchReport.rows
        .filter((row: any) => row.sessionMedium === "organic")
        .slice(0, 10)
        .map((row: any) => row.sessions),
    );

    const organicLandingChart = await this.generateBarChart(
      "Top Landing Pages for Organic Traffic",
      organicLandingReport.rows
        .slice(0, 10)
        .map((row: any) => this.truncateString(row.landingPage, 30)),
      [
        {
          label: "Sessions",
          data: organicLandingReport.rows
            .slice(0, 10)
            .map((row: any) => row.sessions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "pie",
        title: "Organic Traffic Sources",
        base64Data: organicSourcesChart,
      },
      {
        chartType: "bar",
        title: "Top Landing Pages for Organic Traffic",
        base64Data: organicLandingChart,
      },
    ];
  }

  /**
   * Generate devices report
   * @param result Report result object to update
   */
  private async generateDevicesReport(result: GA4ReportResult): Promise<void> {
    // Get date range
    const { startDate, endDate } = result.dateRange;

    // Run device category report
    const deviceReport = await this.runReport(
      ["sessions", "users", "bounceRate", "conversions"],
      ["deviceCategory"],
      "custom",
      startDate,
      endDate,
    );

    // Run browser report
    const browserReport = await this.runReport(
      ["sessions", "users"],
      ["browser"],
      "custom",
      startDate,
      endDate,
    );

    // Run operating system report
    const osReport = await this.runReport(
      ["sessions", "users"],
      ["operatingSystem"],
      "custom",
      startDate,
      endDate,
    );

    // Run screen resolution report
    const screenReport = await this.runReport(
      ["sessions", "users"],
      ["screenResolution"],
      "custom",
      startDate,
      endDate,
    );

    // Update result with report data
    result.rows = [
      ...deviceReport.rows,
      ...browserReport.rows.slice(0, 10),
      ...osReport.rows.slice(0, 10),
    ];
    result.totals = { ...deviceReport.totals };

    // Add dimensions
    result.dimensions = {
      devices: deviceReport.rows.map((row: any) => row.deviceCategory),
      browsers: browserReport.rows.slice(0, 10).map((row: any) => row.browser),
      operatingSystems: osReport.rows
        .slice(0, 10)
        .map((row: any) => row.operatingSystem),
      screenResolutions: screenReport.rows
        .slice(0, 10)
        .map((row: any) => row.screenResolution),
    };

    // Add metrics
    result.metrics = {
      sessions: deviceReport.totals.sessions,
      users: deviceReport.totals.users,
      bounceRate: deviceReport.totals.bounceRate,
      conversions: deviceReport.totals.conversions,
    };

    // Generate charts
    const deviceChart = await this.generatePieChart(
      "Device Categories",
      deviceReport.rows.map((row: any) => row.deviceCategory),
      deviceReport.rows.map((row: any) => row.sessions),
    );

    const browserChart = await this.generateBarChart(
      "Top Browsers",
      browserReport.rows.slice(0, 10).map((row: any) => row.browser),
      [
        {
          label: "Sessions",
          data: browserReport.rows.slice(0, 10).map((row: any) => row.sessions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    const osChart = await this.generateBarChart(
      "Top Operating Systems",
      osReport.rows.slice(0, 10).map((row: any) => row.operatingSystem),
      [
        {
          label: "Sessions",
          data: osReport.rows.slice(0, 10).map((row: any) => row.sessions),
          backgroundColor: this.options.whiteLabelColorPrimary,
        },
      ],
    );

    // Add charts to result
    result.charts = [
      {
        chartType: "pie",
        title: "Device Categories",
        base64Data: deviceChart,
      },
      {
        chartType: "bar",
        title: "Top Browsers",
        base64Data: browserChart,
      },
      {
        chartType: "bar",
        title: "Top Operating Systems",
        base64Data: osChart,
      },
    ];
  }

  /**
   * Generate a line chart
   * @param title Chart title
   * @param labels X-axis labels
   * @param datasets Chart datasets
   * @param scales Optional scales configuration
   * @returns Promise with chart as base64 string
   */
  private async generateLineChart(
    title: string,
    labels: string[],
    datasets: any[],
    scales: any = {},
  ): Promise<string> {
    const configuration = {
      type: "line" as const,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 16,
              family: this.options.chartFontFamily,
            },
          },
          legend: {
            position: "top" as const,
            labels: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          tooltip: {
            enabled: true,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Date",
              font: {
                family: this.options.chartFontFamily,
              },
            },
            ticks: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "Value",
              font: {
                family: this.options.chartFontFamily,
              },
            },
            ticks: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          ...scales,
        },
      },
    };

    const image = await this.chartJSCanvas.renderToBuffer(configuration);
    return image.toString("base64");
  }

  /**
   * Generate a bar chart
   * @param title Chart title
   * @param labels X-axis labels
   * @param datasets Chart datasets
   * @param scales Optional scales configuration
   * @returns Promise with chart as base64 string
   */
  private async generateBarChart(
    title: string,
    labels: string[],
    datasets: any[],
    scales: any = {},
  ): Promise<string> {
    const configuration = {
      type: "bar" as const,
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 16,
              family: this.options.chartFontFamily,
            },
          },
          legend: {
            position: "top" as const,
            labels: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          tooltip: {
            enabled: true,
          },
        },
        scales: {
          x: {
            title: {
              display: false,
              font: {
                family: this.options.chartFontFamily,
              },
            },
            ticks: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "Value",
              font: {
                family: this.options.chartFontFamily,
              },
            },
            ticks: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          ...scales,
        },
      },
    };

    const image = await this.chartJSCanvas.renderToBuffer(configuration);
    return image.toString("base64");
  }

  /**
   * Generate a pie chart
   * @param title Chart title
   * @param labels Pie slice labels
   * @param data Pie slice values
   * @returns Promise with chart as base64 string
   */
  private async generatePieChart(
    title: string,
    labels: string[],
    data: number[],
  ): Promise<string> {
    // Generate colors for pie slices
    const colors = this.generateColors(data.length);

    const configuration = {
      type: "pie" as const,
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 16,
              family: this.options.chartFontFamily,
            },
          },
          legend: {
            position: "right" as const,
            labels: {
              font: {
                family: this.options.chartFontFamily,
              },
            },
          },
          tooltip: {
            enabled: true,
          },
        },
      },
    };

    const image = await this.chartJSCanvas.renderToBuffer(configuration);
    return image.toString("base64");
  }

  /**
   * Generate colors for chart elements
   * @param count Number of colors to generate
   * @returns Array of color strings
   */
  private generateColors(count: number): string[] {
    const colors = [];
    const primaryColor = this.options.whiteLabelColorPrimary || "#4A90E2";
    const secondaryColor = this.options.whiteLabelColorSecondary || "#50E3C2";

    // Add primary and secondary colors
    colors.push(primaryColor);
    colors.push(secondaryColor);

    // Generate additional colors by adjusting hue
    const baseHsl = this.hexToHsl(primaryColor);

    for (let i = 2; i < count; i++) {
      const hue = (baseHsl.h + i * 137.5) % 360;
      colors.push(`hsl(${hue}, ${baseHsl.s}%, ${baseHsl.l}%)`);
    }

    return colors;
  }

  /**
   * Convert hex color to RGBA
   * @param hex Hex color string
   * @param alpha Alpha value (0-1)
   * @returns RGBA color string
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Convert hex color to HSL
   * @param hex Hex color string
   * @returns HSL color object
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }

      h /= 6;
    }

    return {
      h: h * 360,
      s: s * 100,
      l: l * 100,
    };
  }

  /**
   * Truncate a string to a maximum length
   * @param str String to truncate
   * @param maxLength Maximum length
   * @returns Truncated string
   */
  private truncateString(str: string, maxLength: number): string {
    if (!str) return "";
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  }

  /**
   * Generate summary text for a report
   * @param report Report result
   * @returns Promise with summary text
   */
  private async generateSummaryText(report: GA4ReportResult): Promise<string> {
    // This is a placeholder for a more sophisticated summary generation
    // In a real implementation, you might use an LLM to generate a summary

    const { startDate, endDate } = report.dateRange;
    const dateRange = `${startDate} to ${endDate}`;

    let summary = `# ${this.options.whiteLabelName} Analytics Report\n\n`;
    summary += `**Period:** ${dateRange}\n\n`;

    // Add report type specific summary
    switch (report.reportType) {
      case GA4ReportType.OVERVIEW:
        summary += `## Overview\n\n`;
        summary += `During this period, the website received **${report.metrics.sessions}** sessions from **${report.metrics.users}** users. `;
        summary += `Of these, **${report.metrics.newUsers}** were new users. `;
        summary += `The engagement rate was **${parseFloat(report.metrics.engagementRate as string) * 100}%** with an average session duration of **${this.formatDuration(report.metrics.averageSessionDuration as string)}**.\n\n`;

        // Add traffic sources
        if (
          report.dimensions.trafficSources &&
          report.dimensions.trafficSources.length > 0
        ) {
          summary += `## Traffic Sources\n\n`;
          summary += `The top traffic sources were:\n\n`;
          report.dimensions.trafficSources
            .slice(0, 5)
            .forEach((source, index) => {
              summary += `${index + 1}. ${source}\n`;
            });
          summary += `\n`;
        }

        // Add device breakdown
        if (report.dimensions.devices && report.dimensions.devices.length > 0) {
          summary += `## Device Breakdown\n\n`;
          summary += `Users accessed the site using the following devices:\n\n`;
          report.dimensions.devices.forEach((device) => {
            const deviceSessions =
              report.rows.find((row) => row.deviceCategory === device)
                ?.sessions || 0;
            const percentage =
              (parseInt(deviceSessions) /
                parseInt(report.metrics.sessions as string)) *
              100;
            summary += `- **${device}**: ${deviceSessions} sessions (${percentage.toFixed(1)}%)\n`;
          });
          summary += `\n`;
        }
        break;

      case GA4ReportType.TRAFFIC:
        summary += `## Traffic Analysis\n\n`;
        summary += `During this period, the website received **${report.metrics.sessions}** sessions from **${report.metrics.users}** users. `;
        summary += `Of these, **${report.metrics.newUsers}** were new users. `;
        summary += `The bounce rate was **${parseFloat(report.metrics.bounceRate as string) * 100}%**.\n\n`;

        // Add traffic sources
        if (
          report.dimensions.trafficSources &&
          report.dimensions.trafficSources.length > 0
        ) {
          summary += `## Traffic Sources\n\n`;
          summary += `The top traffic sources were:\n\n`;
          report.dimensions.trafficSources
            .slice(0, 5)
            .forEach((source, index) => {
              const sourceSessions =
                report.rows.find(
                  (row) =>
                    `${row.sessionSource} / ${row.sessionMedium}` === source,
                )?.sessions || 0;
              summary += `${index + 1}. **${source}**: ${sourceSessions} sessions\n`;
            });
          summary += `\n`;
        }

        // Add referrals
        if (
          report.dimensions.referrals &&
          report.dimensions.referrals.length > 0
        ) {
          summary += `## Top Referrals\n\n`;
          summary += `The top referring sites were:\n\n`;
          report.dimensions.referrals.slice(0, 5).forEach((referral, index) => {
            summary += `${index + 1}. ${referral}\n`;
          });
          summary += `\n`;
        }
        break;

      // Add other report types as needed

      default:
        summary += `## ${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report\n\n`;
        summary += `This report provides insights into the ${report.reportType} performance for the period ${dateRange}.\n\n`;
    }

    // Add conclusion
    summary += `## Conclusion\n\n`;
    summary += `This report was generated by ${this.options.whiteLabelName} on ${format(new Date(), "yyyy-MM-dd")}. `;
    summary += `For more detailed insights or to discuss these results, please contact your ${this.options.whiteLabelName} representative.\n`;

    return summary;
  }

  /**
   * Format duration in seconds to a human-readable string
   * @param durationSeconds Duration in seconds
   * @returns Formatted duration string
   */
  private formatDuration(durationSeconds: string): string {
    const seconds = parseFloat(durationSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (minutes === 0) {
      return `${remainingSeconds} seconds`;
    } else if (minutes === 1) {
      return `1 minute ${remainingSeconds} seconds`;
    } else {
      return `${minutes} minutes ${remainingSeconds} seconds`;
    }
  }

  /**
   * Generate a weekly GA4 report and save it to the database
   * @param sandboxId Sandbox ID
   * @param options Report options
   * @returns Promise with GA4Report object
   */
  public async generateWeeklyReport(
    sandboxId: string,
    options: {
      dateRange?: "last7days" | "last30days" | "last90days" | "custom";
      customStartDate?: string;
      customEndDate?: string;
      reportTypes?: GA4ReportType[];
    } = {},
  ): Promise<GA4Report> {
    try {
      // Set default options
      const reportOptions = {
        dateRange: "last7days",
        reportTypes: [
          GA4ReportType.OVERVIEW,
          GA4ReportType.TRAFFIC,
          GA4ReportType.PAGES,
        ],
        ...options,
      };

      // Get date range
      const { startDate, endDate } = this.getDateRange(
        reportOptions.dateRange as any,
        reportOptions.customStartDate,
        reportOptions.customEndDate,
      );

      // Generate reports
      const reports = [];
      for (const reportType of reportOptions.reportTypes) {
        const report = await this.generateReport(
          reportType,
          reportOptions.dateRange as any,
          reportOptions.customStartDate,
          reportOptions.customEndDate,
        );
        reports.push(report);
      }

      // Combine reports into a single GA4Report
      const ga4Report: GA4Report = {
        reportName: `Weekly Report - ${startDate} to ${endDate}`,
        metrics: {},
        dimensions: {},
        dateRange: {
          startDate,
          endDate,
        },
      };

      // Process overview report
      const overviewReport = reports.find(
        (report) => report.reportType === GA4ReportType.OVERVIEW,
      );
      if (overviewReport) {
        ga4Report.metrics = {
          sessions: parseInt(overviewReport.metrics.sessions as string) || 0,
          users: parseInt(overviewReport.metrics.users as string) || 0,
          newUsers: parseInt(overviewReport.metrics.newUsers as string) || 0,
          pageViews: parseInt(overviewReport.metrics.pageViews as string) || 0,
          bounceRate:
            parseFloat(overviewReport.metrics.bounceRate as string) || 0,
          avgSessionDuration:
            parseFloat(
              overviewReport.metrics.averageSessionDuration as string,
            ) || 0,
        };

        // Add device breakdown to dimensions
        if (overviewReport.dimensions.devices) {
          ga4Report.dimensions.devices = overviewReport.dimensions.devices;
        }
      }

      // Process pages report
      const pagesReport = reports.find(
        (report) => report.reportType === GA4ReportType.PAGES,
      );
      if (pagesReport && pagesReport.dimensions.pages) {
        ga4Report.dimensions.pages = pagesReport.dimensions.pages;
      }

      // Process traffic sources
      const trafficReport = reports.find(
        (report) => report.reportType === GA4ReportType.TRAFFIC,
      );
      if (trafficReport && trafficReport.dimensions.trafficSources) {
        ga4Report.dimensions.trafficSources =
          trafficReport.dimensions.trafficSources;
      }

      return ga4Report;
    } catch (error) {
      logger.error(
        { error, sandboxId },
        "Failed to generate weekly GA4 report",
      );
      throw new Error(
        `Failed to generate weekly GA4 report: ${(error as Error).message}`,
      );
    }
  }
}

/**
 * Create a new GA4Client instance with the given options
 * @param options Configuration options for GA4 client
 * @returns GA4Client instance
 */
export function createGA4Client(options: GA4ClientOptions): GA4Client {
  return new GA4Client(options);
}

export default {
  GA4Client,
  createGA4Client,
  GA4ReportType,
  GA4MetricType,
  GA4DimensionType,
};
