/**
 * Enhanced AI Service with Conversation Intelligence
 * 
 * Generates natural, contextual, and intelligent responses using
 * conversation memory, customer journey tracking, and dynamic prompts.
 */

import { conversationIntelligence, ConversationContext } from './conversation-intelligence';
import { generateAIResponse } from './openai';
import logger from '../utils/logger';

export interface EnhancedMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    intent?: string;
    sentiment?: string;
    entities?: Record<string, any>;
  };
}

export class EnhancedAIService {
  
  /**
   * Generate intelligent, contextual response
   */
  async generateResponse(
    conversationId: string,
    userMessage: string,
    dealershipId: number,
    recentMessages: EnhancedMessage[] = []
  ): Promise<string> {
    try {
      // Analyze user message and update conversation context
      const context = await conversationIntelligence.analyzeMessage(
        conversationId, 
        userMessage, 
        true
      );

      // Generate context-aware system prompt
      const systemPrompt = await this.generateContextualSystemPrompt(context, dealershipId);
      
      // Prepare conversation history with intelligent context
      const conversationHistory = await this.prepareIntelligentHistory(context, recentMessages, userMessage);
      
      // Generate AI response with enhanced context
      const response = await generateAIResponse(
        userMessage,
        systemPrompt,
        dealershipId,
        conversationHistory
      );

      // Analyze AI response to update context
      await conversationIntelligence.analyzeMessage(conversationId, response, false);

      logger.info('Generated enhanced AI response', {
        conversationId,
        stage: context.conversationStage,
        intent: context.currentIntent?.primary,
        sentiment: context.customerSentiment
      });

      return response;

    } catch (error) {
      logger.error('Enhanced AI service error:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Generate contextual system prompt based on conversation state
   */
  private async generateContextualSystemPrompt(
    context: ConversationContext, 
    dealershipId: number
  ): Promise<string> {
    
    const contextSummary = await conversationIntelligence.generateContextSummary(context.conversationId);
    
    let prompt = `You are Rylie, an intelligent and helpful automotive assistant. You maintain context throughout conversations and provide personalized, natural responses.

CURRENT CONVERSATION CONTEXT:
${contextSummary}

CONVERSATION GUIDELINES:

1. MEMORY & CONTEXT:
   - Remember everything discussed in this conversation
   - Reference previous topics and customer preferences naturally
   - Build upon what you've already learned about the customer
   - Acknowledge their specific interests and needs

2. COMMUNICATION STYLE:
   - Be warm, genuine, and conversational
   - Adapt your tone to match the customer's communication style
   - Use their name when you know it
   - Show you're listening by referencing what they've told you

3. CONVERSATION STAGE AWARENESS:
   Current Stage: ${context.conversationStage}
   `;

    // Stage-specific guidance
    switch (context.conversationStage) {
      case 'greeting':
        prompt += `
   - Welcome them warmly and start building rapport
   - Ask open-ended questions to understand their needs
   - Don't rush into product recommendations`;
        break;
        
      case 'discovery':
        prompt += `
   - Ask thoughtful questions to understand their specific needs
   - Listen for clues about their lifestyle, family, and preferences
   - Help them clarify what they're really looking for`;
        break;
        
      case 'exploration':
        prompt += `
   - Provide detailed information about vehicles they've shown interest in
   - Compare options based on their stated preferences
   - Share relevant features and benefits that match their needs`;
        break;
        
      case 'evaluation':
        prompt += `
   - Help them weigh pros and cons of their options
   - Address any concerns or questions they have
   - Provide pricing and financing information when appropriate`;
        break;
        
      case 'negotiation':
        prompt += `
   - Focus on value and how the vehicle meets their needs
   - Be helpful with financing and pricing discussions
   - Prepare for potential handoff to human sales team`;
        break;
    }

    // Customer-specific adaptations
    if (context.customerName) {
      prompt += `\n   - Address them as ${context.customerName} naturally in conversation`;
    }

    if (context.previousInterests.length > 0) {
      prompt += `\n   - Remember they've shown interest in: ${context.previousInterests.map(i => `${i.make} ${i.model || ''}`).join(', ')}`;
    }

    if (context.currentNeed) {
      prompt += `\n   - They need a vehicle for: ${context.currentNeed.primary}`;
      prompt += `\n   - Timeline: ${context.currentNeed.timeline}`;
      if (context.currentNeed.financing !== 'undecided') {
        prompt += `\n   - Financing preference: ${context.currentNeed.financing}`;
      }
    }

    // Intent-specific guidance
    if (context.currentIntent) {
      switch (context.currentIntent.primary) {
        case 'pricing':
          prompt += `\n\n4. PRICING FOCUS:
   - They're interested in pricing information
   - Provide value-focused explanations
   - Mention financing options and total cost of ownership
   - Be transparent but emphasize value`;
          break;
          
        case 'scheduling':
          prompt += `\n\n4. SCHEDULING FOCUS:
   - They want to schedule a test drive or appointment
   - Gather their availability and preferences
   - Confirm details and next steps
   - Provide clear instructions`;
          break;
          
        case 'financing':
          prompt += `\n\n4. FINANCING FOCUS:
   - They're interested in financing options
   - Explain different financing vs leasing benefits
   - Discuss payment options and terms
   - Help them understand what works best for their situation`;
          break;
      }
    }

    // Sentiment-based adaptations
    switch (context.customerSentiment) {
      case 'positive':
        prompt += `\n\n5. CUSTOMER IS POSITIVE: Match their enthusiasm and energy while staying helpful.`;
        break;
      case 'negative':
        prompt += `\n\n5. CUSTOMER SEEMS FRUSTRATED: Be extra patient, empathetic, and solution-focused.`;
        break;
    }

    // Urgency adaptations
    if (context.urgencyLevel === 'high') {
      prompt += `\n\n6. HIGH URGENCY: They need help quickly. Be efficient while still being thorough.`;
    }

    prompt += `\n\nIMPORTANT: 
- Always respond in a natural, conversational way
- Reference previous parts of the conversation
- Show you understand their specific situation
- Ask relevant follow-up questions
- Be genuinely helpful, not just informative
- If they ask about something specific, provide detailed and useful information

Remember: You're having an ongoing conversation with a real person who has shared information with you. Use that context to be truly helpful and personalized.`;

    return prompt;
  }

  /**
   * Prepare intelligent conversation history with context compression
   */
  private async prepareIntelligentHistory(
    context: ConversationContext,
    recentMessages: EnhancedMessage[],
    currentMessage: string
  ): Promise<{ role: string; content: string }[]> {
    
    const history: { role: string; content: string }[] = [];
    
    // Add context summary as system message if conversation has history
    if (context.totalMessages > 5) {
      const contextSummary = await conversationIntelligence.generateContextSummary(context.conversationId);
      history.push({
        role: 'system',
        content: `CONVERSATION CONTEXT SUMMARY:\n${contextSummary}`
      });
    }
    
    // Add recent messages (more intelligent selection)
    const relevantMessages = this.selectRelevantMessages(recentMessages, context, currentMessage);
    
    relevantMessages.forEach(msg => {
      history.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    return history;
  }

  /**
   * Intelligently select most relevant recent messages
   */
  private selectRelevantMessages(
    messages: EnhancedMessage[],
    context: ConversationContext,
    currentMessage: string
  ): EnhancedMessage[] {
    
    // Always include the last few messages for immediate context
    const recentCount = Math.min(8, messages.length);
    let selectedMessages = messages.slice(-recentCount);
    
    // If conversation is longer, also include messages with high relevance
    if (messages.length > recentCount) {
      const relevantMessages = messages.slice(0, -recentCount).filter(msg => {
        const content = msg.content.toLowerCase();
        const currentLower = currentMessage.toLowerCase();
        
        // Include messages that mention similar topics
        return context.previousInterests.some(interest => 
          content.includes(interest.make?.toLowerCase() || '') ||
          currentLower.includes(interest.make?.toLowerCase() || '')
        );
      });
      
      // Add up to 3 most relevant historical messages
      selectedMessages = [...relevantMessages.slice(-3), ...selectedMessages];
    }
    
    return selectedMessages;
  }

  /**
   * Get fallback response for error cases
   */
  private getFallbackResponse(): string {
    const responses = [
      "I apologize, but I'm having a technical issue right now. Could you please repeat your question? I want to make sure I give you the best help possible.",
      "I'm experiencing a brief technical difficulty. Please bear with me for a moment - I want to make sure I address your question properly.",
      "I'm sorry, I seem to be having a connection issue. Could you try asking your question again? I'm here to help you find the perfect vehicle."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Generate conversation starter based on context
   */
  async generateContextualGreeting(conversationId: string, dealershipId: number): Promise<string> {
    const context = await conversationIntelligence.getConversationContext(conversationId, dealershipId);
    
    if (context.totalMessages === 0) {
      return "Hi there! I'm Rylie, your automotive assistant. I'm here to help you find the perfect vehicle for your needs. What brings you in today?";
    } else {
      return "Welcome back! I remember our conversation. How can I continue helping you today?";
    }
  }

  /**
   * Check if conversation needs human handoff
   */
  async shouldHandoffToHuman(conversationId: string): Promise<{ shouldHandoff: boolean; reason?: string }> {
    const context = conversationIntelligence['context'].get(conversationId);
    if (!context) return { shouldHandoff: false };

    // High urgency + negative sentiment = handoff
    if (context.urgencyLevel === 'high' && context.customerSentiment === 'negative') {
      return { shouldHandoff: true, reason: 'Customer needs immediate assistance and seems frustrated' };
    }

    // Ready to schedule = handoff
    if (context.currentIntent?.primary === 'scheduling' && context.conversationStage === 'negotiation') {
      return { shouldHandoff: true, reason: 'Customer is ready to schedule and move forward' };
    }

    // Complex financing discussion = handoff
    if (context.currentIntent?.primary === 'financing' && context.totalMessages > 10) {
      return { shouldHandoff: true, reason: 'Complex financing discussion needs human expertise' };
    }

    return { shouldHandoff: false };
  }
}

// Singleton instance
export const enhancedAIService = new EnhancedAIService();