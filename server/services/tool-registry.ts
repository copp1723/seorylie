/**
 * Tool Registry Service
 *
 * Central hub for managing, registering, and executing tools within the agent ecosystem.
 * Provides a unified interface for agents to discover and use tools across different services.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  tools,
  agent_tools,
  Tool,
  AgentTool,
  InsertTool,
  InsertAgentTool,
} from "../../shared/schema";
import { logger } from "../utils/logger";
import { analyticsClient, AnalyticsResponse } from "./analytics-client";
import { EventEmitter } from "events";
import { z } from "zod";
import { WebSocketService } from "./websocket-service";

// Tool execution context
export interface ToolContext {
  agentId: string;
  conversationId?: string;
  userId?: string;
  dealershipId?: string;
  sessionId?: string;
  requestId: string;
  timestamp: number;
}

// Tool execution request
export interface ToolRequest {
  toolName: string;
  parameters: Record<string, any>;
  context: ToolContext;
  timeout?: number;
  streaming?: boolean;
}

// Tool execution response
export interface ToolResponse {
  success: boolean;
  toolName: string;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    processingTime: number;
    toolVersion?: string;
    requestId: string;
  };
}

// Tool execution stream event
export interface ToolStreamEvent {
  type: "start" | "data" | "error" | "end";
  toolName: string;
  requestId: string;
  timestamp: number;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Tool handler function type
export type ToolHandler = (
  parameters: Record<string, any>,
  context: ToolContext,
) => Promise<any>;

// Tool handler with streaming support
export type StreamingToolHandler = (
  parameters: Record<string, any>,
  context: ToolContext,
  emitter: EventEmitter,
) => Promise<void>;

// Tool definition
export interface ToolDefinition {
  name: string;
  handler: ToolHandler;
  streamingHandler?: StreamingToolHandler;
  inputSchema: z.ZodType<any>;
  description: string;
  version: string;
  category: string;
  requiresAuth: boolean;
  timeout: number; // in milliseconds
}

/**
 * Tool Registry Service
 *
 * Manages the registration, discovery, and execution of tools across the platform.
 */
