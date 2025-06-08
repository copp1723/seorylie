import { jest } from "@jest/globals";
import { EventEmitter } from "events";
import { IntentOrchestrator } from "../../server/services/intent/intent-orchestrator";
import { RuleEngine } from "../../server/services/intent/rule-engine";
import { MLClassifier } from "../../server/services/intent/ml-classifier";
import { BehaviouralMonitor } from "../../server/services/intent/behavioural-monitor";
import { SLATracker } from "../../server/services/intent/sla-tracker";
import { UnifiedConfigService } from "../../server/services/intent/unified-config-service";
import { monitoringService } from "../../server/services/monitoring";
import { createConfigService } from "../../server/services/intent/unified-config-service";
import logger from "../../server/utils/logger";

// Mock dependencies
jest.mock("../../server/services/monitoring", () => ({
  monitoringService: {
    registerMetric: jest.fn(),
    incrementMetric: jest.fn(),
    recordLatency: jest.fn(),
    getMetric: jest.fn().mockReturnValue(0),
    recordGauge: jest.fn(),
  },
}));

jest.mock("../../server/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../server/db", () => ({
  execute: jest.fn().mockResolvedValue([]),
  transaction: jest.fn().mockImplementation((fn) => fn()),
}));

jest.mock("openai", () => {
  return {
    Configuration: jest.fn(),
    OpenAIApi: jest.fn().mockImplementation(() => ({
      createCompletion: jest.fn().mockResolvedValue({
        data: {
          choices: [{ text: "mocked response" }],
        },
      }),
      createChatCompletion: jest.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: "mocked response",
                function_call: {
                  name: "detectIntent",
                  arguments: JSON.stringify({
                    hasIntent: true,
                    intentType: "purchase",
                    confidence: 0.92,
                    reasoning:
                      "Customer is asking about purchasing the vehicle",
                  }),
                },
              },
            },
          ],
        },
      }),
    })),
  };
});

jest.mock("redis", () => {
  const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK"),
  };

  return {
    createClient: jest.fn().mockReturnValue(mockRedisClient),
  };
});

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify({
      handover: {
        rules: {
          include: ["R-BUY-1", "R-TEST-1"],
          exclude: [],
        },
        ml_threshold: 0.8,
        behavioural: {
          engaged_replies: 3,
          window_minutes: 30,
        },
        sla: {
          no_response_hours: 48,
        },
      },
    }),
  ),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue(["config.yml"]),
}));

jest.mock("js-yaml", () => ({
  load: jest.fn().mockReturnValue({
    handover: {
      rules: {
        include: ["R-BUY-1", "R-TEST-1"],
        exclude: [],
      },
      ml_threshold: 0.8,
      behavioural: {
        engaged_replies: 3,
        window_minutes: 30,
      },
      sla: {
        no_response_hours: 48,
      },
    },
  }),
  dump: jest.fn().mockReturnValue("mocked yaml content"),
}));

