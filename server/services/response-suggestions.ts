/**
 * Service to generate contextual response suggestions for sales representatives
 * These suggestions appear as chips or quick replies that reps can use when responding to handover leads
 */

import { OpenAI } from 'openai';
import logger from '../utils/logger';
import { ResponseSuggestion } from '../../shared/schema';
import { ConversationContext } from './handover-service';
import { DEFAULT_SYSTEM_PROMPT } from './system-prompts/default';
import type { ChatCompletionMessageParam } from 'openai/resources';

// Use the logger for this service
const serviceLogger = logger;

// Initialize OpenAI with graceful fallback
let openai: OpenAI | null = null;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !apiKey.startsWith('sk-dummy') && !apiKey.includes('placeholder')) {
    openai = new OpenAI({ apiKey });
  } else {
    console.warn('OpenAI API key not configured - response suggestions will be disabled');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI in response-suggestions:', error);
  openai = null;
}

/**
 * Generate contextual response suggestions based on conversation history and customer insights
 */
export async function generateResponseSuggestions(
  context: ConversationContext,
): Promise<ResponseSuggestion[]> {
  try {
    if (!openai) {
      serviceLogger.warn('OpenAI client not initialized, returning empty response suggestions');
      return [];
    }
    // We'll handle formatting the conversation history directly when building the messages array

    // Get vehicle information if available
    const vehicleInfo = context.relevantVehicles && context.relevantVehicles.length > 0
      ? context.relevantVehicles.map(vehicle => {
          return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''} - $${vehicle.price}`;
        }).join('\n')
      : 'No specific vehicles discussed';

    // Construct the system prompt
    const systemPrompt = `
${DEFAULT_SYSTEM_PROMPT}

ADDITIONAL CONTEXT: You are now creating response suggestions for a human sales representative who will take over the conversation with the customer.
Generate 5-7 contextually relevant response options that the sales representative could use.

Focus on:
1. Responding to the customer's most recent questions or concerns
2. Moving the conversation toward scheduling a test drive or visit
3. Addressing any specific vehicle interests
4. Providing pricing or financing information when relevant
5. Handling possible objections professionally

Current conversation context:
- Customer name: ${context.customerName}
- Vehicle interests: ${vehicleInfo}

FORMAT YOUR RESPONSE AS A JSON ARRAY OF SUGGESTION OBJECTS:
[
  {
    "text": "The complete text of a suggested response",
    "context": "Brief explanation of when this response would be useful",
    "category": "One of: greeting, product_info, pricing, follow_up, appointment, objection_handling, general",
    "priority": 1-5 (with 5 being highest priority)
  },
  ...
]
`;

    // Call the OpenAI API to generate suggestions
    // Create a properly typed array of messages for the OpenAI API
    // Properly type the system message and create the array
    const systemMessage: ChatCompletionMessageParam = {
      role: "system",
      content: systemPrompt
    };

    const messages: ChatCompletionMessageParam[] = [systemMessage];

    // Add conversation history with proper typing for OpenAI API
    context.previousMessages.forEach(msg => {
      const role = msg.isFromCustomer ? 'user' as const : 'assistant' as const;
      messages.push({
        role,
        content: msg.content
      });
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Extract and parse the response
    const responseText = response.choices[0]?.message?.content || '[]';
    let suggestions: ResponseSuggestion[] = [];

    try {
      // Try to parse the JSON response
      suggestions = JSON.parse(responseText);

      // Validate the structure of each suggestion
      suggestions = suggestions.filter(suggestion => {
        return (
          suggestion.text &&
          suggestion.context &&
          suggestion.category &&
          typeof suggestion.priority === 'number'
        );
      });

      // Sort by priority (highest first)
      suggestions.sort((a, b) => b.priority - a.priority);

      // Limit to a reasonable number
      if (suggestions.length > 7) {
        suggestions = suggestions.slice(0, 7);
      }

    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      serviceLogger.error(`Failed to parse response suggestions: ${errorMessage}`);
      // Also log the response text for debugging
      serviceLogger.debug('Response text from failed parsing attempt', { responseText });
      return [];
    }

    return suggestions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    serviceLogger.error(`Error generating response suggestions: ${errorMessage}`);
    return [];
  }
}