/**
 * Orchestrator Service v2
 * 
 * Enhanced orchestration service that manages cross-service workflows,
 * supports complex execution patterns, and provides replayable logs.
 * 
 * Capabilities:
 * - Sequential, parallel, and conditional execution patterns
 * - Cross-service communication via EventBus
 * - Sandbox isolation and rate limiting
 * - Correlation tracking across service boundaries
 * - Replayable logs for Agent Studio
 * - Workflow checkpoints and rollback support
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { db } from '../db';
import { 
  sandboxes, 
  sandboxSessions, 
  tokenUsageLogs,
  tools as toolsTable,
  agentTools
} from '../../shared/schema';
import { 
  eq, 
  and, 
  lte, 
  gte, 
  sum, 
  sql, 
  desc, 
  asc,
  isNull
} from 'drizzle-orm';
import { WebSocketService } from './websocket-service';
import { ToolRegistryService } from './tool-registry';
import { EventBus, EventType } from './event-bus';
import { AdsAutomationWorker, AdsTaskType } from './ads-automation-worker';
import { analyticsClient } from './analytics-client';
import { CircuitBreaker } from './circuit-breaker';

// Error types
export class RateLimitExceededError extends Error {
  constructor(message: string, public limit: number, public usage: number, public type: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

export class SandboxNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxNotFoundError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}

export class WorkflowExecutionError extends Error {
  constructor(message: string, public step: string, public details: any) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

// Workflow types
export enum WorkflowPattern {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  CONDITIONAL = 'conditional'
}

export enum WorkflowStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  parameters: Record<string, any>;
  condition?: string; // For conditional steps
  dependsOn?: string[]; // For parallel with dependencies
  status: WorkflowStepStatus;
  result?: any;
  error?: any;
  startTime?: Date;
  endTime?: Date;
  checkpoint?: boolean; // Whether this step is a checkpoint
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  pattern: WorkflowPattern;
  steps: WorkflowStep[];
  status: WorkflowStepStatus;
  correlationId: string;
  sandboxId: number;
  userId?: number;
  dealershipId?: number;
  startTime?: Date;
  endTime?: Date;
  rollbackOnFailure?: boolean;
  currentStepIndex?: number;
  result?: any;
  error?: any;
}

// Predefined workflows
export const PREDEFINED_WORKFLOWS: Record<string, Omit<Workflow, 'id' | 'correlationId' | 'sandboxId' | 'status'>> = {
  'sales-analysis-update': {
    name: 'Sales Analysis and VinSolutions Update',
    description: 'Analyze sales data and update VinSolutions CRM',
    pattern: WorkflowPattern.SEQUENTIAL,
    steps: [
      {
        id: 'step1',
        name: 'Analyze Sales Data',
        tool: 'watchdog_analysis',
        parameters: {
          question: 'What are the top-performing sales reps this month?',
          includeMetrics: ['total_sales', 'conversion_rate', 'average_deal_value']
        },
        status: WorkflowStepStatus.PENDING,
        checkpoint: true
      },
      {
        id: 'step2',
        name: 'Update VinSolutions CRM',
        tool: 'vin_agent_task',
        parameters: {
          taskType: 'update_crm_dashboard',
          platformId: 'vinsolutions',
          updateType: 'sales_performance'
        },
        status: WorkflowStepStatus.PENDING
      }
    ],
    rollbackOnFailure: true
  },
  'inventory-analysis-campaign': {
    name: 'Inventory Analysis and Google Ads Campaign',
    description: 'Analyze inventory and create targeted Google Ads campaign',
    pattern: WorkflowPattern.SEQUENTIAL,
    steps: [
      {
        id: 'step1',
        name: 'Analyze Inventory',
        tool: 'watchdog_analysis',
        parameters: {
          question: 'Which vehicle models have the highest inventory levels?',
          includeMetrics: ['inventory_count', 'days_on_lot', 'price_competitiveness']
        },
        status: WorkflowStepStatus.PENDING,
        checkpoint: true
      },
      {
        id: 'step2',
        name: 'Create Google Ads Campaign',
        tool: 'google_ads.createCampaign',
        parameters: {
          campaignName: 'High Inventory Promotion',
          budget: {
            amount: 100,
            deliveryMethod: 'STANDARD'
          },
          bidStrategy: {
            type: 'MAXIMIZE_CONVERSIONS'
          },
          isDryRun: true
        },
        status: WorkflowStepStatus.PENDING
      }
    ],
    rollbackOnFailure: false
  },
  'customer-insight-automation': {
    name: 'Customer Insight and Automation',
    description: 'Generate customer insights and automate follow-up tasks',
    pattern: WorkflowPattern.PARALLEL,
    steps: [
      {
        id: 'step1',
        name: 'Customer Segmentation Analysis',
        tool: 'watchdog_analysis',
        parameters: {
          question: 'What are the key customer segments based on purchase history?',
          includeMetrics: ['customer_lifetime_value', 'purchase_frequency', 'service_visits']
        },
        status: WorkflowStepStatus.PENDING
      },
      {
        id: 'step2',
        name: 'Lead Source Analysis',
        tool: 'watchdog_analysis',
        parameters: {
          question: 'Which lead sources have the highest conversion rates?',
          includeMetrics: ['conversion_rate', 'cost_per_lead', 'lead_quality_score']
        },
        status: WorkflowStepStatus.PENDING
      },
      {
        id: 'step3',
        name: 'Schedule Follow-up Tasks',
        tool: 'vin_agent_task',
        parameters: {
          taskType: 'schedule_followups',
          platformId: 'vinsolutions',
          targetSegment: 'high_value_customers'
        },
        dependsOn: ['step1', 'step2'],
        status: WorkflowStepStatus.PENDING
      }
    ],
    rollbackOnFailure: false
  },
  'conditional-marketing-workflow': {
    name: 'Conditional Marketing Workflow',
    description: 'Analyze performance and conditionally create marketing campaigns',
    pattern: WorkflowPattern.CONDITIONAL,
    steps: [
      {
        id: 'step1',
        name: 'Performance Analysis',
        tool: 'watchdog_analysis',
        parameters: {
          question: 'What is our current ROI on marketing spend?',
          includeMetrics: ['marketing_roi', 'cost_per_acquisition', 'conversion_rate']
        },
        status: WorkflowStepStatus.PENDING,
        checkpoint: true
      },
      {
        id: 'step2a',
        name: 'Create High-Budget Campaign',
        tool: 'google_ads.createCampaign',
        parameters: {
          campaignName: 'High ROI Expansion Campaign',
          budget: {
            amount: 200,
            deliveryMethod: 'STANDARD'
          },
          bidStrategy: {
            type: 'MAXIMIZE_CONVERSIONS'
          }
        },
        condition: 'step1.result.metrics.marketing_roi > 3',
        status: WorkflowStepStatus.PENDING
      },
      {
        id: 'step2b',
        name: 'Create Conservative Campaign',
        tool: 'google_ads.createCampaign',
        parameters: {
          campaignName: 'Conservative Optimization Campaign',
          budget: {
            amount: 50,
            deliveryMethod: 'STANDARD'
          },
          bidStrategy: {
            type: 'MAXIMIZE_CONVERSIONS_VALUE'
          }
        },
        condition: 'step1.result.metrics.marketing_roi <= 3',
        status: WorkflowStepStatus.PENDING
      }
    ],
    rollbackOnFailure: false
  }
};

/**
 * Orchestrator Service class
 * Manages cross-service workflows and tool execution
 */
