import { sql } from 'drizzle-orm';
import db from '../db';
import logger from '../utils/logger';
import { dealerships } from '../../shared/schema';
import type { DealershipMode } from '../../shared/schema';
import { cacheService } from './unified-cache-service';

/**
 * Service for managing dealership configuration settings
 * Especially for handling operation modes (Rylie AI vs Direct Agent)
 */
export class DealershipConfigService {
  
  /**
   * Get the current operation mode for a dealership
   */
  async getDealershipMode(dealershipId: number): Promise<DealershipMode> {
    try {
      const cacheKey = `dealership:${dealershipId}:mode`;
      
      return await cacheService.getOrSet(cacheKey, async () => {
        const result = await db.select({ 
          mode: dealerships.operation_mode 
        })
        .from(dealerships)
        .where(sql`${dealerships.id} = ${dealershipId}`)
        .limit(1);
        
        return result[0]?.mode || 'rylie_ai';
      }, { ttl: 300 });
    } catch (error) {
      logger.error('Error getting dealership mode', { error, dealershipId });
      return 'rylie_ai'; // Default fallback
    }
  }

  /**
   * Update the operation mode for a dealership
   */
  async updateDealershipMode(
    dealershipId: number, 
    mode: DealershipMode,
    config?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        operation_mode: mode,
        updated_at: new Date()
      };

      // Update mode-specific configuration if provided
      if (mode === 'rylie_ai' && config?.ai_config) {
        updateData.ai_config = JSON.stringify(config.ai_config);
      } else if (mode === 'direct_agent' && config?.agent_config) {
        updateData.agent_config = JSON.stringify(config.agent_config);
      }

      await db.update(dealerships)
        .set(updateData)
        .where(sql`${dealerships.id} = ${dealershipId}`);
      
      // Invalidate cache
      await cacheService.invalidatePattern(`dealership:${dealershipId}*`);
      
      logger.info('Dealership mode updated', { dealershipId, mode });
    } catch (error) {
      logger.error('Error updating dealership mode', { error, dealershipId, mode });
      throw error;
    }
  }

  /**
   * Get full configuration for a dealership
   */
  async getDealershipConfig(dealershipId: number): Promise<any> {
    try {
      const cacheKey = `dealership:${dealershipId}:config`;
      
      return await cacheService.getOrSet(cacheKey, async () => {
        const result = await db.select({
          mode: dealerships.operation_mode,
          aiConfig: dealerships.ai_config,
          agentConfig: dealerships.agent_config,
          leadRouting: dealerships.lead_routing,
          name: dealerships.name,
          personaName: dealerships.persona_name,
          personaTone: dealerships.persona_tone,
          welcomeMessage: dealerships.welcome_message
        })
        .from(dealerships)
        .where(sql`${dealerships.id} = ${dealershipId}`)
        .limit(1);

        if (result.length === 0) {
          throw new Error(`Dealership not found: ${dealershipId}`);
        }

        return result[0];
      }, { ttl: 300 }); // Cache for 5 minutes

    } catch (error) {
      logger.error('Error getting dealership config', { error, dealershipId });
      throw error;
    }
  }

  /**
   * Check if dealership is using Rylie AI mode
   */
  async isRylieMode(dealershipId: number): Promise<boolean> {
    const mode = await this.getDealershipMode(dealershipId);
    return mode === 'rylie_ai';
  }

  /**
   * Check if dealership is using Direct Agent mode
   */
  async isDirectAgentMode(dealershipId: number): Promise<boolean> {
    const mode = await this.getDealershipMode(dealershipId);
    return mode === 'direct_agent';
  }

  /**
   * Get working hours configuration for a dealership in direct agent mode
   */
  async getAgentWorkingHours(dealershipId: number): Promise<any> {
    try {
      const config = await this.getDealershipConfig(dealershipId);
      return config.agentConfig?.working_hours || {
        timezone: 'America/New_York',
        schedule: {
          monday: { start: '09:00', end: '17:00', enabled: true },
          tuesday: { start: '09:00', end: '17:00', enabled: true },
          wednesday: { start: '09:00', end: '17:00', enabled: true },
          thursday: { start: '09:00', end: '17:00', enabled: true },
          friday: { start: '09:00', end: '17:00', enabled: true },
          saturday: { start: '10:00', end: '16:00', enabled: true },
          sunday: { start: '12:00', end: '16:00', enabled: false }
        }
      };
    } catch (error) {
      logger.error('Error getting working hours', { error, dealershipId });
      return {};
    }
  }

  /**
   * Check if current time is within working hours for a dealership
   */
  async isWithinWorkingHours(dealershipId: number): Promise<boolean> {
    try {
      const workingHours = await this.getAgentWorkingHours(dealershipId);
      const now = new Date();
      
      // Get day of week in lowercase (monday, tuesday, etc.)
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      const todaySchedule = workingHours.schedule?.[dayOfWeek];
      if (!todaySchedule || !todaySchedule.enabled) {
        return false;
      }

      // Format current time as HH:MM
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      
      return currentTime >= todaySchedule.start && currentTime <= todaySchedule.end;
    } catch (error) {
      logger.error('Error checking working hours', { error, dealershipId });
      return true; // Default to available in case of error
    }
  }

  /**
   * Get template messages for a dealership
   */
  async getTemplateMessages(dealershipId: number): Promise<{
    greeting?: string;
    away?: string;
    queue?: string;
  }> {
    try {
      const config = await this.getDealershipConfig(dealershipId);
      
      // First check mode-specific templates
      if (config.mode === 'direct_agent' && config.agentConfig?.templates) {
        return {
          greeting: config.agentConfig.templates.greeting_message,
          away: config.agentConfig.templates.away_message,
          queue: config.agentConfig.templates.queue_message,
        };
      }
      
      // Fall back to dealership-wide welcome message
      return {
        greeting: config.welcomeMessage,
        away: "We're currently outside of our business hours. Please leave a message and we'll get back to you during our regular hours.",
        queue: "All of our agents are currently busy. You've been added to our queue and an agent will assist you shortly."
      };
    } catch (error) {
      logger.error('Error getting template messages', { error, dealershipId });
      return {};
    }
  }
}

// Export a singleton instance
export const dealershipConfigService = new DealershipConfigService();