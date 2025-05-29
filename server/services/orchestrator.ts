/**
 * Enhanced Orchestrator Service (v2)
 * 
 * Provides sandbox isolation, rate limiting, and WebSocket channel namespacing
 * for secure and controlled agent execution environments.
 */

import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { 
  sandboxes, 
  sandbox_sessions, 
  token_usage_logs, 
  Sandbox, 
  SandboxSession, 
  TokenUsageLog,
  InsertSandbox,
  InsertSandboxSession
} from '../../shared/schema';
import { logger } from '../utils/logger';
import { toolRegistry, ToolRequest, ToolResponse } from './tool-registry';
import { getWebSocketService, WebSocketService, MessageType } from './websocket-service';
import { AgentSquadOrchestrator } from './agentSquad';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { performance } from 'perf_hooks';

// Rate limit error
export class RateLimitExceededError extends Error {
  constructor(
    public sandboxId: number,
    public limit: number,
    public timeframe: 'hourly' | 'daily',
    public currentUsage: number
  ) {
    super(`Rate limit exceeded: ${timeframe} limit of ${limit} tokens reached (current usage: ${currentUsage})`);
    this.name = 'RateLimitExceededError';
  }
}

// Sandbox not found error
export class SandboxNotFoundError extends Error {
  constructor(public identifier: string | number) {
    super(`Sandbox not found: ${identifier}`);
    this.name = 'SandboxNotFoundError';
  }
}

// Unauthorized sandbox access error
export class UnauthorizedSandboxAccessError extends Error {
  constructor(public sandboxId: number, public userId?: number) {
    super(`Unauthorized access to sandbox ${sandboxId}${userId ? ` by user ${userId}` : ''}`);
    this.name = 'UnauthorizedSandboxAccessError';
  }
}

// Sandbox operation types for token tracking
export enum SandboxOperationType {
  AGENT_MESSAGE = 'agent_message',
  TOOL_EXECUTION = 'tool_execution',
  FUNCTION_CALL = 'function_call',
  ANALYTICS_QUERY = 'analytics_query',
  AUTOMATION_TASK = 'automation_task',
  SYSTEM_PROMPT = 'system_prompt'
}

// Sandbox WebSocket message
interface SandboxWebSocketMessage {
  type: string;
  sandboxId: number;
  sessionId: string;
  payload: any;
  timestamp?: number;
  requestId?: string;
}

// Sandbox session context
export interface SandboxSessionContext {
  sandboxId: number;
  sessionId: string;
  userId?: number;
  dealershipId?: number;
  websocketChannel: string;
}

// Operation options
export interface SandboxOperationOptions {
  maxTokens?: number;
  priority?: 'high' | 'normal' | 'low';
  timeout?: number;
  streaming?: boolean;
}

// Token usage tracking
interface TokenUsage {
  sandboxId: number;
  sessionId: string;
  operationType: SandboxOperationType;
  tokensUsed: number;
  requestId: string;
}

/**
 * Orchestrator Service (v2)
 * 
 * Manages sandboxed agent execution environments with token rate limiting
 * and isolated WebSocket channels.
 */