class ToolRegistryService extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private metricsCollector: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    executionTimes: Record<string, number[]>;
    lastExecutionTimestamp: number;
  } = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    executionTimes: {},
    lastExecutionTimestamp: Date.now(),
  };

  constructor(private wsService?: WebSocketService) {
    super();
    this.initializeBuiltInTools();

    // Set up event listeners
    this.on("tool:executed", this.handleToolExecution.bind(this));
    this.on("tool:failed", this.handleToolFailure.bind(this));

    // Log initialization
    logger.info("Tool Registry Service initialized", {
      wsServiceAvailable: !!this.wsService,
    });

    // Start periodic metrics logging
    setInterval(() => this.logMetrics(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Initialize built-in tools
   */
  private initializeBuiltInTools(): void {
    // Register the watchdog_analysis tool
    this.registerInMemoryTool({
      name: "watchdog_analysis",
      handler: this.handleWatchdogAnalysis.bind(this),
      streamingHandler: this.handleWatchdogAnalysisStream.bind(this),
      inputSchema: z.object({
        uploadId: z.string().min(1),
        question: z.string().min(1),
      }),
      description:
        "Analyzes data and answers questions using the Watchdog analytics engine",
      version: "1.0.0",
      category: "analytics",
      requiresAuth: true,
      timeout: 30000, // 30 seconds
    });

    // Register the vin_agent_task tool
    this.registerInMemoryTool({
      name: "vin_agent_task",
      handler: this.handleVinAgentTask.bind(this),
      inputSchema: z.object({
        taskType: z.string().min(1),
        parameters: z.record(z.any()),
        priority: z.enum(["low", "medium", "high"]).optional(),
      }),
      description: "Executes automation tasks using the VIN Agent service",
      version: "1.0.0",
      category: "automation",
      requiresAuth: true,
      timeout: 60000, // 60 seconds
    });
  }

  /**
   * Register a tool in memory (not persisted to database)
   */
  private registerInMemoryTool(toolDef: ToolDefinition): void {
    this.tools.set(toolDef.name, toolDef);
    logger.info(`Registered in-memory tool: ${toolDef.name}`, {
      category: toolDef.category,
      version: toolDef.version,
    });
  }

  /**
   * Handle watchdog analysis tool execution
   */
  private async handleWatchdogAnalysis(
    parameters: { uploadId: string; question: string },
    context: ToolContext,
  ): Promise<AnalyticsResponse> {
    logger.info(`Executing watchdog_analysis tool`, {
      uploadId: parameters.uploadId,
      agentId: context.agentId,
      requestId: context.requestId,
    });

    try {
      // Call the analytics client
      const response = await analyticsClient.answerQuestion(
        parameters.uploadId,
        parameters.question,
      );

      return response;
    } catch (error) {
      logger.error(`Error executing watchdog_analysis tool`, {
        error: error instanceof Error ? error.message : String(error),
        uploadId: parameters.uploadId,
        requestId: context.requestId,
      });

      throw error;
    }
  }

  /**
   * Handle watchdog analysis tool streaming execution
   */
  private async handleWatchdogAnalysisStream(
    parameters: { uploadId: string; question: string },
    context: ToolContext,
    emitter: EventEmitter,
  ): Promise<void> {
    try {
      // Emit start event
      emitter.emit("data", {
        type: "start",
        toolName: "watchdog_analysis",
        requestId: context.requestId,
        timestamp: Date.now(),
      });

      // Call the analytics client
      const response = await analyticsClient.answerQuestion(
        parameters.uploadId,
        parameters.question,
      );

      // Emit data event with the response
      emitter.emit("data", {
        type: "data",
        toolName: "watchdog_analysis",
        requestId: context.requestId,
        timestamp: Date.now(),
        data: response,
      });

      // Emit end event
      emitter.emit("data", {
        type: "end",
        toolName: "watchdog_analysis",
        requestId: context.requestId,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Emit error event
      emitter.emit("data", {
        type: "error",
        toolName: "watchdog_analysis",
        requestId: context.requestId,
        timestamp: Date.now(),
        error: {
          code: "TOOL_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Handle VIN Agent task execution
   */
  private async handleVinAgentTask(
    parameters: {
      taskType: string;
      parameters: Record<string, any>;
      priority?: "low" | "medium" | "high";
    },
    context: ToolContext,
  ): Promise<any> {
    logger.info(`Executing vin_agent_task tool`, {
      taskType: parameters.taskType,
      agentId: context.agentId,
      requestId: context.requestId,
    });

    try {
      // This is a placeholder - in a real implementation, you would call the VIN Agent API
      // For now, we'll just return a mock response
      return {
        success: true,
        taskId: `task-${Date.now()}`,
        status: "accepted",
        estimatedCompletionTime: new Date(Date.now() + 60000).toISOString(),
      };
    } catch (error) {
      logger.error(`Error executing vin_agent_task tool`, {
        error: error instanceof Error ? error.message : String(error),
        taskType: parameters.taskType,
        requestId: context.requestId,
      });

      throw error;
    }
  }

  /**
   * Execute a tool by name
   */
  public async executeTool(request: ToolRequest): Promise<ToolResponse> {
    const { toolName, parameters, context, timeout } = request;
    const startTime = Date.now();

    // Update metrics
    this.metricsCollector.totalExecutions++;
    this.metricsCollector.lastExecutionTimestamp = startTime;
    if (!this.metricsCollector.executionTimes[toolName]) {
      this.metricsCollector.executionTimes[toolName] = [];
    }

    try {
      // Find the tool
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Validate parameters against the input schema
      try {
        tool.inputSchema.parse(parameters);
      } catch (error) {
        logger.warn(`Tool parameter validation failed for ${toolName}`, {
          error: error instanceof Error ? error.message : String(error),
          parameters,
          requestId: context.requestId,
        });

        return {
          success: false,
          toolName,
          error: {
            code: "INVALID_PARAMETERS",
            message: "Invalid parameters for tool",
            details: error instanceof Error ? error.message : String(error),
          },
          meta: {
            processingTime: Date.now() - startTime,
            requestId: context.requestId,
          },
        };
      }

      // Execute the tool with timeout
      const timeoutMs = timeout || tool.timeout;
      const result = await Promise.race([
        tool.handler(parameters, context),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Tool execution timed out after ${timeoutMs}ms`),
              ),
            timeoutMs,
          ),
        ),
      ]);

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.metricsCollector.executionTimes[toolName].push(processingTime);

      // Update success metrics
      this.metricsCollector.successfulExecutions++;

      // Emit tool executed event
      this.emit("tool:executed", {
        toolName,
        processingTime,
        context,
      });

      // Return success response
      return {
        success: true,
        toolName,
        data: result,
        meta: {
          processingTime,
          toolVersion: tool.version,
          requestId: context.requestId,
        },
      };
    } catch (error) {
      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Update failure metrics
      this.metricsCollector.failedExecutions++;

      // Log the error
      logger.error(`Tool execution failed for ${toolName}`, {
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId,
        processingTime,
      });

      // Emit tool failed event
      this.emit("tool:failed", {
        toolName,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        context,
      });

      // Return error response
      return {
        success: false,
        toolName,
        error: {
          code: "TOOL_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
        meta: {
          processingTime,
          requestId: context.requestId,
        },
      };
    }
  }

  /**
   * Execute a tool with streaming response
   */
  public executeToolStream(request: ToolRequest): EventEmitter {
    const { toolName, parameters, context } = request;
    const emitter = new EventEmitter();

    // Find the tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      // Emit error and end events
      setTimeout(() => {
        emitter.emit("data", {
          type: "error",
          toolName,
          requestId: context.requestId,
          timestamp: Date.now(),
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool not found: ${toolName}`,
          },
        });

        emitter.emit("data", {
          type: "end",
          toolName,
          requestId: context.requestId,
          timestamp: Date.now(),
        });
      }, 0);

      return emitter;
    }

    // Check if tool supports streaming
    if (!tool.streamingHandler) {
      // Use the regular handler and convert to streaming
      setTimeout(async () => {
        try {
          // Emit start event
          emitter.emit("data", {
            type: "start",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
          });

          // Execute the tool
          const result = await tool.handler(parameters, context);

          // Emit data event
          emitter.emit("data", {
            type: "data",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
            data: result,
          });

          // Emit end event
          emitter.emit("data", {
            type: "end",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
          });
        } catch (error) {
          // Emit error event
          emitter.emit("data", {
            type: "error",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
            error: {
              code: "TOOL_EXECUTION_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          });

          // Emit end event
          emitter.emit("data", {
            type: "end",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
          });
        }
      }, 0);

      return emitter;
    }

    // Use the streaming handler
    setTimeout(async () => {
      try {
        // Validate parameters against the input schema
        try {
          tool.inputSchema.parse(parameters);
        } catch (validationError) {
          // Emit error for validation failure
          emitter.emit("data", {
            type: "error",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
            error: {
              code: "INVALID_PARAMETERS",
              message: "Invalid parameters for tool",
              details:
                validationError instanceof Error
                  ? validationError.message
                  : String(validationError),
            },
          });

          // Emit end event
          emitter.emit("data", {
            type: "end",
            toolName,
            requestId: context.requestId,
            timestamp: Date.now(),
          });

          return;
        }

        // Execute the streaming handler
        await tool.streamingHandler(parameters, context, emitter);
      } catch (error) {
        // Emit error event for any uncaught errors
        emitter.emit("data", {
          type: "error",
          toolName,
          requestId: context.requestId,
          timestamp: Date.now(),
          error: {
            code: "TOOL_EXECUTION_ERROR",
            message: error instanceof Error ? error.message : String(error),
          },
        });

        // Emit end event
        emitter.emit("data", {
          type: "end",
          toolName,
          requestId: context.requestId,
          timestamp: Date.now(),
        });
      }
    }, 0);

    return emitter;
  }

  /**
   * Register a new tool in the database
   */
  public async registerTool(toolData: InsertTool): Promise<Tool> {
    try {
      // Check if a tool with the same name already exists
      const existingTool = await db.query.tools.findFirst({
        where: eq(tools.name, toolData.name),
      });

      if (existingTool) {
        throw new Error(`Tool with name '${toolData.name}' already exists`);
      }

      // Insert the tool into the database
      const [insertedTool] = await db
        .insert(tools)
        .values(toolData)
        .returning();

      logger.info(`Registered new tool in database: ${toolData.name}`, {
        id: insertedTool.id,
        service: toolData.service,
        category: toolData.category,
      });

      return insertedTool;
    } catch (error) {
      logger.error(`Failed to register tool: ${toolData.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get a tool by name
   */
  public async getToolByName(name: string): Promise<Tool | null> {
    try {
      const tool = await db.query.tools.findFirst({
        where: eq(tools.name, name),
      });

      return tool;
    } catch (error) {
      logger.error(`Failed to get tool by name: ${name}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get all tools
   */
  public async getAllTools(): Promise<Tool[]> {
    try {
      return await db.query.tools.findMany();
    } catch (error) {
      logger.error(`Failed to get all tools`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get tools by category
   */
  public async getToolsByCategory(category: string): Promise<Tool[]> {
    try {
      return await db.query.tools.findMany({
        where: eq(tools.category, category),
      });
    } catch (error) {
      logger.error(`Failed to get tools by category: ${category}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get tools by service
   */
  public async getToolsByService(service: string): Promise<Tool[]> {
    try {
      return await db.query.tools.findMany({
        where: eq(tools.service, service),
      });
    } catch (error) {
      logger.error(`Failed to get tools by service: ${service}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Update a tool
   */
  public async updateTool(
    id: number,
    toolData: Partial<InsertTool>,
  ): Promise<Tool | null> {
    try {
      const [updatedTool] = await db
        .update(tools)
        .set(toolData)
        .where(eq(tools.id, id))
        .returning();

      if (!updatedTool) {
        return null;
      }

      logger.info(`Updated tool: ${updatedTool.name}`, {
        id: updatedTool.id,
      });

      return updatedTool;
    } catch (error) {
      logger.error(`Failed to update tool with id: ${id}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Delete a tool
   */
  public async deleteTool(id: number): Promise<boolean> {
    try {
      const [deletedTool] = await db
        .delete(tools)
        .where(eq(tools.id, id))
        .returning();

      if (!deletedTool) {
        return false;
      }

      logger.info(`Deleted tool: ${deletedTool.name}`, {
        id: deletedTool.id,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to delete tool with id: ${id}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Assign a tool to an agent
   */
  public async assignToolToAgent(
    agentId: string,
    toolId: number,
    config?: Partial<InsertAgentTool>,
  ): Promise<AgentTool> {
    try {
      // Check if the assignment already exists
      const existingAssignment = await db.query.agent_tools.findFirst({
        where: and(
          eq(agent_tools.agent_id, agentId),
          eq(agent_tools.tool_id, toolId),
        ),
      });

      if (existingAssignment) {
        // Update the existing assignment
        const [updatedAssignment] = await db
          .update(agent_tools)
          .set({
            ...config,
            is_enabled: config?.is_enabled ?? existingAssignment.is_enabled,
          })
          .where(eq(agent_tools.id, existingAssignment.id))
          .returning();

        logger.info(`Updated tool assignment for agent: ${agentId}`, {
          toolId,
          assignmentId: updatedAssignment.id,
        });

        return updatedAssignment;
      }

      // Create a new assignment
      const [newAssignment] = await db
        .insert(agent_tools)
        .values({
          agent_id: agentId,
          tool_id: toolId,
          permissions: config?.permissions,
          config_override: config?.config_override,
          is_enabled: config?.is_enabled ?? true,
        })
        .returning();

      logger.info(`Assigned tool to agent: ${agentId}`, {
        toolId,
        assignmentId: newAssignment.id,
      });

      return newAssignment;
    } catch (error) {
      logger.error(`Failed to assign tool to agent: ${agentId}`, {
        toolId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Unassign a tool from an agent
   */
  public async unassignToolFromAgent(
    agentId: string,
    toolId: number,
  ): Promise<boolean> {
    try {
      const [deletedAssignment] = await db
        .delete(agent_tools)
        .where(
          and(
            eq(agent_tools.agent_id, agentId),
            eq(agent_tools.tool_id, toolId),
          ),
        )
        .returning();

      if (!deletedAssignment) {
        return false;
      }

      logger.info(`Unassigned tool from agent: ${agentId}`, {
        toolId,
        assignmentId: deletedAssignment.id,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to unassign tool from agent: ${agentId}`, {
        toolId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get all tools assigned to an agent
   */
  public async getAgentTools(agentId: string): Promise<AgentTool[]> {
    try {
      return await db.query.agent_tools.findMany({
        where: eq(agent_tools.agent_id, agentId),
        with: {
          tool: true,
        },
      });
    } catch (error) {
      logger.error(`Failed to get tools for agent: ${agentId}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Check if an agent has access to a tool
   */
  public async agentHasToolAccess(
    agentId: string,
    toolName: string,
  ): Promise<boolean> {
    try {
      // Get the tool ID
      const tool = await this.getToolByName(toolName);
      if (!tool) {
        return false;
      }

      // Check if the agent has access to the tool
      const assignment = await db.query.agent_tools.findFirst({
        where: and(
          eq(agent_tools.agent_id, agentId),
          eq(agent_tools.tool_id, tool.id),
          eq(agent_tools.is_enabled, true),
        ),
      });

      return !!assignment;
    } catch (error) {
      logger.error(`Failed to check tool access for agent: ${agentId}`, {
        toolName,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Handle tool execution event
   */
  private handleToolExecution(data: {
    toolName: string;
    processingTime: number;
    context: ToolContext;
  }): void {
    // Log the event
    logger.debug(`Tool executed: ${data.toolName}`, {
      processingTime: data.processingTime,
      agentId: data.context.agentId,
      requestId: data.context.requestId,
    });

    // Send WebSocket notification if available
    if (this.wsService && data.context.sessionId) {
      this.wsService.sendToSession(data.context.sessionId, {
        type: "tool:stream",
        toolName: data.toolName,
        requestId: data.context.requestId,
        timestamp: Date.now(),
        status: "end",
        data: {
          processingTime: data.processingTime,
          success: true,
        },
      });
    }
  }

  /**
   * Handle tool failure event
   */
  private handleToolFailure(data: {
    toolName: string;
    error: string;
    processingTime: number;
    context: ToolContext;
  }): void {
    // Log the event
    logger.warn(`Tool failed: ${data.toolName}`, {
      error: data.error,
      processingTime: data.processingTime,
      agentId: data.context.agentId,
      requestId: data.context.requestId,
    });

    // Send WebSocket notification if available
    if (this.wsService && data.context.sessionId) {
      this.wsService.sendToSession(data.context.sessionId, {
        type: "tool:stream",
        toolName: data.toolName,
        requestId: data.context.requestId,
        timestamp: Date.now(),
        status: "error",
        error: {
          message: data.error,
          code: "TOOL_EXECUTION_ERROR",
        },
      });
    }
  }

  /**
   * Log metrics for tool usage
   */
  private logMetrics(): void {
    // Calculate average execution times for each tool
    const averageExecutionTimes: Record<string, number> = {};
    for (const [toolName, times] of Object.entries(
      this.metricsCollector.executionTimes,
    )) {
      if (times.length > 0) {
        const sum = times.reduce((acc, time) => acc + time, 0);
        averageExecutionTimes[toolName] = sum / times.length;
      }
    }

    // Log the metrics
    logger.info("Tool registry metrics", {
      totalExecutions: this.metricsCollector.totalExecutions,
      successfulExecutions: this.metricsCollector.successfulExecutions,
      failedExecutions: this.metricsCollector.failedExecutions,
      successRate:
        this.metricsCollector.totalExecutions > 0
          ? (this.metricsCollector.successfulExecutions /
              this.metricsCollector.totalExecutions) *
            100
          : 100,
      averageExecutionTimes,
      lastExecutionTimestamp: this.metricsCollector.lastExecutionTimestamp,
    });

    // Reset execution times to prevent memory growth
    for (const toolName in this.metricsCollector.executionTimes) {
      this.metricsCollector.executionTimes[toolName] = [];
    }
  }

  /**
   * Get available tools (in-memory)
   */
  public getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool definition (in-memory)
   */
  public getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get metrics for tool usage
   */
  public getMetrics(): any {
    return {
      totalExecutions: this.metricsCollector.totalExecutions,
      successfulExecutions: this.metricsCollector.successfulExecutions,
      failedExecutions: this.metricsCollector.failedExecutions,
      successRate:
        this.metricsCollector.totalExecutions > 0
          ? (this.metricsCollector.successfulExecutions /
              this.metricsCollector.totalExecutions) *
            100
          : 100,
      lastExecutionTimestamp: this.metricsCollector.lastExecutionTimestamp,
    };
  }
}

// Export a singleton instance
export const toolRegistry = new ToolRegistryService();

// Export types
export type {
  ToolContext,
  ToolRequest,
  ToolResponse,
  ToolStreamEvent,
  ToolHandler,
  StreamingToolHandler,
  ToolDefinition,
};
