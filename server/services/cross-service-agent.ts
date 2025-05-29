/**
 * Cross-Service Agent
 * 
 * Orchestrates interactions between analytics (Watchdog) and automation (VIN Agent) services,
 * providing a unified interface for AI agents to perform complex operations across services.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';
import { AnalyticsClient, AnalyticsRequest, AnalyticsResponse, ChartRequest, ChartResponse } from './analytics-client';

// VIN Agent Client Types
export interface VinAgentRequest {
  taskType: string;
  parameters?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  scheduleTime?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryInterval: number;
  };
}

export interface VinAgentResponse {
  success: boolean;
  taskId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  startTime?: string;
  completionTime?: string;
  progress?: number;
}

export interface VinAgentPlatformInfo {
  platformId: string;
  platformName: string;
  availableTasks: string[];
  status: 'available' | 'unavailable' | 'degraded';
  capabilities: string[];
}

export interface VinAgentSystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  platforms: VinAgentPlatformInfo[];
  activeTasks: number;
  queuedTasks: number;
  uptime: number;
  timestamp: string;
}

/**
 * Client for interacting with the VIN Agent API
 */
export class VinAgentClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseURL?: string, apiKey?: string) {
    // Default to environment variables if not provided
    this.baseUrl = baseURL || process.env.VIN_AGENT_API_URL || 'http://localhost:5000';
    const apiKeyValue = apiKey || process.env.VIN_AGENT_API_KEY;
    
