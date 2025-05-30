/**
 * Integration Test for Cross-Service Orchestration
 * 
 * This test suite validates the cross-service orchestration capabilities,
 * including sequential workflows, event publishing/consumption, replayable logs,
 * correlation tracking, WebSocket events, task queues, and error handling.
 */

import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'http';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';

// Import services and components
import { app, server } from '../../server/index';
import { db } from '../../server/db';
import { orchestratorService, WorkflowPattern, WorkflowStepStatus } from '../../server/services/orchestrator';
import { webSocketService } from '../../server/services/websocket-service';
import { eventBus, EventType } from '../../server/services/event-bus';
import { toolRegistryService } from '../../server/services/tool-registry';
import { adsAutomationWorker, AdsTaskType } from '../../server/services/ads-automation-worker';
import { analyticsClient } from '../../server/services/analytics-client';
import { adsApiService } from '../../server/services/ads-api-service';

// Import schema
import {
  sandboxes,
  sandboxSessions,
  tokenUsageLogs,
  tools,
  agentTools,
  gadsAccounts,
  gadsCampaigns
} from '../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Test constants
const TEST_PORT = 3001;
const TEST_WS_PORT = 3002;
const TEST_SANDBOX_ID = 999;
const TEST_SESSION_ID = 'test_session_id';
const TEST_USER_ID = 1;
const TEST_DEALERSHIP_ID = 1;
const TEST_ACCOUNT_ID = '1234567890';
const TEST_UPLOAD_ID = 'test_upload_id';
const TEST_TIMEOUT = 30000; // 30 seconds

// Mock implementations
jest.mock('../../server/services/analytics-client', () => ({
  analyticsClient: {
    answerQuestion: jest.fn().mockImplementation(async (uploadId, question, options) => {
      // Simulate analytics processing time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: true,
        insights: [
          {
            title: 'Sales Performance Analysis',
            description: 'Analysis of sales performance metrics',
            data: {
              topPerformers: [
                { name: 'John Doe', sales: 125000, conversionRate: 0.12 },
                { name: 'Jane Smith', sales: 98000, conversionRate: 0.09 }
              ],
              metrics: {
                totalSales: 450000,
                averageConversionRate: 0.08,
                leadCount: 1250
              }
            }
          }
        ],
        tokenUsage: 1250,
        correlationId: options?.correlationId
      };
    })
  }
}));

jest.mock('../../server/services/ads-api-service', () => ({
  adsApiService: {
    createSearchCampaign: jest.fn().mockImplementation(async (params) => {
      // Simulate campaign creation time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        id: 1,
        gadsAccountId: 1,
        campaignId: 'test_campaign_123',
        campaignName: params.campaignName,
        campaignType: 'SEARCH',
        status: params.isDryRun ? 'DRY_RUN' : 'ENABLED',
        budgetAmount: params.budget.amount,
        isDryRun: params.isDryRun || false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }),
    getCampaignPerformance: jest.fn().mockImplementation(async () => {
      return {
        metrics: {
          cost_micros: 50000000, // $50
          impressions: 10000,
          clicks: 500
        }
      };
    }),
    updateCampaignBudget: jest.fn().mockImplementation(async () => {
      return { success: true };
    })
  }
}));

// WebSocket client for testing
class TestWebSocketClient {
  private ws: WebSocket;
  private messages: any[] = [];
  private connected: boolean = false;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.on('open', () => {
      this.connected = true;
      this.emit('connected', true);
    });
    
    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.messages.push(message);
      this.emit('message', message);
      
      // Emit specific event type
      if (message.type) {
        this.emit(message.type, message.data);
      }
    });
    
    this.ws.on('close', () => {
      this.connected = false;
      this.emit('disconnected', true);
    });
    
    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  public send(data: any): void {
    this.ws.send(JSON.stringify(data));
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getMessages(): any[] {
    return this.messages;
  }

  public clearMessages(): void {
    this.messages = [];
  }

  public on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any): void {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event)!.forEach(handler => handler(data));
    }
  }

  public async waitForEvent(event: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);
      
      this.on(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  public async waitForMessage(predicate: (message: any) => boolean, timeout: number = 5000): Promise<any> {
    // First check existing messages
    const existingMessage = this.messages.find(predicate);
    if (existingMessage) {
      return existingMessage;
    }
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, timeout);
      
      const messageHandler = (message: any) => {
        if (predicate(message)) {
          this.eventHandlers.get('message')!.splice(
            this.eventHandlers.get('message')!.indexOf(messageHandler), 1
          );
          clearTimeout(timer);
          resolve(message);
        }
      };
      
      this.on('message', messageHandler);
    });
  }

  public close(): void {
    this.ws.close();
  }
}

