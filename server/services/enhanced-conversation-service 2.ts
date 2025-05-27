import { ConversationService } from './conversation-service';
import { generateAIResponse } from './openai';
import { eq, desc } from 'drizzle-orm';
import db from '../db';
import { messages, conversations, personas } from '../../shared/lead-management-schema';
import logger from '../utils/logger';

export interface EnhancedReplyOptions {
  conversationId: string;
  dealershipId: number;
  content: string;
  sender: 'customer' | 'ai' | 'agent' | 'system';
  senderUserId?: number;
  includeInventoryContext?: boolean;
  useConversationHistory?: boolean;
}

export interface ConversationContext {
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
  }>;
  persona?: {
    name: string;
    promptTemplate: string;
    arguments: Record<string, any>;
  };
}

export class EnhancedConversationService extends ConversationService {
  
  /**
   * Generate AI response with conversation history and inventory context
   */
  async generateAIResponseWithContext(
    options: EnhancedReplyOptions
  ): Promise<{ response: string; context: ConversationContext }> {
    try {
      logger.info('Generating AI response with context', {
        conversationId: options.conversationId,
        dealershipId: options.dealershipId,
        includeInventory: options.includeInventoryContext,
        useHistory: options.useConversationHistory
      });

      // Get conversation context
      const context = await this.getConversationContext(
        options.conversationId,
        options.dealershipId,
        options.useConversationHistory
      );

      // Build conversation history for AI
      const conversationHistory = options.useConversationHistory
        ? this.formatConversationHistory(context.messages)
        : undefined;

      // Get persona prompt template
      const systemPrompt = context.persona?.promptTemplate || this.getDefaultPrompt();

      // Process prompt with persona arguments
      const processedPrompt = this.processPromptTemplate(
        systemPrompt,
        context.persona?.arguments || {}
      );

      // Generate AI response with enhanced context
      const response = await generateAIResponse(
        processedPrompt,
        options.content,
        options.includeInventoryContext ? options.dealershipId : undefined,
        conversationHistory
      );

      return { response, context };

    } catch (error) {
      logger.error('Error generating AI response with context:', error);
      throw error;
    }
  }

  /**
   * Get conversation context including messages and persona
   */
  private async getConversationContext(
    conversationId: string,
    dealershipId: number,
    includeMessages: boolean = true
  ): Promise<ConversationContext> {
    try {
      // Get conversation details
      const conversationResult = await db
        .select({
          id: conversations.id,
          aiPersonaId: conversations.aiPersonaId,
          persona: {
            id: personas.id,
            name: personas.name,
            promptTemplate: personas.promptTemplate,
            arguments: personas.arguments
          }
        })
        .from(conversations)
        .leftJoin(personas, eq(conversations.aiPersonaId, personas.id))
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversationResult.length === 0) {
        throw new Error('Conversation not found');
      }

      const conversation = conversationResult[0];
      let conversationMessages: Array<{role: string; content: string; timestamp: Date}> = [];

      if (includeMessages) {
        // Get recent messages (last 10 for context)
        const messageResults = await db
          .select({
            content: messages.content,
            sender: messages.sender,
            createdAt: messages.createdAt
          })
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(desc(messages.createdAt))
          .limit(10);

        // Convert to conversation format (reverse to chronological order)
        conversationMessages = messageResults.reverse().map(msg => ({
          role: this.mapSenderToRole(msg.sender),
          content: msg.content,
          timestamp: msg.createdAt
        }));
      }

      return {
        messages: conversationMessages,
        persona: conversation.persona ? {
          name: conversation.persona.name,
          promptTemplate: conversation.persona.promptTemplate,
          arguments: conversation.persona.arguments || {}
        } : undefined
      };

    } catch (error) {
      logger.error('Error getting conversation context:', error);
      throw error;
    }
  }

  /**
   * Format conversation history for AI context
   */
  private formatConversationHistory(messages: Array<{role: string; content: string; timestamp: Date}>) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Map message sender to AI role
   */
  private mapSenderToRole(sender: string): string {
    switch (sender) {
      case 'customer':
        return 'user';
      case 'ai':
        return 'assistant';
      case 'agent':
        return 'assistant';
      case 'system':
        return 'system';
      default:
        return 'user';
    }
  }

  /**
   * Process prompt template with variables
   */
  private processPromptTemplate(template: string, args: Record<string, any>): string {
    let processedTemplate = template;

    // Replace template variables (e.g., {{variable_name}})
    Object.entries(args).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processedTemplate = processedTemplate.replace(regex, String(value));
    });

    return processedTemplate;
  }

  /**
   * Get default system prompt
   */
  private getDefaultPrompt(): string {
    return `You are Rylie, a helpful automotive sales agent AI. You work for a car dealership and assist customers with their vehicle needs. 

Key guidelines:
- Be friendly, professional, and knowledgeable about vehicles
- When inventory information is provided in the context, use it to make specific recommendations
- If a customer asks about specific vehicles, reference the available inventory when possible
- Always aim to be helpful and guide customers toward finding the right vehicle
- If you don't know something specific, offer to connect them with a human agent
- Keep responses conversational and engaging
- Remember previous parts of the conversation to maintain context

Respond in JSON format with an "answer" field containing your response.`;
  }

  /**
   * Send enhanced reply with AI generation
   */
  async sendEnhancedReply(options: EnhancedReplyOptions) {
    try {
      if (options.sender === 'ai') {
        // Generate AI response with context
        const { response } = await this.generateAIResponseWithContext(options);
        
        // Send the AI-generated response
        return await this.sendReply(options.dealershipId, {
          conversationId: options.conversationId,
          content: response,
          sender: 'ai',
          senderUserId: options.senderUserId,
          senderName: 'Rylie'
        });
      } else {
        // Send user message as-is
        return await this.sendReply(options.dealershipId, {
          conversationId: options.conversationId,
          content: options.content,
          sender: options.sender,
          senderUserId: options.senderUserId
        });
      }
    } catch (error) {
      logger.error('Error sending enhanced reply:', error);
      throw error;
    }
  }

  /**
   * Get conversation summary for handovers
   */
  async getConversationSummary(
    conversationId: string,
    dealershipId: number
  ): Promise<string> {
    try {
      const context = await this.getConversationContext(conversationId, dealershipId, true);
      
      if (context.messages.length === 0) {
        return "No conversation history available.";
      }

      // Create a summary of the conversation
      const messagesSummary = context.messages.map((msg, index) => {
        const role = msg.role === 'user' ? 'Customer' : 
                     msg.role === 'assistant' ? 'Agent' : 'System';
        return `${index + 1}. ${role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
      }).join('\n');

      return `Conversation Summary:\n${messagesSummary}`;

    } catch (error) {
      logger.error('Error getting conversation summary:', error);
      return "Error retrieving conversation summary.";
    }
  }
}

export const enhancedConversationService = new EnhancedConversationService();