import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import db from "../db";
import { vehicles, type Vehicle } from "../../shared/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import logger from "../utils/logger";
import { AI_CONFIG } from "../config/constants";

// Initialize OpenAI with the API key from environment variables
let openai: OpenAI | null = null;

try {
  const apiKey = AI_CONFIG.OPENAI_API_KEY;
  if (
    !apiKey ||
    apiKey.trim() === "" ||
    apiKey.startsWith("sk-dummy") ||
    apiKey.includes("placeholder")
  ) {
    console.warn(
      "OpenAI API key not configured - AI features will be disabled",
    );
    openai = null;
  } else {
    openai = new OpenAI({ 
      apiKey,
      timeout: 30000, // 30 second timeout
      maxRetries: 2, // OpenAI client internal retries
    });
    console.log("OpenAI API configured successfully");
  }
} catch (error) {
  console.error("Failed to initialize OpenAI:", error);
  openai = null;
}

// Enhanced AI response with inventory integration and error resilience
export async function generateAIResponse(
  prompt: string,
  customerScenario?: string,
  dealershipId?: number,
  conversationHistory?: Array<{ role: string; content: string }>,
): Promise<string> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  // Check if OpenAI is available
  if (!openai) {
    logger.warn("OpenAI not configured, returning fallback response");
    return getFallbackResponse(new Error("OpenAI not configured"));
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`OpenAI request attempt ${attempt}`, {
        dealershipId,
        hasHistory: !!conversationHistory?.length,
      });

      // Construct the message to send to OpenAI
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: prompt,
        },
      ];

      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        // Add last few exchanges for context (limit to avoid token overflow)
        const recentHistory = conversationHistory.slice(-6); // Last 6 messages
        recentHistory.forEach((msg) => {
          messages.push({
            role: msg.role as any,
            content: msg.content,
          });
        });
      }

      // Add customer message if provided
      if (customerScenario) {
        // Check for inventory-related keywords in customer message
        let inventoryContext = "";
        if (dealershipId && containsInventoryKeywords(customerScenario)) {
          const inventoryResults = await searchInventoryForContext(
            dealershipId,
            customerScenario,
          );
          if (inventoryResults.length > 0) {
            inventoryContext = formatInventoryContext(inventoryResults);
          }
        }

        // Combine customer message with inventory context
        const enhancedMessage = inventoryContext
          ? `${customerScenario}\n\n${inventoryContext}`
          : customerScenario;

        messages.push({
          role: "user",
          content: enhancedMessage,
        });
      } else {
        // Default customer message if none provided
        messages.push({
          role: "user",
          content:
            "Hello, I'm interested in learning more about your vehicles.",
        });
      }

      // Use configured AI model and settings
      const response = await openai.chat.completions.create({
        model: AI_CONFIG.DEFAULT_MODEL,
        messages: messages,
        temperature: AI_CONFIG.TEMPERATURE,
        max_tokens: AI_CONFIG.MAX_TOKENS,
        response_format: { type: "json_object" },
      });

      // Parse the JSON response
      const responseContent = response.choices[0].message.content || "{}";

      try {
        const jsonResponse = JSON.parse(responseContent);
        // Extract the answer field from the JSON response if it exists
        if (jsonResponse.answer) {
          logger.info("OpenAI response generated successfully", {
            attempt,
            dealershipId,
            responseLength: jsonResponse.answer.length,
          });
          return jsonResponse.answer;
        } else {
          // If no answer field, just return the full content
          logger.info("OpenAI response generated (raw content)", {
            attempt,
            dealershipId,
            responseLength: responseContent.length,
          });
          return responseContent;
        }
      } catch (parseError) {
        // If not valid JSON, return the raw content
        logger.warn("OpenAI response not valid JSON, returning raw content", {
          attempt,
          parseError:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
        return responseContent;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn(`OpenAI request attempt ${attempt} failed`, {
        error: lastError.message,
        attempt,
        maxRetries,
        dealershipId,
      });

      // Check if it's a rate limit error or temporary issue
      const isRetryableError = isRetryable(lastError);

      if (attempt < maxRetries && isRetryableError) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        logger.info(`Retrying OpenAI request in ${delayMs}ms`, {
          attempt,
          delayMs,
        });
        await new Promise<void>((resolve: () => void) =>
          setTimeout(resolve, delayMs),
        );
        continue;
      }

      // If it's the last attempt or non-retryable error, break
      break;
    }
  }

  // All retries failed, return fallback response
  logger.error(
    "All OpenAI retry attempts failed, returning fallback response",
    {
      error: lastError?.message,
      dealershipId,
    },
  );

  return getFallbackResponse(lastError);
}

