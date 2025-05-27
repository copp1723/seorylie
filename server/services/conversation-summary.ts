/**
 * Conversation Summary Service for Rylie AI platform
 *
 * This module provides functionality to generate conversation summaries
 * and extract key data points using OpenAI's API
 */
import OpenAI from 'openai';
import logger from '../utils/logger';

// Initialize OpenAI client lazily to prevent startup failures
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openaiClient === null) {
    try {
      if (process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.info('OpenAI client initialized for conversation summaries');
      } else {
        logger.warn('OpenAI API key not provided, conversation summaries will not be available');
        return null;
      }
    } catch (error) {
      logger.error('Failed to initialize OpenAI client for conversation summaries', error);
      return null;
    }
  }
  return openaiClient;
}

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user
const MODEL = 'gpt-4o';

/**
 * Generate a summary of a conversation
 * @param messages Array of conversation messages
 * @returns Summary of the conversation
 */
export const generateConversationSummary = async (
  messages: Array<{role: 'customer' | 'assistant', content: string}>
): Promise<string> => {
  try {
    const client = getOpenAI();
    if (!client) {
      logger.warn('OpenAI client not initialized, returning placeholder summary');
      return 'Conversation summary not available - OpenAI API key not configured.';
    }

    // Filter out very short messages that don't add context
    const significantMessages = messages.filter(msg => msg.content.length > 10);

    // If there are very few messages, return a simple summary
    if (significantMessages.length < 2) {
      return 'Brief conversation, not enough content to summarize.';
    }

    // Format messages for the API
    const formattedMessages = [
      {
        role: 'system',
        content: `You are an expert automotive sales conversation analyzer.
        Summarize the following conversation between a customer and an automotive dealership AI assistant named Rylie.
        Focus on key points like:
        - Customer's main interests and questions
        - Vehicle preferences mentioned (make, model, features, price range)
        - Customer's position in the buying journey
        - Any action items or next steps mentioned
        - Obstacles or objections raised

        Keep the summary concise (max 150 words) but comprehensive, focusing on the most important information for a sales representative.`
      },
      ...significantMessages.map(msg => ({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    // Generate summary using OpenAI
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      max_tokens: 300,
      temperature: 0.3,
    });

    const summary = response.choices[0].message.content?.trim();

    if (!summary) {
      throw new Error('Empty summary returned from OpenAI');
    }

    return summary;
  } catch (error) {
    logger.error('Failed to generate conversation summary', error);
    return 'Error generating conversation summary. Please try again later.';
  }
};

/**
 * Extract customer insights from a conversation
 * @param messages Array of conversation messages
 * @returns Array of customer insights with confidence scores
 */
export const extractCustomerInsights = async (
  messages: Array<{role: 'customer' | 'assistant', content: string}>
): Promise<Array<{key: string, value: string, confidence: number}>> => {
  try {
    const client = getOpenAI();
    if (!client) {
      logger.warn('OpenAI client not initialized, returning empty insights');
      return [];
    }

    // Format messages for the API
    const formattedMessages = [
      {
        role: 'system',
        content: `You are an expert at analyzing automotive sales conversations.
        Extract key customer insights from the conversation between a customer and an automotive dealership AI assistant named Rylie.
        For each insight, provide:
        1. A key (e.g., "Budget", "Preferred Brand", "Timeline", "Credit Situation", "Trade-In Interest", etc.)
        2. A value (the specific information for that key)
        3. A confidence score (0.0 to 1.0) based on how explicitly this was stated or how strongly it was implied

        Return the results in JSON format like this:
        [
          {"key": "Budget", "value": "$30,000-$35,000", "confidence": 0.9},
          {"key": "Preferred Brand", "value": "Toyota", "confidence": 0.7}
        ]

        Only include insights that are reasonably confident (0.5 or higher).`
      },
      ...messages.map(msg => ({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    // Generate insights using OpenAI
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.2,
    });

    const insightsText = response.choices[0].message.content?.trim();

    if (!insightsText) {
      throw new Error('Empty insights returned from OpenAI');
    }

    try {
      const insights = JSON.parse(insightsText);
      if (Array.isArray(insights)) {
        return insights;
      } else if (insights && Array.isArray(insights.insights)) {
        return insights.insights;
      } else {
        logger.warn('Unexpected insights format returned', { insights: insightsText });
        return [];
      }
    } catch (parseError) {
      logger.error('Failed to parse insights JSON', parseError, { insights: insightsText });
      return [];
    }
  } catch (error) {
    logger.error('Failed to extract customer insights', error);
    return [];
  }
};

/**
 * Detect vehicle interests from a conversation
 * @param messages Array of conversation messages
 * @param availableInventory Optional available inventory to match against
 * @returns Array of vehicle interests with confidence scores
 */
export const detectVehicleInterests = async (
  messages: Array<{role: 'customer' | 'assistant', content: string}>,
  availableInventory: any[] = []
): Promise<Array<{
  vin?: string,
  year?: number,
  make?: string,
  model?: string,
  trim?: string,
  confidence: number
}>> => {
  try {
    const client = getOpenAI();
    if (!client) {
      logger.warn('OpenAI client not initialized, returning empty vehicle interests');
      return [];
    }

    // Create a simplified inventory list to include in the prompt if available
    let inventoryContext = '';
    if (availableInventory && availableInventory.length > 0) {
      const simplifiedInventory = availableInventory.map(vehicle => {
        const { vin, year, make, model, trim } = vehicle;
        return { vin, year, make, model, trim };
      }).slice(0, 20); // Limit to 20 vehicles to avoid token limits

      inventoryContext = `Available inventory: ${JSON.stringify(simplifiedInventory)}`;
    }

    // Format messages for the API
    const formattedMessages = [
      {
        role: 'system',
        content: `You are an expert at detecting vehicle interests in automotive sales conversations.
        Analyze the conversation between a customer and an automotive dealership AI assistant named Rylie.
        Identify specific vehicles the customer is interested in, even if only partially described.

        ${inventoryContext}

        For each vehicle interest, provide:
        1. VIN (if specifically mentioned or if you can confidently match to inventory)
        2. Year (if mentioned)
        3. Make (manufacturer name)
        4. Model
        5. Trim (if mentioned)
        6. A confidence score (0.0 to 1.0) based on how explicitly this was stated

        Return the results in JSON format like this:
        [
          {"vin": "ABC123XYZ", "year": 2023, "make": "Toyota", "model": "RAV4", "trim": "XLE", "confidence": 0.9},
          {"make": "Honda", "model": "Accord", "confidence": 0.6}
        ]

        Only include vehicle interests that are reasonably confident (0.5 or higher).
        Include partial information if that's all that was mentioned.`
      },
      ...messages.map(msg => ({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.content
      }))
    ];

    // Detect vehicle interests using OpenAI
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.2,
    });

    const interestsText = response.choices[0].message.content?.trim();

    if (!interestsText) {
      throw new Error('Empty vehicle interests returned from OpenAI');
    }

    try {
      const interests = JSON.parse(interestsText);
      if (Array.isArray(interests)) {
        return interests;
      } else if (interests && Array.isArray(interests.vehicles)) {
        return interests.vehicles;
      } else {
        logger.warn('Unexpected vehicle interests format returned', { interests: interestsText });
        return [];
      }
    } catch (parseError) {
      logger.error('Failed to parse vehicle interests JSON', parseError, { interests: interestsText });
      return [];
    }
  } catch (error) {
    logger.error('Failed to detect vehicle interests', error);
    return [];
  }
};

/**
 * Send a conversation summary email
 * @param to Recipient email address
 * @param conversation Conversation data
 * @returns Whether the email was sent successfully
 */
export const sendConversationSummary = async (
  to: string,
  conversation: {
    id: number,
    dealershipId: number,
    customerName: string,
    messages: Array<{role: 'customer' | 'assistant', content: string, timestamp: Date}>,
    summary?: string,
    insights?: Array<{key: string, value: string, confidence: number}>,
    vehicleInterests?: Array<{vin?: string, year?: number, make?: string, model?: string, trim?: string, confidence: number}>
  }
): Promise<boolean> => {
  try {
    // Import here to avoid circular dependencies
    const { default: emailService } = await import('./email');

    // Generate summary if not provided
    let summary = conversation.summary;
    if (!summary) {
      summary = await generateConversationSummary(
        conversation.messages.map(m => ({ role: m.role, content: m.content }))
      );
    }

    // Extract insights if not provided
    let insights = conversation.insights;
    if (!insights) {
      insights = await extractCustomerInsights(
        conversation.messages.map(m => ({ role: m.role, content: m.content }))
      );
    }

    // Format insights text
    const insightsText = insights && insights.length > 0
      ? insights.map(insight =>
          `${insight.key}: ${insight.value} (Confidence: ${Math.round(insight.confidence * 100)}%)`
        ).join('\n')
      : 'No specific customer insights detected';

    // Format vehicle interests text
    const vehicleInterestsText = conversation.vehicleInterests && conversation.vehicleInterests.length > 0
      ? conversation.vehicleInterests.map(vehicle => {
          const parts = [];
          if (vehicle.year) parts.push(`${vehicle.year}`);
          if (vehicle.make) parts.push(`${vehicle.make}`);
          if (vehicle.model) parts.push(`${vehicle.model}`);
          if (vehicle.trim) parts.push(`${vehicle.trim}`);
          return `${parts.join(' ')} (Confidence: ${Math.round(vehicle.confidence * 100)}%)`;
        }).join('\n')
      : 'No specific vehicle interests detected';

    // Format conversation text
    const conversationText = conversation.messages
      .map(msg => `[${msg.timestamp.toLocaleString()}] ${msg.role === 'customer' ? 'Customer' : 'Rylie'}: ${msg.content}`)
      .join('\n\n');

    // Email subject
    const subject = `Conversation Summary: ${conversation.customerName} (ID: ${conversation.id})`;

    // Email text content
    const text = `Conversation Summary for ID: ${conversation.id}

Customer: ${conversation.customerName}
Dealership ID: ${conversation.dealershipId}

Summary:
${summary}

Customer Insights:
${insightsText}

Vehicle Interests:
${vehicleInterestsText}

Full Conversation:
${conversationText}

This is an automated summary generated by Rylie AI.`;

    // Email HTML content
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <h2>Conversation Summary</h2>

        <div style="background-color: #f4f6fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p><strong>Conversation ID:</strong> ${conversation.id}</p>
          <p><strong>Customer:</strong> ${conversation.customerName}</p>
          <p><strong>Dealership ID:</strong> ${conversation.dealershipId}</p>
        </div>

        <div style="background-color: #f4f6fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Summary</h3>
          <p>${summary}</p>
        </div>

        <div style="background-color: #f4f6fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Customer Insights</h3>
          <ul>
            ${insights && insights.length > 0
              ? insights.map(insight =>
                  `<li><strong>${insight.key}:</strong> ${insight.value} <span style="color: #666;">(Confidence: ${Math.round(insight.confidence * 100)}%)</span></li>`
                ).join('')
              : '<li>No specific customer insights detected</li>'
            }
          </ul>
        </div>

        <div style="background-color: #f4f6fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Vehicle Interests</h3>
          <ul>
            ${conversation.vehicleInterests && conversation.vehicleInterests.length > 0
              ? conversation.vehicleInterests.map(vehicle => {
                  const parts = [];
                  if (vehicle.year) parts.push(`${vehicle.year}`);
                  if (vehicle.make) parts.push(`${vehicle.make}`);
                  if (vehicle.model) parts.push(`${vehicle.model}`);
                  if (vehicle.trim) parts.push(`${vehicle.trim}`);
                  return `<li>${parts.join(' ')} <span style="color: #666;">(Confidence: ${Math.round(vehicle.confidence * 100)}%)</span></li>`;
                }).join('')
              : '<li>No specific vehicle interests detected</li>'
            }
          </ul>
        </div>

        <div style="background-color: #f4f6fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Full Conversation</h3>
          ${conversation.messages.map(msg => {
            const timestamp = new Date(msg.timestamp).toLocaleString();
            return `
              <div style="margin-bottom: 15px; ${msg.role === 'customer' ? '' : 'background-color: #e6f0ff; padding: 10px; border-radius: 5px;'}">
                <p style="margin-bottom: 5px; font-size: 0.8em; color: #666;">${timestamp} - ${msg.role === 'customer' ? 'Customer' : 'Rylie'}</p>
                <p style="margin-top: 0;">${msg.content}</p>
              </div>
            `;
          }).join('')}
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">This is an automated summary generated by Rylie AI.</p>
      </div>
    `;

    // Send the email
    return await emailService.sendEmail(to, subject, text, html);
  } catch (error) {
    logger.error('Failed to send conversation summary email', error);
    return false;
  }
};

export default {
  generateConversationSummary,
  extractCustomerInsights,
  detectVehicleInterests,
  sendConversationSummary
};