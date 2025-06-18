import { supabaseAdmin } from '../config/supabase';
import { SEOWORKS_ASSISTANT_PROMPT, SEOWORKS_CONTEXT_PROMPT } from './system-prompts/seoworks-assistant';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DealershipContext {
  dealerName: string;
  package: 'PLATINUM' | 'GOLD' | 'SILVER';
  mainBrand: string;
  targetCities: string[];
  targetVehicleModels: string[];
  recentMetrics?: {
    organicTraffic?: number;
    keywordRankings?: number;
    impressions?: number;
    conversions?: number;
  };
}

export class SEOWorksChatService {
  /**
   * Get dealership context from the database
   */
  private async getDealershipContext(dealershipId: string): Promise<DealershipContext | null> {
    try {
      // First, try to get from onboarding submissions
      const { data: onboarding } = await supabaseAdmin
        .from('seoworks_onboarding_submissions')
        .select('*')
        .eq('id', dealershipId)
        .single();

      if (onboarding) {
        return {
          dealerName: onboarding.business_name,
          package: onboarding.package,
          mainBrand: onboarding.main_brand,
          targetCities: onboarding.target_cities,
          targetVehicleModels: onboarding.target_vehicle_models,
        };
      }

      // Fallback to dealerships table if exists
      const { data: dealership } = await supabaseAdmin
        .from('dealerships')
        .select('*')
        .eq('id', dealershipId)
        .single();

      if (dealership) {
        return {
          dealerName: dealership.name,
          package: dealership.seo_package || 'GOLD',
          mainBrand: dealership.primary_brand || 'Unknown',
          targetCities: dealership.target_cities || [],
          targetVehicleModels: dealership.target_models || [],
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching dealership context:', error);
      return null;
    }
  }

  /**
   * Build the context-aware system prompt
   */
  private buildSystemPrompt(context?: DealershipContext): string {
    let prompt = SEOWORKS_ASSISTANT_PROMPT;

    if (context) {
      prompt += `\n\n## Current Dealership Context\n`;
      prompt += `Dealership: ${context.dealerName}\n`;
      prompt += `Package: ${context.package}\n`;
      prompt += `Primary Brand: ${context.mainBrand}\n`;
      prompt += `Target Cities: ${context.targetCities.join(', ')}\n`;
      prompt += `Target Vehicles: ${context.targetVehicleModels.join(', ')}\n`;

      if (context.recentMetrics) {
        prompt += `\n## Recent Performance Metrics\n`;
        if (context.recentMetrics.organicTraffic) {
          prompt += `Organic Traffic: ${context.recentMetrics.organicTraffic.toLocaleString()} sessions\n`;
        }
        if (context.recentMetrics.keywordRankings) {
          prompt += `Average Keyword Position: ${context.recentMetrics.keywordRankings}\n`;
        }
        if (context.recentMetrics.impressions) {
          prompt += `Search Impressions: ${context.recentMetrics.impressions.toLocaleString()}\n`;
        }
        if (context.recentMetrics.conversions) {
          prompt += `Conversions: ${context.recentMetrics.conversions}\n`;
        }
      }

      prompt += `\n${SEOWORKS_CONTEXT_PROMPT}`;
    }

    return prompt;
  }

  /**
   * Process a chat message
   */
  async processMessage(
    message: string,
    dealershipId?: string,
    conversationHistory: any[] = []
  ): Promise<{
    response: string;
    context?: DealershipContext;
  }> {
    try {
      // Get dealership context if available
      const context = dealershipId ? await this.getDealershipContext(dealershipId) : null;

      // Build messages array
      const messages: any[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(context || undefined),
        },
        ...conversationHistory,
        {
          role: 'user',
          content: message,
        },
      ];

      // Get response from OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

      return {
        response,
        context: context || undefined,
      };
    } catch (error) {
      console.error('Error processing chat message:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
      };
    }
  }

  /**
   * Generate a greeting message for a dealership
   */
  async generateGreeting(dealershipId?: string): Promise<string> {
    const context = dealershipId ? await this.getDealershipContext(dealershipId) : null;

    if (context) {
      return `Hello! I'm your SEOWerks assistant for ${context.dealerName}. You're currently on the ${context.package} package. How can I help you understand your SEO performance or strategy today?`;
    }

    return `Hello! I'm your SEOWerks assistant. I'm here to help you understand your SEO package, performance metrics, and strategy. What questions can I answer for you today?`;
  }

  /**
   * Get suggested questions based on context
   */
  async getSuggestedQuestions(dealershipId?: string): Promise<string[]> {
    const context = dealershipId ? await this.getDealershipContext(dealershipId) : null;

    const baseQuestions = [
      'What does my SEO package include?',
      'How long until I see SEO results?',
      'Why is my organic traffic down this month?',
      'What kind of content are you creating for us?',
    ];

    if (context) {
      const contextualQuestions = [
        `What's included in my ${context.package} package?`,
        `How are we ranking for ${context.targetVehicleModels[0]} in ${context.targetCities[0]}?`,
        `What SEO work was completed for ${context.dealerName} this month?`,
        `How can we improve visibility for ${context.mainBrand} vehicles?`,
      ];
      
      return contextualQuestions;
    }

    return baseQuestions;
  }
}

// Export singleton instance
export const seoWorksChatService = new SEOWorksChatService();