/**
 * Determine if an error is retryable
 */
function isRetryable(error: Error): boolean {
  const retryableErrors = [
    "rate limit",
    "timeout",
    "network",
    "connection",
    "temporary",
    "service unavailable",
    "internal server error",
    "500",
    "502",
    "503",
    "504",
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some((keyword) => errorMessage.includes(keyword));
}

/**
 * Get appropriate fallback response based on error type
 */
function getFallbackResponse(error: Error | null): string {
  if (!error) {
    return "I'm having trouble processing your message right now. Let me connect you with one of our team members who can assist you.";
  }

  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes("rate limit")) {
    return "We're experiencing high demand right now. Let me connect you with one of our representatives who can help you immediately.";
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
    return "I'm experiencing a temporary connection issue. One of our team members will be with you shortly to assist.";
  }

  // Generic fallback
  return "I'm having trouble accessing our systems at the moment. Let me get one of our knowledgeable team members to help you right away.";
}

// Check if customer message contains inventory-related keywords
function containsInventoryKeywords(message: string): boolean {
  const keywords = [
    // Vehicle types
    "car",
    "truck",
    "suv",
    "sedan",
    "coupe",
    "convertible",
    "wagon",
    "hatchback",
    // Vehicle makes (common ones)
    "toyota",
    "honda",
    "ford",
    "chevrolet",
    "chevy",
    "nissan",
    "hyundai",
    "kia",
    "bmw",
    "mercedes",
    "audi",
    "lexus",
    "acura",
    "infiniti",
    "cadillac",
    "buick",
    "gmc",
    "dodge",
    "jeep",
    "ram",
    "chrysler",
    "lincoln",
    "volvo",
    "mazda",
    "subaru",
    "mitsubishi",
    "volkswagen",
    "porsche",
    "tesla",
    "genesis",
    // Intent keywords
    "looking for",
    "interested in",
    "want to buy",
    "need a",
    "searching for",
    "show me",
    "do you have",
    "available",
    "in stock",
    "inventory",
    // Specifications
    "year",
    "model",
    "price",
    "mileage",
    "color",
    "features",
    "trim",
    "mpg",
    "fuel",
    "transmission",
    "automatic",
    "manual",
    "awd",
    "4wd",
    // Condition
    "new",
    "used",
    "certified",
    "pre-owned",
    "cpo",
  ];

  const lowerMessage = message.toLowerCase();
  return keywords.some((keyword) => lowerMessage.includes(keyword));
}

// Search inventory for relevant vehicles based on customer message
async function searchInventoryForContext(
  dealershipId: number,
  customerMessage: string,
): Promise<Vehicle[]> {
  try {
    logger.info("Searching inventory for context", {
      dealershipId,
      query: customerMessage,
    });

    // Extract potential vehicle information from the message
    const searchTerms = extractSearchTerms(customerMessage);

    let query = db
      .select()
      .from(vehicles)
      .where(eq(vehicles.dealershipId, dealershipId))
      .limit(5); // Limit to 5 relevant vehicles

    // Build search conditions based on extracted terms
    const conditions = [];

    if (searchTerms.make) {
      conditions.push(ilike(vehicles.make, `%${searchTerms.make}%`));
    }

    if (searchTerms.model) {
      conditions.push(ilike(vehicles.model, `%${searchTerms.model}%`));
    }

    if (searchTerms.year) {
      conditions.push(eq(vehicles.year, searchTerms.year));
    }

    if (searchTerms.bodyStyle) {
      conditions.push(ilike(vehicles.bodyStyle, `%${searchTerms.bodyStyle}%`));
    }

    if (conditions.length > 0) {
      query = query.where(
        and(eq(vehicles.dealershipId, dealershipId), or(...conditions)),
      );
    }

    const results = await query;
    logger.info("Inventory search results", { resultsCount: results.length });

    return results;
  } catch (error) {
    logger.error("Error searching inventory:", error);
    return [];
  }
}

