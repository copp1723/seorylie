import { AIResponseService, type AIResponseRequest, type AIResponseResult } from './ai-response-service.js';
import { 
  routeMessageThroughAgentSquad, 
  isAgentSquadReady, 
  type AgentSquadResponse 
} from './agentSquad/index.js';
import logger from '../utils/logger.js';

export interface HybridAIConfig {
  useAgentSquad: boolean;
  fallbackToOriginal: boolean;
  agentSquadThreshold?: number; // Minimum confidence to use Agent Squad
}

export interface HybridAIResponse extends AIResponseResult {
  usedAgentSquad?: boolean;
  selectedAgent?: string;
  confidence?: number;
  fallbackReason?: string;
}

/**
 * Hybrid AI Service that can route between Agent Squad and original Rylie AI
 * This maintains backward compatibility while adding Agent Squad capabilities
 */
export class HybridAIService {
  private originalAIService = new AIResponseService();
  private config: HybridAIConfig;

  constructor(config: HybridAIConfig = { useAgentSquad: false, fallbackToOriginal: true }) {
    this.config = config;
    logger.info('HybridAIService initialized', { config });
  }

  /**
   * Generate AI response using hybrid approach (Agent Squad + fallback)
   */
  async generateResponse(request: AIResponseRequest): Promise<HybridAIResponse> {
    const startTime = Date.now();
    
    logger.info('Hybrid AI processing request', {
      dealershipId: request.dealershipId,
      conversationId: request.conversationId,
      useAgentSquad: this.config.useAgentSquad,
      agentSquadReady: isAgentSquadReady()
    });

    // Try Agent Squad first if enabled and ready
    if (this.config.useAgentSquad && isAgentSquadReady()) {
      try {
        const agentSquadResult = await this.tryAgentSquad(request);
        
        if (agentSquadResult.success && !agentSquadResult.fallbackRequired) {
          logger.info('Agent Squad successfully handled request', {
            conversationId: request.conversationId,
            selectedAgent: agentSquadResult.selectedAgent,
            processingTime: Date.now() - startTime
          });

          return {
            success: true,
            content: agentSquadResult.response,
            usedAgentSquad: true,
            selectedAgent: agentSquadResult.selectedAgent,
            errors: []
          };
        } else {
          logger.warn('Agent Squad failed or requested fallback', {
            conversationId: request.conversationId,
            error: agentSquadResult.error,
            fallbackRequired: agentSquadResult.fallbackRequired
          });
        }
      } catch (error) {
        logger.error('Agent Squad processing failed', {
          error: error instanceof Error ? error.message : String(error),
          conversationId: request.conversationId
        });
      }
    }

    // Fallback to original AI service
    if (this.config.fallbackToOriginal) {
      logger.info('Using original AI service as fallback', {
        conversationId: request.conversationId
      });

      const originalResult = await this.originalAIService.generateAndSendResponse(request);
      
      return {
        ...originalResult,
        usedAgentSquad: false,
        fallbackReason: this.config.useAgentSquad ? 'agent_squad_failed' : 'agent_squad_disabled'
      };
    }

    // Both systems failed
    return {
      success: false,
      errors: ['All AI systems unavailable'],
      usedAgentSquad: false,
      fallbackReason: 'all_systems_failed'
    };
  }

  /**
   * Try processing with Agent Squad
   */
  private async tryAgentSquad(request: AIResponseRequest): Promise<AgentSquadResponse> {
    try {
      // Build context from request
      const context = {
        dealershipId: request.dealershipId,
        personaId: request.personaId,
        ...request.context
      };

      // Route through Agent Squad
      const agentSquadResult = await routeMessageThroughAgentSquad(
        request.prompt,
        `user_${request.dealershipId}`, // User ID based on dealership
        request.conversationId,
        context
      );

      // If successful, we need to save the message to Rylie's database
      if (agentSquadResult.success && agentSquadResult.response) {
        await this.saveAgentSquadResponse(request, agentSquadResult);
      }

      return agentSquadResult;

    } catch (error) {
      logger.error('Agent Squad processing error', {
        error: error instanceof Error ? error.message : String(error),
        conversationId: request.conversationId
      });

      return {
        success: false,
        error: 'Agent Squad processing failed',
        fallbackRequired: true
      };
    }
  }

  /**
   * Save Agent Squad response to Rylie's conversation system
   */
  private async saveAgentSquadResponse(
    request: AIResponseRequest, 
    agentSquadResult: AgentSquadResponse
  ): Promise<void> {
    try {
      // Import ConversationService to save the response
      const { ConversationService } = await import('./conversation-service.js');
      const conversationService = new ConversationService();

      // Save Agent Squad response as AI message
      await conversationService.sendReply(request.dealershipId, {
        conversationId: request.conversationId,
        content: agentSquadResult.response || '',
        sender: 'ai',
        contentType: 'text',
        senderName: `Rylie AI (${agentSquadResult.selectedAgent})`
      });

      logger.info('Agent Squad response saved to conversation', {
        conversationId: request.conversationId,
        selectedAgent: agentSquadResult.selectedAgent
      });

    } catch (error) {
      logger.error('Failed to save Agent Squad response', {
        error: error instanceof Error ? error.message : String(error),
        conversationId: request.conversationId
      });
    }
  }

  /**
   * Update hybrid configuration
   */
  updateConfig(newConfig: Partial<HybridAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('HybridAIService configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridAIConfig {
    return { ...this.config };
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    originalAI: boolean;
    agentSquad: boolean;
    hybrid: boolean;
  }> {
    return {
      originalAI: true, // Original AI service is always available
      agentSquad: isAgentSquadReady(),
      hybrid: true // Hybrid service is always available due to fallback
    };
  }
}

// Export singleton instance
export const hybridAIService = new HybridAIService();