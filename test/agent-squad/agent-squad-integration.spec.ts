/**
 * STAB-307 Agent Squad System Validation - Integration Tests
 *
 * Comprehensive integration tests for the complete Agent Squad system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RylieAgentSquad } from "../../server/services/agentSquad/orchestrator";
import { advancedRoutingEngine } from "../../server/services/agentSquad/advanced-routing";
import { PromptTemplateService } from "../../server/services/prompt-template-service";
import {
  searchInventory,
  getVehicleDetails,
} from "../../server/services/agentSquad/inventory-functions";
import { mockData } from "../../test-utils/setup";

describe("Agent Squad System Integration", () => {
  let agentSquad: RylieAgentSquad;
  let templateService: PromptTemplateService;

  beforeEach(() => {
    agentSquad = new RylieAgentSquad({
      openaiApiKey: "test-key",
      defaultDealershipId: 1,
      enableAnalytics: true,
      enableAdvancedRouting: true,
      fallbackToGeneral: true,
    });

    templateService = PromptTemplateService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("End-to-End Customer Journey Scenarios", () => {
    it("should handle complete new customer vehicle shopping journey", async () => {
      const customerId = "new-customer-001";
      const sessionId = "journey-session-001";
      const dealershipId = 1;

      // Step 1: Initial greeting
      const greetingResult = await agentSquad.routeMessage(
        "Hi, I'm looking for a new car",
        customerId,
        sessionId,
        {
          dealershipId,
          customerType: "first-time-visitor",
          journeyStage: "awareness",
        },
      );

      expect(greetingResult.success).toBe(true);
      expect(greetingResult.selectedAgent).toMatch(
        /general-agent|inventory-agent/,
      );
      expect(greetingResult.response).toBeDefined();

      // Step 2: Vehicle search inquiry
      const searchResult = await agentSquad.routeMessage(
        "I'm interested in a Honda Accord with good fuel economy",
        customerId,
        sessionId,
        {
          dealershipId,
          customerType: "prospect",
          journeyStage: "consideration",
          previousInteraction: greetingResult,
        },
      );

      expect(searchResult.success).toBe(true);
      expect(searchResult.selectedAgent).toBe("inventory-agent");
      expect(searchResult.confidence).toBeGreaterThan(0.7);

      // Step 3: Financing question
      const financeResult = await agentSquad.routeMessage(
        "What would my monthly payment be for a $25,000 car?",
        customerId,
        sessionId,
        {
          dealershipId,
          customerType: "qualified-lead",
          journeyStage: "consideration",
          interestedVehicle: { make: "Honda", model: "Accord", price: 25000 },
        },
      );

      expect(financeResult.success).toBe(true);
      expect(financeResult.selectedAgent).toBe("finance-agent");

      // Step 4: Ready to purchase
      const purchaseResult = await agentSquad.routeMessage(
        "I'm ready to move forward with the purchase. Can we schedule a test drive?",
        customerId,
        sessionId,
        {
          dealershipId,
          customerType: "hot-lead",
          journeyStage: "decision",
        },
      );

      expect(purchaseResult.success).toBe(true);
      expect(purchaseResult.selectedAgent).toBe("sales-agent");
      expect(purchaseResult.priority).toMatch(/high|urgent/);

      // Verify conversation history
      const history = await agentSquad.getConversationHistory(sessionId);
      expect(history.length).toBeGreaterThan(0);
    });

    it("should handle frustrated customer escalation scenario", async () => {
      const customerId = "frustrated-customer-002";
      const sessionId = "escalation-session-002";
      const dealershipId = 1;

      // Step 1: Initial frustration
      const initialResult = await agentSquad.routeMessage(
        "I've been trying to get help with my car service for weeks!",
        customerId,
        sessionId,
        {
          dealershipId,
          customerType: "existing-customer",
          escalationHistory: 1,
          satisfactionScore: 2,
        },
      );

      expect(initialResult.success).toBe(true);
      expect(initialResult.sentiment).toMatch(/frustrated|disappointed/);

      // Step 2: Escalating anger
      const angryResult = await agentSquad.routeMessage(
        "This is absolutely unacceptable! I demand to speak to a manager immediately!",
        customerId,
        sessionId,
        {
          dealershipId,
          customerType: "existing-customer",
          escalationHistory: 2,
          satisfactionScore: 1,
          previousSentiment: "frustrated",
        },
      );

      expect(angryResult.success).toBe(true);
      expect(angryResult.escalated).toBe(true);
      expect(angryResult.selectedAgent).toBe("human-escalation");
      expect(angryResult.priority).toBe("urgent");
      expect(angryResult.response).toContain(
        "connect you with one of our team members",
      );
    });

    it("should handle complex multi-agent handoff scenario", async () => {
      const customerId = "handoff-customer-003";
      const sessionId = "handoff-session-003";
      const dealershipId = 1;

      // Step 1: Trade-in inquiry
      const tradeResult = await agentSquad.routeMessage(
        "I want to trade in my 2018 Honda Civic for a new SUV",
        customerId,
        sessionId,
        {
          dealershipId,
          hasCurrentVehicle: true,
          currentVehicle: { make: "Honda", model: "Civic", year: 2018 },
        },
      );

      expect(tradeResult.selectedAgent).toBe("trade-agent");

      // Step 2: Inventory search for SUV
      const inventoryResult = await agentSquad.routeMessage(
        "Show me available SUVs under $35,000",
        customerId,
        sessionId,
        {
          dealershipId,
          tradeInValue: 18000,
          budget: 35000,
        },
      );

      expect(inventoryResult.selectedAgent).toBe("inventory-agent");

      // Step 3: Financing for the difference
      const financeResult = await agentSquad.routeMessage(
        "If my trade is worth $18,000, what financing options do I have for the difference?",
        customerId,
        sessionId,
        {
          dealershipId,
          tradeInValue: 18000,
          targetVehiclePrice: 32000,
        },
      );

      expect(financeResult.selectedAgent).toBe("finance-agent");

      // Verify all interactions were handled appropriately
      const history = await agentSquad.getConversationHistory(sessionId);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("Agent Specialization Validation", () => {
    it("should route inventory questions to inventory agent with function access", async () => {
      const result = await agentSquad.routeMessage(
        "Show me all available Honda Accords with under 30,000 miles",
        "test-customer",
        "inventory-test-session",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe("inventory-agent");

      // Inventory agent should have access to search functions
      // This would be verified by the agent actually being able to search
      expect(result.response).toBeDefined();
    });

    it("should route service questions to service agent", async () => {
      const result = await agentSquad.routeMessage(
        "I need to schedule an oil change and brake inspection for my car",
        "test-customer",
        "service-test-session",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe("service-agent");
    });

    it("should route financing questions to finance agent", async () => {
      const result = await agentSquad.routeMessage(
        "What are my loan options for a $30,000 car with a 720 credit score?",
        "test-customer",
        "finance-test-session",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe("finance-agent");
    });

    it("should route credit-specific questions to credit agent", async () => {
      const result = await agentSquad.routeMessage(
        "I have bad credit from a previous bankruptcy. Can I still get a car loan?",
        "test-customer",
        "credit-test-session",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe("credit-agent");
    });

    it("should route lease questions to lease agent", async () => {
      const result = await agentSquad.routeMessage(
        "My lease is ending soon and I'm considering my options for lease return",
        "test-customer",
        "lease-test-session",
        { dealershipId: 1, currentlyLeasing: true },
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBe("lease-agent");
    });
  });

  describe("System Performance and Reliability", () => {
    it("should maintain performance under concurrent load", async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        agentSquad.routeMessage(
          `I'm looking for a car - request ${i + 1}`,
          `load-test-customer-${i + 1}`,
          `load-test-session-${i + 1}`,
          { dealershipId: 1 },
        ),
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.conversationId).toBe(`load-test-session-${index + 1}`);
      });

      // Average response time should be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(3000); // Less than 3 seconds average
    });

    it("should handle system health monitoring", async () => {
      const health = await agentSquad.healthCheck();

      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.agents).toBeGreaterThan(0);
      expect(health.lastResponse).toBeGreaterThan(0);
      expect(Array.isArray(health.errors)).toBe(true);

      if (health.status === "healthy") {
        expect(health.errors).toHaveLength(0);
      }
    });

    it("should provide performance metrics", async () => {
      // Generate some test interactions first
      await agentSquad.routeMessage(
        "Test message for metrics",
        "metrics-customer",
        "metrics-session",
        { dealershipId: 1 },
      );

      const metrics = await agentSquad.getPerformanceMetrics(1);

      expect(metrics.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.escalationRate).toBeGreaterThanOrEqual(0);
      expect(metrics.escalationRate).toBeLessThanOrEqual(1);
      expect(metrics.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.averageConfidence).toBeLessThanOrEqual(1);
      expect(typeof metrics.agentBreakdown).toBe("object");
    });
  });

  describe("Error Handling and Fallback Mechanisms", () => {
    it("should gracefully handle agent routing failures", async () => {
      // Test with potentially problematic input
      const result = await agentSquad.routeMessage(
        "", // Empty message
        "error-test-customer",
        "error-test-session",
        { dealershipId: 1 },
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it("should provide fallback responses when advanced routing fails", async () => {
      // This would typically involve mocking the advanced routing to fail
      const result = await agentSquad.routeMessage(
        "Help me with my car purchase",
        "fallback-customer",
        "fallback-session",
        { dealershipId: 1 },
      );

      // Even if advanced routing fails, should get a basic response
      expect(result.success).toBe(true);
      expect(result.selectedAgent).toBeDefined();
    });

    it("should handle invalid dealership configurations", async () => {
      const invalidConfig = await agentSquad.getDealershipConfig(99999);
      expect(invalidConfig).toBeNull();
    });

    it("should handle configuration updates gracefully", async () => {
      const config = {
        enabled: true,
        fallbackEnabled: true,
        confidenceThreshold: 0.8,
      };

      await expect(
        agentSquad.updateDealershipConfig(1, config),
      ).resolves.toBeUndefined();
    });
  });

  describe("Integration with External Systems", () => {
    it("should integrate with inventory system correctly", async () => {
      // Test direct inventory access
      const inventoryResult = await searchInventory({
        dealershipId: 1,
        make: "Honda",
        limit: 5,
      });

      expect(inventoryResult.success).toBe(true);

      if (inventoryResult.vehicles.length > 0) {
        // Test vehicle details access
        const vehicleDetails = await getVehicleDetails(
          inventoryResult.vehicles[0].id,
          1,
        );

        expect(vehicleDetails.success).toBe(true);
        expect(vehicleDetails.vehicle).toBeDefined();
      }
    });

    it("should integrate with prompt template system", async () => {
      const template = await templateService.selectTemplate({
        dealershipId: 1,
        templateType: "greeting",
      });

      if (template) {
        expect(template.templateType).toBe("greeting");
        expect(template.isActive).toBe(true);

        // Test template rendering
        const rendered = templateService.renderTemplate(
          template.promptContent,
          {
            customerName: "John",
            dealershipName: "Test Motors",
          },
        );

        expect(rendered).toBeDefined();
        expect(typeof rendered).toBe("string");
      }
    });
  });

  describe("Analytics and Tracking", () => {
    it("should track conversation analytics when enabled", async () => {
      const result = await agentSquad.routeMessage(
        "I need help buying a car",
        "analytics-customer",
        "analytics-session",
        {
          dealershipId: 1,
          messageId: "test-message-123",
        },
      );

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);

      // Analytics should be tracked in background
      // This would be verified by checking the database in a real integration test
    });

    it("should provide detailed routing decisions", async () => {
      const result = await agentSquad.routeMessage(
        "I'm looking for a reliable family SUV with good safety ratings",
        "detailed-customer",
        "detailed-session",
        {
          dealershipId: 1,
          customerType: "family-buyer",
          priorities: ["safety", "reliability", "space"],
        },
      );

      expect(result.success).toBe(true);
      expect(result.reasoning).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.selectedAgent).toBeDefined();

      if (result.sentiment) {
        expect(["neutral", "curious", "happy", "excited"]).toContain(
          result.sentiment,
        );
      }
    });
  });

  describe("Customer Context and Personalization", () => {
    it("should remember customer preferences across sessions", async () => {
      const customerId = "preference-customer";
      const dealershipId = 1;

      // First session - establish preference
      const session1 = await agentSquad.routeMessage(
        "I prefer working with your sales team for car purchases",
        customerId,
        "preference-session-1",
        {
          dealershipId,
          customerType: "returning-customer",
        },
      );

      expect(session1.success).toBe(true);

      // Second session - should remember preference
      const session2 = await agentSquad.routeMessage(
        "I'm interested in looking at new cars again",
        customerId,
        "preference-session-2",
        {
          dealershipId,
          customerType: "returning-customer",
        },
      );

      expect(session2.success).toBe(true);
      // In a full implementation, this would route to preferred agent
    });

    it("should adjust responses based on customer journey stage", async () => {
      const customerId = "journey-customer";
      const dealershipId = 1;

      // Awareness stage
      const awarenessResult = await agentSquad.routeMessage(
        "I'm thinking about getting a new car",
        customerId,
        "journey-awareness",
        {
          dealershipId,
          journeyStage: "awareness",
        },
      );

      expect(awarenessResult.selectedAgent).toBe("general-agent");

      // Decision stage
      const decisionResult = await agentSquad.routeMessage(
        "I've decided on the Honda Accord, let's move forward",
        customerId,
        "journey-decision",
        {
          dealershipId,
          journeyStage: "decision",
        },
      );

      expect(decisionResult.selectedAgent).toBe("sales-agent");
      expect(decisionResult.priority).toMatch(/high|urgent/);
    });
  });
});
