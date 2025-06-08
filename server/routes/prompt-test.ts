import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { OpenAI } from "openai";
import logger from "../utils/logger";

const router = Router();

// Handover schema for test purposes
const testHandoverSchema = z.object({
  conversationId: z.number().optional(),
  reason: z.string().optional(),
});

/**
 * Test endpoint for system-prompt handover
 * This doesn't require authentication and creates a mock handover dossier
 */
router.post("/system-handover", async (req: Request, res: Response) => {
  try {
    const { conversationId, reason } = testHandoverSchema.parse(req.body);

    // Create a test handover dossier
    const dossier = {
      id: Math.floor(Math.random() * 10000),
      customerName: "Test Customer",
      conversationSummary:
        "This is a test handover from the system prompt testing interface",
      urgency: "medium",
      customerInsights: [
        { key: "Budget", value: "Around $30,000", confidence: 0.85 },
        {
          key: "Timeline",
          value: "Looking to purchase within 2 weeks",
          confidence: 0.9,
        },
      ],
      vehicleInterests: [
        {
          make: "Honda",
          model: "Accord",
          year: 2023,
          trim: "Sport",
          confidence: 0.8,
        },
      ],
      escalationReason: reason || "Customer requested human assistance",
    };

    return res.json({
      success: true,
      dossier: dossier,
      message: "Handover dossier created successfully",
    });
  } catch (error) {
    logger.error("Error in system prompt test handover", { error });
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: error.errors });
    }
    return res
      .status(500)
      .json({ message: "Server error processing test handover" });
  }
});

// Initialize OpenAI with graceful fallback
let openai: OpenAI | null = null;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (
    apiKey &&
    !apiKey.startsWith("sk-dummy") &&
    !apiKey.includes("placeholder")
  ) {
    openai = new OpenAI({ apiKey });
  } else {
    console.warn(
      "OpenAI API key not configured - prompt test will be disabled",
    );
  }
} catch (error) {
  console.error("Failed to initialize OpenAI in prompt-test:", error);
  openai = null;
}

// Define validation schemas
const testPromptSchema = z.object({
  customerMessage: z.string(),
  variantId: z.number().optional(),
  systemPrompt: z.string().optional(),
  channel: z.enum(["sms", "email", "web"]),
  customerInfo: z.object({
    name: z.string(),
    conversationId: z.number().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  dealershipContext: z.object({
    dealershipId: z.number(),
    dealershipName: z.string(),
    brandTypes: z.string(),
    dealershipLocation: z.string(),
    businessHours: z.string(),
  }),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["customer", "assistant"]),
        content: z.string(),
        timestamp: z.date().optional(),
      }),
    )
    .optional(),
  relevantVehicles: z.array(z.any()).optional(),
  formatOptions: z
    .object({
      enableJsonResponse: z.boolean().default(true),
      includeVehicleRecommendations: z.boolean().default(true),
      considerHandover: z.boolean().default(true),
      generateHandoverDossier: z.boolean().default(false),
      detectCustomerInsights: z.boolean().default(true),
    })
    .optional(),
});

/**
 * Test a prompt variant or custom prompt
 */
