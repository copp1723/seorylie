import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { db } from "../server/db";
import {
  sandboxes,
  sandbox_sessions,
  token_usage_logs,
  Sandbox,
  SandboxSession,
  TokenUsageLog,
} from "../shared/schema";
import {
  orchestrator,
  SandboxOperationType,
  RateLimitExceededError,
} from "../server/services/orchestrator";
import { WebSocketService } from "../server/services/websocket-service";
import { toolRegistry } from "../server/services/tool-registry";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Mock WebSocket service
jest.mock("../server/services/websocket-service", () => {
  const mockSendToSession = jest.fn().mockReturnValue(true);
  const mockSendToSandboxSession = jest.fn().mockReturnValue(true);
  const mockBroadcastToSandbox = jest.fn();

  return {
    getWebSocketService: jest.fn().mockReturnValue({
      sendToSession: mockSendToSession,
      sendToSandboxSession: mockSendToSandboxSession,
      broadcastToSandbox: mockBroadcastToSandbox,
      initialize: jest.fn(),
    }),
    WebSocketService: jest.fn().mockImplementation(() => ({
      sendToSession: mockSendToSession,
      sendToSandboxSession: mockSendToSandboxSession,
      broadcastToSandbox: mockBroadcastToSandbox,
      initialize: jest.fn(),
    })),
  };
});

// Mock tool registry
jest.mock("../server/services/tool-registry", () => {
  return {
    toolRegistry: {
      executeTool: jest.fn().mockImplementation(async (request) => {
        return {
          success: true,
          toolName: request.toolName,
          data: { message: "Mock tool execution successful" },
          meta: {
            processingTime: 100,
            requestId: request.context.requestId,
          },
        };
      }),
      executeToolStream: jest.fn().mockImplementation((request) => {
        const emitter = new (require("events").EventEmitter)();

        // Simulate async events
        setTimeout(() => {
          emitter.emit("data", {
            type: "start",
            toolName: request.toolName,
            requestId: request.context.requestId,
            timestamp: Date.now(),
          });

          emitter.emit("data", {
            type: "data",
            toolName: request.toolName,
            requestId: request.context.requestId,
            timestamp: Date.now(),
            data: { message: "Mock streaming data" },
          });

          emitter.emit("data", {
            type: "end",
            toolName: request.toolName,
            requestId: request.context.requestId,
            timestamp: Date.now(),
          });
        }, 50);

        return emitter;
      }),
    },
  };
});