// Extract search terms from customer message
function extractSearchTerms(message: string): {
  make?: string;
  model?: string;
  year?: number;
  bodyStyle?: string;
} {
  const lowerMessage = message.toLowerCase();
  const terms: any = {};

  // Common vehicle makes mapping
  const makeMap: Record<string, string> = {
    toyota: "Toyota",
    honda: "Honda",
    ford: "Ford",
    chevrolet: "Chevrolet",
    chevy: "Chevrolet",
    nissan: "Nissan",
    hyundai: "Hyundai",
    kia: "Kia",
    bmw: "BMW",
    mercedes: "Mercedes-Benz",
    audi: "Audi",
    lexus: "Lexus",
    acura: "Acura",
    infiniti: "Infiniti",
    cadillac: "Cadillac",
    buick: "Buick",
    gmc: "GMC",
    dodge: "Dodge",
    jeep: "Jeep",
    ram: "Ram",
    chrysler: "Chrysler",
    lincoln: "Lincoln",
    volvo: "Volvo",
    mazda: "Mazda",
    subaru: "Subaru",
    mitsubishi: "Mitsubishi",
    volkswagen: "Volkswagen",
    porsche: "Porsche",
    tesla: "Tesla",
    genesis: "Genesis",
  };

  // Body style mapping
  const bodyStyleMap: Record<string, string> = {
    suv: "SUV",
    sedan: "Sedan",
    truck: "Truck",
    coupe: "Coupe",
    convertible: "Convertible",
    wagon: "Wagon",
    hatchback: "Hatchback",
  };

  // Extract make
  for (const [key, value] of Object.entries(makeMap)) {
    if (lowerMessage.includes(key)) {
      terms.make = value;
      break;
    }
  }

  // Extract body style
  for (const [key, value] of Object.entries(bodyStyleMap)) {
    if (lowerMessage.includes(key)) {
      terms.bodyStyle = value;
      break;
    }
  }

  // Extract year (look for 4-digit numbers between 1990 and current year + 1)
  const currentYear = new Date().getFullYear();
  const yearMatch = lowerMessage.match(/\b(19[9]\d|20[0-2]\d)\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    if (year >= 1990 && year <= currentYear + 1) {
      terms.year = year;
    }
  }

  return terms;
}

// Format inventory results for AI context
function formatInventoryContext(vehicles: Vehicle[]): string {
  if (vehicles.length === 0) {
    return "";
  }

  const vehicleDescriptions = vehicles
    .map((vehicle) => {
      const price = vehicle.salePrice || vehicle.msrp;
      const priceStr = price
        ? `$${(price / 100).toLocaleString()}`
        : "Price available upon request";

      return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ""} - ${priceStr} (Stock #${vehicle.stockNumber || "N/A"})`;
    })
    .join(", ");

  return `(Context: The dealership currently has ${vehicles.length} matching vehicle(s) in stock: ${vehicleDescriptions})`;
}

// Generate handover dossier for sales team
export async function generateHandoverDossier(
  conversationHistory: string,
  customerScenario: string,
): Promise<any> {
  try {
    // Construct the prompt for the handover dossier
    const systemPrompt = `Generate a sales lead handover dossier based on the conversation with a customer.
    Format the response as a JSON object with the following structure:
    {
      "customerName": "Name or Anonymous if unknown",
      "customerContact": "Contact details if available, otherwise 'Not provided'",
      "conversationSummary": "Brief summary of the conversation",
      "customerInsights": [
        {"key": "Insight category", "value": "Specific insight", "confidence": 0.0-1.0}
      ],
      "vehicleInterests": [
        {"make": "Vehicle make", "model": "Model name", "year": year, "confidence": 0.0-1.0}
      ],
      "suggestedApproach": "Recommended approach for sales team",
      "urgency": "low|medium|high",
      "escalationReason": "Reason for handover"
    }`;

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: customerScenario },
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    // Parse the response content as JSON
    const dossierContent = response.choices[0].message.content;
    return dossierContent ? JSON.parse(dossierContent) : {};
  } catch (error) {
    console.error("Error generating handover dossier:", error);
    throw error;
  }
}

// Generate response analysis
export async function generateResponseAnalysis(
  prompt: string,
  customerScenario: string,
): Promise<any> {
  try {
    const systemPrompt = `Analyze this customer interaction for a car dealership.
    Format the response as a JSON object with the following structure:
    {
      "customerName": "Name if detected, otherwise 'Unknown'",
      "query": "Main customer query",
      "analysis": "Analysis of customer's intent and needs",
      "insights": "Key insights about the customer's situation",
      "channel": "chat",
      "salesReadiness": "low|medium|high",
      "handoverNeeded": true|false
    }`;

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: customerScenario },
      ],
      temperature: 0.5,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    // Parse the response content as JSON
    const analysisContent = response.choices[0].message.content;
    return analysisContent ? JSON.parse(analysisContent) : {};
  } catch (error) {
    console.error("Error generating response analysis:", error);
    throw error;
  }
}

export { openai };

export default {
  generateAIResponse,
  generateHandoverDossier,
  generateResponseAnalysis,
};