router.post("/test", async (req: Request, res: Response) => {
  try {
    if (!openai) {
      logger.error("OpenAI not initialized for prompt testing");
      return res.status(503).json({
        error: "Service unavailable",
        message:
          "OpenAI API key is not configured. Please contact the administrator.",
      });
    }

    const validatedData = testPromptSchema.parse(req.body);
    const startTime = Date.now();

    // Build the messages array for the API request
    let promptContent: string;

    // If variant ID is provided, get the variant content from the database
    if (validatedData.variantId) {
      const variant = await storage.getPromptVariant(validatedData.variantId);
      if (!variant) {
        return res.status(404).json({ error: "Prompt variant not found" });
      }
      promptContent = variant.promptTemplate;
    } else if (validatedData.systemPrompt) {
      // Use the provided custom prompt
      promptContent = validatedData.systemPrompt;
    } else {
      return res
        .status(400)
        .json({ error: "Either variantId or systemPrompt must be provided" });
    }

    // Replace placeholders in the prompt content
    promptContent = promptContent
      .replace("[ARG-Agent Name]", "Rylie")
      .replace(
        "[ARG-Employer Name]",
        validatedData.dealershipContext.dealershipName,
      )
      .replace(
        "[ARG-Information About Employer]",
        validatedData.dealershipContext.brandTypes,
      )
      .replace(
        "[ARG-Employer Contact Details]",
        validatedData.dealershipContext.dealershipLocation,
      );

    // Format vehicle inventory if provided
    if (
      validatedData.relevantVehicles &&
      validatedData.relevantVehicles.length > 0
    ) {
      const inventoryText = validatedData.relevantVehicles
        .map(
          (vehicle) =>
            `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} - ${vehicle.condition}, ${vehicle.exteriorColor}, ${vehicle.mileage} miles, $${vehicle.price}\n` +
            `Features: ${vehicle.features.join(", ")}\n` +
            `Description: ${vehicle.description}`,
        )
        .join("\n\n");
      promptContent = promptContent.replace(
        "[INPUT-Product Inventory]",
        inventoryText,
      );
    } else {
      promptContent = promptContent.replace(
        "[INPUT-Product Inventory]",
        "No specific inventory data available",
      );
    }

    // Add customer name
    promptContent = promptContent.replace(
      "[INPUT-CUSTOMER NAME]",
      validatedData.customerInfo.name,
    );

    // Format conversation history if provided
    if (
      validatedData.conversationHistory &&
      validatedData.conversationHistory.length > 0
    ) {
      const historyText = validatedData.conversationHistory
        .map(
          (msg) =>
            `${msg.role === "customer" ? "Customer" : "Agent"}: ${msg.content}`,
        )
        .join("\n");
      promptContent = promptContent.replace(
        "[INPUT-CONVERSATION]",
        historyText,
      );
    } else {
      promptContent = promptContent.replace(
        "[INPUT-CONVERSATION]",
        "No prior conversation history",
      );
    }

    // Prepare the messages for OpenAI
    const messages = [
      {
        role: "system",
        content: promptContent,
      },
      {
        role: "user",
        content: validatedData.customerMessage,
      },
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const responseTime = Date.now() - startTime;
    const response = completion.choices[0].message.content || "";

    // Extract JSON if present
    let responseJson: any = null;
    try {
      // Look for JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseJson = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.warn("Failed to parse JSON from response", { error });
    }

    // Generate mock customer insights
    const customerInsights = validatedData.formatOptions?.detectCustomerInsights
      ? [
          { key: "Budget", value: "$25,000-$35,000", confidence: 0.85 },
          {
            key: "Preferred Features",
            value: "Safety, Fuel Efficiency",
            confidence: 0.92,
          },
          { key: "Timeline", value: "Within 2 weeks", confidence: 0.75 },
          { key: "Vehicle Type", value: "SUV", confidence: 0.88 },
        ]
      : [];

    // Determine if handover is recommended
    const handoverKeywords = [
      "speak to representative",
      "talk to someone",
      "agent",
      "call me",
      "contact me",
    ];
    const lowercaseResponse = response.toLowerCase();
    const handoverRecommended = handoverKeywords.some((keyword) =>
      lowercaseResponse.includes(keyword),
    );

    // Generate a handover dossier if requested
    const handoverDossier =
      handoverRecommended &&
      validatedData.formatOptions?.generateHandoverDossier
        ? {
            customerName: validatedData.customerInfo.name,
            contactInfo: {
              phone: validatedData.customerInfo.phone || "Not provided",
              email: validatedData.customerInfo.email || "Not provided",
            },
            interestLevel: "High",
            vehicleInterests: validatedData.relevantVehicles?.[0]
              ? [
                  {
                    make: validatedData.relevantVehicles[0].make,
                    model: validatedData.relevantVehicles[0].model,
                    year: validatedData.relevantVehicles[0].year,
                    confidence: 0.9,
                  },
                ]
              : [],
            customerInsights,
            conversationSummary:
              "Customer is interested in a family-friendly SUV with good safety features and fuel economy. They're planning to purchase within the next two weeks and have a budget around $30,000.",
            recommendedActions: [
              "Follow up with a call to discuss financing options",
              "Highlight the safety features of the Honda CR-V",
              "Mention the current financing promotion",
            ],
            conversationHistory: validatedData.conversationHistory || [],
          }
        : null;

    // Response suggestions based on customer inquiry
    const responseSuggestions = [
      {
        text: "Would you like to schedule a test drive for this weekend? I can set that up for you right now.",
        context: "Customer showed high interest in the vehicle",
        category: "appointment",
        priority: 5,
      },
      {
        text: "Our certified pre-owned vehicles come with an extended warranty. Would that give you more peace of mind?",
        context: "Customer expressed concern about reliability",
        category: "objection_handling",
        priority: 4,
      },
      {
        text: "I noticed you mentioned having two kids - the back seat has LATCH connectors for car seats and plenty of room for family trips.",
        context: "Customer mentioned family needs",
        category: "product_info",
        priority: 3,
      },
    ];

    // Track this interaction in the metrics if it's a variant test
    if (validatedData.variantId) {
      try {
        await storage.createPromptMetric({
          variantId: validatedData.variantId,
          conversationId: validatedData.customerInfo.conversationId,
          prompt: validatedData.customerMessage,
          response,
          responseTime,
          channel: validatedData.channel,
          timestamp: new Date(),
          handoverRecommended,
          metadata: { customerInsights },
        });
      } catch (error) {
        logger.error("Failed to store prompt metrics", { error });
        // Don't fail the request if metrics storage fails
      }
    }

    return res.json({
      response,
      responseJson,
      responseTime,
      customerInsights,
      handoverRecommended,
      handoverDossier,
      responseSuggestions,
      variantId: validatedData.variantId,
    });
  } catch (error) {
    logger.error("Error testing prompt", { error });
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid request data", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to test prompt" });
  }
});