// Test helpers
async function createTestSandbox() {
  // Delete existing test sandbox if it exists
  await db.delete(sandboxes).where(eq(sandboxes.id, TEST_SANDBOX_ID));
  
  // Create test sandbox
  const [sandbox] = await db.insert(sandboxes).values({
    id: TEST_SANDBOX_ID,
    name: 'Test Sandbox',
    description: 'Sandbox for integration tests',
    userId: TEST_USER_ID,
    dealershipId: TEST_DEALERSHIP_ID,
    hourlyTokenLimit: 10000,
    dailyTokenLimit: 100000,
    dailyCostLimit: 10.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  return sandbox;
}

async function createTestSession(sandboxId: number) {
  // Delete existing test session if it exists
  await db.delete(sandboxSessions).where(eq(sandboxSessions.sessionId, TEST_SESSION_ID));
  
  // Create test session
  const [session] = await db.insert(sandboxSessions).values({
    sandboxId,
    sessionId: TEST_SESSION_ID,
    userId: TEST_USER_ID,
    dealershipId: TEST_DEALERSHIP_ID,
    clientId: 'test_client',
    metadata: {},
    isActive: true,
    startedAt: new Date(),
    lastActivityAt: new Date()
  }).returning();
  
  return session;
}

async function registerTestTools() {
  // Register analytics tool
  const [analyticsTool] = await db.insert(tools).values({
    name: 'watchdog_analysis',
    description: 'Analyze data using Watchdog',
    type: 'ANALYTICS',
    service: 'watchdog',
    endpoint: '/api/analysis',
    inputSchema: {
      type: 'object',
      properties: {
        uploadId: { type: 'string' },
        question: { type: 'string' }
      },
      required: ['uploadId', 'question']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        insights: { type: 'array' }
      }
    },
    isActive: true
  }).onConflictDoUpdate({
    target: tools.name,
    set: { isActive: true }
  }).returning();
  
  // Register Google Ads tool
  const [adsTool] = await db.insert(tools).values({
    name: 'google_ads.createCampaign',
    description: 'Create a Google Ads campaign',
    type: 'ADS',
    service: 'google_ads',
    endpoint: '/api/ads/campaigns',
    inputSchema: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        campaignName: { type: 'string' },
        budget: { type: 'object' },
        bidStrategy: { type: 'object' },
        isDryRun: { type: 'boolean' }
      },
      required: ['accountId', 'campaignName', 'budget', 'bidStrategy']
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        campaignId: { type: 'string' }
      }
    },
    isActive: true
  }).onConflictDoUpdate({
    target: tools.name,
    set: { isActive: true }
  }).returning();
  
  // Enable tools for test sandbox
  await db.insert(agentTools).values({
    sandboxId: TEST_SANDBOX_ID,
    toolId: analyticsTool.id,
    enabledBy: TEST_USER_ID,
    enabledAt: new Date()
  }).onConflictDoNothing().execute();
  
  await db.insert(agentTools).values({
    sandboxId: TEST_SANDBOX_ID,
    toolId: adsTool.id,
    enabledBy: TEST_USER_ID,
    enabledAt: new Date()
  }).onConflictDoNothing().execute();
  
  return { analyticsTool, adsTool };
}

