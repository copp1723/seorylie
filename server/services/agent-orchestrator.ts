/**
 * Agent Orchestration Service
 *
 * Provides a unified interface for coordinating between analytics (watchdog) and
 * automation (vin-agent) services, enabling sophisticated cross-service workflows.
 */

import {
  AnalyticsClient,
  AnalyticsRequest,
  AnalyticsResponse,
} from "./analytics-client";
import axios, { AxiosInstance, AxiosError } from "axios";
import { logger } from "../utils/logger";
import { redis } from "../utils/redis-config";
import { EventEmitter } from "events";
import { CircuitBreaker } from "./circuit-breaker";

// Type definitions for the orchestration service
export enum AgentType {
  SALES_ANALYTICS = "sales_analytics",
  INVENTORY_AUTOMATION = "inventory_automation",
  LEAD_MANAGEMENT = "lead_management",
  SERVICE_OPTIMIZATION = "service_optimization",
  GENERAL_PURPOSE = "general_purpose",
}

export enum ServiceType {
  ANALYTICS = "analytics",
  AUTOMATION = "automation",
  ORCHESTRATION = "orchestration",
}

export interface ServiceRequest {
  service: ServiceType;
  operation: string;
  parameters: Record<string, any>;
  priority?: "high" | "medium" | "low";
  timeout?: number;
}

export interface ServiceResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    processingTime: number;
    source: ServiceType;
    operation: string;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  requiredPermissions?: string[];
  supportedAgentTypes: AgentType[];
  errorHandling?: {
    retryCount: number;
    retryDelay: number; // in ms
    fallbackStrategy: "skip" | "alternate" | "terminate";
  };
}

export interface WorkflowStep {
  id: string;
  name: string;
  service: ServiceType;
  operation: string;
  parameters:
    | Record<string, any>
    | ((context: WorkflowContext) => Record<string, any>);
  condition?: (context: WorkflowContext) => boolean;
  onSuccess?: (result: any, context: WorkflowContext) => void;
  onError?: (error: any, context: WorkflowContext) => boolean; // Return true to continue, false to abort
  retryConfig?: {
    maxRetries: number;
    delayMs: number;
    backoffMultiplier: number;
  };
  timeout?: number; // in ms
}

export interface WorkflowContext {
  workflowId: string;
  startTime: Date;
  agentId: string;
  agentType: AgentType;
  userId?: string;
  dealershipId?: string;
  results: Record<string, any>;
  errors: Record<string, any>;
  parameters: Record<string, any>;
  state: "running" | "paused" | "completed" | "failed";
  currentStepId?: string;
  stepHistory: {
    stepId: string;
    startTime: Date;
    endTime?: Date;
    status: "success" | "error" | "skipped";
    result?: any;
    error?: any;
  }[];
}

export interface WorkflowExecutionRequest {
  workflowId: string;
  agentId: string;
  agentType: AgentType;
  parameters: Record<string, any>;
  userId?: string;
  dealershipId?: string;
  options?: {
    priority?: "high" | "medium" | "low";
    timeout?: number;
    webhookUrl?: string;
  };
}

export interface WorkflowExecutionResponse {
  executionId: string;
  workflowId: string;
  status: "accepted" | "rejected" | "completed" | "failed";
  startTime: Date;
  endTime?: Date;
  results?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Agent Orchestrator Service
 *
 * Central service for coordinating cross-service workflows between
 * analytics (watchdog) and automation (vin-agent) systems.
 */
export class AgentOrchestrator extends EventEmitter {
  private analyticsClient: AnalyticsClient;
  private automationClient: AxiosInstance;
  private workflows: Map<string, WorkflowDefinition>;
  private activeWorkflows: Map<string, WorkflowContext>;
  private analyticsCircuitBreaker: CircuitBreaker;
  private automationCircuitBreaker: CircuitBreaker;