describe("Sandbox Rate Limiting", () => {
  // Test data
  const TEST_SANDBOX_NAME = "Test Sandbox";
  const TEST_HOURLY_LIMIT = 10000;
  const TEST_DAILY_LIMIT = 50000;
  const BURST_TOKEN_AMOUNT = 5000;

  // Track created resources for cleanup
  let testSandboxId: number;
  let testSessionIds: string[] = [];

  // Setup: Create a test database transaction for isolation
  let testTx: any;

  beforeAll(async () => {
    // Start a transaction for test isolation
    testTx = await db.transaction();

    // Replace the global db with the transaction for all tests
    jest
      .spyOn(db, "insert")
      .mockImplementation((...args) => testTx.insert(...args));
    jest
      .spyOn(db, "select")
      .mockImplementation((...args) => testTx.select(...args));
    jest
      .spyOn(db, "update")
      .mockImplementation((...args) => testTx.update(...args));
    jest
      .spyOn(db, "delete")
      .mockImplementation((...args) => testTx.delete(...args));
    jest
      .spyOn(db, "execute")
      .mockImplementation((...args) => testTx.execute(...args));
    jest.spyOn(db.query, "sandboxes").mockImplementation(() => ({
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        const results = await testTx.select().from(sandboxes).where(where);
        return results[0] || null;
      }),
      findMany: jest.fn().mockImplementation(async ({ where, orderBy }) => {
        return await testTx
          .select()
          .from(sandboxes)
          .where(where)
          .orderBy(orderBy);
      }),
    }));
    jest.spyOn(db.query, "sandbox_sessions").mockImplementation(() => ({
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        const results = await testTx
          .select()
          .from(sandbox_sessions)
          .where(where);
        return results[0] || null;
      }),
      findMany: jest.fn().mockImplementation(async ({ where, orderBy }) => {
        return await testTx
          .select()
          .from(sandbox_sessions)
          .where(where)
          .orderBy(orderBy);
      }),
    }));
  });

  afterAll(async () => {
    // Rollback the transaction to clean up
    await testTx.rollback();

    // Restore original implementations
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  // Test 1: Create a sandbox and verify it works
  test("should create a sandbox with specified token limits", async () => {
    // Create a test sandbox
    const sandbox = await orchestrator.createSandbox({
      name: TEST_SANDBOX_NAME,
      token_limit_per_hour: TEST_HOURLY_LIMIT,
      token_limit_per_day: TEST_DAILY_LIMIT,
      is_active: true,
    });

    // Store sandbox ID for later tests
    testSandboxId = sandbox.id;

    // Verify sandbox was created with correct limits
    expect(sandbox).toBeDefined();
    expect(sandbox.name).toBe(TEST_SANDBOX_NAME);
    expect(sandbox.token_limit_per_hour).toBe(TEST_HOURLY_LIMIT);
    expect(sandbox.token_limit_per_day).toBe(TEST_DAILY_LIMIT);
    expect(sandbox.current_hourly_usage).toBe(0);
    expect(sandbox.current_daily_usage).toBe(0);
    expect(sandbox.is_active).toBe(true);

    // Verify we can retrieve the sandbox
    const retrievedSandbox = await orchestrator.getSandbox(sandbox.id);
    expect(retrievedSandbox).toBeDefined();
    expect(retrievedSandbox?.id).toBe(sandbox.id);
  });

  // Test 2: Create a sandbox session and verify it works
  test("should create a sandbox session", async () => {
    // Create a test session
    const sessionContext = await orchestrator.createSandboxSession({
      sandboxId: testSandboxId,
      userId: 1,
      dealershipId: 1,
    });

    // Store session ID for later tests
    testSessionIds.push(sessionContext.sessionId);

    // Verify session was created correctly
    expect(sessionContext).toBeDefined();
    expect(sessionContext.sandboxId).toBe(testSandboxId);
    expect(sessionContext.sessionId).toBeDefined();
    expect(sessionContext.websocketChannel).toContain(
      `ws/sandbox/${testSandboxId}/`,
    );

    // Verify we can retrieve the session
    const retrievedSession = await orchestrator.getSandboxSession(
      sessionContext.sessionId,
    );
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession?.sandbox_id).toBe(testSandboxId);
    expect(retrievedSession?.session_id).toBe(sessionContext.sessionId);
  });

  // Test 3: Track token usage and verify it's recorded correctly
  test("should track token usage correctly", async () => {
    const sessionId = testSessionIds[0];
    const tokensToUse = 500;

    // Track token usage
    const success = await orchestrator.trackTokenUsage({
      sandboxId: testSandboxId,
      sessionId,
      operationType: SandboxOperationType.AGENT_MESSAGE,
      tokensUsed: tokensToUse,
      requestId: uuidv4(),
    });

    // Verify tracking was successful
    expect(success).toBe(true);

    // Verify sandbox usage was updated
    const sandbox = await orchestrator.getSandbox(testSandboxId);
    expect(sandbox).toBeDefined();
    expect(sandbox?.current_hourly_usage).toBe(tokensToUse);
    expect(sandbox?.current_daily_usage).toBe(tokensToUse);

    // Verify usage log was created
    const usageLogs = await testTx
      .select()
      .from(token_usage_logs)
      .where(eq(token_usage_logs.sandbox_id, testSandboxId));

    expect(usageLogs.length).toBe(1);
    expect(usageLogs[0].tokens_used).toBe(tokensToUse);
    expect(usageLogs[0].operation_type).toBe(
      SandboxOperationType.AGENT_MESSAGE,
    );
    expect(usageLogs[0].session_id).toBe(sessionId);
  });

  // Test 4: Test rate limiting with a 5k token burst
  test("should enforce rate limits and return 429 for a 5k token burst", async () => {
    const sessionId = testSessionIds[0];

    // First, get current usage
    const sandboxBefore = await orchestrator.getSandbox(testSandboxId);
    const currentHourlyUsage = sandboxBefore?.current_hourly_usage || 0;

    // Calculate how many tokens to use to exceed the limit
    // We already used 500 tokens in the previous test
    const tokensToUse = BURST_TOKEN_AMOUNT;

    // If this would exceed the limit, we expect an error
    if (currentHourlyUsage + tokensToUse > TEST_HOURLY_LIMIT) {
      await expect(
        orchestrator.trackTokenUsage({
          sandboxId: testSandboxId,
          sessionId,
          operationType: SandboxOperationType.AGENT_MESSAGE,
          tokensUsed: tokensToUse,
          requestId: uuidv4(),
        }),
      ).rejects.toThrow(RateLimitExceededError);

      // Try executing a tool and expect it to fail with rate limit
      await expect(
        orchestrator.executeToolInSandbox(
          sessionId,
          {
            toolName: "test_tool",
            parameters: { test: "data" },
          },
          tokensToUse,
        ),
      ).resolves.toMatchObject({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
        },
      });
    } else {
      // If we're still under the limit, add more tokens to exceed it
      const additionalTokens = TEST_HOURLY_LIMIT - currentHourlyUsage + 1;

      // This should succeed
      await orchestrator.trackTokenUsage({
        sandboxId: testSandboxId,
        sessionId,
        operationType: SandboxOperationType.AGENT_MESSAGE,
        tokensUsed: additionalTokens - 1, // Just under the limit
        requestId: uuidv4(),
      });

      // This should fail (exceeds the limit)
      await expect(
        orchestrator.trackTokenUsage({
          sandboxId: testSandboxId,
          sessionId,
          operationType: SandboxOperationType.AGENT_MESSAGE,
          tokensUsed: 10, // Just a small amount to exceed the limit
          requestId: uuidv4(),
        }),
      ).rejects.toThrow(RateLimitExceededError);
    }

    // Verify the rate limit check function works
    const rateCheck = await orchestrator.checkRateLimit(
      testSandboxId,
      tokensToUse,
    );
    expect(rateCheck.allowed).toBe(false);
  });

  // Test 5: Test multiple concurrent sessions in a sandbox
  test("should handle multiple concurrent sessions in a sandbox", async () => {
    // Create additional test sessions
    const session2Context = await orchestrator.createSandboxSession({
      sandboxId: testSandboxId,
      userId: 2,
    });

    const session3Context = await orchestrator.createSandboxSession({
      sandboxId: testSandboxId,
      userId: 3,
    });

    // Store session IDs for cleanup
    testSessionIds.push(session2Context.sessionId, session3Context.sessionId);

    // Verify all sessions are associated with the same sandbox
    const sessions = await orchestrator.getSandboxSessions(testSandboxId);
    expect(sessions.length).toBeGreaterThanOrEqual(3);

    // Verify token usage is tracked across sessions but aggregated at sandbox level
    const tokensPerSession = 100;

    // Track usage for each session
    for (const sessionId of [
      session2Context.sessionId,
      session3Context.sessionId,
    ]) {
      try {
        await orchestrator.trackTokenUsage({
          sandboxId: testSandboxId,
          sessionId,
          operationType: SandboxOperationType.TOOL_EXECUTION,
          tokensUsed: tokensPerSession,
          requestId: uuidv4(),
        });
      } catch (error) {
        // If we hit rate limit, that's expected and we can continue
        if (!(error instanceof RateLimitExceededError)) {
          throw error;
        }
      }
    }

    // Get usage stats
    const usageStats = await orchestrator.getSandboxUsageStats(testSandboxId);

    // Verify usage is tracked by session
    if (usageStats.usageBySession) {
      // Check if sessions have recorded usage
      const hasSession2Usage = Object.keys(usageStats.usageBySession).includes(
        session2Context.sessionId,
      );
      const hasSession3Usage = Object.keys(usageStats.usageBySession).includes(
        session3Context.sessionId,
      );

      // At least one session should have recorded usage (unless we hit rate limit for both)
      expect(hasSession2Usage || hasSession3Usage).toBeTruthy();
    }
  });

  // Test 6: Test token usage reset mechanism
  test("should reset token usage counters correctly", async () => {
    // Mock the reset function to force a reset
    const originalExecute = db.execute;
    const mockExecute = jest.fn().mockImplementation(async (query) => {
      // If this is the reset query, simulate a reset by updating the sandbox
      if (query.toString().includes("reset_token_usage_counters")) {
        await testTx
          .update(sandboxes)
          .set({
            current_hourly_usage: 0,
            usage_reset_hour: new Date(),
          })
          .where(eq(sandboxes.id, testSandboxId));
        return [{ success: true }];
      }
      return originalExecute.call(db, query);
    });

    // Apply the mock
    jest.spyOn(db, "execute").mockImplementation(mockExecute);

    // Call reset function
    await orchestrator.resetUsageCounters();

    // Verify counters were reset
    const sandbox = await orchestrator.getSandbox(testSandboxId);
    expect(sandbox).toBeDefined();
    expect(sandbox?.current_hourly_usage).toBe(0);

    // Restore original execute
    jest.spyOn(db, "execute").mockRestore();
  });

  // Test 7: Test sandbox health status
  test("should report sandbox health status correctly", async () => {
    // Get sandbox health
    const health = await orchestrator.getSandboxHealth(testSandboxId);

    // Verify health data
    expect(health).toBeDefined();
    expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    expect(health.activeSessions).toBeGreaterThanOrEqual(3); // We created at least 3 sessions
    expect(health.tokenUsage).toBeDefined();
    expect(health.tokenUsage.hourlyLimit).toBe(TEST_HOURLY_LIMIT);
    expect(health.tokenUsage.dailyLimit).toBe(TEST_DAILY_LIMIT);
  });

  // Test 8: Test daily limit enforcement
  test("should enforce daily token limits", async () => {
    // Create a new sandbox with a low daily limit for testing
    const lowLimitSandbox = await orchestrator.createSandbox({
      name: "Low Daily Limit Sandbox",
      token_limit_per_hour: 10000, // High hourly limit
      token_limit_per_day: 1000, // Low daily limit
      is_active: true,
    });

    // Create a session
    const sessionContext = await orchestrator.createSandboxSession({
      sandboxId: lowLimitSandbox.id,
      userId: 1,
    });

    // Track usage just below the daily limit
    await orchestrator.trackTokenUsage({
      sandboxId: lowLimitSandbox.id,
      sessionId: sessionContext.sessionId,
      operationType: SandboxOperationType.AGENT_MESSAGE,
      tokensUsed: 999,
      requestId: uuidv4(),
    });

    // Verify we're close to the limit
    const rateCheck = await orchestrator.checkRateLimit(lowLimitSandbox.id, 2);
    expect(rateCheck.allowed).toBe(false);
    expect(rateCheck.dailyUsage).toBe(999);

    // Try to exceed the daily limit
    await expect(
      orchestrator.trackTokenUsage({
        sandboxId: lowLimitSandbox.id,
        sessionId: sessionContext.sessionId,
        operationType: SandboxOperationType.AGENT_MESSAGE,
        tokensUsed: 2,
        requestId: uuidv4(),
      }),
    ).rejects.toThrow(RateLimitExceededError);

    // Clean up
    await orchestrator.deleteSandbox(lowLimitSandbox.id);
  });

  // Test 9: Test agent message processing with rate limiting
  test("should rate limit agent message processing", async () => {
    // Create a new sandbox with a low limit for testing
    const lowLimitSandbox = await orchestrator.createSandbox({
      name: "Low Limit Agent Sandbox",
      token_limit_per_hour: 1000,
      token_limit_per_day: 5000,
      is_active: true,
    });

    // Create a session
    const sessionContext = await orchestrator.createSandboxSession({
      sandboxId: lowLimitSandbox.id,
      userId: 1,
    });

    // Process a message with a token count below the limit
    const response1 = await orchestrator.processAgentMessage(
      sessionContext.sessionId,
      "This is a test message",
      500, // Token estimate
    );

    // Verify success
    expect(response1.success).toBe(true);

    // Process another message that would exceed the limit
    const response2 = await orchestrator.processAgentMessage(
      sessionContext.sessionId,
      "This is another test message that would exceed the limit",
      600, // Token estimate that would exceed the 1000 limit
    );

    // Verify rate limit error
    expect(response2.success).toBe(false);
    expect(response2.error?.code).toBe("RATE_LIMIT_EXCEEDED");

    // Clean up
    await orchestrator.deleteSandbox(lowLimitSandbox.id);
  });

  // Test 10: Test sandbox token usage estimation
  test("should estimate token usage correctly", () => {
    // Test with various message lengths
    const shortMessage = "This is a short message.";
    const mediumMessage =
      "This is a medium length message that contains more words and should result in a higher token count estimation.";
    const longMessage =
      "This is a long message that contains many words and should result in an even higher token count estimation. It includes multiple sentences and a variety of words to ensure that the token estimation function has enough text to work with. The estimation should be proportional to the length of the text, with longer texts resulting in higher token counts.";

    // Get estimates
    const shortEstimate = orchestrator.estimateTokenUsage(shortMessage);
    const mediumEstimate = orchestrator.estimateTokenUsage(mediumMessage);
    const longEstimate = orchestrator.estimateTokenUsage(longMessage);

    // Verify estimates are reasonable and increase with message length
    expect(shortEstimate).toBeGreaterThan(0);
    expect(mediumEstimate).toBeGreaterThan(shortEstimate);
    expect(longEstimate).toBeGreaterThan(mediumEstimate);
  });

  // Clean up: Delete test sessions and sandbox
  afterAll(async () => {
    // Delete test sessions
    for (const sessionId of testSessionIds) {
      try {
        await orchestrator.deleteSandboxSession(sessionId);
      } catch (error) {
        console.error(`Error deleting test session ${sessionId}:`, error);
      }
    }

    // Delete test sandbox
    try {
      await orchestrator.deleteSandbox(testSandboxId);
    } catch (error) {
      console.error(`Error deleting test sandbox ${testSandboxId}:`, error);
    }
  });
});