export class OrchestratorService {
  private webSocketService: WebSocketService;
  private toolRegistry: ToolRegistryService;
  private eventBus: EventBus;
  private adsAutomationWorker: AdsAutomationWorker;
  private analyticsCircuitBreaker: CircuitBreaker;
  private adsCircuitBreaker: CircuitBreaker;
  private activeWorkflows: Map<string, Workflow> = new Map();
  private replayableLogs: Map<string, any[]> = new Map();

  constructor(
    webSocketService: WebSocketService,
    toolRegistry: ToolRegistryService,
    eventBus: EventBus,
    adsAutomationWorker: AdsAutomationWorker
  ) {
    this.webSocketService = webSocketService;
    this.toolRegistry = toolRegistry;
    this.eventBus = eventBus;
    this.adsAutomationWorker = adsAutomationWorker;

    // Set up circuit breakers for external services
    this.analyticsCircuitBreaker = new CircuitBreaker({
      name: 'analytics-api',
      maxFailures: 3,
      resetTimeout: 30000,
      timeout: 10000,
      failureStatusCodes: [500, 502, 503, 504]
    });

    this.adsCircuitBreaker = new CircuitBreaker({
      name: 'google-ads-api',
      maxFailures: 3,
      resetTimeout: 60000,
      timeout: 15000,
      failureStatusCodes: [500, 502, 503, 504]
    });

    // Subscribe to relevant events
    this.subscribeToEvents();
  }

