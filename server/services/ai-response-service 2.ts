import { ConversationService, type ReplyMessageData } from './conversation-service';
import { HandoverService, type HandoverRequest } from './handover-service';
import { evaluateEscalationTriggers } from './escalation-triggers';
import { generateAIResponse } from './openai';
import logger from '../utils/logger';

export interface AIResponseRequest {
  dealershipId: number;
  conversationId: string;
  prompt: string;
  personaId?: number;
  context?: Record<string, any>;
}

export interface AIResponseResult {
  success: boolean;
  messageId?: string;
  content?: string;
  escalated?: boolean;
  escalationReason?: string;
  handoverId?: string;
  errors: string[];
}

export class AIResponseService {
  private conversationService = new ConversationService();
  private handoverService = new HandoverService();

  /**
   * Generate and send AI response with automatic escalation checking
   */
  async generateAndSendResponse(request: AIResponseRequest): Promise<AIResponseResult> {
    const errors: string[] = [];

    try {
      logger.info('Generating AI response with escalation checking', {
        dealershipId: request.dealershipId,
        conversationId: request.conversationId
      });

      // Get conversation details to analyze for escalation
      const conversationDetails = await this.conversationService.getConversation(
        request.dealershipId,
        request.conversationId,
        { includeMessages: true, messageLimit: 20 }
      );

      if (!conversationDetails) {
        return {
          success: false,
          errors: ['Conversation not found']
        };
      }

      // Prepare messages for escalation analysis
      const messageAnalysis = conversationDetails.messages.map(msg => ({
        content: msg.content,
        isFromCustomer: msg.sender === 'customer'
      }));

      // Check for escalation triggers BEFORE generating AI response
      const escalationResult = await evaluateEscalationTriggers(
        request.dealershipId,
        { messages: messageAnalysis }
      );

      if (escalationResult.shouldEscalate) {
        logger.info('Escalation triggered before AI response', {
          conversationId: request.conversationId,
          reason: escalationResult.reason
        });

        // Create handover instead of AI response
        const handoverRequest: HandoverRequest = {
          conversationId: request.conversationId,
          reason: this.mapEscalationReasonToHandoverReason(escalationResult.reason || 'ai_limitation'),
          description: escalationResult.description || `Automatic escalation: ${escalationResult.reason}`,
          urgency: this.determineUrgencyFromReason(escalationResult.reason || '')
        };

        const handoverResult = await this.handoverService.createHandover(
          request.dealershipId,
          handoverRequest
        );

        if (handoverResult.success) {
          // Send escalation message to customer
          await this.sendEscalationMessage(request.dealershipId, request.conversationId);

          return {
            success: true,
            escalated: true,
            escalationReason: escalationResult.reason,
            handoverId: handoverResult.handoverId,
            errors
          };
        } else {
          // Escalation failed, continue with AI response but log the issue
          logger.warn('Escalation creation failed, continuing with AI response', {
            conversationId: request.conversationId,
            errors: handoverResult.errors
          });
          errors.push(...handoverResult.errors);
        }
      }

      // Generate AI response using OpenAI service
      const aiResponse = await this.generateAIResponse(request, conversationDetails);

      if (!aiResponse.success) {
        return {
          success: false,
          errors: aiResponse.errors || ['Failed to generate AI response']
        };
      }

      // Check if the AI response itself contains escalation triggers
      const responseAnalysis = [
        ...messageAnalysis,
        { content: aiResponse.content || '', isFromCustomer: false }
      ];

      const postResponseEscalation = await evaluateEscalationTriggers(
        request.dealershipId,
        { messages: responseAnalysis }
      );

      // Send the AI response
      const replyData: ReplyMessageData = {
        conversationId: request.conversationId,
        content: aiResponse.content || '',
        sender: 'ai',
        contentType: 'text',
        senderName: 'Rylie AI'
      };

      const messageResult = await this.conversationService.sendReply(
        request.dealershipId,
        replyData
      );

      if (!messageResult.success) {
        return {
          success: false,
          errors: messageResult.errors
        };
      }

      // If post-response escalation is needed, create handover
      if (postResponseEscalation.shouldEscalate) {
        logger.info('Escalation triggered after AI response', {
          conversationId: request.conversationId,
          reason: postResponseEscalation.reason
        });

        const handoverRequest: HandoverRequest = {
          conversationId: request.conversationId,
          reason: this.mapEscalationReasonToHandoverReason(postResponseEscalation.reason || 'ai_limitation'),
          description: postResponseEscalation.description || `Post-response escalation: ${postResponseEscalation.reason}`,
          urgency: this.determineUrgencyFromReason(postResponseEscalation.reason || '')
        };

        const handoverResult = await this.handoverService.createHandover(
          request.dealershipId,
          handoverRequest
        );

        if (handoverResult.success) {
          // Send additional escalation notification
          await this.sendPostResponseEscalationMessage(request.dealershipId, request.conversationId);
        }
      }

      return {
        success: true,
        messageId: messageResult.messageId,
        content: aiResponse.content,
        escalated: postResponseEscalation.shouldEscalate,
        escalationReason: postResponseEscalation.reason,
        handoverId: postResponseEscalation.shouldEscalate ? undefined : undefined,
        errors
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('AI response generation failed', {
        error: err.message,
        dealershipId: request.dealershipId,
        conversationId: request.conversationId
      });

      return {
        success: false,
        errors: [`Failed to generate AI response: ${err.message}`]
      };
    }
  }

  /**
   * Generate AI response using OpenAI service with retry logic
   */
  private async generateAIResponse(
    request: AIResponseRequest,
    conversationDetails: any
  ): Promise<{ success: boolean; content?: string; errors?: string[] }> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`AI response generation attempt ${attempt}`, {
          conversationId: request.conversationId
        });