/**
 * Generate a handover dossier
 */
router.post("/handover", async (req: Request, res: Response) => {
  try {
    const validatedData = testPromptSchema.parse(req.body);

    // Generate a comprehensive handover dossier
    const handoverDossier = {
      customerName: validatedData.customerInfo.name,
      contactInfo: {
        phone: validatedData.customerInfo.phone || "Not provided",
        email: validatedData.customerInfo.email || "Not provided",
      },
      interestLevel: "High",
      vehicleInterests:
        validatedData.relevantVehicles?.slice(0, 2).map((vehicle) => ({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          trim: vehicle.trim,
          price: vehicle.price,
          confidence: 0.9,
        })) || [],
      customerInsights: [
        { key: "Budget", value: "$25,000-$35,000", confidence: 0.85 },
        {
          key: "Preferred Features",
          value: "Safety, Fuel Efficiency",
          confidence: 0.92,
        },
        { key: "Timeline", value: "Within 2 weeks", confidence: 0.75 },
        { key: "Vehicle Type", value: "SUV", confidence: 0.88 },
      ],
      conversationSummary:
        "Customer is interested in a family-friendly SUV with good safety features and fuel economy. They're planning to purchase within the next two weeks and have a budget around $30,000.",
      recommendedActions: [
        "Follow up with a call to discuss financing options",
        "Highlight the safety features of the Honda CR-V",
        "Mention the current financing promotion",
      ],
      conversationHistory: validatedData.conversationHistory || [],
      salesReadiness: "high",
      objections: [
        {
          topic: "Price",
          description:
            "Customer has mentioned concern about the starting price",
          resolution:
            "Highlight the value features and available financing options",
        },
      ],
      nextSteps: {
        recommendedAction: "Schedule a test drive",
        priority: "High",
        timeline: "Within 48 hours",
      },
    };

    return res.json({
      handoverDossier,
    });
  } catch (error) {
    logger.error("Error generating handover dossier", { error });
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid request data", details: error.errors });
    }
    return res
      .status(500)
      .json({ error: "Failed to generate handover dossier" });
  }
});

export default router;