export class OrchestratorService {
  private wsService: WebSocketService;
  private sandboxChannels: Map<string, Set<WebSocket>> = new Map();
  private sandboxSessions: Map<string, SandboxSessionContext> = new Map();
  private metricsCollector = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    rateLimitedOperations: 0,
    totalTokensUsed: 0,
    operationTimes: new Map<string, number[]>(),
    lastOperationTimestamp: Date.now()
  };
  
  constructor(
    private agentSquad?: AgentSquadOrchestrator
  ) {
    this.wsService = getWebSocketService();
    this.initializeWebSocketChannels();
    
    // Start periodic cleanup and metrics logging
    setInterval(() => this.cleanupInactiveSessions(), 15 * 60 * 1000); // Every 15 minutes
    setInterval(() => this.logMetrics(), 5 * 60 * 1000); // Every 5 minutes
    
    logger.info('Orchestrator Service (v2) initialized');
  }
  
  /**
   * Initialize WebSocket channels for sandbox communication
   */
  private initializeWebSocketChannels(): void {
    // This method will be called to set up WebSocket channel handling
    // The actual implementation depends on how your WebSocket server is configured
    
    logger.info('Initializing sandbox WebSocket channels');
    
    // The WebSocket server should be configured to route messages to the appropriate handler
    // based on the URL path, e.g., /ws/sandbox/:id
    
    // We'll implement this in a separate WebSocket routing setup
  }
  
  /**
   * Create a new sandbox
   */
  async createSandbox(data: Omit<InsertSandbox, 'created_at' | 'updated_at'>): Promise<Sandbox> {
    try {
      const [sandbox] = await db.insert(sandboxes).values(data).returning();
      
      logger.info(`Created sandbox: ${sandbox.name} (ID: ${sandbox.id})`, {
        sandboxId: sandbox.id,
        dealershipId: sandbox.dealership_id
      });
      
      return sandbox;
    } catch (error) {
      logger.error('Error creating sandbox', {
        error: error instanceof Error ? error.message : String(error),
        data
      });
      throw error;
    }
  }
  
  /**
   * Get a sandbox by ID
   */
  async getSandbox(id: number): Promise<Sandbox | null> {
    try {
      const sandbox = await db.query.sandboxes.findFirst({
        where: eq(sandboxes.id, id)
      });
      
      return sandbox;
    } catch (error) {
      logger.error(`Error getting sandbox with ID ${id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Update a sandbox
   */
  async updateSandbox(id: number, data: Partial<Omit<InsertSandbox, 'created_at' | 'updated_at'>>): Promise<Sandbox | null> {
    try {
      const [updatedSandbox] = await db.update(sandboxes)
        .set(data)
        .where(eq(sandboxes.id, id))
        .returning();
      
      if (!updatedSandbox) {
        return null;
      }
      
      logger.info(`Updated sandbox: ${updatedSandbox.name} (ID: ${updatedSandbox.id})`, {
        sandboxId: updatedSandbox.id
      });
      
      return updatedSandbox;
    } catch (error) {
      logger.error(`Error updating sandbox with ID ${id}`, {
        error: error instanceof Error ? error.message : String(error),
        data
      });
      throw error;
    }
  }
  
  /**
   * Delete a sandbox
   */
  async deleteSandbox(id: number): Promise<boolean> {
    try {
      // First, delete all sessions for this sandbox
      await db.delete(sandbox_sessions)
        .where(eq(sandbox_sessions.sandbox_id, id));
      
      // Then delete the sandbox
      const [deletedSandbox] = await db.delete(sandboxes)
        .where(eq(sandboxes.id, id))
        .returning();
      
      if (!deletedSandbox) {
        return false;
      }
      
      logger.info(`Deleted sandbox: ${deletedSandbox.name} (ID: ${deletedSandbox.id})`, {
        sandboxId: deletedSandbox.id
      });
      
      return true;
    } catch (error) {
      logger.error(`Error deleting sandbox with ID ${id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get all sandboxes for a dealership
   */
  async getSandboxesByDealership(dealershipId: number): Promise<Sandbox[]> {
    try {
      return await db.query.sandboxes.findMany({
        where: eq(sandboxes.dealership_id, dealershipId),
        orderBy: [desc(sandboxes.created_at)]
      });
    } catch (error) {
      logger.error(`Error getting sandboxes for dealership ${dealershipId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get all sandboxes owned by a user
   */
  async getSandboxesByOwner(ownerId: number): Promise<Sandbox[]> {
    try {
      return await db.query.sandboxes.findMany({
        where: eq(sandboxes.owner_id, ownerId),
        orderBy: [desc(sandboxes.created_at)]
      });
    } catch (error) {
      logger.error(`Error getting sandboxes for owner ${ownerId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Create a new sandbox session
   */
  async createSandboxSession(data: {
    sandboxId: number;
    userId?: number;
    dealershipId?: number;
  }): Promise<SandboxSessionContext> {
    try {
      // Check if sandbox exists
      const sandbox = await this.getSandbox(data.sandboxId);
      if (!sandbox) {
        throw new SandboxNotFoundError(data.sandboxId);
      }
      
      // Generate a unique session ID and WebSocket channel
      const sessionId = this.generateSessionId();
      const websocketChannel = `ws/sandbox/${data.sandboxId}/${sessionId}`;
      
      // Create the session in the database
      const [session] = await db.insert(sandbox_sessions).values({
        sandbox_id: data.sandboxId,
        session_id: sessionId,
        user_id: data.userId,
        websocket_channel: websocketChannel,
        is_active: true,
        last_activity: new Date()
      }).returning();
      
      // Create session context
      const sessionContext: SandboxSessionContext = {
        sandboxId: data.sandboxId,
        sessionId,
        userId: data.userId,
        dealershipId: data.dealershipId,
        websocketChannel
      };
      
      // Store in memory for quick access
      this.sandboxSessions.set(sessionId, sessionContext);
      
      logger.info(`Created sandbox session: ${sessionId}`, {
        sandboxId: data.sandboxId,
        userId: data.userId,
        websocketChannel
      });
      
      return sessionContext;
    } catch (error) {
      logger.error('Error creating sandbox session', {
        error: error instanceof Error ? error.message : String(error),
        sandboxId: data.sandboxId,
        userId: data.userId
      });
      throw error;
    }
  }
  
  /**
   * Get a sandbox session by ID
   */
  async getSandboxSession(sessionId: string): Promise<SandboxSession | null> {
    try {
      // Check in-memory cache first
      if (this.sandboxSessions.has(sessionId)) {
        // Still need to get the full record from the database
        const session = await db.query.sandbox_sessions.findFirst({
          where: eq(sandbox_sessions.session_id, sessionId)
        });
        
        return session;
      }
      
      // Not in cache, query database
      const session = await db.query.sandbox_sessions.findFirst({
        where: eq(sandbox_sessions.session_id, sessionId)
      });
      
      if (session) {
        // Add to in-memory cache
        this.sandboxSessions.set(sessionId, {
          sandboxId: session.sandbox_id,
          sessionId: session.session_id,
          userId: session.user_id || undefined,
          websocketChannel: session.websocket_channel
        });
      }
      
      return session;
    } catch (error) {
      logger.error(`Error getting sandbox session: ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Update a sandbox session
   */
  async updateSandboxSession(sessionId: string, data: {
    isActive?: boolean;
  }): Promise<SandboxSession | null> {
    try {
      // Update the session in the database
      const [updatedSession] = await db.update(sandbox_sessions)
        .set({
          ...data,
          last_activity: new Date()
        })
        .where(eq(sandbox_sessions.session_id, sessionId))
        .returning();
      
      if (!updatedSession) {
        return null;
      }
      
      logger.debug(`Updated sandbox session: ${sessionId}`, {
        isActive: data.isActive
      });
      
      return updatedSession;
    } catch (error) {
      logger.error(`Error updating sandbox session: ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
        data
      });
      throw error;
    }
  }
  
  /**
   * Delete a sandbox session
   */
  async deleteSandboxSession(sessionId: string): Promise<boolean> {
    try {
      // Delete the session from the database
      const [deletedSession] = await db.delete(sandbox_sessions)
        .where(eq(sandbox_sessions.session_id, sessionId))
        .returning();
      
      if (!deletedSession) {
        return false;
      }
      
      // Remove from in-memory cache
      this.sandboxSessions.delete(sessionId);
      
      logger.info(`Deleted sandbox session: ${sessionId}`, {
        sandboxId: deletedSession.sandbox_id
      });
      
      return true;
    } catch (error) {
      logger.error(`Error deleting sandbox session: ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get all sessions for a sandbox
   */
  async getSandboxSessions(sandboxId: number): Promise<SandboxSession[]> {
    try {
      return await db.query.sandbox_sessions.findMany({
        where: eq(sandbox_sessions.sandbox_id, sandboxId),
        orderBy: [desc(sandbox_sessions.last_activity)]
      });
    } catch (error) {
      logger.error(`Error getting sessions for sandbox ${sandboxId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Track token usage for a sandbox operation
   */
  async trackTokenUsage(usage: TokenUsage): Promise<boolean> {
    try {
      // Call the database function to record token usage
      const result = await db.execute(sql`
        SELECT record_token_usage(
          ${usage.sandboxId},
          ${usage.sessionId},
          ${usage.operationType},
          ${usage.tokensUsed},
          ${usage.requestId}
        ) as success
      `);
      
      const success = result[0]?.success === true;
      
      // Update metrics
      this.metricsCollector.totalOperations++;
      this.metricsCollector.totalTokensUsed += usage.tokensUsed;
      this.metricsCollector.lastOperationTimestamp = Date.now();
      
      if (success) {
        this.metricsCollector.successfulOperations++;
      } else {
        this.metricsCollector.rateLimitedOperations++;
        
        // Get current sandbox usage for error details
        const sandbox = await this.getSandbox(usage.sandboxId);
        if (sandbox) {
          // Determine if hourly or daily limit was exceeded
          const hourlyLimitExceeded = sandbox.current_hourly_usage + usage.tokensUsed > sandbox.token_limit_per_hour;
          const dailyLimitExceeded = sandbox.current_daily_usage + usage.tokensUsed > sandbox.token_limit_per_day;
          
          if (hourlyLimitExceeded) {
            throw new RateLimitExceededError(
              usage.sandboxId,
              sandbox.token_limit_per_hour,
              'hourly',
              sandbox.current_hourly_usage
            );
          } else if (dailyLimitExceeded) {
            throw new RateLimitExceededError(
              usage.sandboxId,
              sandbox.token_limit_per_day,
              'daily',
              sandbox.current_daily_usage
            );
          }
        }
        
        // Generic rate limit error if we couldn't determine the specific limit
        throw new RateLimitExceededError(
          usage.sandboxId,
          0,
          'hourly',
          0
        );
      }
      
      return success;
    } catch (error) {
      // Only log if it's not a RateLimitExceededError, since that's expected
      if (!(error instanceof RateLimitExceededError)) {
        logger.error('Error tracking token usage', {
          error: error instanceof Error ? error.message : String(error),
          sandboxId: usage.sandboxId,
          sessionId: usage.sessionId,
          operationType: usage.operationType,
          tokensUsed: usage.tokensUsed
        });
      }
      
      // Rethrow the error
      throw error;
    }
  }
  
  /**
   * Check if an operation would exceed rate limits without recording usage
   */
  async checkRateLimit(sandboxId: number, tokensToUse: number): Promise<{
    allowed: boolean;
    hourlyLimit: number;
    hourlyUsage: number;
    dailyLimit: number;
    dailyUsage: number;
  }> {
    try {
      // Get sandbox with current usage
      const sandbox = await this.getSandbox(sandboxId);
      if (!sandbox) {
        throw new SandboxNotFoundError(sandboxId);
      }
      
      // Check if sandbox is active
      if (!sandbox.is_active) {
        return {
          allowed: false,
          hourlyLimit: sandbox.token_limit_per_hour,
          hourlyUsage: sandbox.current_hourly_usage,
          dailyLimit: sandbox.token_limit_per_day,
          dailyUsage: sandbox.current_daily_usage
        };
      }
      
      // Check if usage would exceed limits
      const hourlyAllowed = sandbox.current_hourly_usage + tokensToUse <= sandbox.token_limit_per_hour;
      const dailyAllowed = sandbox.current_daily_usage + tokensToUse <= sandbox.token_limit_per_day;
      
      return {
        allowed: hourlyAllowed && dailyAllowed,
        hourlyLimit: sandbox.token_limit_per_hour,
        hourlyUsage: sandbox.current_hourly_usage,
        dailyLimit: sandbox.token_limit_per_day,
        dailyUsage: sandbox.current_daily_usage
      };
    } catch (error) {
      logger.error(`Error checking rate limit for sandbox ${sandboxId}`, {
        error: error instanceof Error ? error.message : String(error),
        tokensToUse
      });
      throw error;
    }
  }
  
  /**
   * Reset usage counters for all sandboxes
   */
  async resetUsageCounters(): Promise<void> {
    try {
      // Call the database function to reset counters
      await db.execute(sql`SELECT reset_token_usage_counters()`);
      
      logger.info('Reset token usage counters for all sandboxes');
    } catch (error) {
      logger.error('Error resetting usage counters', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get token usage statistics for a sandbox
   */
  async getSandboxUsageStats(sandboxId: number): Promise<{
    hourlyUsage: number;
    dailyUsage: number;
    hourlyLimit: number;
    dailyLimit: number;
    hourlyRemaining: number;
    dailyRemaining: number;
    usageByType: Record<string, number>;
    usageBySession: Record<string, number>;
  }> {
    try {
      // Get sandbox with current usage
      const sandbox = await this.getSandbox(sandboxId);
      if (!sandbox) {
        throw new SandboxNotFoundError(sandboxId);
      }
      
      // Get usage by operation type
      const usageByTypeResult = await db.execute(sql`
        SELECT operation_type, SUM(tokens_used) as total_tokens
        FROM token_usage_logs
        WHERE sandbox_id = ${sandboxId}
        AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY operation_type
      `);
      
      const usageByType: Record<string, number> = {};
      for (const row of usageByTypeResult) {
        usageByType[row.operation_type] = Number(row.total_tokens);
      }
      
      // Get usage by session
      const usageBySessionResult = await db.execute(sql`
        SELECT session_id, SUM(tokens_used) as total_tokens
        FROM token_usage_logs
        WHERE sandbox_id = ${sandboxId}
        AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY session_id
      `);
      
      const usageBySession: Record<string, number> = {};
      for (const row of usageBySessionResult) {
        usageBySession[row.session_id] = Number(row.total_tokens);
      }
      
      return {
        hourlyUsage: sandbox.current_hourly_usage,
        dailyUsage: sandbox.current_daily_usage,
        hourlyLimit: sandbox.token_limit_per_hour,
        dailyLimit: sandbox.token_limit_per_day,
        hourlyRemaining: sandbox.token_limit_per_hour - sandbox.current_hourly_usage,
        dailyRemaining: sandbox.token_limit_per_day - sandbox.current_daily_usage,
        usageByType,
        usageBySession
      };
    } catch (error) {
      logger.error(`Error getting usage stats for sandbox ${sandboxId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Execute a tool within a sandbox context with rate limiting
   */
  async executeToolInSandbox(
    sessionId: string,
    toolRequest: Omit<ToolRequest, 'context'>,
    estimatedTokens: number
  ): Promise<ToolResponse> {
    const startTime = performance.now();
    const requestId = this.generateRequestId();
    
    try {
      // Get session and sandbox
      const session = await this.getSandboxSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      const sandboxId = session.sandbox_id;
      
      // Check and track token usage
      await this.trackTokenUsage({
        sandboxId,
        sessionId,
        operationType: SandboxOperationType.TOOL_EXECUTION,
        tokensUsed: estimatedTokens,
        requestId
      });
      
      // Create tool context
      const toolContext = {
        agentId: `sandbox-${sandboxId}`,
        sessionId,
        requestId,
        timestamp: Date.now()
      };
      
      // Execute the tool
      const result = await toolRegistry.executeTool({
        ...toolRequest,
        context: toolContext
      });
      
      // Track operation time
      const operationTime = performance.now() - startTime;
      if (!this.metricsCollector.operationTimes.has('tool_execution')) {
        this.metricsCollector.operationTimes.set('tool_execution', []);
      }
      this.metricsCollector.operationTimes.get('tool_execution')?.push(operationTime);
      
      return result;
    } catch (error) {
      // Track failed operation
      this.metricsCollector.failedOperations++;
      
      // Handle rate limit errors
      if (error instanceof RateLimitExceededError) {
        logger.warn(`Rate limit exceeded for sandbox session ${sessionId}`, {
          error: error.message,
          sandboxId: error.sandboxId,
          limit: error.limit,
          timeframe: error.timeframe,
          currentUsage: error.currentUsage
        });
        
        return {
          success: false,
          toolName: toolRequest.toolName,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: error.message
          },
          meta: {
            processingTime: performance.now() - startTime,
            requestId
          }
        };
      }
      
      // Handle other errors
      logger.error(`Error executing tool in sandbox: ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
        toolName: toolRequest.toolName,
        requestId
      });
      
      return {
        success: false,
        toolName: toolRequest.toolName,
        error: {
          code: 'SANDBOX_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error)
        },
        meta: {
          processingTime: performance.now() - startTime,
          requestId
        }
      };
    }
  }
  
  /**
   * Execute a streaming tool within a sandbox context with rate limiting
   */
  executeToolStreamInSandbox(
    sessionId: string,
    toolRequest: Omit<ToolRequest, 'context'>,
    estimatedTokens: number
  ): EventEmitter {
    const emitter = new EventEmitter();
    const requestId = this.generateRequestId();
    
    // Process asynchronously
    (async () => {
      try {
        // Get session and sandbox
        const session = await this.getSandboxSession(sessionId);
        if (!session) {
          emitter.emit('error', new Error(`Session not found: ${sessionId}`));
          return;
        }
        
        const sandboxId = session.sandbox_id;
        
        try {
          // Check and track token usage
          await this.trackTokenUsage({
            sandboxId,
            sessionId,
            operationType: SandboxOperationType.TOOL_EXECUTION,
            tokensUsed: estimatedTokens,
            requestId
          });
        } catch (error) {
          // Handle rate limit errors
          if (error instanceof RateLimitExceededError) {
            emitter.emit('data', {
              type: 'error',
              toolName: toolRequest.toolName,
              requestId,
              timestamp: Date.now(),
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: error.message,
                details: {
                  limit: error.limit,
                  timeframe: error.timeframe,
                  currentUsage: error.currentUsage
                }
              }
            });
            
            emitter.emit('data', {
              type: 'end',
              toolName: toolRequest.toolName,
              requestId,
              timestamp: Date.now()
            });
            
            return;
          }
          
          // Handle other errors
          emitter.emit('error', error);
          return;
        }
        
        // Create tool context
        const toolContext = {
          agentId: `sandbox-${sandboxId}`,
          sessionId,
          requestId,
          timestamp: Date.now()
        };
        
        // Execute the tool with streaming
        const toolEmitter = toolRegistry.executeToolStream({
          ...toolRequest,
          context: toolContext,
          streaming: true
        });
        
        // Forward events from tool emitter to our emitter
        toolEmitter.on('data', (data) => {
          emitter.emit('data', data);
        });
        
        toolEmitter.on('error', (error) => {
          emitter.emit('error', error);
        });
      } catch (error) {
        // Track failed operation
        this.metricsCollector.failedOperations++;
        
        // Handle errors
        logger.error(`Error setting up tool stream in sandbox: ${sessionId}`, {
          error: error instanceof Error ? error.message : String(error),
          toolName: toolRequest.toolName,
          requestId
        });
        
        emitter.emit('error', error);
      }
    })();
    
    return emitter;
  }
  
  /**
   * Process an agent message within a sandbox context
   */
  async processAgentMessage(
    sessionId: string,
    message: string,
    estimatedTokens: number = 500 // Default token estimate if not provided
  ): Promise<{
    success: boolean;
    response?: string;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  }> {
    const startTime = performance.now();
    const requestId = this.generateRequestId();
    
    try {
      // Get session and sandbox
      const session = await this.getSandboxSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      const sandboxId = session.sandbox_id;
      
      // Check and track token usage
      await this.trackTokenUsage({
        sandboxId,
        sessionId,
        operationType: SandboxOperationType.AGENT_MESSAGE,
        tokensUsed: estimatedTokens,
        requestId
      });
      
      // If we have an AgentSquad, use it to process the message
      if (this.agentSquad) {
        // Create a context object for the agent
        const agentContext = {
          agentId: `sandbox-${sandboxId}`,
          sessionId,
          requestId,
          sandboxId,
          websocketChannel: session.websocket_channel
        };
        
        // Process the message with the AgentSquad
        const response = await this.agentSquad.processMessage(
          message,
          agentContext
        );
        
        // Track operation time
        const operationTime = performance.now() - startTime;
        if (!this.metricsCollector.operationTimes.has('agent_message')) {
          this.metricsCollector.operationTimes.set('agent_message', []);
        }
        this.metricsCollector.operationTimes.get('agent_message')?.push(operationTime);
        
        return {
          success: true,
          response
        };
      } else {
        // No AgentSquad available
        logger.warn('No AgentSquad available to process message', {
          sessionId,
          sandboxId
        });
        
        return {
          success: false,
          error: {
            code: 'AGENT_SQUAD_UNAVAILABLE',
            message: 'No AgentSquad available to process message'
          }
        };
      }
    } catch (error) {
      // Track failed operation
      this.metricsCollector.failedOperations++;
      
      // Handle rate limit errors
      if (error instanceof RateLimitExceededError) {
        logger.warn(`Rate limit exceeded for sandbox session ${sessionId}`, {
          error: error.message,
          sandboxId: error.sandboxId,
          limit: error.limit,
          timeframe: error.timeframe,
          currentUsage: error.currentUsage
        });
        
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: error.message,
            details: {
              limit: error.limit,
              timeframe: error.timeframe,
              currentUsage: error.currentUsage
            }
          }
        };
      }
      
      // Handle other errors
      logger.error(`Error processing agent message in sandbox: ${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
        requestId
      });
      
      return {
        success: false,
        error: {
          code: 'SANDBOX_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  
  /**
   * Send a message to a sandbox WebSocket channel
   */
  sendToSandboxChannel(
    sandboxId: number,
    sessionId: string,
    message: any
  ): boolean {
    try {
      // Get the session
      const sessionContext = this.sandboxSessions.get(sessionId);
      if (!sessionContext) {
        logger.warn(`Session not found for message: ${sessionId}`, {
          sandboxId
        });
        return false;
      }
      
      // Create the sandbox message
      const sandboxMessage: SandboxWebSocketMessage = {
        type: message.type || 'sandbox_message',
        sandboxId,
        sessionId,
        payload: message,
        timestamp: Date.now(),
        requestId: message.requestId || this.generateRequestId()
      };
      
      // Send to the WebSocket channel
      return this.wsService.sendToSession(sessionId, {
        type: MessageType.CHAT_MESSAGE, // Use an appropriate message type
        message: JSON.stringify(sandboxMessage),
        timestamp: new Date().toISOString(),
        metadata: {
          sandboxId,
          sessionId,
          channelType: 'sandbox'
        }
      });
    } catch (error) {
      logger.error(`Error sending message to sandbox channel: ${sandboxId}/${sessionId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Handle a message received from a sandbox WebSocket channel
   */
  async handleSandboxMessage(
    sandboxId: number,
    sessionId: string,
    message: any
  ): Promise<void> {
    try {
      // Get the session
      const session = await this.getSandboxSession(sessionId);
      if (!session) {
        logger.warn(`Session not found for message: ${sessionId}`, {
          sandboxId
        });
        return;
      }
      
      // Process the message based on its type
      if (message.type === 'agent_message') {
        // Process agent message
        const response = await this.processAgentMessage(
          sessionId,
          message.content,
          message.estimatedTokens
        );
        
        // Send response back to the client
        this.sendToSandboxChannel(sandboxId, sessionId, {
          type: 'agent_response',
          requestId: message.requestId,
          success: response.success,
          content: response.response,
          error: response.error
        });
      } else if (message.type === 'tool_request') {
        // Execute tool
        const response = await this.executeToolInSandbox(
          sessionId,
          {
            toolName: message.toolName,
            parameters: message.parameters
          },
          message.estimatedTokens || 1000 // Default estimate if not provided
        );
        
        // Send response back to the client
        this.sendToSandboxChannel(sandboxId, sessionId, {
          type: 'tool_response',
          requestId: message.requestId,
          toolName: message.toolName,
          success: response.success,
          data: response.data,
          error: response.error
        });
      } else if (message.type === 'tool_stream_request') {
        // Execute streaming tool
        const emitter = this.executeToolStreamInSandbox(
          sessionId,
          {
            toolName: message.toolName,
            parameters: message.parameters,
            streaming: true
          },
          message.estimatedTokens || 1000 // Default estimate if not provided
        );
        
        // Forward events to the client
        emitter.on('data', (data) => {
          this.sendToSandboxChannel(sandboxId, sessionId, {
            type: 'tool_stream',
            requestId: message.requestId,
            toolName: message.toolName,
            streamEvent: data
          });
        });
        
        emitter.on('error', (error) => {
          this.sendToSandboxChannel(sandboxId, sessionId, {
            type: 'tool_stream',
            requestId: message.requestId,
            toolName: message.toolName,
            streamEvent: {
              type: 'error',
              error: {
                code: 'TOOL_EXECUTION_ERROR',
                message: error instanceof Error ? error.message : String(error)
              }
            }
          });
        });
      } else {
        // Unknown message type
        logger.warn(`Unknown message type received in sandbox: ${message.type}`, {
          sandboxId,
          sessionId
        });
      }
    } catch (error) {
      logger.error(`Error handling sandbox message: ${sandboxId}/${sessionId}`, {
        error: error instanceof Error ? error.message : String(error),
        message
      });
      
      // Send error back to the client
      this.sendToSandboxChannel(sandboxId, sessionId, {
        type: 'error',
        requestId: message.requestId,
        error: {
          code: 'SANDBOX_MESSAGE_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Clean up inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    try {
      // Find inactive sessions (no activity for 24 hours)
      const inactiveSessions = await db.query.sandbox_sessions.findMany({
        where: lte(
          sandbox_sessions.last_activity,
          new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        )
      });
      
      if (inactiveSessions.length === 0) {
        return;
      }
      
      logger.info(`Cleaning up ${inactiveSessions.length} inactive sandbox sessions`);
      
      // Delete inactive sessions
      for (const session of inactiveSessions) {
        await this.deleteSandboxSession(session.session_id);
      }
    } catch (error) {
      logger.error('Error cleaning up inactive sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Log metrics
   */
  private logMetrics(): void {
    try {
      // Calculate average operation times
      const averageOperationTimes: Record<string, number> = {};
      for (const [operationType, times] of this.metricsCollector.operationTimes.entries()) {
        if (times.length > 0) {
          const sum = times.reduce((acc, time) => acc + time, 0);
          averageOperationTimes[operationType] = sum / times.length;
        }
      }
      
      // Log the metrics
      logger.info('Orchestrator metrics', {
        totalOperations: this.metricsCollector.totalOperations,
        successfulOperations: this.metricsCollector.successfulOperations,
        failedOperations: this.metricsCollector.failedOperations,
        rateLimitedOperations: this.metricsCollector.rateLimitedOperations,
        totalTokensUsed: this.metricsCollector.totalTokensUsed,
        averageOperationTimes,
        lastOperationTimestamp: this.metricsCollector.lastOperationTimestamp
      });
      
      // Reset operation times to prevent memory growth
      for (const operationType of this.metricsCollector.operationTimes.keys()) {
        this.metricsCollector.operationTimes.set(operationType, []);
      }
    } catch (error) {
      logger.error('Error logging metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `sess_${uuidv4()}`;
  }
  
  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${uuidv4()}`;
  }
  
  /**
   * Get sandbox health status
   */
  async getSandboxHealth(sandboxId: number): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeSessions: number;
    tokenUsage: {
      hourlyUsage: number;
      dailyUsage: number;
      hourlyLimit: number;
      dailyLimit: number;
      hourlyUtilizationPercent: number;
      dailyUtilizationPercent: number;
    };
    lastActivity?: Date;
  }> {
    try {
      // Get sandbox
      const sandbox = await this.getSandbox(sandboxId);
      if (!sandbox) {
        throw new SandboxNotFoundError(sandboxId);
      }
      
      // Get active sessions
      const sessions = await this.getSandboxSessions(sandboxId);
      const activeSessions = sessions.filter(s => s.is_active).length;
      
      // Get last activity
      let lastActivity: Date | undefined;
      if (sessions.length > 0) {
        lastActivity = sessions[0].last_activity;
      }
      
      // Calculate usage percentages
      const hourlyUtilizationPercent = (sandbox.current_hourly_usage / sandbox.token_limit_per_hour) * 100;
      const dailyUtilizationPercent = (sandbox.current_daily_usage / sandbox.token_limit_per_day) * 100;
      
      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (!sandbox.is_active) {
        status = 'unhealthy';
      } else if (hourlyUtilizationPercent > 90 || dailyUtilizationPercent > 90) {
        status = 'degraded';
      }
      
      return {
        status,
        activeSessions,
        tokenUsage: {
          hourlyUsage: sandbox.current_hourly_usage,
          dailyUsage: sandbox.current_daily_usage,
          hourlyLimit: sandbox.token_limit_per_hour,
          dailyLimit: sandbox.token_limit_per_day,
          hourlyUtilizationPercent,
          dailyUtilizationPercent
        },
        lastActivity
      };
    } catch (error) {
      logger.error(`Error getting health for sandbox ${sandboxId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Estimate token usage for a message
   */
  estimateTokenUsage(message: string): number {
    // Simple estimation: ~4 characters per token for English text
    // This is a very rough estimate and should be replaced with a more accurate method
    return Math.ceil(message.length / 4);
  }
}

// Export a singleton instance
export const orchestrator = new OrchestratorService();

// Export types
export type { 
  SandboxSessionContext, 
  SandboxOperationOptions,
  TokenUsage
};
export { SandboxOperationType };