  /**
   * Subscribe to relevant events from the event bus
   */
  private async subscribeToEvents(): Promise<void> {
    try {
      const consumerId = `orchestrator-${uuidv4().substring(0, 8)}`;

      // Subscribe to task completion events
      await this.eventBus.subscribe(
        consumerId,
        [EventType.TASK_COMPLETED, EventType.TASK_FAILED],
        async (event) => {
          logger.debug(`Received task event: ${event.type}`, { eventData: event });

          // Find any workflows waiting on this task
          for (const [workflowId, workflow] of this.activeWorkflows.entries()) {
            if (workflow.correlationId === event.correlationId) {
              // Update the workflow with the task result
              await this.updateWorkflowWithTaskResult(workflowId, event);
            }
          }
        }
      );

      // Subscribe to ads automation events
      await this.eventBus.subscribe(
        consumerId,
        [EventType.CAMPAIGN_CREATED, EventType.CAMPAIGN_DRY_RUN],
        async (event) => {
          logger.debug(`Received ads event: ${event.type}`, { eventData: event });

          // Add to replayable logs if correlation ID exists
          if (event.correlationId) {
            this.addToReplayableLogs(event.correlationId, {
              type: 'ads_event',
              event: event.type,
              data: event,
              timestamp: new Date().toISOString()
            });
          }
        }
      );

      logger.info('Orchestrator subscribed to events', {
        consumerId,
        events: [
          EventType.TASK_COMPLETED,
          EventType.TASK_FAILED,
          EventType.CAMPAIGN_CREATED,
          EventType.CAMPAIGN_DRY_RUN
        ]
      });
    } catch (error) {
      logger.error('Failed to subscribe to events', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }

  /**
   * Create a new sandbox
   */
  public async createSandbox(params: {
    name: string;
    description?: string;
    userId: number;
    dealershipId: number;
    hourlyTokenLimit?: number;
    dailyTokenLimit?: number;
    dailyCostLimit?: number;
  }): Promise<any> {
    try {
      // Set default limits if not provided
      const hourlyTokenLimit = params.hourlyTokenLimit || 10000;  // 10k tokens per hour
      const dailyTokenLimit = params.dailyTokenLimit || 100000;   // 100k tokens per day
      const dailyCostLimit = params.dailyCostLimit || 5.0;        // $5 per day

      // Insert sandbox into database
      const [sandbox] = await db.insert(sandboxes).values({
        name: params.name,
        description: params.description,
        userId: params.userId,
        dealershipId: params.dealershipId,
        hourlyTokenLimit,
        dailyTokenLimit,
        dailyCostLimit,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      logger.info(`Created sandbox: ${sandbox.id}`, {
        sandboxId: sandbox.id,
        name: params.name,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      // Publish sandbox creation event
      await this.eventBus.publish(EventType.SANDBOX_CREATED, {
        sandboxId: sandbox.id,
        name: params.name,
        userId: params.userId,
        dealershipId: params.dealershipId,
        timestamp: new Date().toISOString()
      });

      return sandbox;
    } catch (error) {
      logger.error('Error creating sandbox', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        params
      });
      throw error;
    }
  }

  /**
   * Get sandbox by ID
   */
  public async getSandbox(sandboxId: number): Promise<any> {
    try {
      const sandbox = await db.query.sandboxes.findFirst({
        where: and(
          eq(sandboxes.id, sandboxId),
          eq(sandboxes.isActive, true)
        )
      });

      if (!sandbox) {
        throw new SandboxNotFoundError(`Sandbox not found: ${sandboxId}`);
      }

      return sandbox;
    } catch (error) {
      if (error instanceof SandboxNotFoundError) {
        throw error;
      }
      logger.error('Error getting sandbox', {
        error: (error as Error).message,
        sandboxId
      });
      throw new Error(`Failed to get sandbox: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new sandbox session
   */
  public async createSandboxSession(params: {
    sandboxId: number;
    userId: number;
    dealershipId: number;
    clientId?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    try {
      // Check if sandbox exists and is active
      const sandbox = await this.getSandbox(params.sandboxId);

      // Generate session ID
      const sessionId = `sess_${uuidv4().replace(/-/g, '')}`;

      // Insert session into database
      const [session] = await db.insert(sandboxSessions).values({
        sandboxId: params.sandboxId,
        sessionId,
        userId: params.userId,
        dealershipId: params.dealershipId,
        clientId: params.clientId,
        metadata: params.metadata || {},
        isActive: true,
        startedAt: new Date(),
        lastActivityAt: new Date()
      }).returning();

      logger.info(`Created sandbox session: ${sessionId}`, {
        sandboxId: params.sandboxId,
        sessionId,
        userId: params.userId
      });

      // Publish session creation event
      await this.eventBus.publish(EventType.SESSION_CREATED, {
        sandboxId: params.sandboxId,
        sessionId,
        userId: params.userId,
        dealershipId: params.dealershipId,
        timestamp: new Date().toISOString()
      });

      return session;
    } catch (error) {
      logger.error('Error creating sandbox session', {
        error: (error as Error).message,
        sandboxId: params.sandboxId,
        userId: params.userId
      });
      throw error;
    }
  }

  /**
   * Get sandbox session by ID
   */
  public async getSandboxSession(sessionId: string): Promise<any> {
    try {
      const session = await db.query.sandboxSessions.findFirst({
        where: and(
          eq(sandboxSessions.sessionId, sessionId),
          eq(sandboxSessions.isActive, true)
        )
      });

      if (!session) {
        throw new SessionNotFoundError(`Session not found: ${sessionId}`);
      }

      return session;
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        throw error;
      }
      logger.error('Error getting sandbox session', {
        error: (error as Error).message,
        sessionId
      });
      throw new Error(`Failed to get sandbox session: ${(error as Error).message}`);
    }
  }

  /**
   * Update sandbox session last activity
   */
  public async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await db.update(sandboxSessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(sandboxSessions.sessionId, sessionId));
    } catch (error) {
      logger.error('Error updating session activity', {
        error: (error as Error).message,
        sessionId
      });
    }
  }

  /**
   * Check token rate limits for a sandbox
   * Returns true if within limits, false if exceeded
   */
  public async checkRateLimits(params: {
    sandboxId: number;
    sessionId: string;
    estimatedTokens: number;
  }): Promise<boolean> {
    try {
      const { sandboxId, sessionId, estimatedTokens } = params;

      // Get sandbox to check limits
      const sandbox = await this.getSandbox(sandboxId);

      // Check hourly limit
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourlyUsage = await db
        .select({ total: sum(tokenUsageLogs.tokenCount) })
        .from(tokenUsageLogs)
        .where(
          and(
            eq(tokenUsageLogs.sandboxId, sandboxId),
            gte(tokenUsageLogs.timestamp, hourAgo)
          )
        );

      const hourlyTotal = hourlyUsage[0]?.total || 0;
      if (hourlyTotal + estimatedTokens > sandbox.hourlyTokenLimit) {
        logger.warn('Hourly token limit exceeded', {
          sandboxId,
          sessionId,
          hourlyUsage: hourlyTotal,
          hourlyLimit: sandbox.hourlyTokenLimit,
          estimatedTokens
        });
        return false;
      }

      // Check daily limit
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailyUsage = await db
        .select({ total: sum(tokenUsageLogs.tokenCount) })
        .from(tokenUsageLogs)
        .where(
          and(
            eq(tokenUsageLogs.sandboxId, sandboxId),
            gte(tokenUsageLogs.timestamp, dayAgo)
          )
        );

      const dailyTotal = dailyUsage[0]?.total || 0;
      if (dailyTotal + estimatedTokens > sandbox.dailyTokenLimit) {
        logger.warn('Daily token limit exceeded', {
          sandboxId,
          sessionId,
          dailyUsage: dailyTotal,
          dailyLimit: sandbox.dailyTokenLimit,
          estimatedTokens
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking rate limits', {
        error: (error as Error).message,
        sandboxId: params.sandboxId,
        sessionId: params.sessionId
      });
      // Default to allowing the request in case of errors
      return true;
    }
  }

  /**
   * Log token usage for a sandbox
   */
  public async logTokenUsage(params: {
    sandboxId: number;
    sessionId: string;
    tokenCount: number;
    operationType: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { sandboxId, sessionId, tokenCount, operationType, metadata } = params;

      // Insert token usage log
      await db.insert(tokenUsageLogs).values({
        sandboxId,
        sessionId,
        tokenCount,
        operationType,
        metadata: metadata || {},
        timestamp: new Date()
      });

      // Update session activity
      await this.updateSessionActivity(sessionId);
    } catch (error) {
      logger.error('Error logging token usage', {
        error: (error as Error).message,
        sandboxId: params.sandboxId,
        sessionId: params.sessionId,
        tokenCount: params.tokenCount
      });
    }
  }

  /**
   * Execute a tool within a sandbox
   */
  public async executeTool(params: {
    sandboxId: number;
    sessionId: string;
    toolName: string;
    parameters: Record<string, any>;
    estimatedTokens?: number;
    userId?: number;
    dealershipId?: number;
    correlationId?: string;
  }): Promise<any> {
    const correlationId = params.correlationId || uuidv4();
    let startTime = Date.now();

    try {
      const { sandboxId, sessionId, toolName, parameters, estimatedTokens = 500 } = params;

      // Check if sandbox and session exist
      const sandbox = await this.getSandbox(sandboxId);
      const session = await this.getSandboxSession(sessionId);

      // Check rate limits
      const withinLimits = await this.checkRateLimits({
        sandboxId,
        sessionId,
        estimatedTokens
      });

      if (!withinLimits) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const hourlyUsage = await db
          .select({ total: sum(tokenUsageLogs.tokenCount) })
          .from(tokenUsageLogs)
          .where(
            and(
              eq(tokenUsageLogs.sandboxId, sandboxId),
              gte(tokenUsageLogs.timestamp, hourAgo)
            )
          );

        const hourlyTotal = hourlyUsage[0]?.total || 0;
        
        // Send rate limit exceeded event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'rate_limit_exceeded',
          data: {
            sandboxId,
            sessionId,
            toolName,
            limit: sandbox.hourlyTokenLimit,
            usage: hourlyTotal,
            estimatedTokens,
            timestamp: new Date().toISOString()
          }
        });

        // Publish rate limit event
        await this.eventBus.publish(EventType.RATE_LIMIT_EXCEEDED, {
          sandboxId,
          sessionId,
          toolName,
          limit: sandbox.hourlyTokenLimit,
          usage: hourlyTotal,
          estimatedTokens,
          timestamp: new Date().toISOString(),
          correlationId
        });

        // Add to replayable logs
        this.addToReplayableLogs(correlationId, {
          type: 'error',
          error: 'rate_limit_exceeded',
          data: {
            sandboxId,
            sessionId,
            toolName,
            limit: sandbox.hourlyTokenLimit,
            usage: hourlyTotal,
            estimatedTokens
          },
          timestamp: new Date().toISOString()
        });

        throw new RateLimitExceededError(
          'Rate limit exceeded',
          sandbox.hourlyTokenLimit,
          hourlyTotal,
          'hourly'
        );
      }

      // Log the tool execution start
      logger.info(`Executing tool: ${toolName}`, {
        sandboxId,
        sessionId,
        toolName,
        correlationId,
        estimatedTokens
      });

      // Add to replayable logs
      this.addToReplayableLogs(correlationId, {
        type: 'tool_start',
        tool: toolName,
        parameters,
        timestamp: new Date().toISOString()
      });

      // Send tool execution start event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'tool_start',
        data: {
          tool: toolName,
          parameters,
          timestamp: new Date().toISOString(),
          correlationId
        }
      });

      // Publish tool execution started event
      await this.eventBus.publish(EventType.TOOL_EXECUTION_STARTED, {
        sandboxId,
        sessionId,
        toolName,
        parameters,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      // Execute the tool based on its type
      let result;
      
      // Check if it's a Watchdog analytics tool
      if (toolName === 'watchdog_analysis') {
        // Execute analytics query with circuit breaker
        result = await this.analyticsCircuitBreaker.execute(async () => {
          return await analyticsClient.answerQuestion(
            parameters.uploadId,
            parameters.question,
            {
              correlationId,
              sandboxId,
              sessionId
            }
          );
        });

        // Stream results to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'tool_stream',
          data: {
            tool: toolName,
            streamEvent: 'data',
            data: result,
            timestamp: new Date().toISOString(),
            correlationId
          }
        });
      } 
      // Check if it's a Google Ads tool
      else if (toolName === 'google_ads.createCampaign') {
        // Execute Google Ads operation with circuit breaker
        result = await this.adsCircuitBreaker.execute(async () => {
          // Queue the task in the ads automation worker
          const taskId = await this.adsAutomationWorker.addTask({
            taskType: AdsTaskType.CAMPAIGN_CREATION,
            accountId: parameters.accountId,
            correlationId,
            sandboxId,
            userId: params.userId,
            dealershipId: params.dealershipId,
            campaignName: parameters.campaignName,
            budget: parameters.budget,
            bidStrategy: parameters.bidStrategy,
            isDryRun: parameters.isDryRun || false
          });

          // Return initial response with task ID
          return {
            success: true,
            taskId,
            status: 'queued',
            message: 'Campaign creation task queued successfully'
          };
        });

        // Stream initial response to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'tool_stream',
          data: {
            tool: toolName,
            streamEvent: 'data',
            data: result,
            timestamp: new Date().toISOString(),
            correlationId
          }
        });
      } 
      // For other tools, use the tool registry
      else {
        result = await this.toolRegistry.executeTool(toolName, parameters, {
          correlationId,
          sandboxId,
          sessionId,
          userId: params.userId,
          dealershipId: params.dealershipId,
          onProgress: (data) => {
            // Stream progress events to WebSocket
            this.webSocketService.sendToSession(sessionId, {
              type: 'tool_stream',
              data: {
                tool: toolName,
                streamEvent: 'progress',
                data,
                timestamp: new Date().toISOString(),
                correlationId
              }
            });

            // Add to replayable logs
            this.addToReplayableLogs(correlationId, {
              type: 'tool_progress',
              tool: toolName,
              data,
              timestamp: new Date().toISOString()
            });
          }
        });
      }

      // Calculate actual tokens used (estimate if not provided by tool)
      const tokensUsed = result.tokenUsage || estimatedTokens;

      // Log token usage
      await this.logTokenUsage({
        sandboxId,
        sessionId,
        tokenCount: tokensUsed,
        operationType: `tool:${toolName}`,
        metadata: {
          correlationId,
          parameters,
          executionTime: Date.now() - startTime
        }
      });

      // Add to replayable logs
      this.addToReplayableLogs(correlationId, {
        type: 'tool_complete',
        tool: toolName,
        result,
        tokensUsed,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      // Send tool execution complete event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'tool_complete',
        data: {
          tool: toolName,
          result,
          tokensUsed,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          correlationId
        }
      });

      // Publish tool execution completed event
      await this.eventBus.publish(EventType.TOOL_EXECUTION_COMPLETED, {
        sandboxId,
        sessionId,
        toolName,
        result,
        tokensUsed,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      logger.info(`Tool execution completed: ${toolName}`, {
        sandboxId,
        sessionId,
        toolName,
        correlationId,
        tokensUsed,
        executionTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Tool execution failed: ${params.toolName}`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        sandboxId: params.sandboxId,
        sessionId: params.sessionId,
        toolName: params.toolName,
        correlationId,
        executionTime
      });

      // Add to replayable logs
      this.addToReplayableLogs(correlationId, {
        type: 'tool_error',
        tool: params.toolName,
        error: {
          message: (error as Error).message,
          name: (error as Error).name,
          stack: (error as Error).stack
        },
        executionTime,
        timestamp: new Date().toISOString()
      });

      // Send error event to WebSocket
      this.webSocketService.sendToSession(params.sessionId, {
        type: 'tool_error',
        data: {
          tool: params.toolName,
          error: {
            message: (error as Error).message,
            name: (error as Error).name
          },
          executionTime,
          timestamp: new Date().toISOString(),
          correlationId
        }
      });

      // Publish tool execution failed event
      await this.eventBus.publish(EventType.TOOL_EXECUTION_FAILED, {
        sandboxId: params.sandboxId,
        sessionId: params.sessionId,
        toolName: params.toolName,
        error: {
          message: (error as Error).message,
          name: (error as Error).name
        },
        executionTime,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      // Rethrow the error
      throw error;
    }
  }

  /**
   * Execute a workflow
   */
  public async executeWorkflow(params: {
    workflowId: string;
    sandboxId: number;
    sessionId: string;
    userId?: number;
    dealershipId?: number;
    parameters?: Record<string, any>;
    correlationId?: string;
  }): Promise<any> {
    const correlationId = params.correlationId || uuidv4();
    const startTime = Date.now();

    try {
      const { workflowId, sandboxId, sessionId, parameters = {} } = params;

      // Check if it's a predefined workflow
      let workflow: Workflow;
      if (PREDEFINED_WORKFLOWS[workflowId]) {
        // Create a new workflow instance from predefined template
        workflow = {
          ...PREDEFINED_WORKFLOWS[workflowId],
          id: uuidv4(),
          correlationId,
          sandboxId,
          userId: params.userId,
          dealershipId: params.dealershipId,
          status: WorkflowStepStatus.PENDING,
          startTime: new Date()
        };

        // Apply parameters to workflow steps
        workflow.steps = workflow.steps.map(step => {
          // Apply parameters that match step.parameters keys
          const updatedParameters = { ...step.parameters };
          Object.keys(parameters).forEach(key => {
            if (key in updatedParameters) {
              updatedParameters[key] = parameters[key];
            }
          });
          return { ...step, parameters: updatedParameters };
        });
      } else {
        // Check if it's a custom workflow from database
        // This would be implemented in a real system
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Store workflow in active workflows
      this.activeWorkflows.set(workflow.id, workflow);

      // Initialize replayable logs for this workflow
      this.replayableLogs.set(correlationId, []);

      // Add workflow start to replayable logs
      this.addToReplayableLogs(correlationId, {
        type: 'workflow_start',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          pattern: workflow.pattern
        },
        timestamp: new Date().toISOString()
      });

      // Send workflow started event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'workflow_start',
        data: {
          workflow: {
            id: workflow.id,
            name: workflow.name,
            pattern: workflow.pattern,
            steps: workflow.steps.map(s => ({
              id: s.id,
              name: s.name,
              tool: s.tool,
              status: s.status
            }))
          },
          timestamp: new Date().toISOString(),
          correlationId
        }
      });

      // Publish workflow started event
      await this.eventBus.publish(EventType.ORCHESTRATION_SEQUENCE_STARTED, {
        workflowId: workflow.id,
        workflowName: workflow.name,
        pattern: workflow.pattern,
        sandboxId,
        sessionId,
        tools: workflow.steps.map(s => s.tool),
        timestamp: new Date().toISOString(),
        correlationId,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      // Update workflow status
      workflow.status = WorkflowStepStatus.RUNNING;
      this.activeWorkflows.set(workflow.id, { ...workflow });

      // Execute workflow based on pattern
      let result;
      switch (workflow.pattern) {
        case WorkflowPattern.SEQUENTIAL:
          result = await this.executeSequentialWorkflow(workflow, sessionId);
          break;
        case WorkflowPattern.PARALLEL:
          result = await this.executeParallelWorkflow(workflow, sessionId);
          break;
        case WorkflowPattern.CONDITIONAL:
          result = await this.executeConditionalWorkflow(workflow, sessionId);
          break;
        default:
          throw new Error(`Unsupported workflow pattern: ${workflow.pattern}`);
      }

      // Update workflow status and end time
      workflow.status = WorkflowStepStatus.COMPLETED;
      workflow.endTime = new Date();
      workflow.result = result;
      this.activeWorkflows.set(workflow.id, { ...workflow });

      // Add workflow completion to replayable logs
      this.addToReplayableLogs(correlationId, {
        type: 'workflow_complete',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          pattern: workflow.pattern
        },
        result,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      // Send workflow completed event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'workflow_complete',
        data: {
          workflow: {
            id: workflow.id,
            name: workflow.name,
            pattern: workflow.pattern,
            steps: workflow.steps.map(s => ({
              id: s.id,
              name: s.name,
              tool: s.tool,
              status: s.status,
              result: s.result
            }))
          },
          result,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          correlationId
        }
      });

      // Publish workflow completed event
      await this.eventBus.publish(EventType.ORCHESTRATION_SEQUENCE_COMPLETED, {
        workflowId: workflow.id,
        workflowName: workflow.name,
        pattern: workflow.pattern,
        sandboxId,
        sessionId,
        tools: workflow.steps.map(s => s.tool),
        results: workflow.steps.map(s => ({
          stepId: s.id,
          tool: s.tool,
          status: s.status,
          result: s.result
        })),
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      logger.info(`Workflow execution completed: ${workflow.name}`, {
        workflowId: workflow.id,
        sandboxId,
        sessionId,
        correlationId,
        executionTime: Date.now() - startTime
      });

      return {
        workflowId: workflow.id,
        name: workflow.name,
        status: workflow.status,
        steps: workflow.steps.map(s => ({
          id: s.id,
          name: s.name,
          tool: s.tool,
          status: s.status,
          result: s.result
        })),
        result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Workflow execution failed: ${params.workflowId}`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        sandboxId: params.sandboxId,
        sessionId: params.sessionId,
        workflowId: params.workflowId,
        correlationId,
        executionTime
      });

      // Add to replayable logs
      this.addToReplayableLogs(correlationId, {
        type: 'workflow_error',
        workflowId: params.workflowId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name,
          stack: (error as Error).stack
        },
        executionTime,
        timestamp: new Date().toISOString()
      });

      // Send error event to WebSocket
      this.webSocketService.sendToSession(params.sessionId, {
        type: 'workflow_error',
        data: {
          workflowId: params.workflowId,
          error: {
            message: (error as Error).message,
            name: (error as Error).name
          },
          executionTime,
          timestamp: new Date().toISOString(),
          correlationId
        }
      });

      // Publish workflow failed event
      await this.eventBus.publish(EventType.ORCHESTRATION_SEQUENCE_FAILED, {
        workflowId: params.workflowId,
        sandboxId: params.sandboxId,
        sessionId: params.sessionId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name
        },
        executionTime,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: params.userId,
        dealershipId: params.dealershipId
      });

      // Rethrow the error
      throw error;
    }
  }

  /**
   * Execute a sequential workflow
   */
  private async executeSequentialWorkflow(workflow: Workflow, sessionId: string): Promise<any> {
    const results = [];

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      workflow.currentStepIndex = i;

      // Update step status
      step.status = WorkflowStepStatus.RUNNING;
      step.startTime = new Date();
      this.activeWorkflows.set(workflow.id, { ...workflow });

      // Send step started event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'workflow_step_start',
        data: {
          workflowId: workflow.id,
          stepId: step.id,
          stepName: step.name,
          tool: step.tool,
          parameters: step.parameters,
          timestamp: new Date().toISOString(),
          correlationId: workflow.correlationId
        }
      });

      try {
        // Execute the tool for this step
        const result = await this.executeTool({
          sandboxId: workflow.sandboxId,
          sessionId,
          toolName: step.tool,
          parameters: step.parameters,
          userId: workflow.userId,
          dealershipId: workflow.dealershipId,
          correlationId: workflow.correlationId
        });

        // Update step with result
        step.status = WorkflowStepStatus.COMPLETED;
        step.result = result;
        step.endTime = new Date();
        this.activeWorkflows.set(workflow.id, { ...workflow });

        // Send step completed event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_complete',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            tool: step.tool,
            result,
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        results.push(result);

        // If this is a checkpoint step and it failed, stop the workflow
        if (step.checkpoint && !this.isStepSuccessful(step)) {
          logger.warn(`Checkpoint step failed, stopping workflow: ${workflow.id}`, {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name
          });
          break;
        }
      } catch (error) {
        // Update step with error
        step.status = WorkflowStepStatus.FAILED;
        step.error = {
          message: (error as Error).message,
          name: (error as Error).name
        };
        step.endTime = new Date();
        this.activeWorkflows.set(workflow.id, { ...workflow });

        // Send step failed event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_error',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            tool: step.tool,
            error: {
              message: (error as Error).message,
              name: (error as Error).name
            },
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        // If rollback is enabled, perform rollback
        if (workflow.rollbackOnFailure) {
          await this.rollbackWorkflow(workflow, i, sessionId);
        }

        // Rethrow the error to stop the workflow
        throw new WorkflowExecutionError(
          `Step ${step.name} failed: ${(error as Error).message}`,
          step.id,
          error
        );
      }
    }

    return {
      success: true,
      results
    };
  }

  /**
   * Execute a parallel workflow
   */
  private async executeParallelWorkflow(workflow: Workflow, sessionId: string): Promise<any> {
    // Group steps by dependencies
    const independentSteps = workflow.steps.filter(step => !step.dependsOn || step.dependsOn.length === 0);
    const dependentSteps = workflow.steps.filter(step => step.dependsOn && step.dependsOn.length > 0);

    // Execute independent steps in parallel
    const independentPromises = independentSteps.map(async (step, index) => {
      // Update step status
      step.status = WorkflowStepStatus.RUNNING;
      step.startTime = new Date();
      this.activeWorkflows.set(workflow.id, { ...workflow });

      // Send step started event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'workflow_step_start',
        data: {
          workflowId: workflow.id,
          stepId: step.id,
          stepName: step.name,
          tool: step.tool,
          parameters: step.parameters,
          timestamp: new Date().toISOString(),
          correlationId: workflow.correlationId
        }
      });

      try {
        // Execute the tool for this step
        const result = await this.executeTool({
          sandboxId: workflow.sandboxId,
          sessionId,
          toolName: step.tool,
          parameters: step.parameters,
          userId: workflow.userId,
          dealershipId: workflow.dealershipId,
          correlationId: workflow.correlationId
        });

        // Update step with result
        step.status = WorkflowStepStatus.COMPLETED;
        step.result = result;
        step.endTime = new Date();
        this.activeWorkflows.set(workflow.id, { ...workflow });

        // Send step completed event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_complete',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            tool: step.tool,
            result,
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        return { stepId: step.id, result };
      } catch (error) {
        // Update step with error
        step.status = WorkflowStepStatus.FAILED;
        step.error = {
          message: (error as Error).message,
          name: (error as Error).name
        };
        step.endTime = new Date();
        this.activeWorkflows.set(workflow.id, { ...workflow });

        // Send step failed event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_error',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            tool: step.tool,
            error: {
              message: (error as Error).message,
              name: (error as Error).name
            },
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        // If this is a checkpoint step, throw error to stop workflow
        if (step.checkpoint) {
          throw new WorkflowExecutionError(
            `Checkpoint step ${step.name} failed: ${(error as Error).message}`,
            step.id,
            error
          );
        }

        return { stepId: step.id, error };
      }
    });

    // Wait for all independent steps to complete
    const independentResults = await Promise.allSettled(independentPromises);
    
    // Check if any checkpoint steps failed
    const checkpointFailed = independentSteps.some(
      step => step.checkpoint && step.status === WorkflowStepStatus.FAILED
    );

    if (checkpointFailed) {
      // If rollback is enabled, perform rollback
      if (workflow.rollbackOnFailure) {
        await this.rollbackWorkflow(workflow, -1, sessionId);
      }

      throw new WorkflowExecutionError(
        'Workflow execution failed: checkpoint step failed',
        'checkpoint',
        { workflow }
      );
    }

    // Execute dependent steps if there are any
    if (dependentSteps.length > 0) {
      // Create a map of step IDs to results
      const stepResults = new Map<string, any>();
      independentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          stepResults.set(result.value.stepId, result.value.result);
        }
      });

      // Execute dependent steps that have all dependencies satisfied
      const dependentPromises = dependentSteps
        .filter(step => {
          // Check if all dependencies are completed successfully
          return step.dependsOn!.every(depId => {
            const depStep = workflow.steps.find(s => s.id === depId);
            return depStep && depStep.status === WorkflowStepStatus.COMPLETED;
          });
        })
        .map(async step => {
          // Update step status
          step.status = WorkflowStepStatus.RUNNING;
          step.startTime = new Date();
          this.activeWorkflows.set(workflow.id, { ...workflow });

          // Send step started event to WebSocket
          this.webSocketService.sendToSession(sessionId, {
            type: 'workflow_step_start',
            data: {
              workflowId: workflow.id,
              stepId: step.id,
              stepName: step.name,
              tool: step.tool,
              parameters: step.parameters,
              timestamp: new Date().toISOString(),
              correlationId: workflow.correlationId
            }
          });

          try {
            // Prepare parameters with dependency results
            const enhancedParams = { ...step.parameters };
            step.dependsOn!.forEach(depId => {
              if (stepResults.has(depId)) {
                // Add dependency results to parameters
                enhancedParams[`dep_${depId}`] = stepResults.get(depId);
              }
            });

            // Execute the tool for this step
            const result = await this.executeTool({
              sandboxId: workflow.sandboxId,
              sessionId,
              toolName: step.tool,
              parameters: enhancedParams,
              userId: workflow.userId,
              dealershipId: workflow.dealershipId,
              correlationId: workflow.correlationId
            });

            // Update step with result
            step.status = WorkflowStepStatus.COMPLETED;
            step.result = result;
            step.endTime = new Date();
            this.activeWorkflows.set(workflow.id, { ...workflow });

            // Send step completed event to WebSocket
            this.webSocketService.sendToSession(sessionId, {
              type: 'workflow_step_complete',
              data: {
                workflowId: workflow.id,
                stepId: step.id,
                stepName: step.name,
                tool: step.tool,
                result,
                timestamp: new Date().toISOString(),
                correlationId: workflow.correlationId
              }
            });

            return { stepId: step.id, result };
          } catch (error) {
            // Update step with error
            step.status = WorkflowStepStatus.FAILED;
            step.error = {
              message: (error as Error).message,
              name: (error as Error).name
            };
            step.endTime = new Date();
            this.activeWorkflows.set(workflow.id, { ...workflow });

            // Send step failed event to WebSocket
            this.webSocketService.sendToSession(sessionId, {
              type: 'workflow_step_error',
              data: {
                workflowId: workflow.id,
                stepId: step.id,
                stepName: step.name,
                tool: step.tool,
                error: {
                  message: (error as Error).message,
                  name: (error as Error).name
                },
                timestamp: new Date().toISOString(),
                correlationId: workflow.correlationId
              }
            });

            return { stepId: step.id, error };
          }
        });

      // Wait for dependent steps to complete
      const dependentResults = await Promise.allSettled(dependentPromises);

      // Add dependent results to the step results map
      dependentResults.forEach(result => {
        if (result.status === 'fulfilled') {
          stepResults.set(result.value.stepId, result.value.result);
        }
      });

      // Collect all results
      const allResults = Array.from(stepResults.entries()).map(([stepId, result]) => {
        const step = workflow.steps.find(s => s.id === stepId);
        return {
          stepId,
          stepName: step?.name,
          tool: step?.tool,
          result
        };
      });

      return {
        success: true,
        results: allResults
      };
    }

    // Collect results from independent steps
    const results = independentResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value);

    return {
      success: true,
      results
    };
  }

  /**
   * Execute a conditional workflow
   */
  private async executeConditionalWorkflow(workflow: Workflow, sessionId: string): Promise<any> {
    const results = [];

    // Execute steps in order, but only if conditions are met
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      workflow.currentStepIndex = i;

      // Check if step has a condition
      if (step.condition && i > 0) {
        // Evaluate condition against previous step results
        const shouldExecute = await this.evaluateCondition(step.condition, workflow);

        if (!shouldExecute) {
          // Skip this step
          step.status = WorkflowStepStatus.SKIPPED;
          this.activeWorkflows.set(workflow.id, { ...workflow });

          // Send step skipped event to WebSocket
          this.webSocketService.sendToSession(sessionId, {
            type: 'workflow_step_skip',
            data: {
              workflowId: workflow.id,
              stepId: step.id,
              stepName: step.name,
              tool: step.tool,
              condition: step.condition,
              timestamp: new Date().toISOString(),
              correlationId: workflow.correlationId
            }
          });

          continue;
        }
      }

      // Update step status
      step.status = WorkflowStepStatus.RUNNING;
      step.startTime = new Date();
      this.activeWorkflows.set(workflow.id, { ...workflow });

      // Send step started event to WebSocket
      this.webSocketService.sendToSession(sessionId, {
        type: 'workflow_step_start',
        data: {
          workflowId: workflow.id,
          stepId: step.id,
          stepName: step.name,
          tool: step.tool,
          parameters: step.parameters,
          timestamp: new Date().toISOString(),
          correlationId: workflow.correlationId
        }
      });

      try {
        // Execute the tool for this step
        const result = await this.executeTool({
          sandboxId: workflow.sandboxId,
          sessionId,
          toolName: step.tool,
          parameters: step.parameters,
          userId: workflow.userId,
          dealershipId: workflow.dealershipId,
          correlationId: workflow.correlationId
        });

        // Update step with result
        step.status = WorkflowStepStatus.COMPLETED;
        step.result = result;
        step.endTime = new Date();
        this.activeWorkflows.set(workflow.id, { ...workflow });

        // Send step completed event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_complete',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            tool: step.tool,
            result,
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        results.push(result);

        // If this is a checkpoint step and it failed, stop the workflow
        if (step.checkpoint && !this.isStepSuccessful(step)) {
          logger.warn(`Checkpoint step failed, stopping workflow: ${workflow.id}`, {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name
          });
          break;
        }
      } catch (error) {
        // Update step with error
        step.status = WorkflowStepStatus.FAILED;
        step.error = {
          message: (error as Error).message,
          name: (error as Error).name
        };
        step.endTime = new Date();
        this.activeWorkflows.set(workflow.id, { ...workflow });

        // Send step failed event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_error',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            tool: step.tool,
            error: {
              message: (error as Error).message,
              name: (error as Error).name
            },
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        // If rollback is enabled, perform rollback
        if (workflow.rollbackOnFailure) {
          await this.rollbackWorkflow(workflow, i, sessionId);
        }

        // Rethrow the error to stop the workflow
        throw new WorkflowExecutionError(
          `Step ${step.name} failed: ${(error as Error).message}`,
          step.id,
          error
        );
      }
    }

    return {
      success: true,
      results
    };
  }

  /**
   * Evaluate a condition against workflow step results
   */
  private async evaluateCondition(condition: string, workflow: Workflow): Promise<boolean> {
    try {
      // Parse the condition (e.g., "step1.result.metrics.marketing_roi > 3")
      const [stepRef, comparison] = condition.split(/\s*(>|<|>=|<=|==|!=)\s*/);
      const operator = condition.match(/(>|<|>=|<=|==|!=)/)?.[0];
      const valueStr = condition.split(/\s*(>|<|>=|<=|==|!=)\s*/)[2];

      if (!stepRef || !operator || !valueStr) {
        logger.error(`Invalid condition format: ${condition}`);
        return false;
      }

      // Extract step ID from the reference
      const stepId = stepRef.split('.')[0];
      const step = workflow.steps.find(s => s.id === stepId);

      if (!step || step.status !== WorkflowStepStatus.COMPLETED) {
        logger.error(`Referenced step not found or not completed: ${stepId}`);
        return false;
      }

      // Extract the value from the step result using the path
      const path = stepRef.split('.').slice(1);
      let actualValue = step.result;
      
      for (const segment of path) {
        if (actualValue && typeof actualValue === 'object' && segment in actualValue) {
          actualValue = actualValue[segment];
        } else {
          logger.error(`Path not found in step result: ${path.join('.')}`);
          return false;
        }
      }

      // Parse the comparison value
      let comparisonValue: any;
      try {
        comparisonValue = JSON.parse(valueStr);
      } catch (e) {
        // If not valid JSON, treat as string
        comparisonValue = valueStr;
      }

      // Perform the comparison
      switch (operator) {
        case '>':
          return actualValue > comparisonValue;
        case '<':
          return actualValue < comparisonValue;
        case '>=':
          return actualValue >= comparisonValue;
        case '<=':
          return actualValue <= comparisonValue;
        case '==':
          return actualValue == comparisonValue;
        case '!=':
          return actualValue != comparisonValue;
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Error evaluating condition: ${condition}`, {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Roll back a workflow to a previous state
   */
  private async rollbackWorkflow(workflow: Workflow, failedStepIndex: number, sessionId: string): Promise<void> {
    logger.info(`Rolling back workflow: ${workflow.id}`, {
      workflowId: workflow.id,
      failedStepIndex
    });

    // Send rollback started event to WebSocket
    this.webSocketService.sendToSession(sessionId, {
      type: 'workflow_rollback_start',
      data: {
        workflowId: workflow.id,
        timestamp: new Date().toISOString(),
        correlationId: workflow.correlationId
      }
    });

    // Identify steps that need rollback (completed steps up to the failed step)
    const stepsToRollback = workflow.steps
      .filter((step, index) => 
        index < failedStepIndex && 
        step.status === WorkflowStepStatus.COMPLETED
      )
      .reverse(); // Roll back in reverse order

    // Perform rollback for each step
    for (const step of stepsToRollback) {
      try {
        // Check if the step has a rollback action
        // In a real system, you would define rollback actions for each step
        // For now, just log the rollback
        logger.info(`Rolling back step: ${step.id}`, {
          workflowId: workflow.id,
          stepId: step.id,
          stepName: step.name
        });

        // Send step rollback event to WebSocket
        this.webSocketService.sendToSession(sessionId, {
          type: 'workflow_step_rollback',
          data: {
            workflowId: workflow.id,
            stepId: step.id,
            stepName: step.name,
            timestamp: new Date().toISOString(),
            correlationId: workflow.correlationId
          }
        });

        // Perform actual rollback action
        // This would depend on the specific step and tool
        // For example, if a step created a resource, the rollback would delete it
      } catch (error) {
        logger.error(`Error rolling back step: ${step.id}`, {
          error: (error as Error).message,
          workflowId: workflow.id,
          stepId: step.id
        });
      }
    }

    // Send rollback completed event to WebSocket
    this.webSocketService.sendToSession(sessionId, {
      type: 'workflow_rollback_complete',
      data: {
        workflowId: workflow.id,
        timestamp: new Date().toISOString(),
        correlationId: workflow.correlationId
      }
    });
  }

  /**
   * Update a workflow with task result from event
   */
  private async updateWorkflowWithTaskResult(workflowId: string, event: any): Promise<void> {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) return;

      // Find the step that corresponds to this task
      const stepIndex = workflow.steps.findIndex(step => 
        step.tool === event.taskType && 
        step.status === WorkflowStepStatus.RUNNING
      );

      if (stepIndex === -1) return;

      const step = workflow.steps[stepIndex];

      // Update step with result
      if (event.type === EventType.TASK_COMPLETED) {
        step.status = WorkflowStepStatus.COMPLETED;
        step.result = event.result;
        step.endTime = new Date();
      } else if (event.type === EventType.TASK_FAILED) {
        step.status = WorkflowStepStatus.FAILED;
        step.error = event.error;
        step.endTime = new Date();
      }

      // Update workflow
      this.activeWorkflows.set(workflowId, { ...workflow });

      // Send step update to WebSocket
      this.webSocketService.sendToSession(workflow.sandboxId.toString(), {
        type: event.type === EventType.TASK_COMPLETED ? 'workflow_step_complete' : 'workflow_step_error',
        data: {
          workflowId,
          stepId: step.id,
          stepName: step.name,
          tool: step.tool,
          result: step.result,
          error: step.error,
          timestamp: new Date().toISOString(),
          correlationId: workflow.correlationId
        }
      });
    } catch (error) {
      logger.error(`Error updating workflow with task result: ${workflowId}`, {
        error: (error as Error).message,
        workflowId,
        eventType: event.type
      });
    }
  }

  /**
   * Check if a step was successful
   */
  private isStepSuccessful(step: WorkflowStep): boolean {
    if (step.status !== WorkflowStepStatus.COMPLETED) return false;
    
    // Check if result indicates success
    // This would depend on the specific tool and result format
    if (step.result && typeof step.result === 'object') {
      return step.result.success === true;
    }
    
    return true;
  }

  /**
   * Add an entry to replayable logs
   */
  private addToReplayableLogs(correlationId: string, entry: any): void {
    if (!this.replayableLogs.has(correlationId)) {
      this.replayableLogs.set(correlationId, []);
    }
    
    this.replayableLogs.get(correlationId)!.push(entry);
    
    // Limit log size to prevent memory issues
    const logs = this.replayableLogs.get(correlationId)!;
    if (logs.length > 1000) {
      this.replayableLogs.set(correlationId, logs.slice(-1000));
    }
  }

  /**
   * Get replayable logs for a correlation ID
   */
  public getReplayableLogs(correlationId: string): any[] {
    return this.replayableLogs.get(correlationId) || [];
  }

  /**
   * Get available tools for a sandbox
   */
  public async getAvailableTools(sandboxId: number): Promise<any[]> {
    try {
      // Get tools from database
      const tools = await db.query.toolsTable.findMany({
        where: eq(toolsTable.isActive, true),
        with: {
          agentTools: {
            where: eq(agentTools.sandboxId, sandboxId)
          }
        }
      });

      // Transform to include enabled status
      return tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        type: tool.type,
        service: tool.service,
        endpoint: tool.endpoint,
        enabled: tool.agentTools.length > 0,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      }));
    } catch (error) {
      logger.error('Error getting available tools', {
        error: (error as Error).message,
        sandboxId
      });
      throw error;
    }
  }

  /**
   * Enable a tool for a sandbox
   */
  public async enableTool(params: {
    sandboxId: number;
    toolId: number;
    userId: number;
  }): Promise<void> {
    try {
      const { sandboxId, toolId, userId } = params;

      // Check if tool is already enabled
      const existing = await db.query.agentTools.findFirst({
        where: and(
          eq(agentTools.sandboxId, sandboxId),
          eq(agentTools.toolId, toolId)
        )
      });

      if (existing) return;

      // Enable tool
      await db.insert(agentTools).values({
        sandboxId,
        toolId,
        enabledBy: userId,
        enabledAt: new Date()
      });

      logger.info(`Tool enabled for sandbox: ${toolId}`, {
        sandboxId,
        toolId,
        userId
      });
    } catch (error) {
      logger.error('Error enabling tool', {
        error: (error as Error).message,
        sandboxId: params.sandboxId,
        toolId: params.toolId
      });
      throw error;
    }
  }

  /**
   * Disable a tool for a sandbox
   */
  public async disableTool(params: {
    sandboxId: number;
    toolId: number;
  }): Promise<void> {
    try {
      const { sandboxId, toolId } = params;

      // Disable tool
      await db.delete(agentTools)
        .where(
          and(
            eq(agentTools.sandboxId, sandboxId),
            eq(agentTools.toolId, toolId)
          )
        );

      logger.info(`Tool disabled for sandbox: ${toolId}`, {
        sandboxId,
        toolId
      });
    } catch (error) {
      logger.error('Error disabling tool', {
        error: (error as Error).message,
        sandboxId: params.sandboxId,
        toolId: params.toolId
      });
      throw error;
    }
  }

  /**
   * Get sandbox usage statistics
   */
  public async getSandboxUsage(sandboxId: number): Promise<any> {
    try {
      // Get total token usage
      const totalUsage = await db
        .select({ total: sum(tokenUsageLogs.tokenCount) })
        .from(tokenUsageLogs)
        .where(eq(tokenUsageLogs.sandboxId, sandboxId));

      // Get hourly usage
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const hourlyUsage = await db
        .select({ total: sum(tokenUsageLogs.tokenCount) })
        .from(tokenUsageLogs)
        .where(
          and(
            eq(tokenUsageLogs.sandboxId, sandboxId),
            gte(tokenUsageLogs.timestamp, hourAgo)
          )
        );

      // Get daily usage
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailyUsage = await db
        .select({ total: sum(tokenUsageLogs.tokenCount) })
        .from(tokenUsageLogs)
        .where(
          and(
            eq(tokenUsageLogs.sandboxId, sandboxId),
            gte(tokenUsageLogs.timestamp, dayAgo)
          )
        );

      // Get usage by operation type
      const usageByType = await db
        .select({
          operationType: tokenUsageLogs.operationType,
          total: sum(tokenUsageLogs.tokenCount)
        })
        .from(tokenUsageLogs)
        .where(eq(tokenUsageLogs.sandboxId, sandboxId))
        .groupBy(tokenUsageLogs.operationType);

      // Get active sessions
      const activeSessions = await db
        .select({ count: sql`count(*)` })
        .from(sandboxSessions)
        .where(
          and(
            eq(sandboxSessions.sandboxId, sandboxId),
            eq(sandboxSessions.isActive, true)
          )
        );

      // Get sandbox details
      const sandbox = await this.getSandbox(sandboxId);

      return {
        sandboxId,
        name: sandbox.name,
        totalTokens: totalUsage[0]?.total || 0,
        hourlyTokens: hourlyUsage[0]?.total || 0,
        dailyTokens: dailyUsage[0]?.total || 0,
        hourlyLimit: sandbox.hourlyTokenLimit,
        dailyLimit: sandbox.dailyTokenLimit,
        usageByType: usageByType.map(item => ({
          operationType: item.operationType,
          tokens: item.total
        })),
        activeSessions: activeSessions[0]?.count || 0,
        isActive: sandbox.isActive,
        createdAt: sandbox.createdAt
      };
    } catch (error) {
      logger.error('Error getting sandbox usage', {
        error: (error as Error).message,
        sandboxId
      });
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get active workflows for a sandbox
   */
  public getActiveWorkflows(sandboxId: number): Workflow[] {
    return Array.from(this.activeWorkflows.values())
      .filter(workflow => workflow.sandboxId === sandboxId);
  }

  /**
   * Clean up old workflows and logs
   */
  public cleanupOldData(): void {
    const now = Date.now();
    
    // Clean up workflows older than 24 hours
    for (const [workflowId, workflow] of this.activeWorkflows.entries()) {
      if (workflow.endTime && now - workflow.endTime.getTime() > 24 * 60 * 60 * 1000) {
        this.activeWorkflows.delete(workflowId);
      }
    }
    
    // Clean up logs older than 24 hours
    for (const [correlationId, logs] of this.replayableLogs.entries()) {
      if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        if (lastLog.timestamp && now - new Date(lastLog.timestamp).getTime() > 24 * 60 * 60 * 1000) {
          this.replayableLogs.delete(correlationId);
        }
      }
    }
  }
}

// Export singleton instance
export const orchestratorService = new OrchestratorService(
  // These will be injected when the module is imported
  null as any, // webSocketService will be injected
  null as any, // toolRegistry will be injected
  null as any, // eventBus will be injected
  null as any  // adsAutomationWorker will be injected
);

export default orchestratorService;
