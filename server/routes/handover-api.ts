/**
 * Handover API Routes
 * External API access to handover intelligence capabilities
 */

import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { apiAuth } from "../middleware/api-auth";
import { generateHandoverDossier } from "../services/openai";
import logger from "../utils/logger";

const router = Router();

/**
 * Generate handover dossier and analysis
 * @route POST /api/v1/handover/analyze
 */
router.post(
  "/analyze",
  apiAuth("handover:analyze"),
  [
    body("customer").isObject().withMessage("Customer information is required"),
    body("conversation_history")
      .isArray()
      .withMessage("Conversation history must be an array"),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "validation_error",
          details: errors.array(),
        });
      }

      const { customer, conversation_history, trigger_reason } = req.body;

      // Format conversation history for dossier generation
      const formattedConversation = conversation_history
        .map(
          (msg: any) =>
            `${msg.role === "customer" ? "Customer" : "Agent"}: ${msg.message}`,
        )
        .join("\n\n");

      // Format customer scenario
      const customerScenario = `
        Customer Name: ${customer.name || "Unknown"}
        Customer Email: ${customer.email || "Not provided"}
        Customer Phone: ${customer.phone || "Not provided"}
        Trigger Reason: ${trigger_reason || "Not specified"}
        
        Conversation History:
        ${formattedConversation}
      `;

      // Generate handover dossier with timeout protection
      let dossier;
      try {
        const dossierPromise = generateHandoverDossier(
          formattedConversation,
          customerScenario,
        );
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Dossier generation timed out")),
            10000,
          );
        });

        dossier = (await Promise.race([dossierPromise, timeoutPromise])) as any;
      } catch (error) {
        // Fallback dossier on error
        dossier = {
          conversationSummary: "Error generating detailed analysis",
          vehicleInterests: [],
          customerInsights: [],
          suggestedApproach: "Recommend contacting sales team for assistance",
          urgency: "medium",
        };
      }

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Determine urgency based on dossier or default to medium
      const urgency = dossier.urgency || "medium";

      // Determine if handover is recommended based on urgency and other factors
      const handoverRecommended =
        urgency === "high" ||
        dossier.customerInsights?.some(
          (insight: any) =>
            insight.key === "Purchase Intent" && insight.confidence > 0.7,
        ) ||
        trigger_reason === "high_intent_detected";

      logger.info("Handover analysis generated", {
        clientId: req.apiClient?.clientId,
        urgency,
        handoverRecommended,
        responseTime,
      });

      // Return structured response
      return res.json({
        handover_recommended: handoverRecommended,
        urgency,
        dossier: {
          customer_summary:
            dossier.conversationSummary || "No summary available",
          vehicle_interests: dossier.vehicleInterests || [],
          key_insights: dossier.customerInsights || [],
          suggested_approach:
            dossier.suggestedApproach || "No approach suggested",
          next_steps: [
            "Contact customer promptly",
            "Follow up within 24 hours",
          ],
          escalation_reason:
            dossier.escalationReason || trigger_reason || "Not specified",
        },
        response_time_ms: responseTime,
      });
    } catch (error) {
      logger.error("Error generating handover analysis", { error });

      // Return fallback response on error
      return res.status(500).json({
        error: "generation_failed",
        message: "Failed to generate handover analysis",
        details: error instanceof Error ? error.message : String(error),
        fallback: {
          handover_recommended: true,
          urgency: "medium",
          dossier: {
            customer_summary: "Error generating detailed analysis",
            vehicle_interests: [],
            key_insights: [],
            suggested_approach:
              "Recommend contacting sales team for assistance",
            next_steps: [
              "Contact customer promptly",
              "Apologize for any inconvenience",
            ],
            escalation_reason: "Analysis error - manual review needed",
          },
        },
      });
    }
  },
);

export default router;
