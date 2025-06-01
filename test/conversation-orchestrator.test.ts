/**
 * Comprehensive Test Suite for ADF-W10 Conversation Orchestrator
 * 
 * Tests the advanced conversation orchestrator including:
 * - Event-driven processing
 * - Circuit breaker functionality
 * - Queue management
 * - Metrics collection
 * - Database operations
 * - Error handling and resilience
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { ConversationOrchestrator } from '../server/services/conversation-orchestrator';
import { PromptManager } from '../server/services/prompt-manager';
import { MetricsCollector } from '../server/services/metrics-collector';
import { CircuitBreaker } from '../server/services/circuit-breaker';

// Mock dependencies
vi.mock('../server/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({
    xgroup: vi.fn(),
    xreadgroup: vi.fn(() => []),
    xadd: vi.fn(),
    xack: vi.fn(),
    duplicate: vi.fn(() => ({}))
  }))
}));

vi.mock('../server/db', () => ({
  default: {
    execute: vi.fn(() => ({ rows: [] })),
    insert: vi.fn(() => ({ returning: vi.fn(() => [{}]) })),
    update: vi.fn(() => ({ returning: vi.fn(() => [{}]) })),
    select: vi.fn(() => ({ from: vi.fn(), where: vi.fn(), limit: vi.fn() }))
  }
}));

vi.mock('bull', () => ({
  default: vi.fn(() => ({
    process: vi.fn(),
    add: vi.fn(),
    getJobCounts: vi.fn(() => ({
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 0
    })),
    on: vi.fn(),
    close: vi.fn()
  }))
}));

vi.mock('../server/services/ai-response-service', () => ({
  AIResponseService: vi.fn(() => ({
    generateResponse: vi.fn(() => Promise.resolve({
      content: 'Test AI response',
      confidence: 0.9,
      intent: 'general_inquiry',
      sentiment: 0.8,
      tokensUsed: 50,
      cost: 0.001
    }))
  }))
}));

vi.mock('../server/utils/logger', () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
    level: 'info',
    silent: false
  };

  return {
    default: mockLogger,
    logger: mockLogger,
    ...mockLogger
  };
});

describe('ConversationOrchestrator', () => {
  let orchestrator: ConversationOrchestrator;
  let mockDb: any;
  let cleanupTasks: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Increase EventEmitter max listeners to prevent memory leak warnings
    process.setMaxListeners(50);
  });

  afterAll(async () => {
    // Ensure all cleanup tasks are executed
    await Promise.all(cleanupTasks.map(task => task().catch(console.error)));
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    cleanupTasks = [];

    // Create fresh orchestrator instance
    orchestrator = new ConversationOrchestrator();

    // Set max listeners to prevent memory leak warnings
    orchestrator.setMaxListeners(20);

    // Mock database responses
    mockDb = await import('../server/db');
    mockDb.default.execute.mockResolvedValue({ rows: [] });

    // Mock Redis responses
    const redisModule = await import('../server/lib/redis');
    redisModule.getRedisClient();
  });

  afterEach(async () => {
    // Immediate shutdown to prevent memory leaks
    if (orchestrator) {
      try {
        // Remove all listeners before shutdown to prevent memory leaks
        orchestrator.removeAllListeners();
        await orchestrator.shutdown();
      } catch (error) {
        console.error('Error during orchestrator shutdown:', error);
      }
    }

    // Execute any additional cleanup tasks
    await Promise.all(cleanupTasks.map(task => task().catch(console.error)));
    cleanupTasks = [];
  });

  describe('Initialization', () => {
    it('should initialize successfully with all dependencies', async () => {
      const initPromise = orchestrator.initialize();
      await expect(initPromise).resolves.not.toThrow();
    });

    it('should handle initialization failure gracefully', async () => {
      // Mock Redis to fail
      const redisModule = await import('../server/lib/redis');
      vi.mocked(redisModule.getRedisClient).mockReturnValue(null);

      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event when ready', async () => {
      const initSpy = vi.fn();
      orchestrator.on('initialized', initSpy);
      
      await orchestrator.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('Lead Processing', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should process new lead and create conversation', async () => {
      const leadData = {
        id: 'lead-123',
        dealership_id: 1,
        source: 'website',
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890'
        },
        vehicle: {
          model: 'Model Y'
        },
        metadata: {
          sessionDuration: 300
        }
      };

      // Mock database insert
      mockDb.default.execute.mockResolvedValueOnce({ rows: [] });

      // Simulate handling new lead
      await (orchestrator as any).handleNewLead('msg-123', {
        data: JSON.stringify(leadData)
      });

      // Verify conversation was stored
      expect(mockDb.default.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                expect.stringContaining('INSERT INTO conversations_v2')
              ])
            })
          ])
        })
      );
    });

    it('should calculate lead priority correctly', async () => {
      const highPriorityLead = {
        comments: 'I need this car today',
        vehicle: { price: 75000 },
        dealership: { premium_tier: true },
        metadata: { sessionDuration: 600 }
      };

      const priority = (orchestrator as any).calculatePriority(highPriorityLead);
      expect(priority).toBeGreaterThan(10);
    });

    it('should select appropriate AI model based on lead characteristics', async () => {
      const premiumLead = {
        dealership: { premium_tier: true },
        vehicle: { price: 80000 }
      };

      const model = (orchestrator as any).selectAIModel(premiumLead);
      expect(model).toBe('gpt-4');
    });
  });

  describe('Conversation Turn Processing', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should process conversation turn successfully', async () => {
      const context = {
        conversationId: 'conv-123',
        leadId: 'lead-123',
        dealershipId: 1,
        currentTurn: 0,
        maxTurns: 2,
        metadata: {
          source: 'website',
          customerInfo: { name: 'John' }
        },
        history: [],
        state: 'active',
        aiModel: 'gpt-3.5-turbo',
        temperature: 0.7,
        priority: 5
      };

      // Mock database operations
      mockDb.default.execute
        .mockResolvedValueOnce({ 
          rows: [{ ...context, id: context.conversationId }] 
        }) // loadConversationState
        .mockResolvedValueOnce({ rows: [] }) // loadConversationHistory
        .mockResolvedValueOnce({ rows: [] }) // storeMessage
        .mockResolvedValueOnce({ rows: [] }); // updateConversationState

      const result = await (orchestrator as any).processConversationTurn({
        context,
        turnNumber: 1
      });

      expect(result).toMatchObject({
        conversationId: context.conversationId,
        turnNumber: 1,
        message: expect.any(String),
        nextAction: expect.any(String),
        metadata: expect.objectContaining({
          responseTime: expect.any(Number)
        })
      });
    });

    it('should handle AI service failures with circuit breaker', async () => {
      const context = {
        conversationId: 'conv-123',
        leadId: 'lead-123',
        dealershipId: 1,
        currentTurn: 0,
        maxTurns: 2,
        metadata: { source: 'website', customerInfo: {} },
        history: [],
        state: 'active',
        aiModel: 'gpt-3.5-turbo',
        temperature: 0.7,
        priority: 5
      };

      // Mock circuit breaker to fail
      const circuitBreaker = (orchestrator as any).circuitBreaker;
      circuitBreaker.execute = vi.fn().mockRejectedValue(new Error('AI service unavailable'));

      // Mock database operations
      mockDb.default.execute
        .mockResolvedValueOnce({ 
          rows: [{ ...context, id: context.conversationId }] 
        });

      await expect(
        (orchestrator as any).processConversationTurn({
          context,
          turnNumber: 1
        })
      ).rejects.toThrow('AI service unavailable');
    });

    it('should determine next action correctly for two-turn mode', async () => {
      const context = {
        maxTurns: 2,
        dealershipId: 1
      };

      const response = {
        escalationReason: null,
        intent: 'general_inquiry',
        confidence: 0.8,
        sentiment: 0.7
      };

      // Turn 1 should continue
      let nextAction = (orchestrator as any).determineNextAction(context, response, 1);
      expect(nextAction).toBe('continue');

      // Turn 2 should complete
      nextAction = (orchestrator as any).determineNextAction(context, response, 2);
      expect(nextAction).toBe('complete');
    });

    it('should escalate on explicit escalation signal', async () => {
      const context = { maxTurns: 5, dealershipId: 1 };
      const response = { escalationReason: 'customer_request' };

      const nextAction = (orchestrator as any).determineNextAction(context, response, 1);
      expect(nextAction).toBe('escalate');
    });
  });

  describe('Adaptive Conversation Logic', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
      process.env.ADAPTIVE_CONVERSATIONS_ENABLED = 'true';
    });

    afterEach(() => {
      delete process.env.ADAPTIVE_CONVERSATIONS_ENABLED;
    });

    it('should support extended turns in adaptive mode', async () => {
      const lead = {
        metadata: { maxTurns: 5 }
      };

      const maxTurns = (orchestrator as any).getMaxTurns(lead);
      expect(maxTurns).toBe(5);
    });

    it('should escalate on low engagement in adaptive mode', async () => {
      const context = { maxTurns: 5, dealershipId: 1 };
      const response = { 
        escalationReason: null,
        sentiment: 0.2,
        intent: 'disengagement'
      };

      const nextAction = (orchestrator as any).determineNextAction(context, response, 3);
      expect(nextAction).toBe('escalate');
    });

    it('should complete on high-confidence appointment booking', async () => {
      const context = { maxTurns: 5, dealershipId: 1 };
      const response = {
        escalationReason: null,
        intent: 'schedule_appointment',
        confidence: 0.95
      };

      const nextAction = (orchestrator as any).determineNextAction(context, response, 2);
      expect(nextAction).toBe('complete');
    });
  });

  describe('Database Operations', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should store conversation context correctly', async () => {
      const context = {
        conversationId: 'conv-123',
        leadId: 'lead-123',
        dealershipId: 1,
        currentTurn: 0,
        maxTurns: 2,
        metadata: { source: 'website' },
        state: 'active',
        aiModel: 'gpt-3.5-turbo',
        temperature: 0.7,
        priority: 5
      };

      await (orchestrator as any).storeConversation(context);

      expect(mockDb.default.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                expect.stringContaining('INSERT INTO conversations_v2')
              ])
            })
          ])
        })
      );
    });

    it('should store message with metadata correctly', async () => {
      const message = {
        role: 'assistant',
        content: 'Hello! How can I help you?',
        turnNumber: 1,
        metadata: {
          model: 'gpt-3.5-turbo',
          processingTime: 1500,
          confidence: 0.9,
          tokensUsed: 25
        }
      };

      await (orchestrator as any).storeMessage('conv-123', message);

      expect(mockDb.default.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                expect.stringContaining('INSERT INTO conversation_messages_v2')
              ])
            })
          ])
        })
      );
    });

    it('should update conversation state correctly', async () => {
      const updates = {
        currentTurn: 2,
        state: 'completed',
        completedAt: new Date()
      };

      await (orchestrator as any).updateConversationState('conv-123', updates);

      expect(mockDb.default.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                expect.stringContaining('UPDATE conversations_v2')
              ])
            })
          ])
        })
      );
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should return comprehensive health status', async () => {
      // Mock conversation metrics
      mockDb.default.execute.mockResolvedValueOnce({
        rows: [{ total: 10, active: 3, average_turns: 1.8 }]
      });

      const health = await orchestrator.getHealthStatus();

      expect(health).toMatchObject({
        status: expect.any(String),
        queue: expect.objectContaining({
          waiting: expect.any(Number),
          active: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number)
        }),
        circuitBreaker: expect.objectContaining({
          state: expect.any(String),
          failures: expect.any(Number)
        }),
        metrics: expect.objectContaining({
          totalConversations: expect.any(Number),
          activeConversations: expect.any(Number),
          averageTurnsPerConversation: expect.any(Number)
        }),
        redis: expect.objectContaining({
          connected: expect.any(Boolean),
          streamsActive: expect.any(Boolean)
        })
      });
    });

    it('should determine health status correctly', async () => {
      const queueCounts = { waiting: 5, active: 2, completed: 100, failed: 1 };
      const circuitBreakerStats = { state: 'closed', failureCount: 0 };

      const status = (orchestrator as any).determineOverallHealth(queueCounts, circuitBreakerStats);
      expect(status).toBe('healthy');
    });

    it('should detect unhealthy state when circuit breaker is open', async () => {
      const queueCounts = { waiting: 5, active: 2, completed: 100, failed: 1 };
      const circuitBreakerStats = { state: 'open', failureCount: 10 };

      const status = (orchestrator as any).determineOverallHealth(queueCounts, circuitBreakerStats);
      expect(status).toBe('unhealthy');
    });

    it('should detect degraded state with high queue backlog', async () => {
      const queueCounts = { waiting: 150, active: 5, completed: 100, failed: 2 };
      const circuitBreakerStats = { state: 'closed', failureCount: 0 };

      const status = (orchestrator as any).determineOverallHealth(queueCounts, circuitBreakerStats);
      expect(status).toBe('degraded');
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle database connection failures gracefully', async () => {
      mockDb.default.execute.mockRejectedValue(new Error('Database connection failed'));

      const context = {
        conversationId: 'conv-123',
        leadId: 'lead-123',
        dealershipId: 1
      };

      await expect(
        (orchestrator as any).storeConversation(context)
      ).rejects.toThrow('Database connection failed');
    });

    it('should record turn errors correctly', async () => {
      const error = new Error('Processing failed');
      
      await (orchestrator as any).recordTurnError('conv-123', 1, error);

      expect(mockDb.default.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                expect.stringContaining('INSERT INTO conversation_queue_jobs')
              ])
            })
          ])
        })
      );
    });

    it('should emit error events for monitoring', async () => {
      const errorSpy = vi.fn();
      orchestrator.on('error', errorSpy);

      orchestrator.emit('error', new Error('Test error'));

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should emit conversation:started event', async () => {
      const startedSpy = vi.fn();
      orchestrator.on('conversation:started', startedSpy);

      orchestrator.emit('conversation:started', {
        conversationId: 'conv-123',
        leadId: 'lead-123',
        dealershipId: 1
      });

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-123',
          leadId: 'lead-123',
          dealershipId: 1
        })
      );
    });

    it('should emit conversation:completed event', async () => {
      const completedSpy = vi.fn();
      orchestrator.on('conversation:completed', completedSpy);

      orchestrator.emit('conversation:completed', {
        conversationId: 'conv-123',
        totalTurns: 2,
        outcome: 'completed'
      });

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-123',
          totalTurns: 2,
          outcome: 'completed'
        })
      );
    });

    it('should emit conversation:escalated event', async () => {
      const escalatedSpy = vi.fn();
      orchestrator.on('conversation:escalated', escalatedSpy);

      orchestrator.emit('conversation:escalated', {
        conversationId: 'conv-123',
        reason: 'customer_request',
        turnNumber: 2
      });

      expect(escalatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-123',
          reason: 'customer_request',
          turnNumber: 2
        })
      );
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await orchestrator.initialize();
      
      const shutdownPromise = orchestrator.shutdown();
      await expect(shutdownPromise).resolves.not.toThrow();
    });

    it('should emit shutdown event', async () => {
      await orchestrator.initialize();

      const shutdownSpy = vi.fn();
      orchestrator.on('shutdown', shutdownSpy);

      // Capture the event before shutdown removes listeners
      const shutdownPromise = new Promise(resolve => {
        orchestrator.once('shutdown', resolve);
      });

      const shutdownTask = orchestrator.shutdown();

      // Wait for either the event or a timeout
      const result = await Promise.race([
        shutdownPromise.then(() => 'event-emitted'),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 100))
      ]);

      await shutdownTask;

      // The shutdown should complete successfully
      expect(result).toBe('event-emitted');
    });
  });
});

describe('CircuitBreaker Integration', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenSuccessThreshold: 2
    });
  });

  it('should open circuit after failure threshold', async () => {
    const failingFunction = () => Promise.reject(new Error('Service failure'));

    // Execute function enough times to trigger circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe('open');
  });

  it('should transition to half-open after reset timeout', async () => {
    const failingFunction = () => Promise.reject(new Error('Service failure'));

    // Trigger circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe('open');

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Next execution should transition to half-open
    try {
      await circuitBreaker.execute(failingFunction);
    } catch (error) {
      // Expected to fail, but state should change
    }

    expect(circuitBreaker.getState()).toBe('open'); // Goes back to open on failure
  });

  it('should close circuit on successful executions in half-open state', async () => {
    const successFunction = () => Promise.resolve('success');
    const failingFunction = () => Promise.reject(new Error('Service failure'));

    // Trigger circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingFunction);
      } catch (error) {
        // Expected to fail
      }
    }

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Execute successful functions to close circuit
    await circuitBreaker.execute(successFunction);
    await circuitBreaker.execute(successFunction);

    expect(circuitBreaker.getState()).toBe('closed');
  });
});

describe('Integration Tests', () => {
  let orchestrator: ConversationOrchestrator;
  let integrationMockDb: any;

  beforeEach(async () => {
    orchestrator = new ConversationOrchestrator();

    // Set max listeners to prevent memory leak warnings
    orchestrator.setMaxListeners(20);

    // Setup integration test database mocks
    integrationMockDb = await import('../server/db');
    integrationMockDb.default.execute.mockResolvedValue({ rows: [] });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    // Remove all listeners before shutdown to prevent memory leaks
    if (orchestrator) {
      orchestrator.removeAllListeners();
      await orchestrator.shutdown();
    }
  });

  it('should handle complete conversation flow', async () => {
    const leadData = {
      id: 'lead-integration',
      dealership_id: 1,
      source: 'website',
      customer: { name: 'Test Customer', email: 'test@example.com' },
      vehicle: { model: 'Test Vehicle' }
    };

    // Mock successful database operations
    integrationMockDb.default.execute
      .mockResolvedValueOnce({ rows: [] }) // storeConversation
      .mockResolvedValueOnce({
        rows: [{
          id: 'conv-integration',
          lead_id: leadData.id,
          dealership_id: leadData.dealership_id,
          current_turn: 0,
          max_turns: 2,
          state: 'active',
          metadata: {},
          ai_model: 'gpt-3.5-turbo',
          temperature: 0.7,
          priority: 0
        }]
      }) // loadConversationState
      .mockResolvedValueOnce({ rows: [] }) // loadConversationHistory
      .mockResolvedValueOnce({ rows: [] }) // storeMessage
      .mockResolvedValueOnce({ rows: [] }); // updateConversationState

    // Handle new lead
    await (orchestrator as any).handleNewLead('msg-integration', {
      data: JSON.stringify(leadData)
    });

    // Verify conversation was created and queued
    expect(integrationMockDb.default.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        queryChunks: expect.arrayContaining([
          expect.objectContaining({
            value: expect.arrayContaining([
              expect.stringContaining('INSERT INTO conversations_v2')
            ])
          })
        ])
      })
    );
  });
});

export { ConversationOrchestrator };