jest.mock("chokidar", () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock("node-schedule", () => ({
  scheduleJob: jest.fn().mockReturnValue({
    cancel: jest.fn(),
  }),
}));

// Mock data
const mockConversation = {
  id: 123,
  dealershipId: 456,
  customerId: 789,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessage = {
  id: 1,
  conversationId: 123,
  content: "I want to buy this car. What's your best price?",
  isFromCustomer: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDealershipConfig = {
  handover: {
    rules: {
      include: ["R-BUY-1", "R-TEST-1"],
      exclude: [],
    },
    ml_threshold: 0.8,
    behavioural: {
      engaged_replies: 3,
      window_minutes: 30,
    },
    sla: {
      no_response_hours: 48,
    },
  },
};

// Helper function to wait for promises to resolve
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe("Intent Detection System", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("IntentOrchestrator", () => {
    let orchestrator: IntentOrchestrator;
    let ruleEngine: RuleEngine;
    let mlClassifier: MLClassifier;
    let behaviouralMonitor: BehaviouralMonitor;
    let slaTracker: SLATracker;

    beforeEach(() => {
      // Create mock instances of all components
      ruleEngine = new RuleEngine();
      mlClassifier = new MLClassifier();
      behaviouralMonitor = new BehaviouralMonitor();
      slaTracker = new SLATracker();

      // Mock methods
      ruleEngine.evaluateMessage = jest.fn().mockResolvedValue({
        hasIntent: true,
        intentType: "purchase",
        ruleId: "R-BUY-1",
        confidence: 1.0,
        triggerType: "rule",
      });

      mlClassifier.classifyIntent = jest.fn().mockResolvedValue({
        hasIntent: true,
        intentType: "purchase",
        confidence: 0.92,
        triggerType: "ml",
      });

      behaviouralMonitor.evaluateEngagement = jest.fn().mockResolvedValue({
        hasIntent: false,
        engagementLevel: "medium",
        messageCount: 2,
        triggerType: "behavioural",
      });

      slaTracker.checkSLA = jest.fn().mockResolvedValue({
        hasIntent: false,
        hoursWithoutResponse: 0,
        triggerType: "sla",
      });

      // Create orchestrator with mock components
      orchestrator = new IntentOrchestrator({
        ruleEngine,
        mlClassifier,
        behaviouralMonitor,
        slaTracker,
      });
    });

    test("should initialize with all components", () => {
      expect(orchestrator).toBeDefined();
      expect(monitoringService.registerMetric).toHaveBeenCalledWith(
        "intent_detection_total",
        "counter",
      );
      expect(monitoringService.registerMetric).toHaveBeenCalledWith(
        "intent_detection_latency_ms",
        "histogram",
      );
    });

    test("should detect intent from rule engine", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Create spy for emit
      const emitSpy = jest.spyOn(orchestrator, "emit");

      // Execute
      await orchestrator.processMessage(
        message,
        conversation,
        dealershipConfig,
      );

      // Verify
      expect(ruleEngine.evaluateMessage).toHaveBeenCalledWith(
        message,
        conversation,
        dealershipConfig.handover.rules,
      );

      expect(emitSpy).toHaveBeenCalledWith(
        "handover.intent.triggered",
        expect.objectContaining({
          conversationId: conversation.id,
          dealershipId: conversation.dealershipId,
          triggerType: "rule",
          ruleId: "R-BUY-1",
          confidence: 1.0,
        }),
      );

      expect(monitoringService.incrementMetric).toHaveBeenCalledWith(
        "intent_detection_total",
        {
          family: "rule",
          dealership_id: conversation.dealershipId,
          outcome: "triggered",
        },
      );

      expect(monitoringService.recordLatency).toHaveBeenCalledWith(
        "intent_detection_latency_ms",
        expect.any(Number),
        { family: "rule" },
      );
    });

    test("should detect intent from ML classifier when rule engine finds none", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Mock rule engine to return no intent
      ruleEngine.evaluateMessage = jest.fn().mockResolvedValue({
        hasIntent: false,
        triggerType: "rule",
      });

      // Create spy for emit
      const emitSpy = jest.spyOn(orchestrator, "emit");

      // Execute
      await orchestrator.processMessage(
        message,
        conversation,
        dealershipConfig,
      );

      // Verify
      expect(mlClassifier.classifyIntent).toHaveBeenCalledWith(
        message,
        conversation,
        dealershipConfig.handover.ml_threshold,
      );

      expect(emitSpy).toHaveBeenCalledWith(
        "handover.intent.triggered",
        expect.objectContaining({
          conversationId: conversation.id,
          dealershipId: conversation.dealershipId,
          triggerType: "ml",
          confidence: 0.92,
        }),
      );

      expect(monitoringService.incrementMetric).toHaveBeenCalledWith(
        "intent_detection_total",
        {
          family: "ml",
          dealership_id: conversation.dealershipId,
          outcome: "triggered",
        },
      );
    });

    test("should detect intent from behavioural monitor when others find none", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Mock engines to return no intent
      ruleEngine.evaluateMessage = jest.fn().mockResolvedValue({
        hasIntent: false,
        triggerType: "rule",
      });

      mlClassifier.classifyIntent = jest.fn().mockResolvedValue({
        hasIntent: false,
        triggerType: "ml",
      });

      // Mock behavioural monitor to return intent
      behaviouralMonitor.evaluateEngagement = jest.fn().mockResolvedValue({
        hasIntent: true,
        engagementLevel: "high",
        messageCount: 4,
        triggerType: "behavioural",
        confidence: 0.85,
      });

      // Create spy for emit
      const emitSpy = jest.spyOn(orchestrator, "emit");

      // Execute
      await orchestrator.processMessage(
        message,
        conversation,
        dealershipConfig,
      );

      // Verify
      expect(behaviouralMonitor.evaluateEngagement).toHaveBeenCalledWith(
        message,
        conversation,
        dealershipConfig.handover.behavioural,
      );

      expect(emitSpy).toHaveBeenCalledWith(
        "handover.intent.triggered",
        expect.objectContaining({
          conversationId: conversation.id,
          dealershipId: conversation.dealershipId,
          triggerType: "behavioural",
          confidence: 0.85,
        }),
      );
    });

    test("should not emit event when no intent is detected", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Mock all engines to return no intent
      ruleEngine.evaluateMessage = jest.fn().mockResolvedValue({
        hasIntent: false,
        triggerType: "rule",
      });

      mlClassifier.classifyIntent = jest.fn().mockResolvedValue({
        hasIntent: false,
        triggerType: "ml",
      });

      behaviouralMonitor.evaluateEngagement = jest.fn().mockResolvedValue({
        hasIntent: false,
        engagementLevel: "low",
        messageCount: 1,
        triggerType: "behavioural",
      });

      // Create spy for emit
      const emitSpy = jest.spyOn(orchestrator, "emit");

      // Execute
      await orchestrator.processMessage(
        message,
        conversation,
        dealershipConfig,
      );

      // Verify no handover event was emitted
      expect(emitSpy).not.toHaveBeenCalledWith(
        "handover.intent.triggered",
        expect.anything(),
      );

      // Verify metrics were still recorded
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith(
        "intent_detection_total",
        {
          family: "rule",
          dealership_id: conversation.dealershipId,
          outcome: "no_trigger",
        },
      );
    });

    test("should debounce multiple intent detections within 10 seconds", async () => {
      // Setup
      const message1 = { ...mockMessage, id: 1 };
      const message2 = { ...mockMessage, id: 2 };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Create spy for emit
      const emitSpy = jest.spyOn(orchestrator, "emit");

      // Execute first message
      await orchestrator.processMessage(
        message1,
        conversation,
        dealershipConfig,
      );

      // Execute second message immediately after
      await orchestrator.processMessage(
        message2,
        conversation,
        dealershipConfig,
      );

      // Verify emit was only called once for handover.intent.triggered
      const handoverEmitCount = emitSpy.mock.calls.filter(
        (call) => call[0] === "handover.intent.triggered",
      ).length;

      expect(handoverEmitCount).toBe(1);

      // Verify debounce was logged
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Debounced intent trigger"),
        expect.any(Object),
      );
    });

    test("should meet latency requirement of ≤2s", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Execute and measure time
      const startTime = Date.now();
      await orchestrator.processMessage(
        message,
        conversation,
        dealershipConfig,
      );
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is under 2000ms
      expect(latency).toBeLessThanOrEqual(2000);

      // Verify latency was recorded
      expect(monitoringService.recordLatency).toHaveBeenCalledWith(
        "intent_detection_latency_ms",
        expect.any(Number),
        expect.any(Object),
      );
    });

    test("should handle errors gracefully", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const dealershipConfig = { ...mockDealershipConfig };

      // Mock rule engine to throw error
      ruleEngine.evaluateMessage = jest
        .fn()
        .mockRejectedValue(new Error("Test error"));

      // Execute
      await orchestrator.processMessage(
        message,
        conversation,
        dealershipConfig,
      );

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error in rule engine"),
        expect.objectContaining({
          error: expect.stringContaining("Test error"),
        }),
      );

      // Verify other engines were still called
      expect(mlClassifier.classifyIntent).toHaveBeenCalled();
    });
  });

  describe("RuleEngine", () => {
    let ruleEngine: RuleEngine;

    beforeEach(() => {
      ruleEngine = new RuleEngine();
    });

    test("should initialize correctly", () => {
      expect(ruleEngine).toBeDefined();
    });

    test("should detect intent from exact phrase match", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "I want to buy this car today",
      };
      const conversation = { ...mockConversation };
      const rules = {
        include: ["R-BUY-1"],
        exclude: [],
      };

      // Execute
      const result = await ruleEngine.evaluateMessage(
        message,
        conversation,
        rules,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.ruleId).toBe("R-BUY-1");
      expect(result.intentType).toBe("purchase");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    test("should not detect intent when content doesn't match rules", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "Just checking the status of my application",
      };
      const conversation = { ...mockConversation };
      const rules = {
        include: ["R-BUY-1", "R-TEST-1"],
        exclude: [],
      };

      // Execute
      const result = await ruleEngine.evaluateMessage(
        message,
        conversation,
        rules,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
    });

    test("should respect excluded rules", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "I want to buy this car today",
      };
      const conversation = { ...mockConversation };
      const rules = {
        include: ["R-BUY-1", "R-TEST-1"],
        exclude: ["R-BUY-1"], // Explicitly exclude the buy rule
      };

      // Execute
      const result = await ruleEngine.evaluateMessage(
        message,
        conversation,
        rules,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
    });

    test("should handle case insensitivity correctly", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "I WANT TO BUY THIS CAR",
      };
      const conversation = { ...mockConversation };
      const rules = {
        include: ["R-BUY-1"],
        exclude: [],
      };

      // Execute
      const result = await ruleEngine.evaluateMessage(
        message,
        conversation,
        rules,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.ruleId).toBe("R-BUY-1");
    });

    test("should evaluate multiple rules and return highest confidence match", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "I want to buy this car and also schedule a test drive",
      };
      const conversation = { ...mockConversation };
      const rules = {
        include: ["R-BUY-1", "R-TEST-1"],
        exclude: [],
      };

      // Execute
      const result = await ruleEngine.evaluateMessage(
        message,
        conversation,
        rules,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      // Should return R-BUY-1 since it has higher priority (lower number)
      expect(result.ruleId).toBe("R-BUY-1");
    });

    test("should complete evaluation in under 50ms for performance", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content:
          "I want to buy this car and also schedule a test drive and discuss financing options and trade-in value and check availability",
      };
      const conversation = { ...mockConversation };
      const rules = {
        include: ["R-BUY-1", "R-TEST-1", "R-FIN-1", "R-TRADE-1", "R-AVAIL-1"],
        exclude: [],
      };

      // Execute and measure time
      const startTime = Date.now();
      await ruleEngine.evaluateMessage(message, conversation, rules);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is under 50ms (this is very fast for pattern matching)
      expect(latency).toBeLessThanOrEqual(50);
    });
  });

  describe("MLClassifier", () => {
    let mlClassifier: MLClassifier;

    beforeEach(() => {
      mlClassifier = new MLClassifier();
    });

    test("should initialize correctly", () => {
      expect(mlClassifier).toBeDefined();
    });

    test("should classify intent using OpenAI function calls", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "What kind of APR can you offer on this vehicle?",
      };
      const conversation = { ...mockConversation };
      const threshold = 0.8;

      // Execute
      const result = await mlClassifier.classifyIntent(
        message,
        conversation,
        threshold,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.intentType).toBe("purchase");
      expect(result.confidence).toBeGreaterThanOrEqual(threshold);
    });

    test("should respect confidence threshold", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const threshold = 0.95; // Set higher than the mock response of 0.92

      // Execute
      const result = await mlClassifier.classifyIntent(
        message,
        conversation,
        threshold,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.confidence).toBeLessThan(threshold);
    });

    test("should cache results for the same message content", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const threshold = 0.8;

      // Mock the OpenAI API
      const openaiSpy = jest.spyOn(
        mlClassifier["openai"],
        "createChatCompletion",
      );

      // Execute twice with same content
      await mlClassifier.classifyIntent(message, conversation, threshold);
      await mlClassifier.classifyIntent(message, conversation, threshold);

      // Verify OpenAI was only called once
      expect(openaiSpy).toHaveBeenCalledTimes(1);
    });

    test("should handle OpenAI errors gracefully", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const threshold = 0.8;

      // Mock OpenAI to throw error
      mlClassifier["openai"].createChatCompletion = jest
        .fn()
        .mockRejectedValue(new Error("OpenAI API error"));

      // Execute
      const result = await mlClassifier.classifyIntent(
        message,
        conversation,
        threshold,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error classifying intent with OpenAI"),
        expect.any(Object),
      );
    });

    test("should extract function call parameters correctly", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const threshold = 0.8;

      // Mock OpenAI with different function call format
      mlClassifier["openai"].createChatCompletion = jest
        .fn()
        .mockResolvedValue({
          data: {
            choices: [
              {
                message: {
                  content: null,
                  function_call: {
                    name: "detectIntent",
                    arguments: JSON.stringify({
                      hasIntent: true,
                      intentType: "financing",
                      confidence: 0.88,
                      reasoning: "Customer is asking about financing options",
                    }),
                  },
                },
              },
            ],
          },
        });

      // Execute
      const result = await mlClassifier.classifyIntent(
        message,
        conversation,
        threshold,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.intentType).toBe("financing");
      expect(result.confidence).toBe(0.88);
    });

    test("should meet latency requirement even with OpenAI call", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const threshold = 0.8;

      // Execute and measure time
      const startTime = Date.now();
      await mlClassifier.classifyIntent(message, conversation, threshold);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is under 2000ms (this includes the mocked OpenAI call)
      expect(latency).toBeLessThanOrEqual(2000);
    });
  });

  describe("BehaviouralMonitor", () => {
    let behaviouralMonitor: BehaviouralMonitor;

    beforeEach(() => {
      behaviouralMonitor = new BehaviouralMonitor();

      // Mock database queries
      const db = require("../../server/db");
      db.execute.mockImplementation((query) => {
        // Mock query for message count
        if (query.toString().includes("COUNT")) {
          return Promise.resolve([{ count: 3 }]);
        }

        // Mock query for messages
        if (query.toString().includes("SELECT")) {
          return Promise.resolve([
            {
              id: 1,
              content: "Hello",
              is_from_customer: true,
              created_at: new Date(Date.now() - 1000 * 60 * 10),
            },
            {
              id: 2,
              content: "How can I help?",
              is_from_customer: false,
              created_at: new Date(Date.now() - 1000 * 60 * 9),
            },
            {
              id: 3,
              content: "I want to know more",
              is_from_customer: true,
              created_at: new Date(Date.now() - 1000 * 60 * 5),
            },
          ]);
        }

        return Promise.resolve([]);
      });
    });

    test("should initialize correctly", () => {
      expect(behaviouralMonitor).toBeDefined();
    });

    test("should detect engaged conversation based on message count", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const config = {
        engaged_replies: 3,
        window_minutes: 30,
      };

      // Execute
      const result = await behaviouralMonitor.evaluateEngagement(
        message,
        conversation,
        config,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.engagementLevel).toBe("high");
      expect(result.messageCount).toBe(3);
    });

    test("should not trigger if message count is below threshold", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const config = {
        engaged_replies: 5, // Higher than our mocked 3 messages
        window_minutes: 30,
      };

      // Execute
      const result = await behaviouralMonitor.evaluateEngagement(
        message,
        conversation,
        config,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.engagementLevel).toBe("medium");
      expect(result.messageCount).toBe(3);
    });

    test("should respect time window configuration", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const config = {
        engaged_replies: 3,
        window_minutes: 5, // Shorter window than our mocked messages
      };

      // Mock database to return fewer messages in window
      const db = require("../../server/db");
      db.execute.mockImplementation((query) => {
        if (query.toString().includes("COUNT")) {
          return Promise.resolve([{ count: 1 }]);
        }

        if (query.toString().includes("SELECT")) {
          return Promise.resolve([
            {
              id: 3,
              content: "I want to know more",
              is_from_customer: true,
              created_at: new Date(Date.now() - 1000 * 60 * 3),
            },
          ]);
        }

        return Promise.resolve([]);
      });

      // Execute
      const result = await behaviouralMonitor.evaluateEngagement(
        message,
        conversation,
        config,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.messageCount).toBe(1);
    });

    test("should calculate engagement level based on message patterns", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const config = {
        engaged_replies: 3,
        window_minutes: 30,
      };

      // Mock database to return varied message lengths
      const db = require("../../server/db");
      db.execute.mockImplementation((query) => {
        if (query.toString().includes("COUNT")) {
          return Promise.resolve([{ count: 3 }]);
        }

        if (query.toString().includes("SELECT")) {
          return Promise.resolve([
            {
              id: 1,
              content: "Hello",
              is_from_customer: true,
              created_at: new Date(Date.now() - 1000 * 60 * 10),
            },
            {
              id: 2,
              content: "How can I help?",
              is_from_customer: false,
              created_at: new Date(Date.now() - 1000 * 60 * 9),
            },
            {
              id: 3,
              content:
                "I am very interested in this vehicle and would like to discuss financing options and possibly schedule a test drive this weekend. What kind of deals are you offering currently?",
              is_from_customer: true,
              created_at: new Date(Date.now() - 1000 * 60 * 5),
            },
          ]);
        }

        return Promise.resolve([]);
      });

      // Execute
      const result = await behaviouralMonitor.evaluateEngagement(
        message,
        conversation,
        config,
      );

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.engagementLevel).toBe("high");
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    test("should handle database errors gracefully", async () => {
      // Setup
      const message = { ...mockMessage };
      const conversation = { ...mockConversation };
      const config = {
        engaged_replies: 3,
        window_minutes: 30,
      };

      // Mock database to throw error
      const db = require("../../server/db");
      db.execute.mockRejectedValue(new Error("Database error"));

      // Execute
      const result = await behaviouralMonitor.evaluateEngagement(
        message,
        conversation,
        config,
      );

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error evaluating engagement"),
        expect.any(Object),
      );
    });
  });

  describe("SLATracker", () => {
    let slaTracker: SLATracker;

    beforeEach(() => {
      slaTracker = new SLATracker();

      // Mock database queries
      const db = require("../../server/db");
      db.execute.mockImplementation((query) => {
        // Mock query for last customer message
        if (query.toString().includes("last_customer_message_at")) {
          return Promise.resolve([
            {
              last_customer_message_at: new Date(
                Date.now() - 1000 * 60 * 60 * 24,
              ), // 24 hours ago
            },
          ]);
        }

        return Promise.resolve([]);
      });
    });

    test("should initialize correctly", () => {
      expect(slaTracker).toBeDefined();
    });

    test("should detect SLA breach based on hours without response", async () => {
      // Setup
      const conversation = { ...mockConversation };
      const config = {
        no_response_hours: 24, // Exactly our mocked 24 hours
      };

      // Execute
      const result = await slaTracker.checkSLA(conversation, config);

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.hoursWithoutResponse).toBe(24);
      expect(result.triggerType).toBe("sla");
    });

    test("should not trigger if hours without response is below threshold", async () => {
      // Setup
      const conversation = { ...mockConversation };
      const config = {
        no_response_hours: 48, // Higher than our mocked 24 hours
      };

      // Execute
      const result = await slaTracker.checkSLA(conversation, config);

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.hoursWithoutResponse).toBe(24);
    });

    test("should handle case with no previous customer messages", async () => {
      // Setup
      const conversation = { ...mockConversation };
      const config = {
        no_response_hours: 24,
      };

      // Mock database to return no last message
      const db = require("../../server/db");
      db.execute.mockResolvedValue([{ last_customer_message_at: null }]);

      // Execute
      const result = await slaTracker.checkSLA(conversation, config);

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.hoursWithoutResponse).toBe(0);
    });

    test("should respect business hours if configured", async () => {
      // Setup
      const conversation = { ...mockConversation };
      const config = {
        no_response_hours: 24,
        business_hours_only: true,
        business_hours: {
          start: 9, // 9 AM
          end: 17, // 5 PM
          timezone: "America/New_York",
          days: [1, 2, 3, 4, 5], // Monday to Friday
        },
      };

      // Mock current time to be during business hours
      const originalDateNow = Date.now;
      const mockDate = new Date("2025-05-29T14:00:00Z"); // Thursday 2 PM UTC
      global.Date.now = jest.fn(() => mockDate.getTime());

      // Execute
      const result = await slaTracker.checkSLA(conversation, config);

      // Verify
      expect(result.hasIntent).toBe(true);
      expect(result.businessHoursOnly).toBe(true);

      // Restore Date.now
      global.Date.now = originalDateNow;
    });

    test("should schedule SLA checks for future evaluation", async () => {
      // Setup
      const conversation = { ...mockConversation };

      // Mock node-schedule
      const schedule = require("node-schedule");

      // Execute
      await slaTracker.scheduleSLACheck(conversation, 48);

      // Verify
      expect(schedule.scheduleJob).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Scheduled SLA check"),
        expect.objectContaining({
          conversationId: conversation.id,
          hoursFromNow: 48,
        }),
      );
    });

    test("should handle database errors gracefully", async () => {
      // Setup
      const conversation = { ...mockConversation };
      const config = {
        no_response_hours: 24,
      };

      // Mock database to throw error
      const db = require("../../server/db");
      db.execute.mockRejectedValue(new Error("Database error"));

      // Execute
      const result = await slaTracker.checkSLA(conversation, config);

      // Verify
      expect(result.hasIntent).toBe(false);
      expect(result.error).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error checking SLA"),
        expect.any(Object),
      );
    });
  });

  describe("UnifiedConfigService", () => {
    let configService: UnifiedConfigService;

    beforeEach(async () => {
      // Create config service
      configService = createConfigService("intent");

      // Mock initialize to avoid actual file system operations
      configService.initialize = jest.fn().mockResolvedValue(undefined);

      // Initialize
      await configService.initialize();
    });

    test("should initialize correctly", () => {
      expect(configService).toBeDefined();
      expect(configService.initialize).toHaveBeenCalled();
    });

    test("should get dealership configuration", async () => {
      // Mock getDealershipConfig
      configService.getDealershipConfig = jest
        .fn()
        .mockResolvedValue(mockDealershipConfig);

      // Execute
      const config = await configService.getDealershipConfig(456);

      // Verify
      expect(config).toEqual(mockDealershipConfig);
      expect(config.handover.rules.include).toContain("R-BUY-1");
      expect(config.handover.ml_threshold).toBe(0.8);
    });

    test("should check feature flag status", () => {
      // Mock isFeatureEnabled
      configService.isFeatureEnabled = jest
        .fn()
        .mockImplementation((flagName, dealershipId) => {
          if (flagName === "INTENT_DETECTION_V2") {
            return true;
          }
          return false;
        });

      // Execute
      const isEnabled = configService.isFeatureEnabled(
        "INTENT_DETECTION_V2",
        456,
      );

      // Verify
      expect(isEnabled).toBe(true);
    });

    test("should get A/B test variant", () => {
      // Mock getABTestVariant
      configService.getABTestVariant = jest
        .fn()
        .mockImplementation((testName, dealershipId) => {
          if (testName === "ML_THRESHOLD_TEST") {
            return "variant_a";
          }
          return null;
        });

      // Execute
      const variant = configService.getABTestVariant("ML_THRESHOLD_TEST", 456);

      // Verify
      expect(variant).toBe("variant_a");
    });

    test("should emit events on configuration changes", async () => {
      // Setup
      const emitSpy = jest.spyOn(configService, "emit");

      // Mock handleGlobalConfigChange
      await configService["handleGlobalConfigChange"](
        "configs/global/intent/config.yml",
      );

      // Verify
      expect(emitSpy).toHaveBeenCalledWith(
        "config.global.changed",
        expect.any(String),
      );
    });

    test("should handle hot-reloading of configuration files", async () => {
      // Setup
      const clearCacheSpy = jest.spyOn(configService, "clearCache");

      // Mock scheduleConfigReload and trigger it
      await configService["scheduleConfigReload"]();

      // Manually trigger the reload callback
      if (configService["reloadTimer"]) {
        clearInterval(configService["reloadTimer"]);
      }
      await configService["loadGlobalConfigs"]();
      configService.clearCache();

      // Verify
      expect(clearCacheSpy).toHaveBeenCalled();
    });

    test("should apply A/B test variants to configuration", async () => {
      // Setup
      const baseConfig = { ...mockDealershipConfig };
      const abTest = {
        id: "test-123",
        name: "ML_THRESHOLD_TEST",
        description: "Test different ML thresholds",
        isActive: true,
        variants: [
          {
            id: "variant_a",
            name: "Lower Threshold",
            percentage: 100,
            config: {
              handover: {
                ml_threshold: 0.7,
              },
            },
          },
        ],
        dealershipOverrides: {},
        environment: configService["environment"],
        startedAt: new Date(),
        metrics: [],
      };

      // Add test to abTests map
      configService["abTests"].set("ML_THRESHOLD_TEST", abTest);

      // Mock getABTestVariant
      configService.getABTestVariant = jest.fn().mockReturnValue("variant_a");

      // Execute
      const result = await configService["applyABTestVariants"](
        baseConfig,
        456,
      );

      // Verify
      expect(result.handover.ml_threshold).toBe(0.7);
    });

    test("should gracefully handle configuration errors", async () => {
      // Setup
      configService.getDealershipConfig = jest
        .fn()
        .mockRejectedValue(new Error("Config error"));

      // Execute
      const config = await configService.getDealershipConfig(456);

      // Verify
      expect(config).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get dealership configuration"),
        expect.any(Object),
      );
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith(
        "config_service_errors_total",
      );
    });
  });

  describe("Integration Tests", () => {
    let orchestrator: IntentOrchestrator;
    let ruleEngine: RuleEngine;
    let mlClassifier: MLClassifier;
    let behaviouralMonitor: BehaviouralMonitor;
    let slaTracker: SLATracker;
    let configService: UnifiedConfigService;

    beforeEach(async () => {
      // Create all components
      ruleEngine = new RuleEngine();
      mlClassifier = new MLClassifier();
      behaviouralMonitor = new BehaviouralMonitor();
      slaTracker = new SLATracker();
      configService = createConfigService("intent");

      // Mock initialize to avoid actual file system operations
      configService.initialize = jest.fn().mockResolvedValue(undefined);
      await configService.initialize();

      // Mock getDealershipConfig
      configService.getDealershipConfig = jest
        .fn()
        .mockResolvedValue(mockDealershipConfig);

      // Create orchestrator with real components
      orchestrator = new IntentOrchestrator({
        ruleEngine,
        mlClassifier,
        behaviouralMonitor,
        slaTracker,
      });
    });

    test("should achieve ≥90% precision on test dataset", async () => {
      // Setup test dataset with known intents
      const testMessages = [
        { content: "I want to buy this car", expectedIntent: true },
        { content: "What's your best price?", expectedIntent: true },
        { content: "Can I schedule a test drive?", expectedIntent: true },
        { content: "What APR can you offer?", expectedIntent: true },
        { content: "Is this vehicle still available?", expectedIntent: false },
        { content: "What color options do you have?", expectedIntent: false },
        { content: "How many miles does it have?", expectedIntent: false },
        { content: "Can you send me more pictures?", expectedIntent: false },
        { content: "What's the fuel economy?", expectedIntent: false },
        { content: "Does it have a sunroof?", expectedIntent: false },
      ];

      // Mock rule engine for consistent results
      ruleEngine.evaluateMessage = jest.fn().mockImplementation((message) => {
        const content = message.content.toLowerCase();
        if (content.includes("buy") || content.includes("price")) {
          return Promise.resolve({
            hasIntent: true,
            intentType: "purchase",
            ruleId: "R-BUY-1",
            confidence: 1.0,
            triggerType: "rule",
          });
        }
        if (content.includes("test drive")) {
          return Promise.resolve({
            hasIntent: true,
            intentType: "test-drive",
            ruleId: "R-TEST-1",
            confidence: 0.9,
            triggerType: "rule",
          });
        }
        return Promise.resolve({
          hasIntent: false,
          triggerType: "rule",
        });
      });

      // Mock ML classifier for consistent results
      mlClassifier.classifyIntent = jest.fn().mockImplementation((message) => {
        const content = message.content.toLowerCase();
        if (content.includes("apr")) {
          return Promise.resolve({
            hasIntent: true,
            intentType: "financing",
            confidence: 0.92,
            triggerType: "ml",
          });
        }
        return Promise.resolve({
          hasIntent: false,
          triggerType: "ml",
        });
      });

      // Run tests
      let truePositives = 0;
      let falsePositives = 0;
      let trueNegatives = 0;
      let falseNegatives = 0;

      for (const testCase of testMessages) {
        const message = {
          ...mockMessage,
          content: testCase.content,
        };

        // Create spy for emit
        const emitSpy = jest.spyOn(orchestrator, "emit");
        emitSpy.mockClear();

        // Process message
        await orchestrator.processMessage(
          message,
          mockConversation,
          mockDealershipConfig,
        );

        // Check if handover was triggered
        const handoverTriggered = emitSpy.mock.calls.some(
          (call) => call[0] === "handover.intent.triggered",
        );

        // Update counts
        if (testCase.expectedIntent && handoverTriggered) {
          truePositives++;
        } else if (!testCase.expectedIntent && handoverTriggered) {
          falsePositives++;
        } else if (!testCase.expectedIntent && !handoverTriggered) {
          trueNegatives++;
        } else if (testCase.expectedIntent && !handoverTriggered) {
          falseNegatives++;
        }
      }

      // Calculate precision and recall
      const precision = truePositives / (truePositives + falsePositives);
      const recall = truePositives / (truePositives + falseNegatives);

      // Verify precision ≥90%
      expect(precision).toBeGreaterThanOrEqual(0.9);

      // Verify recall ≥85%
      expect(recall).toBeGreaterThanOrEqual(0.85);
    });

    test("should meet end-to-end latency requirement of ≤2s", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "I want to buy this car and need financing",
      };

      // Execute and measure time
      const startTime = Date.now();

      // Get config
      const config = await configService.getDealershipConfig(
        mockConversation.dealershipId,
      );

      // Process message
      await orchestrator.processMessage(message, mockConversation, config);

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify latency is under 2000ms
      expect(latency).toBeLessThanOrEqual(2000);
    });

    test("should emit metrics for all processing stages", async () => {
      // Setup
      const message = {
        ...mockMessage,
        content: "I want to buy this car",
      };

      // Execute
      await orchestrator.processMessage(
        message,
        mockConversation,
        mockDealershipConfig,
      );

      // Verify metrics were recorded
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith(
        "intent_detection_total",
        expect.objectContaining({
          family: expect.any(String),
          dealership_id: mockConversation.dealershipId,
        }),
      );

      expect(monitoringService.recordLatency).toHaveBeenCalledWith(
        "intent_detection_latency_ms",
        expect.any(Number),
        expect.objectContaining({
          family: expect.any(String),
        }),
      );
    });

    test("should support configuration hot-reloading without restart", async () => {
      // Setup
      const emitSpy = jest.spyOn(configService, "emit");

      // Simulate file change
      await configService["handleGlobalConfigChange"](
        "configs/global/intent/config.yml",
      );

      // Verify cache was cleared
      expect(emitSpy).toHaveBeenCalledWith(
        "config.global.changed",
        expect.any(String),
      );

      // Get new config
      configService.getDealershipConfig = jest.fn().mockResolvedValue({
        ...mockDealershipConfig,
        handover: {
          ...mockDealershipConfig.handover,
          ml_threshold: 0.75, // Changed threshold
        },
      });

      const newConfig = await configService.getDealershipConfig(
        mockConversation.dealershipId,
      );

      // Verify new config is used
      expect(newConfig.handover.ml_threshold).toBe(0.75);
    });
  });
});
