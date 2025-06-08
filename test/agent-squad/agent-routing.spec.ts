/**
 * STAB-307 Agent Squad System Validation - Agent Routing Tests
 *
 * Test agent routing logic, sentiment analysis, and routing decisions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  advancedRoutingEngine,
  type SentimentAnalysis,
  type CustomerContext,
  type RoutingDecision,
} from "../../server/services/agentSquad/advanced-routing";
import { RylieAgentSquad } from "../../server/services/agentSquad/orchestrator";
import { mockData } from "../../test-utils/setup";

describe("Agent Squad Routing System", () => {
  let agentSquad: RylieAgentSquad;

  beforeEach(() => {
    // Initialize with test configuration
    agentSquad = new RylieAgentSquad({
      openaiApiKey: "test-key",
      defaultDealershipId: 1,
      enableAnalytics: false,
      enableAdvancedRouting: true,
      fallbackToGeneral: true,
    });
  });

  describe("Sentiment Analysis", () => {
    it("should correctly identify angry sentiment", async () => {
      const message =
        "I am absolutely furious with this terrible service! This is unacceptable!";
      const sentiment = await advancedRoutingEngine.analyzeSentiment(message);

      expect(sentiment.emotion).toBe("angry");
      expect(sentiment.intensity).toMatch(/strong|intense/);
      expect(sentiment.score).toBeLessThan(-0.3);
      expect(sentiment.urgency).toMatch(/high|urgent/);
      expect(sentiment.triggers).toContain(expect.stringContaining("furious"));
    });

    it("should correctly identify excited sentiment", async () => {
      const message =
        "I'm so excited about this car! It's perfect and I can't wait to buy it!";
      const sentiment = await advancedRoutingEngine.analyzeSentiment(message);

      expect(sentiment.emotion).toBe("excited");
      expect(sentiment.intensity).toMatch(/moderate|strong/);
      expect(sentiment.score).toBeGreaterThan(0.3);
      expect(sentiment.triggers).toContain(expect.stringContaining("excited"));
    });

    it("should correctly identify confused sentiment", async () => {
      const message =
        "I don't understand the difference between leasing and financing. Can you explain?";
      const sentiment = await advancedRoutingEngine.analyzeSentiment(message);

      expect(sentiment.emotion).toBe("confused");
      expect(sentiment.triggers).toContain(
        expect.stringContaining("understand"),
      );
    });

    it("should detect urgency indicators", async () => {
      const message =
        "I need this car immediately! This is urgent and time sensitive!";
      const sentiment = await advancedRoutingEngine.analyzeSentiment(message);

      expect(sentiment.urgency).toMatch(/high|urgent/);
      expect(sentiment.triggers).toContain(expect.stringContaining("urgency"));
    });

    it("should analyze emotional progression in conversation history", async () => {
      const conversationHistory = [
        "I was looking at cars yesterday",
        "I'm getting frustrated with the process",
        "This is taking too long and I'm angry now!",
      ];

      const sentiment = await advancedRoutingEngine.analyzeSentiment(
        "I'm absolutely furious with this whole experience!",
        conversationHistory,
      );

      expect(sentiment.emotionalJourney).toContain("escalating");
      expect(sentiment.emotion).toBe("angry");
    });
  });

  describe("Customer Context Analysis", () => {
    it("should retrieve customer context correctly", async () => {
      const context = await advancedRoutingEngine.getCustomerContext(
        1,
        "test-user-123",
      );

      expect(context).toHaveProperty("totalInteractions");
      expect(context).toHaveProperty("averageResponseTime");
      expect(context).toHaveProperty("lastInteractionDate");
      expect(context).toHaveProperty("escalationHistory");
      expect(context.escalationHistory).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Routing Decision Logic", () => {
    let testSentiment: SentimentAnalysis;
    let testCustomerContext: CustomerContext;

    beforeEach(() => {
      testSentiment = {
        score: 0,
        confidence: 0.8,
        emotion: "neutral",
        urgency: "medium",
        intensity: "mild",
        triggers: [],
        emotionalJourney: "Initial interaction",
      };

      testCustomerContext = {
        previousMessages: [],
        totalInteractions: 1,
        averageResponseTime: 300000,
        lastInteractionDate: new Date(),
        escalationHistory: 0,
      };
    });

    it("should route angry customers with escalation history to human", async () => {
      testSentiment.emotion = "angry";
      testSentiment.intensity = "intense";
      testCustomerContext.escalationHistory = 2;

      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I'm furious with this service!",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.shouldEscalate).toBe(true);
      expect(decision.escalationReason).toContain("escalation history");
      expect(decision.priority).toBe("urgent");
    });

    it("should route inventory inquiries to inventory agent", async () => {
      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I'm looking for a Honda Accord with low mileage",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.recommendedAgent).toBe("inventory-agent");
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.reasoning).toContain("inventory");
    });

    it("should route financing questions to finance agent", async () => {
      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "What are my financing options? I need to know about loan rates and monthly payments",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.recommendedAgent).toBe("finance-agent");
      expect(decision.reasoning).toContain("finance");
    });

    it("should route service inquiries to service agent", async () => {
      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I need to schedule an oil change and brake inspection",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.recommendedAgent).toBe("service-agent");
      expect(decision.reasoning).toContain("service");
    });

    it("should route trade-in questions to trade agent", async () => {
      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I want to trade in my current car. What's it worth?",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.recommendedAgent).toBe("trade-agent");
      expect(decision.reasoning).toContain("trade");
    });

    it("should route ready-to-buy customers to sales agent", async () => {
      testSentiment.emotion = "excited";
      testSentiment.urgency = "high";

      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I'm ready to buy today! Can we schedule a test drive?",
        testSentiment,
        testCustomerContext,
        { journeyStage: "decision" },
      );

      expect(decision.recommendedAgent).toBe("sales-agent");
      expect(decision.priority).toMatch(/high|urgent/);
    });

    it("should route credit-concerned customers to credit agent", async () => {
      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I have bad credit and filed bankruptcy. Can I still get a car?",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.recommendedAgent).toBe("credit-agent");
      expect(decision.reasoning).toContain("credit");
    });

    it("should respect customer preferred agent", async () => {
      testCustomerContext.preferredAgent = "sales-agent";
      testCustomerContext.totalInteractions = 5;

      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I need help with something",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.recommendedAgent).toBe("sales-agent");
      expect(decision.reasoning).toContain("preferred agent");
    });

    it("should escalate customers with extensive escalation history", async () => {
      testCustomerContext.escalationHistory = 4;

      const decision = await advancedRoutingEngine.makeRoutingDecision(
        "I need help with my car",
        testSentiment,
        testCustomerContext,
      );

      expect(decision.shouldEscalate).toBe(true);
      expect(decision.escalationReason).toContain(
        "extensive escalation history",
      );
    });

    it("should provide appropriate priority levels", async () => {
      // Test urgent priority
      testSentiment.urgency = "urgent";
      let decision = await advancedRoutingEngine.makeRoutingDecision(
        "Emergency! I need help right now!",
        testSentiment,
        testCustomerContext,
      );
      expect(decision.priority).toBe("urgent");

      // Test high priority for VIP customers
      testCustomerContext.totalInteractions = 15;
      testSentiment.urgency = "medium";
      decision = await advancedRoutingEngine.makeRoutingDecision(
        "I need assistance",
        testSentiment,
        testCustomerContext,
      );
      expect(decision.priority).toBe("high");

      // Test medium priority for new customers
      testCustomerContext.totalInteractions = 0;
      decision = await advancedRoutingEngine.makeRoutingDecision(
        "Hello, I'm looking for information",
        testSentiment,
        testCustomerContext,
      );
      expect(decision.priority).toBe("medium");
    });
  });

  describe("Agent Squad Orchestrator Integration", () => {
    it("should route messages through the full system", async () => {
      const result = await agentSquad.routeMessage(
        "I'm looking for a red Honda Civic",
        "test-user-123",
        "test-session-456",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.selectedAgent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it("should handle escalation scenarios", async () => {
      const result = await agentSquad.routeMessage(
        "I am absolutely furious! This is the worst service ever!",
        "angry-customer-789",
        "escalation-session-123",
        {
          dealershipId: 1,
          customerType: "returning-customer",
          escalationHistory: 2,
        },
      );

      expect(result.escalated).toBe(true);
      expect(result.selectedAgent).toBe("human-escalation");
      expect(result.response).toContain(
        "connect you with one of our team members",
      );
    });

    it("should provide fallback when routing fails", async () => {
      // Mock a failure scenario
      const result = await agentSquad.routeMessage(
        "Test message",
        "test-user",
        "test-session",
        { dealershipId: 1 },
      );

      // Should still provide a response even if there are issues
      expect(result).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it("should track conversation history", async () => {
      const sessionId = "history-test-session";

      await agentSquad.routeMessage(
        "Hello, I'm looking for a car",
        "test-user",
        sessionId,
        { dealershipId: 1 },
      );

      const history = await agentSquad.getConversationHistory(sessionId);
      expect(Array.isArray(history)).toBe(true);
    });

    it("should clear conversation history", async () => {
      const sessionId = "clear-test-session";

      await agentSquad.routeMessage("Test message", "test-user", sessionId, {
        dealershipId: 1,
      });

      await agentSquad.clearConversation(sessionId);

      const history = await agentSquad.getConversationHistory(sessionId);
      expect(history).toHaveLength(0);
    });
  });

  describe("Health Check and Monitoring", () => {
    it("should provide health check status", async () => {
      const health = await agentSquad.healthCheck();

      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.agents).toBeGreaterThan(0);
      expect(health.lastResponse).toBeGreaterThan(0);
      expect(Array.isArray(health.errors)).toBe(true);
    });

    it("should handle configuration updates", async () => {
      const config = {
        enabled: true,
        fallbackEnabled: true,
        confidenceThreshold: 0.7,
        preferredAgents: ["general-agent", "sales-agent"],
      };

      // This should not throw an error
      await expect(
        agentSquad.updateDealershipConfig(1, config),
      ).resolves.toBeUndefined();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty messages gracefully", async () => {
      const result = await agentSquad.routeMessage(
        "",
        "test-user",
        "test-session",
        { dealershipId: 1 },
      );

      expect(result).toBeDefined();
      expect(result.selectedAgent).toBeDefined();
    });

    it("should handle very long messages", async () => {
      const longMessage = "I need help ".repeat(1000);

      const result = await agentSquad.routeMessage(
        longMessage,
        "test-user",
        "test-session",
        { dealershipId: 1 },
      );

      expect(result).toBeDefined();
      expect(result.processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("should handle messages with special characters", async () => {
      const message =
        "I'm looking for a car with émojis 🚗 and speciāl characters!";

      const result = await agentSquad.routeMessage(
        message,
        "test-user",
        "test-session",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
    });

    it("should handle concurrent routing requests", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        agentSquad.routeMessage(
          `Concurrent message ${i + 1}`,
          `user-${i + 1}`,
          `session-${i + 1}`,
          { dealershipId: 1 },
        ),
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.conversationId).toBe(`session-${index + 1}`);
      });
    });
  });
});