  constructor() {
    super();

    // Initialize analytics client
    this.analyticsClient = new AnalyticsClient(
      process.env.WATCHDOG_API_URL || "http://localhost:8000",
    );

    // Initialize automation client
    this.automationClient = axios.create({
      baseURL: process.env.VIN_AGENT_API_URL || "http://localhost:5000",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize workflow registry
    this.workflows = new Map();
    this.activeWorkflows = new Map();

    // Register predefined workflows
    this.registerPredefinedWorkflows();

    // Initialize circuit breakers
    this.analyticsCircuitBreaker = new CircuitBreaker({
      name: "analytics-service",
      failureThreshold: 5,
      resetTimeout: 30000,
      onOpen: () => logger.warn("Analytics service circuit breaker opened"),
      onClose: () => logger.info("Analytics service circuit breaker closed"),
      onHalfOpen: () =>
        logger.info("Analytics service circuit breaker half-open"),
    });

    this.automationCircuitBreaker = new CircuitBreaker({
      name: "automation-service",
      failureThreshold: 5,
      resetTimeout: 30000,
      onOpen: () => logger.warn("Automation service circuit breaker opened"),
      onClose: () => logger.info("Automation service circuit breaker closed"),
      onHalfOpen: () =>
        logger.info("Automation service circuit breaker half-open"),
    });

    // Set up event listeners
    this.on("workflowStep:complete", this.handleStepCompletion.bind(this));
    this.on("workflowStep:error", this.handleStepError.bind(this));
    this.on("workflow:complete", this.handleWorkflowCompletion.bind(this));
    this.on("workflow:error", this.handleWorkflowError.bind(this));

    logger.info("Agent Orchestrator initialized");
  }

  /**
   * Register a workflow definition
   */
  public registerWorkflow(workflow: WorkflowDefinition): void {
    if (this.workflows.has(workflow.id)) {
      logger.warn(
        `Workflow with ID ${workflow.id} already exists, overwriting`,
      );
    }

    this.workflows.set(workflow.id, workflow);
    logger.info(`Registered workflow: ${workflow.name} (${workflow.id})`);
  }

  /**
   * Execute a workflow by ID
   */
  public async executeWorkflow(
    request: WorkflowExecutionRequest,
  ): Promise<WorkflowExecutionResponse> {
    const {
      workflowId,
      agentId,
      agentType,
      parameters,
      userId,
      dealershipId,
      options,
    } = request;

    // Validate workflow exists
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      logger.error(`Workflow not found: ${workflowId}`);
      return {
        executionId: "",
        workflowId,
        status: "rejected",
        startTime: new Date(),
        error: {
          code: "WORKFLOW_NOT_FOUND",
          message: `Workflow with ID ${workflowId} not found`,
        },
      };
    }

    // Validate agent type is supported
    if (!workflow.supportedAgentTypes.includes(agentType)) {
      logger.error(
        `Agent type ${agentType} not supported for workflow ${workflowId}`,
      );
      return {
        executionId: "",
        workflowId,
        status: "rejected",
        startTime: new Date(),
        error: {
          code: "AGENT_TYPE_NOT_SUPPORTED",
          message: `Agent type ${agentType} is not supported for this workflow`,
        },
      };
    }

    // Generate execution ID
    const executionId = `wf-${workflowId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create workflow context
    const context: WorkflowContext = {
      workflowId,
      startTime: new Date(),
      agentId,
      agentType,
      userId,
      dealershipId,
      results: {},
      errors: {},
      parameters,
      state: "running",
      stepHistory: [],
    };

    // Store active workflow
    this.activeWorkflows.set(executionId, context);

    // Log workflow start
    logger.info(
      `Starting workflow execution: ${workflow.name} (${executionId})`,
      {
        executionId,
        workflowId,
        agentId,
        agentType,
        dealershipId,
      },
    );

    // Execute workflow asynchronously
    this.executeWorkflowSteps(executionId, workflow, context).catch((error) => {
      logger.error(`Unhandled error in workflow execution: ${error.message}`, {
        executionId,
        workflowId,
        error,
      });

      // Update context
      context.state = "failed";
      context.errors["unhandled"] = error;

      // Emit error event
      this.emit("workflow:error", executionId, error);
    });

    // Return initial response
    return {
      executionId,
      workflowId,
      status: "accepted",
      startTime: context.startTime,
    };
  }

  /**
   * Get the status of a workflow execution
   */
  public getWorkflowStatus(
    executionId: string,
  ): WorkflowExecutionResponse | null {
    const context = this.activeWorkflows.get(executionId);
    if (!context) {
      return null;
    }

    return {
      executionId,
      workflowId: context.workflowId,
      status: this.mapStateToStatus(context.state),
      startTime: context.startTime,
      endTime:
        context.state === "completed" || context.state === "failed"
          ? new Date()
          : undefined,
      results: context.state === "completed" ? context.results : undefined,
      error:
        context.state === "failed"
          ? {
              code: "WORKFLOW_FAILED",
              message: "Workflow execution failed",
              details: context.errors,
            }
          : undefined,
    };
  }

  /**
   * List available workflows
   */
  public listWorkflows(
    agentType?: AgentType,
  ): { id: string; name: string; description: string }[] {
    const workflowList: { id: string; name: string; description: string }[] =
      [];

    for (const [id, workflow] of this.workflows.entries()) {
      if (!agentType || workflow.supportedAgentTypes.includes(agentType)) {
        workflowList.push({
          id,
          name: workflow.name,
          description: workflow.description,
        });
      }
    }

    return workflowList;
  }

  /**
   * Make a direct request to the analytics service
   */
  public async callAnalyticsService(
    request: AnalyticsRequest,
  ): Promise<AnalyticsResponse> {
    try {
      return await this.analyticsCircuitBreaker.execute(async () => {
        logger.debug("Making analytics service request", { request });
        const startTime = Date.now();

        const response = await this.analyticsClient.analyzeData(request);

        const processingTime = Date.now() - startTime;
        logger.debug("Analytics service response received", {
          processingTime,
          success: response.success,
        });

        return response;
      });
    } catch (error) {
      logger.error("Error calling analytics service", {
        error: error instanceof Error ? error.message : String(error),
        request,
      });

      return {
        success: false,
        requestId: "",
        error: {
          code: "ANALYTICS_SERVICE_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Make a direct request to the automation service
   */
  public async callAutomationService(
    operation: string,
    parameters: Record<string, any>,
  ): Promise<ServiceResponse> {
    try {
      return await this.automationCircuitBreaker.execute(async () => {
        logger.debug("Making automation service request", {
          operation,
          parameters,
        });
        const startTime = Date.now();

        const response = await this.automationClient.post(
          `/api/v1/${operation}`,
          parameters,
        );

        const processingTime = Date.now() - startTime;
        logger.debug("Automation service response received", {
          processingTime,
          status: response.status,
        });

        return {
          success: true,
          data: response.data,
          meta: {
            processingTime,
            source: ServiceType.AUTOMATION,
            operation,
          },
        };
      });
    } catch (error) {
      logger.error("Error calling automation service", {
        error: error instanceof Error ? error.message : String(error),
        operation,
        parameters,
      });

      const axiosError = error as AxiosError;

      return {
        success: false,
        error: {
          code: "AUTOMATION_SERVICE_ERROR",
          message: error instanceof Error ? error.message : String(error),
          details: axiosError.response?.data,
        },
        meta: {
          processingTime: 0,
          source: ServiceType.AUTOMATION,
          operation,
        },
      };
    }
  }

  /**
   * Execute a unified service request (analytics or automation)
   */
  public async executeServiceRequest(
    request: ServiceRequest,
  ): Promise<ServiceResponse> {
    const { service, operation, parameters } = request;

    // Log the request
    logger.info(`Executing ${service} service request: ${operation}`, {
      service,
      operation,
      parameters: JSON.stringify(parameters),
    });

    try {
      switch (service) {
        case ServiceType.ANALYTICS:
          const analyticsResponse = await this.callAnalyticsService(
            parameters as AnalyticsRequest,
          );
          return {
            success: analyticsResponse.success,
            data: analyticsResponse.insights || analyticsResponse,
            error: analyticsResponse.error,
            meta: {
              processingTime: analyticsResponse.meta?.processingTime || 0,
              source: ServiceType.ANALYTICS,
              operation,
            },
          };

        case ServiceType.AUTOMATION:
          return await this.callAutomationService(operation, parameters);

        default:
          return {
            success: false,
            error: {
              code: "INVALID_SERVICE",
              message: `Invalid service type: ${service}`,
            },
            meta: {
              processingTime: 0,
              source: ServiceType.ORCHESTRATION,
              operation,
            },
          };
      }
    } catch (error) {
      logger.error(`Error executing ${service} service request: ${operation}`, {
        error: error instanceof Error ? error.message : String(error),
        service,
        operation,
      });

      return {
        success: false,
        error: {
          code: "SERVICE_REQUEST_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
        meta: {
          processingTime: 0,
          source: ServiceType.ORCHESTRATION,
          operation,
        },
      };
    }
  }

  // Private methods

  /**
   * Execute workflow steps sequentially
   */
  private async executeWorkflowSteps(
    executionId: string,
    workflow: WorkflowDefinition,
    context: WorkflowContext,
  ): Promise<void> {
    for (const step of workflow.steps) {
      // Skip step if condition is not met
      if (step.condition && !step.condition(context)) {
        logger.info(
          `Skipping workflow step: ${step.name} (condition not met)`,
          {
            executionId,
            stepId: step.id,
          },
        );

        context.stepHistory.push({
          stepId: step.id,
          startTime: new Date(),
          endTime: new Date(),
          status: "skipped",
        });

        continue;
      }

      // Update context with current step
      context.currentStepId = step.id;

      // Record step start
      const stepStart = new Date();
      context.stepHistory.push({
        stepId: step.id,
        startTime: stepStart,
        status: "success", // Will be updated if error occurs
      });

      try {
        // Resolve parameters if they are a function
        const resolvedParameters =
          typeof step.parameters === "function"
            ? step.parameters(context)
            : step.parameters;

        // Log step execution
        logger.info(`Executing workflow step: ${step.name}`, {
          executionId,
          stepId: step.id,
          service: step.service,
          operation: step.operation,
        });

        // Execute step with retry logic
        const result = await this.executeStepWithRetry(
          step.service,
          step.operation,
          resolvedParameters,
          step.retryConfig || workflow.errorHandling,
        );

        // Store result in context
        context.results[step.id] = result;

        // Update step history
        const historyEntry = context.stepHistory.find(
          (h) => h.stepId === step.id,
        );
        if (historyEntry) {
          historyEntry.endTime = new Date();
          historyEntry.result = result;
        }

        // Call onSuccess handler if defined
        if (step.onSuccess) {
          step.onSuccess(result, context);
        }

        // Emit step completion event
        this.emit("workflowStep:complete", executionId, step.id, result);
      } catch (error) {
        logger.error(`Error executing workflow step: ${step.name}`, {
          executionId,
          stepId: step.id,
          error: error instanceof Error ? error.message : String(error),
        });

        // Store error in context
        context.errors[step.id] = error;

        // Update step history
        const historyEntry = context.stepHistory.find(
          (h) => h.stepId === step.id,
        );
        if (historyEntry) {
          historyEntry.endTime = new Date();
          historyEntry.status = "error";
          historyEntry.error = error;
        }

        // Call onError handler if defined
        let continueExecution = false;
        if (step.onError) {
          continueExecution = step.onError(error, context);
        } else if (workflow.errorHandling?.fallbackStrategy === "skip") {
          continueExecution = true;
        }

        // Emit step error event
        this.emit("workflowStep:error", executionId, step.id, error);

        // If not continuing, mark workflow as failed and exit
        if (!continueExecution) {
          context.state = "failed";
          this.emit("workflow:error", executionId, error);
          return;
        }
      }
    }

    // Mark workflow as completed
    context.state = "completed";
    this.emit("workflow:complete", executionId, context.results);
  }

  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry(
    service: ServiceType,
    operation: string,
    parameters: Record<string, any>,
    retryConfig?: any,
  ): Promise<any> {
    const maxRetries = retryConfig?.maxRetries || 3;
    const initialDelay = retryConfig?.delayMs || 1000;
    const backoffMultiplier = retryConfig?.backoffMultiplier || 2;

    let attempt = 0;
    let delay = initialDelay;

    while (attempt <= maxRetries) {
      try {
        // Execute service request
        const response = await this.executeServiceRequest({
          service,
          operation,
          parameters,
        });

        // If successful, return the data
        if (response.success) {
          return response.data;
        }

        // If not successful but we've reached max retries, throw error
        if (attempt === maxRetries) {
          throw new Error(
            `Service request failed after ${maxRetries} attempts: ${response.error?.message}`,
          );
        }

        // Log retry attempt
        logger.warn(
          `Service request failed, retrying (${attempt + 1}/${maxRetries})`,
          {
            service,
            operation,
            error: response.error,
          },
        );
      } catch (error) {
        // If we've reached max retries, rethrow the error
        if (attempt === maxRetries) {
          throw error;
        }

        // Log retry attempt
        logger.warn(
          `Service request threw exception, retrying (${attempt + 1}/${maxRetries})`,
          {
            service,
            operation,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }

      // Increment attempt counter
      attempt++;

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next attempt
      delay *= backoffMultiplier;
    }

    // This should never be reached due to the throw in the loop,
    // but TypeScript requires a return value
    throw new Error(`Service request failed after ${maxRetries} attempts`);
  }

  /**
   * Handle step completion event
   */
  private handleStepCompletion(
    executionId: string,
    stepId: string,
    result: any,
  ): void {
    logger.debug(`Workflow step completed: ${stepId}`, {
      executionId,
      stepId,
    });
  }

  /**
   * Handle step error event
   */
  private handleStepError(
    executionId: string,
    stepId: string,
    error: any,
  ): void {
    logger.debug(`Workflow step error: ${stepId}`, {
      executionId,
      stepId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Handle workflow completion event
   */
  private handleWorkflowCompletion(
    executionId: string,
    results: Record<string, any>,
  ): void {
    const context = this.activeWorkflows.get(executionId);
    if (!context) {
      return;
    }

    logger.info(`Workflow completed: ${context.workflowId}`, {
      executionId,
      workflowId: context.workflowId,
      agentId: context.agentId,
      duration: Date.now() - context.startTime.getTime(),
    });

    // Clean up after some time
    setTimeout(() => {
      this.activeWorkflows.delete(executionId);
    }, 3600000); // Keep for 1 hour
  }

  /**
   * Handle workflow error event
   */
  private handleWorkflowError(executionId: string, error: any): void {
    const context = this.activeWorkflows.get(executionId);
    if (!context) {
      return;
    }

    logger.error(`Workflow failed: ${context.workflowId}`, {
      executionId,
      workflowId: context.workflowId,
      agentId: context.agentId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - context.startTime.getTime(),
    });

    // Clean up after some time
    setTimeout(() => {
      this.activeWorkflows.delete(executionId);
    }, 3600000); // Keep for 1 hour
  }

  /**
   * Map internal state to status
   */
  private mapStateToStatus(
    state: string,
  ): "accepted" | "rejected" | "completed" | "failed" {
    switch (state) {
      case "running":
      case "paused":
        return "accepted";
      case "completed":
        return "completed";
      case "failed":
        return "failed";
      default:
        return "rejected";
    }
  }

  /**
   * Register predefined workflows
   */
  private registerPredefinedWorkflows(): void {
    // Sales Analysis and VinSolutions Update Workflow
    this.registerWorkflow({
      id: "sales-analysis-update",
      name: "Sales Analysis and VinSolutions Update",
      description:
        "Analyzes sales data and updates VinSolutions if issues are found",
      supportedAgentTypes: [
        AgentType.SALES_ANALYTICS,
        AgentType.GENERAL_PURPOSE,
      ],
      steps: [
        {
          id: "analyze-sales-data",
          name: "Analyze Sales Data",
          service: ServiceType.ANALYTICS,
          operation: "analyze",
          parameters: (context) => ({
            uploadId: context.parameters.uploadId,
            metrics: [
              "conversion_rate",
              "sales_performance",
              "lead_source_roi",
            ],
            timeRange: context.parameters.timeRange || {
              start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 30 days ago
              end: new Date().toISOString().split("T")[0], // today
            },
          }),
          onSuccess: (result, context) => {
            // Check if any issues were found that require updates
            const issues = result.insights?.filter(
              (insight) => insight.score && insight.score < 0.4, // Low score indicates an issue
            );

            // Store issues for next step
            context.results["issues"] = issues || [];
          },
        },
        {
          id: "update-vinsolutions",
          name: "Update VinSolutions",
          service: ServiceType.AUTOMATION,
          operation: "tasks/create",
          parameters: (context) => {
            const issues = context.results["issues"] || [];

            // Only proceed if issues were found
            if (issues.length === 0) {
              return { skip: true };
            }

            return {
              taskType: "vinsolutions_update",
              priority: "high",
              parameters: {
                updates: issues.map((issue) => ({
                  type: "sales_process_update",
                  reason: issue.title,
                  details: issue.description,
                  metrics: issue.metrics,
                })),
              },
              dealershipId: context.dealershipId,
              notifyUsers: context.parameters.notifyUsers || [],
            };
          },
          // Skip this step if no issues were found
          condition: (context) => {
            const issues = context.results["issues"] || [];
            return issues.length > 0;
          },
        },
        {
          id: "generate-summary-report",
          name: "Generate Summary Report",
          service: ServiceType.ANALYTICS,
          operation: "generate-report",
          parameters: (context) => ({
            uploadId: context.parameters.uploadId,
            reportType: "sales_analysis",
            includeCharts: true,
            highlights: context.results["issues"] || [],
            recommendations: true,
          }),
        },
      ],
      errorHandling: {
        retryCount: 2,
        retryDelay: 2000,
        fallbackStrategy: "skip",
      },
    });

    // Inventory Insights and Report Workflow
    this.registerWorkflow({
      id: "inventory-insights-report",
      name: "Inventory Insights and Automated Reports",
      description: "Gets inventory insights and triggers automated reports",
      supportedAgentTypes: [
        AgentType.INVENTORY_AUTOMATION,
        AgentType.GENERAL_PURPOSE,
      ],
      steps: [
        {
          id: "analyze-inventory",
          name: "Analyze Inventory Data",
          service: ServiceType.ANALYTICS,
          operation: "analyze",
          parameters: (context) => ({
            uploadId: context.parameters.uploadId,
            metrics: [
              "inventory_health",
              "aging_analysis",
              "price_competitiveness",
            ],
            filters: context.parameters.filters || {},
          }),
        },
        {
          id: "generate-inventory-report",
          name: "Generate Inventory Report",
          service: ServiceType.AUTOMATION,
          operation: "reports/generate",
          parameters: (context) => ({
            reportType: "inventory_health",
            format: context.parameters.format || "PDF",
            data: context.results["analyze-inventory"],
            recipients: context.parameters.recipients || [],
            dealershipId: context.dealershipId,
          }),
        },
        {
          id: "schedule-inventory-actions",
          name: "Schedule Inventory Actions",
          service: ServiceType.AUTOMATION,
          operation: "tasks/schedule",
          parameters: (context) => {
            const inventoryData = context.results["analyze-inventory"];
            const agingIssues = inventoryData.insights?.filter(
              (i) =>
                i.title.toLowerCase().includes("aging") &&
                i.score &&
                i.score < 0.5,
            );

            return {
              taskType: "inventory_actions",
              schedule: {
                type: "once",
                runAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
              },
              parameters: {
                actions: agingIssues?.length
                  ? [
                      {
                        type: "price_adjustment",
                        vehicles: agingIssues.flatMap(
                          (i) => i.metrics?.vehicles || [],
                        ),
                        adjustmentType: "percentage",
                        value: -3, // 3% reduction
                      },
                    ]
                  : [],
              },
              dealershipId: context.dealershipId,
            };
          },
          // Only schedule actions if aging issues were found
          condition: (context) => {
            const inventoryData = context.results["analyze-inventory"];
            const agingIssues = inventoryData.insights?.filter(
              (i) =>
                i.title.toLowerCase().includes("aging") &&
                i.score &&
                i.score < 0.5,
            );
            return agingIssues?.length > 0;
          },
        },
      ],
    });

    // Lead Trends and Follow-up Workflow
    this.registerWorkflow({
      id: "lead-trends-followup",
      name: "Lead Trends and Automated Follow-up",
      description: "Monitors lead trends and automates follow-up processes",
      supportedAgentTypes: [
        AgentType.LEAD_MANAGEMENT,
        AgentType.GENERAL_PURPOSE,
      ],
      steps: [
        {
          id: "analyze-lead-trends",
          name: "Analyze Lead Trends",
          service: ServiceType.ANALYTICS,
          operation: "analyze",
          parameters: (context) => ({
            uploadId: context.parameters.uploadId,
            metrics: [
              "lead_volume",
              "lead_sources",
              "conversion_rates",
              "response_time",
            ],
            timeRange: context.parameters.timeRange || {
              start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0], // 90 days ago
              end: new Date().toISOString().split("T")[0], // today
            },
          }),
        },
        {
          id: "identify-followup-opportunities",
          name: "Identify Follow-up Opportunities",
          service: ServiceType.ANALYTICS,
          operation: "query",
          parameters: (context) => ({
            uploadId: context.parameters.uploadId,
            query:
              "Find leads that have not been contacted in the last 7 days with a high purchase likelihood score",
            filters: {
              lastContactDays: ">7",
              purchaseLikelihood: ">0.6",
            },
          }),
        },
        {
          id: "schedule-followups",
          name: "Schedule Follow-ups",
          service: ServiceType.AUTOMATION,
          operation: "leads/schedule-followup",
          parameters: (context) => {
            const opportunities =
              context.results["identify-followup-opportunities"];
            return {
              leads: opportunities.data || [],
              template: context.parameters.template || "high_intent_followup",
              scheduleTime: context.parameters.scheduleTime || "optimal",
              channel: context.parameters.channel || "email",
              dealershipId: context.dealershipId,
            };
          },
          condition: (context) => {
            const opportunities =
              context.results["identify-followup-opportunities"];
            return (
              opportunities &&
              opportunities.data &&
              opportunities.data.length > 0
            );
          },
        },
        {
          id: "generate-lead-insights",
          name: "Generate Lead Insights Report",
          service: ServiceType.ANALYTICS,
          operation: "generate-report",
          parameters: (context) => ({
            uploadId: context.parameters.uploadId,
            reportType: "lead_management",
            includeCharts: true,
            recommendations: true,
            followupSummary: {
              scheduled: context.results["schedule-followups"]?.count || 0,
              opportunities:
                context.results["identify-followup-opportunities"]?.data
                  ?.length || 0,
            },
          }),
        },
      ],
    });
  }
}

// Export a singleton instance
export const agentOrchestrator = new AgentOrchestrator();

/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by stopping calls to failing services
 */
export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private options: {
      name: string;
      failureThreshold: number;
      resetTimeout: number;
      halfOpenSuccessThreshold?: number;
      onOpen?: () => void;
      onClose?: () => void;
      onHalfOpen?: () => void;
    },
  ) {
    this.options.halfOpenSuccessThreshold =
      this.options.halfOpenSuccessThreshold || 1;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.toHalfOpen();
      } else {
        throw new Error(`Circuit breaker for ${this.options.name} is open`);
      }
    }

    try {
      const result = await fn();

      // On success in half-open state, increment success counter
      if (this.state === "half-open") {
        this.successCount++;

        // If success threshold reached, close the circuit
        if (this.successCount >= (this.options.halfOpenSuccessThreshold || 1)) {
          this.toClose();
        }
      } else if (this.state === "closed") {
        // Reset failure count on success in closed state
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      return this.handleFailure(error);
    }
  }

  private handleFailure(error: any): never {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // If failure threshold reached, open the circuit
    if (
      this.state === "closed" &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.toOpen();
    } else if (this.state === "half-open") {
      this.toOpen();
    }

    throw error;
  }

  private toOpen(): void {
    if (this.state !== "open") {
      this.state = "open";
      this.successCount = 0;

      if (this.options.onOpen) {
        this.options.onOpen();
      }

      logger.warn(`Circuit breaker for ${this.options.name} opened`);
    }
  }

  private toHalfOpen(): void {
    if (this.state !== "half-open") {
      this.state = "half-open";
      this.successCount = 0;

      if (this.options.onHalfOpen) {
        this.options.onHalfOpen();
      }

      logger.info(`Circuit breaker for ${this.options.name} half-open`);
    }
  }

  private toClose(): void {
    if (this.state !== "closed") {
      this.state = "closed";
      this.failureCount = 0;
      this.successCount = 0;

      if (this.options.onClose) {
        this.options.onClose();
      }

      logger.info(`Circuit breaker for ${this.options.name} closed`);
    }
  }
}