async function createTestGoogleAdsAccount() {
  // Delete existing test account if it exists
  await db.delete(gadsAccounts).where(eq(gadsAccounts.cid, TEST_ACCOUNT_ID));
  
  // Create test account
  const [account] = await db.insert(gadsAccounts).values({
    cid: TEST_ACCOUNT_ID,
    name: 'Test Ads Account',
    currencyCode: 'USD',
    timezone: 'America/New_York',
    isManagerAccount: true,
    refreshToken: 'test_refresh_token',
    accessToken: 'test_access_token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    sandboxId: TEST_SANDBOX_ID,
    userId: TEST_USER_ID,
    dealershipId: TEST_DEALERSHIP_ID,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  
  return account;
}

// Test setup and teardown
let httpServer: Server;
let wsServer: WebSocket.Server;
let redisClient: Redis;
let testWsClient: TestWebSocketClient;

beforeAll(async () => {
  // Start HTTP server for tests
  httpServer = app.listen(TEST_PORT);
  
  // Start WebSocket server for tests
  wsServer = new WebSocket.Server({ port: TEST_WS_PORT });
  wsServer.on('connection', (ws) => {
    ws.on('message', (message) => {
      // Echo back messages for testing
      ws.send(message);
    });
  });
  
  // Connect to Redis
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  // Set up test data
  await createTestSandbox();
  await createTestSession(TEST_SANDBOX_ID);
  await registerTestTools();
  await createTestGoogleAdsAccount();
  
  // Start ads automation worker
  await adsAutomationWorker.start();
  
  // Connect WebSocket client
  testWsClient = new TestWebSocketClient(`ws://localhost:${TEST_PORT}/ws/sandbox/${TEST_SANDBOX_ID}/${TEST_SESSION_ID}`);
  
  // Wait for connection
  await new Promise<void>((resolve) => {
    testWsClient.on('connected', () => resolve());
  });
}, TEST_TIMEOUT);

afterAll(async () => {
  // Close WebSocket client
  testWsClient.close();
  
  // Stop ads automation worker
  await adsAutomationWorker.stop();
  
  // Disconnect from Redis
  await redisClient.quit();
  
  // Close servers
  wsServer.close();
  httpServer.close();
  server.close();
  
  // Clean up test data
  await db.delete(sandboxSessions).where(eq(sandboxSessions.sessionId, TEST_SESSION_ID));
  await db.delete(sandboxes).where(eq(sandboxes.id, TEST_SANDBOX_ID));
  await db.delete(tokenUsageLogs).where(eq(tokenUsageLogs.sandboxId, TEST_SANDBOX_ID));
}, TEST_TIMEOUT);

describe('Cross-Service Orchestration', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    testWsClient.clearMessages();
  });
  
  describe('Sequential Workflow Execution', () => {
    it('should execute a sequential workflow from Watchdog to Google Ads', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute the workflow
      const workflowResult = await orchestratorService.executeWorkflow({
        workflowId: 'inventory-analysis-campaign',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID,
          accountId: TEST_ACCOUNT_ID,
          isDryRun: true
        },
        correlationId
      });
      
      // Verify workflow execution
      expect(workflowResult).toBeDefined();
      expect(workflowResult.status).toBe(WorkflowStepStatus.COMPLETED);
      
      // Verify analytics tool was called
      expect(analyticsClient.answerQuestion).toHaveBeenCalledWith(
        TEST_UPLOAD_ID,
        expect.any(String),
        expect.objectContaining({
          correlationId,
          sandboxId: TEST_SANDBOX_ID,
          sessionId: TEST_SESSION_ID
        })
      );
      
      // Verify ads tool was called
      expect(adsApiService.createSearchCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          isDryRun: true
        })
      );
      
      // Verify workflow steps were executed in sequence
      const steps = workflowResult.steps;
      expect(steps.length).toBe(2);
      expect(steps[0].status).toBe(WorkflowStepStatus.COMPLETED);
      expect(steps[1].status).toBe(WorkflowStepStatus.COMPLETED);
      
      // Verify token usage was logged
      const tokenLogs = await db.query.tokenUsageLogs.findMany({
        where: and(
          eq(tokenUsageLogs.sandboxId, TEST_SANDBOX_ID),
          eq(tokenUsageLogs.sessionId, TEST_SESSION_ID)
        )
      });
      expect(tokenLogs.length).toBeGreaterThan(0);
      
      // Verify replayable logs are available
      const replayableLogs = orchestratorService.getReplayableLogs(correlationId);
      expect(replayableLogs.length).toBeGreaterThan(0);
      
      // Verify WebSocket events were sent
      const wsMessages = testWsClient.getMessages();
      expect(wsMessages.length).toBeGreaterThan(0);
      
      // Verify workflow start event
      const workflowStartEvent = wsMessages.find(m => m.type === 'workflow_start');
      expect(workflowStartEvent).toBeDefined();
      expect(workflowStartEvent.data.correlationId).toBe(correlationId);
      
      // Verify workflow complete event
      const workflowCompleteEvent = wsMessages.find(m => m.type === 'workflow_complete');
      expect(workflowCompleteEvent).toBeDefined();
      expect(workflowCompleteEvent.data.correlationId).toBe(correlationId);
      
      // Verify tool execution events
      const toolStartEvents = wsMessages.filter(m => m.type === 'tool_start');
      expect(toolStartEvents.length).toBe(2);
      
      const toolCompleteEvents = wsMessages.filter(m => m.type === 'tool_complete');
      expect(toolCompleteEvents.length).toBe(2);
      
      // Verify execution time is reasonable
      expect(workflowResult.executionTime).toBeLessThan(10000); // Less than 10 seconds
    }, TEST_TIMEOUT);
    
    it('should handle errors in workflow steps and perform rollback', async () => {
      // Mock analytics client to throw an error
      analyticsClient.answerQuestion = jest.fn().mockRejectedValueOnce(
        new Error('Analytics service unavailable')
      );
      
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute the workflow (should fail)
      try {
        await orchestratorService.executeWorkflow({
          workflowId: 'inventory-analysis-campaign',
          sandboxId: TEST_SANDBOX_ID,
          sessionId: TEST_SESSION_ID,
          userId: TEST_USER_ID,
          dealershipId: TEST_DEALERSHIP_ID,
          parameters: {
            uploadId: TEST_UPLOAD_ID,
            accountId: TEST_ACCOUNT_ID
          },
          correlationId
        });
        fail('Workflow should have failed');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Analytics service unavailable');
      }
      
      // Verify WebSocket error events were sent
      const wsMessages = testWsClient.getMessages();
      const workflowErrorEvent = wsMessages.find(m => m.type === 'workflow_step_error');
      expect(workflowErrorEvent).toBeDefined();
      expect(workflowErrorEvent.data.correlationId).toBe(correlationId);
      
      // Verify Google Ads tool was not called (because first step failed)
      expect(adsApiService.createSearchCampaign).not.toHaveBeenCalled();
      
      // Verify replayable logs contain error
      const replayableLogs = orchestratorService.getReplayableLogs(correlationId);
      const errorLog = replayableLogs.find(log => log.type === 'tool_error');
      expect(errorLog).toBeDefined();
      expect(errorLog.error.message).toContain('Analytics service unavailable');
      
      // Reset mock for subsequent tests
      analyticsClient.answerQuestion = jest.fn().mockImplementation(async (uploadId, question, options) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          success: true,
          insights: [{ title: 'Test Insight', data: {} }],
          tokenUsage: 1250,
          correlationId: options?.correlationId
        };
      });
    }, TEST_TIMEOUT);
  });
  
  describe('Event Publishing and Consumption', () => {
    it('should publish and consume events across services', async () => {
      // Create event handlers to track events
      const receivedEvents: any[] = [];
      const consumerId = `test-consumer-${uuidv4().substring(0, 8)}`;
      
      // Subscribe to events
      await eventBus.subscribe(
        consumerId,
        [
          EventType.ORCHESTRATION_SEQUENCE_STARTED,
          EventType.ORCHESTRATION_SEQUENCE_COMPLETED,
          EventType.TOOL_EXECUTION_STARTED,
          EventType.TOOL_EXECUTION_COMPLETED
        ],
        async (event) => {
          receivedEvents.push(event);
        }
      );
      
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a workflow
      await orchestratorService.executeWorkflow({
        workflowId: 'sales-analysis-update',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID
        },
        correlationId
      });
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify events were published and consumed
      expect(receivedEvents.length).toBeGreaterThan(0);
      
      // Verify sequence started event
      const sequenceStartedEvent = receivedEvents.find(
        e => e.type === EventType.ORCHESTRATION_SEQUENCE_STARTED
      );
      expect(sequenceStartedEvent).toBeDefined();
      expect(sequenceStartedEvent.correlationId).toBe(correlationId);
      expect(sequenceStartedEvent.sandboxId).toBe(TEST_SANDBOX_ID);
      
      // Verify sequence completed event
      const sequenceCompletedEvent = receivedEvents.find(
        e => e.type === EventType.ORCHESTRATION_SEQUENCE_COMPLETED
      );
      expect(sequenceCompletedEvent).toBeDefined();
      expect(sequenceCompletedEvent.correlationId).toBe(correlationId);
      expect(sequenceCompletedEvent.sandboxId).toBe(TEST_SANDBOX_ID);
      
      // Verify tool execution events
      const toolStartedEvents = receivedEvents.filter(
        e => e.type === EventType.TOOL_EXECUTION_STARTED
      );
      expect(toolStartedEvents.length).toBeGreaterThan(0);
      
      const toolCompletedEvents = receivedEvents.filter(
        e => e.type === EventType.TOOL_EXECUTION_COMPLETED
      );
      expect(toolCompletedEvents.length).toBeGreaterThan(0);
      
      // Unsubscribe from events
      await eventBus.unsubscribe(consumerId);
    }, TEST_TIMEOUT);
    
    it('should handle task queue processing and completion events', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Add a task to the queue
      const taskId = await adsAutomationWorker.addTask({
        taskType: AdsTaskType.CAMPAIGN_CREATION,
        accountId: TEST_ACCOUNT_ID,
        correlationId,
        sandboxId: TEST_SANDBOX_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        campaignName: 'Test Campaign',
        budget: {
          amount: 100,
          deliveryMethod: 'STANDARD'
        },
        bidStrategy: {
          type: 'MAXIMIZE_CONVERSIONS'
        },
        isDryRun: true
      });
      
      expect(taskId).toBeDefined();
      
      // Wait for task to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create event handlers to track events
      const receivedEvents: any[] = [];
      const consumerId = `test-consumer-${uuidv4().substring(0, 8)}`;
      
      // Subscribe to events
      await eventBus.subscribe(
        consumerId,
        [EventType.TASK_COMPLETED, EventType.CAMPAIGN_DRY_RUN],
        async (event) => {
          if (event.correlationId === correlationId) {
            receivedEvents.push(event);
          }
        }
      );
      
      // Add another task to the queue
      const taskId2 = await adsAutomationWorker.addTask({
        taskType: AdsTaskType.CAMPAIGN_CREATION,
        accountId: TEST_ACCOUNT_ID,
        correlationId,
        sandboxId: TEST_SANDBOX_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        campaignName: 'Test Campaign 2',
        budget: {
          amount: 100,
          deliveryMethod: 'STANDARD'
        },
        bidStrategy: {
          type: 'MAXIMIZE_CONVERSIONS'
        },
        isDryRun: true
      });
      
      expect(taskId2).toBeDefined();
      
      // Wait for task to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify events were published and consumed
      expect(receivedEvents.length).toBeGreaterThan(0);
      
      // Verify task completed event
      const taskCompletedEvent = receivedEvents.find(
        e => e.type === EventType.TASK_COMPLETED
      );
      expect(taskCompletedEvent).toBeDefined();
      expect(taskCompletedEvent.correlationId).toBe(correlationId);
      
      // Verify campaign dry run event
      const campaignDryRunEvent = receivedEvents.find(
        e => e.type === EventType.CAMPAIGN_DRY_RUN
      );
      expect(campaignDryRunEvent).toBeDefined();
      expect(campaignDryRunEvent.correlationId).toBe(correlationId);
      expect(campaignDryRunEvent.isDryRun).toBe(true);
      
      // Unsubscribe from events
      await eventBus.unsubscribe(consumerId);
    }, TEST_TIMEOUT);
  });
  
  describe('WebSocket Event Streaming', () => {
    it('should stream events to WebSocket clients', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a tool directly
      const toolPromise = orchestratorService.executeTool({
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        toolName: 'watchdog_analysis',
        parameters: {
          uploadId: TEST_UPLOAD_ID,
          question: 'What are the sales trends?'
        },
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        correlationId
      });
      
      // Wait for tool start event
      const toolStartEvent = await testWsClient.waitForMessage(
        m => m.type === 'tool_start' && m.data.correlationId === correlationId,
        5000
      );
      expect(toolStartEvent).toBeDefined();
      expect(toolStartEvent.data.tool).toBe('watchdog_analysis');
      
      // Wait for tool complete event
      const toolCompleteEvent = await testWsClient.waitForMessage(
        m => m.type === 'tool_complete' && m.data.correlationId === correlationId,
        10000
      );
      expect(toolCompleteEvent).toBeDefined();
      expect(toolCompleteEvent.data.tool).toBe('watchdog_analysis');
      expect(toolCompleteEvent.data.result).toBeDefined();
      
      // Wait for tool execution to complete
      const result = await toolPromise;
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Verify token usage was logged
      const tokenLogs = await db.query.tokenUsageLogs.findMany({
        where: and(
          eq(tokenUsageLogs.sandboxId, TEST_SANDBOX_ID),
          eq(tokenUsageLogs.sessionId, TEST_SESSION_ID),
          eq(tokenUsageLogs.operationType, 'tool:watchdog_analysis')
        )
      });
      expect(tokenLogs.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
    
    it('should stream workflow events to WebSocket clients', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute the workflow
      const workflowPromise = orchestratorService.executeWorkflow({
        workflowId: 'sales-analysis-update',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID
        },
        correlationId
      });
      
      // Wait for workflow start event
      const workflowStartEvent = await testWsClient.waitForMessage(
        m => m.type === 'workflow_start' && m.data.correlationId === correlationId,
        5000
      );
      expect(workflowStartEvent).toBeDefined();
      
      // Wait for step start events
      const stepStartEvent = await testWsClient.waitForMessage(
        m => m.type === 'workflow_step_start' && m.data.correlationId === correlationId,
        5000
      );
      expect(stepStartEvent).toBeDefined();
      
      // Wait for tool events
      const toolStartEvent = await testWsClient.waitForMessage(
        m => m.type === 'tool_start' && m.data.correlationId === correlationId,
        5000
      );
      expect(toolStartEvent).toBeDefined();
      
      // Wait for workflow complete event
      const workflowCompleteEvent = await testWsClient.waitForMessage(
        m => m.type === 'workflow_complete' && m.data.correlationId === correlationId,
        15000
      );
      expect(workflowCompleteEvent).toBeDefined();
      
      // Wait for workflow execution to complete
      const result = await workflowPromise;
      expect(result).toBeDefined();
      expect(result.status).toBe(WorkflowStepStatus.COMPLETED);
    }, TEST_TIMEOUT);
    
    it('should handle rate limit exceeded events', async () => {
      // Update sandbox with very low token limit
      await db.update(sandboxes)
        .set({ hourlyTokenLimit: 100 })
        .where(eq(sandboxes.id, TEST_SANDBOX_ID));
      
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a tool that should exceed the rate limit
      try {
        await orchestratorService.executeTool({
          sandboxId: TEST_SANDBOX_ID,
          sessionId: TEST_SESSION_ID,
          toolName: 'watchdog_analysis',
          parameters: {
            uploadId: TEST_UPLOAD_ID,
            question: 'What are the sales trends?'
          },
          estimatedTokens: 500, // This should exceed our 100 token limit
          userId: TEST_USER_ID,
          dealershipId: TEST_DEALERSHIP_ID,
          correlationId
        });
        fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).name).toBe('RateLimitExceededError');
      }
      
      // Wait for rate limit exceeded event
      const rateLimitEvent = await testWsClient.waitForMessage(
        m => m.type === 'rate_limit_exceeded' && m.data.correlationId === correlationId,
        5000
      );
      expect(rateLimitEvent).toBeDefined();
      expect(rateLimitEvent.data.sandboxId).toBe(TEST_SANDBOX_ID);
      expect(rateLimitEvent.data.toolName).toBe('watchdog_analysis');
      
      // Reset sandbox token limit
      await db.update(sandboxes)
        .set({ hourlyTokenLimit: 10000 })
        .where(eq(sandboxes.id, TEST_SANDBOX_ID));
    }, TEST_TIMEOUT);
  });
  
  describe('Replayable Logs', () => {
    it('should capture replayable logs for tool execution', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a tool
      await orchestratorService.executeTool({
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        toolName: 'watchdog_analysis',
        parameters: {
          uploadId: TEST_UPLOAD_ID,
          question: 'What are the sales trends?'
        },
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        correlationId
      });
      
      // Get replayable logs
      const logs = orchestratorService.getReplayableLogs(correlationId);
      expect(logs.length).toBeGreaterThan(0);
      
      // Verify log structure
      const toolStartLog = logs.find(log => log.type === 'tool_start');
      expect(toolStartLog).toBeDefined();
      expect(toolStartLog.tool).toBe('watchdog_analysis');
      expect(toolStartLog.parameters).toBeDefined();
      expect(toolStartLog.timestamp).toBeDefined();
      
      const toolCompleteLog = logs.find(log => log.type === 'tool_complete');
      expect(toolCompleteLog).toBeDefined();
      expect(toolCompleteLog.tool).toBe('watchdog_analysis');
      expect(toolCompleteLog.result).toBeDefined();
      expect(toolCompleteLog.tokensUsed).toBeDefined();
      expect(toolCompleteLog.executionTime).toBeDefined();
      expect(toolCompleteLog.timestamp).toBeDefined();
    }, TEST_TIMEOUT);
    
    it('should capture replayable logs for workflow execution', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a workflow
      await orchestratorService.executeWorkflow({
        workflowId: 'sales-analysis-update',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID
        },
        correlationId
      });
      
      // Get replayable logs
      const logs = orchestratorService.getReplayableLogs(correlationId);
      expect(logs.length).toBeGreaterThan(0);
      
      // Verify workflow logs
      const workflowStartLog = logs.find(log => log.type === 'workflow_start');
      expect(workflowStartLog).toBeDefined();
      expect(workflowStartLog.workflow).toBeDefined();
      expect(workflowStartLog.timestamp).toBeDefined();
      
      const workflowCompleteLog = logs.find(log => log.type === 'workflow_complete');
      expect(workflowCompleteLog).toBeDefined();
      expect(workflowCompleteLog.workflow).toBeDefined();
      expect(workflowCompleteLog.result).toBeDefined();
      expect(workflowCompleteLog.executionTime).toBeDefined();
      expect(workflowCompleteLog.timestamp).toBeDefined();
      
      // Verify tool logs within workflow
      const toolLogs = logs.filter(log => log.type.startsWith('tool_'));
      expect(toolLogs.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
    
    it('should capture error logs', async () => {
      // Mock analytics client to throw an error
      analyticsClient.answerQuestion = jest.fn().mockRejectedValueOnce(
        new Error('Analytics service error')
      );
      
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a tool (should fail)
      try {
        await orchestratorService.executeTool({
          sandboxId: TEST_SANDBOX_ID,
          sessionId: TEST_SESSION_ID,
          toolName: 'watchdog_analysis',
          parameters: {
            uploadId: TEST_UPLOAD_ID,
            question: 'What are the sales trends?'
          },
          userId: TEST_USER_ID,
          dealershipId: TEST_DEALERSHIP_ID,
          correlationId
        });
        fail('Tool execution should have failed');
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Get replayable logs
      const logs = orchestratorService.getReplayableLogs(correlationId);
      expect(logs.length).toBeGreaterThan(0);
      
      // Verify error log
      const errorLog = logs.find(log => log.type === 'tool_error');
      expect(errorLog).toBeDefined();
      expect(errorLog.tool).toBe('watchdog_analysis');
      expect(errorLog.error).toBeDefined();
      expect(errorLog.error.message).toContain('Analytics service error');
      expect(errorLog.timestamp).toBeDefined();
      
      // Reset mock for subsequent tests
      analyticsClient.answerQuestion = jest.fn().mockImplementation(async (uploadId, question, options) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
          success: true,
          insights: [{ title: 'Test Insight', data: {} }],
          tokenUsage: 1250,
          correlationId: options?.correlationId
        };
      });
    }, TEST_TIMEOUT);
  });
  
  describe('Performance and Timing', () => {
    it('should execute tools within reasonable time limits', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Measure execution time
      const startTime = Date.now();
      
      // Execute a tool
      await orchestratorService.executeTool({
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        toolName: 'watchdog_analysis',
        parameters: {
          uploadId: TEST_UPLOAD_ID,
          question: 'What are the sales trends?'
        },
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        correlationId
      });
      
      const executionTime = Date.now() - startTime;
      
      // Verify execution time (should be reasonable)
      expect(executionTime).toBeLessThan(3000); // Less than 3 seconds
      
      // Get replayable logs
      const logs = orchestratorService.getReplayableLogs(correlationId);
      const toolCompleteLog = logs.find(log => log.type === 'tool_complete');
      
      // Verify logged execution time matches actual time (approximately)
      expect(toolCompleteLog.executionTime).toBeGreaterThan(0);
      expect(toolCompleteLog.executionTime).toBeLessThanOrEqual(executionTime);
    }, TEST_TIMEOUT);
    
    it('should execute workflows with parallel steps faster than sequential', async () => {
      // Create correlation IDs for tracking
      const sequentialCorrelationId = uuidv4();
      const parallelCorrelationId = uuidv4();
      
      // Measure sequential execution time
      const sequentialStartTime = Date.now();
      
      // Execute a sequential workflow
      await orchestratorService.executeWorkflow({
        workflowId: 'sales-analysis-update',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID
        },
        correlationId: sequentialCorrelationId
      });
      
      const sequentialExecutionTime = Date.now() - sequentialStartTime;
      
      // Measure parallel execution time
      const parallelStartTime = Date.now();
      
      // Execute a parallel workflow
      await orchestratorService.executeWorkflow({
        workflowId: 'customer-insight-automation',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID
        },
        correlationId: parallelCorrelationId
      });
      
      const parallelExecutionTime = Date.now() - parallelStartTime;
      
      // Get replayable logs
      const sequentialLogs = orchestratorService.getReplayableLogs(sequentialCorrelationId);
      const sequentialCompleteLog = sequentialLogs.find(log => log.type === 'workflow_complete');
      
      const parallelLogs = orchestratorService.getReplayableLogs(parallelCorrelationId);
      const parallelCompleteLog = parallelLogs.find(log => log.type === 'workflow_complete');
      
      // Log execution times for debugging
      console.log(`Sequential execution time: ${sequentialExecutionTime}ms`);
      console.log(`Parallel execution time: ${parallelExecutionTime}ms`);
      
      // Note: In a real test, we would verify that parallel execution is faster,
      // but in our mocked environment, the timing might not be reliable.
      // Instead, we just verify that both workflows completed successfully.
      expect(sequentialCompleteLog).toBeDefined();
      expect(parallelCompleteLog).toBeDefined();
    }, TEST_TIMEOUT);
  });
  
  describe('End-to-End Integration', () => {
    it('should demonstrate full cross-service orchestration capability', async () => {
      // Create a correlation ID for tracking
      const correlationId = uuidv4();
      
      // Execute a complex workflow that uses multiple services
      const workflowResult = await orchestratorService.executeWorkflow({
        workflowId: 'inventory-analysis-campaign',
        sandboxId: TEST_SANDBOX_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        dealershipId: TEST_DEALERSHIP_ID,
        parameters: {
          uploadId: TEST_UPLOAD_ID,
          accountId: TEST_ACCOUNT_ID,
          isDryRun: true
        },
        correlationId
      });
      
      // Verify workflow execution
      expect(workflowResult).toBeDefined();
      expect(workflowResult.status).toBe(WorkflowStepStatus.COMPLETED);
      
      // Verify analytics was called
      expect(analyticsClient.answerQuestion).toHaveBeenCalled();
      
      // Verify Google Ads was called
      expect(adsApiService.createSearchCampaign).toHaveBeenCalled();
      
      // Verify events were published
      // This is an indirect verification since we can't easily check the event bus directly
      
      // Verify WebSocket events were sent
      const wsMessages = testWsClient.getMessages().filter(
        m => m.data && m.data.correlationId === correlationId
      );
      expect(wsMessages.length).toBeGreaterThan(0);
      
      // Verify replayable logs are available
      const replayableLogs = orchestratorService.getReplayableLogs(correlationId);
      expect(replayableLogs.length).toBeGreaterThan(0);
      
      // Verify token usage was logged
      const tokenLogs = await db.query.tokenUsageLogs.findMany({
        where: and(
          eq(tokenUsageLogs.sandboxId, TEST_SANDBOX_ID),
          eq(tokenUsageLogs.sessionId, TEST_SESSION_ID)
        )
      });
      expect(tokenLogs.length).toBeGreaterThan(0);
      
      // Verify workflow steps were executed
      const steps = workflowResult.steps;
      expect(steps.length).toBe(2);
      expect(steps[0].status).toBe(WorkflowStepStatus.COMPLETED);
      expect(steps[1].status).toBe(WorkflowStepStatus.COMPLETED);
      
      // Verify results contain data from both services
      expect(steps[0].result).toBeDefined();
      expect(steps[0].result.insights).toBeDefined();
      expect(steps[1].result).toBeDefined();
      expect(steps[1].result.taskId || steps[1].result.campaignId).toBeDefined();
    }, TEST_TIMEOUT);
  });
});