        // Use OpenAI service with conversation context
        const conversationHistory = conversationDetails.messages.slice(-10).map(msg => ({
          role: msg.sender === 'customer' ? 'user' : 'assistant',
          content: msg.content
        }));

        const aiResponse = await generateAIResponse(
          request.prompt,
          '', // No specific customer scenario as we have conversation history
          request.dealershipId,
          conversationHistory
        );

        if (aiResponse && aiResponse.trim()) {
          return {
            success: true,
            content: aiResponse
          };
        } else {
          throw new Error('OpenAI returned empty response');
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`AI response generation attempt ${attempt} failed`, {
          error: lastError.message,
          conversationId: request.conversationId
        });

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All attempts failed, return fallback response
    logger.error('All AI response generation attempts failed', {
      error: lastError?.message,
      conversationId: request.conversationId
    });

    return {
      success: true, // Still return success to avoid conversation breaking
      content: "I'm having trouble processing your message right now. A human representative will be with you shortly.",
      errors: [`AI generation failed: ${lastError?.message}`]
    };
  }

  /**
   * Send escalation message to customer
   */
  private async sendEscalationMessage(dealershipId: number, conversationId: string): Promise<void> {
    try {
      const escalationMessage = "I'm connecting you with one of our team members who can better assist you. Someone will be with you shortly.";

      await this.conversationService.sendReply(dealershipId, {
        conversationId,
        content: escalationMessage,
        sender: 'system',
        contentType: 'text',
        senderName: 'System'
      });
    } catch (error) {
      logger.error('Failed to send escalation message', { error, conversationId });
    }
  }

  /**
   * Send post-response escalation message
   */
  private async sendPostResponseEscalationMessage(dealershipId: number, conversationId: string): Promise<void> {
    try {
      const escalationMessage = "I've also notified our team about your inquiry to ensure you get the best possible assistance.";

      await this.conversationService.sendReply(dealershipId, {
        conversationId,
        content: escalationMessage,
        sender: 'system',
        contentType: 'text',
        senderName: 'System'
      });
    } catch (error) {
      logger.error('Failed to send post-response escalation message', { error, conversationId });
    }
  }

  /**
   * Map escalation reason to handover reason
   */
  private mapEscalationReasonToHandoverReason(reason: string): any {
    const reasonMap: Record<string, any> = {
      'negative_sentiment': 'customer_request',
      'repeated_questions': 'ai_limitation',
      'urgency_detected': 'complex_inquiry',
      'keyword_trigger': 'policy_escalation',
      'legal_query': 'policy_escalation',
      'complex_technical': 'technical_issue',
      'pricing_discussion': 'pricing_negotiation'
    };

    return reasonMap[reason] || 'ai_limitation';
  }

  /**
   * Determine urgency level based on escalation reason
   */
  private determineUrgencyFromReason(reason: string): any {
    const urgencyMap: Record<string, any> = {
      'negative_sentiment': 'high',
      'legal_query': 'urgent',
      'complaint': 'high',
      'angry_customer': 'urgent',
      'technical_issue': 'medium',
      'pricing_discussion': 'medium'
    };

    return urgencyMap[reason] || 'medium';
  }
}

// Export singleton instance
export const aiResponseService = new AIResponseService();