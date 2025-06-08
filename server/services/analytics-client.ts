import axios, { AxiosInstance } from "axios";
import logger from "../utils/logger";

export interface AnalyticsRequest {
  uploadId?: string;
  metrics?: string[];
  filters?: Record<string, any>;
  timeRange?: {
    start: string;
    end: string;
  };
  options?: Record<string, any>;
  operation?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  requestId: string;
  insights?: any[];
  meta?: {
    processingTime: number;
    recordsProcessed?: number;
    confidence?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Analytics Client for Watchdog Service
 *
 * Simplified client for communicating with the analytics service.
 */
export class AnalyticsClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug("Analytics request", {
          url: config.url,
          method: config.method,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error("Analytics request error", error);
        return Promise.reject(error);
      },
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug("Analytics response", {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error("Analytics response error", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Analyze data using the analytics service
   */
  public async analyzeData(
    request: AnalyticsRequest,
  ): Promise<AnalyticsResponse> {
    try {
      const startTime = Date.now();

      // Handle health check requests
      if (request.operation === "health") {
        try {
          const response = await this.client.get("/health");
          return {
            success: true,
            requestId: `health-${Date.now()}`,
            meta: {
              processingTime: Date.now() - startTime,
            },
          };
        } catch (error) {
          return {
            success: false,
            requestId: `health-${Date.now()}`,
            error: {
              code: "HEALTH_CHECK_FAILED",
              message: "Analytics service health check failed",
            },
          };
        }
      }

      // Make the analytics request
      const response = await this.client.post("/api/analyze", request);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        requestId: response.data.requestId || `req-${Date.now()}`,
        insights: response.data.insights || response.data,
        meta: {
          processingTime,
          recordsProcessed: response.data.recordsProcessed,
          confidence: response.data.confidence,
        },
      };
    } catch (error) {
      logger.error("Error in analytics data analysis", {
        error: error instanceof Error ? error.message : String(error),
        request,
      });

      return {
        success: false,
        requestId: `error-${Date.now()}`,
        error: {
          code: "ANALYTICS_ERROR",
          message: error instanceof Error ? error.message : String(error),
          details: error,
        },
      };
    }
  }

  /**
   * Get analytics service health
   */
  public async getHealth(): Promise<{ healthy: boolean; details?: any }> {
    try {
      const response = await this.client.get("/health");
      return {
        healthy: response.status === 200,
        details: response.data,
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get analytics service metrics
   */
  public async getMetrics(): Promise<any> {
    try {
      const response = await this.client.get("/metrics");
      return response.data;
    } catch (error) {
      logger.error("Error getting analytics metrics", error);
      throw error;
    }
  }
}

export default AnalyticsClient;