    const config: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add API key if available
    if (apiKeyValue) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${apiKeyValue}`
      };
    }

    this.client = axios.create(config);

    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logger.debug(`VIN Agent API request to ${config.url}`);
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`VIN Agent API response from ${response.config.url} - Status: ${response.status}`);
        return response;
      },
      (error) => {
        logger.error(`VIN Agent API error: ${error.message}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make an API request
   */
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any
  ): Promise<T> {
    try {
      // Make the request
      let response;
      if (method === 'get') {
        response = await this.client.get(endpoint, { params: data });
      } else {
        response = await this.client[method](endpoint, data);
      }

      return response.data as T;
    } catch (error: any) {
      logger.error(`VIN Agent API error in ${method.toUpperCase()} ${endpoint}`, { error: error.message });
      
      if (error.response) {
        throw new Error(`VIN Agent API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error(`VIN Agent API no response: ${error.message}`);
      } else {
        throw new Error(`VIN Agent request failed: ${error.message}`);
      }
    }
  }

  /**
   * Check the health of the VIN Agent service
   */
  async checkHealth(): Promise<{ status: string, version?: string }> {
    try {
      const response = await this.request<{ status: string, version?: string }>('get', '/health');
      return response;
    } catch (error) {
      return { status: 'error' };
    }
  }

  /**
   * Get system status including available platforms and tasks
   */
  async getSystemStatus(): Promise<VinAgentSystemStatus> {
    return this.request<VinAgentSystemStatus>('get', '/api/v1/system/status');
  }

  /**
   * Get available platforms
   */
  async getPlatforms(): Promise<VinAgentPlatformInfo[]> {
    const response = await this.request<{ platforms: VinAgentPlatformInfo[] }>('get', '/api/v1/platforms');
    return response.platforms;
  }

  /**
   * Execute a task on a specific platform
   */
  async executeTask(platformId: string, request: VinAgentRequest): Promise<VinAgentResponse> {
    return this.request<VinAgentResponse>('post', `/api/v1/platforms/${platformId}/tasks`, request);
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<VinAgentResponse> {
    return this.request<VinAgentResponse>('get', `/api/v1/tasks/${taskId}`);
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<VinAgentResponse> {
    return this.request<VinAgentResponse>('post', `/api/v1/tasks/${taskId}/cancel`);
  }

  /**
   * Download a report from VinSolutions
   */
  async downloadReport(reportId: string, format: 'CSV' | 'Excel' | 'PDF' = 'CSV'): Promise<VinAgentResponse> {
    return this.request<VinAgentResponse>('post', `/api/vinsolutions/reports/${reportId}/download`, { format });
  }

  /**
   * Get available reports
   */
  async getAvailableReports(): Promise<any> {
    return this.request<any>('get', '/api/vinsolutions/reports');
  }

  /**
   * Check VinSolutions automation status
   */
  async checkVinSolutionsStatus(): Promise<any> {
    return this.request<any>('get', '/api/vinsolutions/automation/status');
  }

  /**
   * Trigger VinSolutions automation task
   */
  async triggerVinSolutionsTask(taskType: string, parameters?: Record<string, any>): Promise<VinAgentResponse> {
    return this.request<VinAgentResponse>('post', '/api/vinsolutions/automation/trigger', { taskType, parameters });
  }
}

/**
 * Intent types for cross-service operations
 */
export enum CrossServiceIntent {
  ANALYTICS_ONLY = 'analytics_only',
  AUTOMATION_ONLY = 'automation_only',
  ANALYTICS_THEN_AUTOMATION = 'analytics_then_automation',
  AUTOMATION_THEN_ANALYTICS = 'automation_then_analytics',
  PARALLEL_EXECUTION = 'parallel_execution',
  UNKNOWN = 'unknown'
}

/**
 * Cross-service request type
 */
export interface CrossServiceRequest {
  query?: string;
  intent?: CrossServiceIntent;
  analyticsParams?: {
    uploadId?: string;
    metrics?: string[];
    filters?: Record<string, any>;
  };
  automationParams?: {
    platformId?: string;
    taskType?: string;
    parameters?: Record<string, any>;
  };
  options?: {
    waitForCompletion?: boolean;
    timeout?: number;
    maxRetries?: number;
  };
}

/**
 * Cross-service response type
 */
export interface CrossServiceResponse {
  success: boolean;
  requestId: string;
  intent: CrossServiceIntent;
  analytics?: {
    success: boolean;
    insights?: any[];
    error?: any;
  };
  automation?: {
    success: boolean;
    taskId?: string;
    status?: string;
    result?: any;
    error?: any;
  };
  combined?: {
    summary: string;
    recommendations: string[];
    nextActions: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

/**
 * Cross-Service Agent class for orchestrating analytics and automation
 */
export class CrossServiceAgent {
  private analyticsClient: AnalyticsClient;
  private vinAgentClient: VinAgentClient;
  private requestCounter: number = 0;

  constructor(
    analyticsBaseUrl?: string, 
    vinAgentBaseUrl?: string,
    analyticsApiKey?: string,
    vinAgentApiKey?: string
  ) {
    this.analyticsClient = new AnalyticsClient(analyticsBaseUrl, analyticsApiKey);
    this.vinAgentClient = new VinAgentClient(vinAgentBaseUrl, vinAgentApiKey);
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    this.requestCounter++;
    return `req-${Date.now()}-${this.requestCounter}`;
  }

  /**
   * Determine the intent of a natural language query
   */
  private async determineIntent(query: string): Promise<CrossServiceIntent> {
    // This is a simplified version - in production, this would use a more sophisticated
    // NLP approach, possibly with OpenAI or a custom classifier
    
    const analyticsKeywords = ['analyze', 'insight', 'trend', 'report', 'data', 'metrics', 'dashboard', 'kpi'];
    const automationKeywords = ['automate', 'download', 'execute', 'run', 'task', 'action', 'trigger', 'schedule'];
    
    const lowerQuery = query.toLowerCase();
    
    let analyticsScore = 0;
    let automationScore = 0;
    
    // Simple keyword matching
    analyticsKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) analyticsScore++;
    });
    
    automationKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) automationScore++;
    });
    
    // Check for explicit sequences
    const hasSequence = lowerQuery.includes('then') || 
                        lowerQuery.includes('after') || 
                        lowerQuery.includes('once') ||
                        lowerQuery.includes('following');
    
    // Determine intent based on scores
    if (analyticsScore > 0 && automationScore > 0) {
      if (hasSequence) {
        // Check sequence direction
        const analyticsFirst = lowerQuery.indexOf('analyze') < lowerQuery.indexOf('automate') ||
                              lowerQuery.indexOf('report') < lowerQuery.indexOf('download');
        
        return analyticsFirst ? 
          CrossServiceIntent.ANALYTICS_THEN_AUTOMATION : 
          CrossServiceIntent.AUTOMATION_THEN_ANALYTICS;
      } else {
        return CrossServiceIntent.PARALLEL_EXECUTION;
      }
    } else if (analyticsScore > 0) {
      return CrossServiceIntent.ANALYTICS_ONLY;
    } else if (automationScore > 0) {
      return CrossServiceIntent.AUTOMATION_ONLY;
    }
    
    return CrossServiceIntent.UNKNOWN;
  }

  /**
   * Process a natural language request and orchestrate services accordingly
   */
  async processRequest(request: CrossServiceRequest): Promise<CrossServiceResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      logger.info(`Processing cross-service request: ${requestId}`, { request });
      
      // Determine intent if not specified
      const intent = request.intent || await this.determineIntent(request.query || '');
      
      // Prepare response object
      const response: CrossServiceResponse = {
        success: false,
        requestId,
        intent,
        timestamp: new Date().toISOString()
      };
      
      // Execute based on intent
      switch (intent) {
        case CrossServiceIntent.ANALYTICS_ONLY:
          await this.handleAnalyticsOnly(request, response);
          break;
          
        case CrossServiceIntent.AUTOMATION_ONLY:
          await this.handleAutomationOnly(request, response);
          break;
          
        case CrossServiceIntent.ANALYTICS_THEN_AUTOMATION:
          await this.handleAnalyticsThenAutomation(request, response);
          break;
          
        case CrossServiceIntent.AUTOMATION_THEN_ANALYTICS:
          await this.handleAutomationThenAnalytics(request, response);
          break;
          
        case CrossServiceIntent.PARALLEL_EXECUTION:
          await this.handleParallelExecution(request, response);
          break;
          
        default:
          response.error = {
            code: 'unknown_intent',
            message: 'Could not determine the intent of the request',
            details: { query: request.query }
          };
          break;
      }
      
      // Log completion
      const duration = Date.now() - startTime;
      logger.info(`Completed cross-service request: ${requestId}`, { 
        duration: `${duration}ms`,
        success: response.success
      });
      
      return response;
      
    } catch (error: any) {
      logger.error(`Error processing cross-service request: ${requestId}`, { error: error.message });
      
      return {
        success: false,
        requestId,
        intent: request.intent || CrossServiceIntent.UNKNOWN,
        error: {
          code: 'request_processing_error',
          message: error.message,
          details: error.stack
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Handle analytics-only request
   */
  private async handleAnalyticsOnly(
    request: CrossServiceRequest, 
    response: CrossServiceResponse
  ): Promise<void> {
    try {
      if (!request.analyticsParams?.uploadId) {
        throw new Error('Upload ID is required for analytics operations');
      }
      
      // If there's a natural language query, use question answering
      if (request.query) {
        const analyticsResponse = await this.analyticsClient.answerQuestion(
          request.analyticsParams.uploadId,
          request.query
        );
        
        response.analytics = {
          success: analyticsResponse.success,
          insights: analyticsResponse.insights,
          error: analyticsResponse.error
        };
        
      } else if (request.analyticsParams.metrics) {
        // Otherwise use metrics-based analysis
        const analyticsResponse = await this.analyticsClient.analyzeData({
          uploadId: request.analyticsParams.uploadId,
          metrics: request.analyticsParams.metrics,
          filters: request.analyticsParams.filters
        });
        
        response.analytics = {
          success: analyticsResponse.success,
          insights: analyticsResponse.insights,
          error: analyticsResponse.error
        };
      }
      
      response.success = response.analytics?.success || false;
      
    } catch (error: any) {
      response.success = false;
      response.analytics = {
        success: false,
        error: {
          message: error.message
        }
      };
    }
  }

  /**
   * Handle automation-only request
   */
  private async handleAutomationOnly(
    request: CrossServiceRequest, 
    response: CrossServiceResponse
  ): Promise<void> {
    try {
      if (!request.automationParams?.taskType) {
        throw new Error('Task type is required for automation operations');
      }
      
      const platformId = request.automationParams.platformId || 'vinsolutions'; // Default platform
      
      // Execute the task
      const automationResponse = await this.vinAgentClient.executeTask(
        platformId,
        {
          taskType: request.automationParams.taskType,
          parameters: request.automationParams.parameters
        }
      );
      
      response.automation = {
        success: automationResponse.success,
        taskId: automationResponse.taskId,
        status: automationResponse.status,
        result: automationResponse.result,
        error: automationResponse.error
      };
      
      // If we need to wait for completion
      if (request.options?.waitForCompletion && automationResponse.taskId) {
        const taskId = automationResponse.taskId;
        const maxWaitTime = request.options.timeout || 60000; // Default 60s timeout
        const startTime = Date.now();
        
        // Poll for task completion
        let taskComplete = false;
        let taskStatus: VinAgentResponse;
        
        while (!taskComplete && (Date.now() - startTime < maxWaitTime)) {
          // Wait a bit between polls
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check task status
          taskStatus = await this.vinAgentClient.getTaskStatus(taskId);
          
          if (['completed', 'failed', 'canceled'].includes(taskStatus.status)) {
            taskComplete = true;
            
            // Update response with final status
            response.automation = {
              success: taskStatus.status === 'completed',
              taskId: taskStatus.taskId,
              status: taskStatus.status,
              result: taskStatus.result,
              error: taskStatus.error
            };
          }
        }
        
        // If we timed out waiting
        if (!taskComplete) {
          response.automation.status = 'timeout';
          response.automation.error = {
            message: `Task execution timed out after ${maxWaitTime}ms`
          };
        }
      }
      
      response.success = response.automation?.success || false;
      
    } catch (error: any) {
      response.success = false;
      response.automation = {
        success: false,
        error: {
          message: error.message
        }
      };
    }
  }

  /**
   * Handle analytics then automation sequence
   */
  private async handleAnalyticsThenAutomation(
    request: CrossServiceRequest, 
    response: CrossServiceResponse
  ): Promise<void> {
    try {
      // First, perform analytics
      await this.handleAnalyticsOnly(request, response);
      
      // If analytics failed, stop here
      if (!response.analytics?.success) {
        response.success = false;
        return;
      }
      
      // Use analytics results to inform automation if needed
      if (response.analytics.insights && response.analytics.insights.length > 0) {
        // Example: Extract parameters from insights for automation
        const insight = response.analytics.insights[0];
        
        // If automation params weren't provided, try to infer them from analytics
        if (!request.automationParams) {
          request.automationParams = {
            platformId: 'vinsolutions',
            taskType: 'report_download',
            parameters: {
              // Example: Use metrics from insights as parameters
              reportType: insight.title?.includes('inventory') ? 'inventory' : 'sales',
              format: 'CSV'
            }
          };
        }
      }
      
      // Now perform automation
      await this.handleAutomationOnly(request, response);
      
      // Overall success depends on both steps
      response.success = (response.analytics?.success && response.automation?.success) || false;
      
      // Add combined insights
      if (response.success) {
        response.combined = {
          summary: `Successfully analyzed data and executed automation task ${response.automation?.taskId}`,
          recommendations: [
            'Review the generated insights',
            'Check the automation task result for any follow-up actions'
          ],
          nextActions: [
            'Schedule regular automation of this workflow',
            'Share insights with team members'
          ]
        };
      }
      
    } catch (error: any) {
      response.success = false;
      response.error = {
        code: 'sequence_execution_error',
        message: error.message
      };
    }
  }

  /**
   * Handle automation then analytics sequence
   */
  private async handleAutomationThenAnalytics(
    request: CrossServiceRequest, 
    response: CrossServiceResponse
  ): Promise<void> {
    try {
      // First, perform automation
      await this.handleAutomationOnly(request, response);
      
      // If automation failed, stop here
      if (!response.automation?.success) {
        response.success = false;
        return;
      }
      
      // Use automation results to inform analytics if needed
      if (response.automation.result) {
        // Example: Extract upload ID from automation result
        const result = response.automation.result;
        
        // If analytics params weren't provided, try to infer them from automation
        if (!request.analyticsParams && result.dataId) {
          request.analyticsParams = {
            uploadId: result.dataId,
            metrics: ['total_sales', 'conversion_rate', 'lead_source_performance']
          };
        }
      }
      
      // Now perform analytics
      await this.handleAnalyticsOnly(request, response);
      
      // Overall success depends on both steps
      response.success = (response.automation?.success && response.analytics?.success) || false;
      
      // Add combined insights
      if (response.success) {
        response.combined = {
          summary: `Successfully executed automation task ${response.automation?.taskId} and analyzed the resulting data`,
          recommendations: [
            'Review the automation results',
            'Explore the generated insights for business opportunities'
          ],
          nextActions: [
            'Schedule this workflow for regular execution',
            'Set up alerts for key metrics'
          ]
        };
      }
      
    } catch (error: any) {
      response.success = false;
      response.error = {
        code: 'sequence_execution_error',
        message: error.message
      };
    }
  }

  /**
   * Handle parallel execution of analytics and automation
   */
  private async handleParallelExecution(
    request: CrossServiceRequest, 
    response: CrossServiceResponse
  ): Promise<void> {
    try {
      // Create separate response objects
      const analyticsResponse: CrossServiceResponse = {
        success: false,
        requestId: response.requestId + '-analytics',
        intent: CrossServiceIntent.ANALYTICS_ONLY,
        timestamp: new Date().toISOString()
      };
      
      const automationResponse: CrossServiceResponse = {
        success: false,
        requestId: response.requestId + '-automation',
        intent: CrossServiceIntent.AUTOMATION_ONLY,
        timestamp: new Date().toISOString()
      };
      
      // Execute both operations in parallel
      const [analyticsResult, automationResult] = await Promise.all([
        this.handleAnalyticsOnly(request, analyticsResponse).catch(error => {
          logger.error('Error in parallel analytics execution', { error });
          return error;
        }),
        this.handleAutomationOnly(request, automationResponse).catch(error => {
          logger.error('Error in parallel automation execution', { error });
          return error;
        })
      ]);
      
      // Combine results
      response.analytics = analyticsResponse.analytics;
      response.automation = automationResponse.automation;
      
      // Overall success if at least one operation succeeded
      response.success = (response.analytics?.success || response.automation?.success) || false;
      
      // Add combined insights if both succeeded
      if (response.analytics?.success && response.automation?.success) {
        response.combined = {
          summary: 'Successfully executed both analytics and automation operations in parallel',
          recommendations: [
            'Review both the analytics insights and automation results',
            'Consider setting up a sequential workflow for future operations'
          ],
          nextActions: [
            'Schedule regular execution of this workflow',
            'Share the combined results with stakeholders'
          ]
        };
      }
      
    } catch (error: any) {
      response.success = false;
      response.error = {
        code: 'parallel_execution_error',
        message: error.message
      };
    }
  }

  /**
   * High-level method: Analyze data and then automate actions based on insights
   */
  async analyzeAndAutomate(
    uploadId: string, 
    query: string, 
    automationOptions?: {
      platformId?: string;
      taskType?: string;
      waitForCompletion?: boolean;
    }
  ): Promise<CrossServiceResponse> {
    return this.processRequest({
      query,
      intent: CrossServiceIntent.ANALYTICS_THEN_AUTOMATION,
      analyticsParams: {
        uploadId
      },
      automationParams: {
        platformId: automationOptions?.platformId || 'vinsolutions',
        taskType: automationOptions?.taskType
      },
      options: {
        waitForCompletion: automationOptions?.waitForCompletion || false
      }
    });
  }

  /**
   * High-level method: Generate a report and trigger its download
   */
  async generateReportAndDownload(
    uploadId: string, 
    reportType: string, 
    format: 'CSV' | 'Excel' | 'PDF' = 'CSV'
  ): Promise<CrossServiceResponse> {
    return this.processRequest({
      intent: CrossServiceIntent.ANALYTICS_THEN_AUTOMATION,
      analyticsParams: {
        uploadId,
        metrics: ['total_sales', 'conversion_rate', 'inventory_metrics']
      },
      automationParams: {
        platformId: 'vinsolutions',
        taskType: 'report_download',
        parameters: {
          reportType,
          format
        }
      },
      options: {
        waitForCompletion: true,
        timeout: 120000 // 2 minutes
      }
    });
  }

  /**
   * High-level method: Set up continuous monitoring with automated responses
   */
  async monitorAndAlert(
    uploadId: string, 
    metricName: string, 
    threshold: number,
    alertAction: {
      platformId: string;
      taskType: string;
      parameters?: Record<string, any>;
    }
  ): Promise<CrossServiceResponse> {
    // This would typically set up a scheduled job, but for this example
    // we'll just perform a one-time check and response
    
    return this.processRequest({
      intent: CrossServiceIntent.ANALYTICS_THEN_AUTOMATION,
      analyticsParams: {
        uploadId,
        metrics: [metricName],
        filters: {
          threshold
        }
      },
      automationParams: {
        platformId: alertAction.platformId,
        taskType: alertAction.taskType,
        parameters: {
          ...alertAction.parameters,
          triggerMetric: metricName,
          triggerThreshold: threshold,
          triggerTime: new Date().toISOString()
        }
      },
      options: {
        waitForCompletion: true
      }
    });
  }

  /**
   * High-level method: Perform inventory check and update
   */
  async checkAndUpdateInventory(dealershipId: string): Promise<CrossServiceResponse> {
    return this.processRequest({
      query: `Check current inventory status for dealership ${dealershipId} and update missing information`,
      intent: CrossServiceIntent.AUTOMATION_THEN_ANALYTICS,
      automationParams: {
        platformId: 'vinsolutions',
        taskType: 'inventory_check',
        parameters: {
          dealershipId,
          checkWindowStickers: true,
          updateFeatures: true
        }
      },
      options: {
        waitForCompletion: true,
        timeout: 300000 // 5 minutes
      }
    });
  }

  /**
   * High-level method: Analyze lead performance and optimize follow-up tasks
   */
  async analyzeSalesPerformanceAndOptimize(uploadId: string): Promise<CrossServiceResponse> {
    return this.processRequest({
      query: 'Analyze sales team performance and optimize follow-up task assignments',
      intent: CrossServiceIntent.ANALYTICS_THEN_AUTOMATION,
      analyticsParams: {
        uploadId,
        metrics: ['sales_by_rep', 'lead_conversion_rate', 'follow_up_effectiveness']
      },
      automationParams: {
        platformId: 'vinsolutions',
        taskType: 'lead_assignment_optimization',
        parameters: {
          optimizationStrategy: 'performance_based',
          includeHistoricalData: true
        }
      },
      options: {
        waitForCompletion: true
      }
    });
  }
}

// Export a singleton instance for convenience
export const crossServiceAgent = new CrossServiceAgent(
  process.env.WATCHDOG_API_URL,
  process.env.VIN_AGENT_API_URL
);
