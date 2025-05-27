import { BaseChannelHandler, ChannelConfiguration } from './base-channel-handler';
import { EmailChannelHandler } from './email-channel-handler';
import { SMSChannelHandler } from './sms-channel-handler';
import { WebChatChannelHandler } from './webchat-channel-handler';
import { CommunicationChannel } from '../channel-routing-service';
import logger from '../../utils/logger';
import { credentialsService } from '../credentials-service';

/**
 * Factory for creating and managing channel handlers
 */
export class ChannelFactory {
  private static instance: ChannelFactory;
  private handlers: Map<string, BaseChannelHandler> = new Map();

  private constructor() {}

  static getInstance(): ChannelFactory {
    if (!ChannelFactory.instance) {
      ChannelFactory.instance = new ChannelFactory();
    }
    return ChannelFactory.instance;
  }

  /**
   * Get or create a channel handler for a specific dealership and channel
   */
  async getChannelHandler(
    dealershipId: number,
    channel: CommunicationChannel
  ): Promise<BaseChannelHandler | null> {
    
    const handlerKey = `${dealershipId}-${channel}`;
    
    // Return cached handler if available
    if (this.handlers.has(handlerKey)) {
      return this.handlers.get(handlerKey)!;
    }

    try {
      // Create new handler
      const handler = await this.createChannelHandler(dealershipId, channel);
      
      if (handler) {
        this.handlers.set(handlerKey, handler);
        logger.info('Channel handler created', { dealershipId, channel });
      }

      return handler;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create channel handler', err, { 
        dealershipId, 
        channel 
      });
      return null;
    }
  }

  /**
   * Create a new channel handler instance
   */
  private async createChannelHandler(
    dealershipId: number,
    channel: CommunicationChannel
  ): Promise<BaseChannelHandler | null> {
    
    const configuration = await this.getChannelConfiguration(dealershipId, channel);
    
    if (!configuration) {
      logger.warn('No configuration found for channel', { dealershipId, channel });
      return null;
    }

    switch (channel) {
      case 'email':
        return new EmailChannelHandler(configuration);
      
      case 'sms':
        return new SMSChannelHandler(configuration);
      
      case 'web_chat':
        return new WebChatChannelHandler(configuration);
      
      default:
        logger.error('Unknown channel type', { channel });
        return null;
    }
  }

  /**
   * Get configuration for a specific channel and dealership
   */
  private async getChannelConfiguration(
    dealershipId: number,
    channel: CommunicationChannel
  ): Promise<ChannelConfiguration | null> {
    
    try {
      // Get credentials based on channel type
      let credentials: Record<string, string> | null = null;
      
      if (channel === 'email') {
        credentials = await credentialsService.getCredentials(dealershipId, 'email');
      } else if (channel === 'sms') {
        credentials = await credentialsService.getCredentials(dealershipId, 'twilio');
      }

      // Get channel-specific settings
      const settings = await this.getChannelSettings(dealershipId, channel);

      return {
        dealershipId,
        channel,
        credentials: credentials || {},
        settings: settings || {}
      };

    } catch (error) {
      logger.error('Failed to get channel configuration', error, { 
        dealershipId, 
        channel 
      });
      return null;
    }
  }

  /**
   * Get channel-specific settings from database
   */
  private async getChannelSettings(
    dealershipId: number,
    channel: CommunicationChannel
  ): Promise<Record<string, any> | null> {
    
    try {
      // This would query dealership settings for channel-specific configuration
      // For now, return default settings
      
      const defaultSettings = this.getDefaultChannelSettings(channel);
      
      // In production, this would merge with database settings:
      // const dbSettings = await db.query('SELECT settings FROM dealership_channel_settings WHERE dealership_id = ? AND channel = ?', [dealershipId, channel]);
      // return { ...defaultSettings, ...dbSettings };
      
      return defaultSettings;

    } catch (error) {
      logger.error('Failed to get channel settings', error, { 
        dealershipId, 
        channel 
      });
      return null;
    }
  }

  /**
   * Get default settings for each channel type
   */
  private getDefaultChannelSettings(channel: CommunicationChannel): Record<string, any> {
    const baseSettings = {
      dealershipName: 'Your Dealership',
      businessHours: {
        enabled: true,
        days: [1, 2, 3, 4, 5], // Monday-Friday
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'America/New_York'
      }
    };

    switch (channel) {
      case 'email':
        return {
          ...baseSettings,
          fromEmail: process.env.DEFAULT_FROM_EMAIL || 'noreply@rylie.ai',
          fromName: 'Rylie AI Assistant',
          templateTheme: 'professional',
          trackOpens: true,
          trackClicks: true
        };

      case 'sms':
        return {
          ...baseSettings,
          maxRetries: 3,
          retryDelay: 5, // minutes
          optOutKeywords: ['STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END'],
          optInKeywords: ['START', 'SUBSCRIBE']
        };

      case 'web_chat':
        return {
          ...baseSettings,
          websocket: {
            enabled: true,
            maxConnections: 100
          },
          agentName: 'Rylie AI Assistant',
          agentAvatar: null,
          welcomeMessage: 'Hello! How can I help you today?',
          offlineMessage: 'We\'re currently offline. Please leave a message and we\'ll get back to you soon.'
        };

      default:
        return baseSettings;
    }
  }

  /**
   * Refresh a channel handler (useful when credentials or settings change)
   */
  async refreshChannelHandler(
    dealershipId: number,
    channel: CommunicationChannel
  ): Promise<void> {
    
    const handlerKey = `${dealershipId}-${channel}`;
    
    // Remove cached handler
    this.handlers.delete(handlerKey);
    
    // Create new handler with updated configuration
    await this.getChannelHandler(dealershipId, channel);
    
    logger.info('Channel handler refreshed', { dealershipId, channel });
  }

  /**
   * Update configuration for an existing handler
   */
  async updateChannelConfiguration(
    dealershipId: number,
    channel: CommunicationChannel,
    newConfiguration: Partial<ChannelConfiguration>
  ): Promise<void> {
    
    const handlerKey = `${dealershipId}-${channel}`;
    const handler = this.handlers.get(handlerKey);
    
    if (handler) {
      const currentConfig = handler.getConfiguration();
      const updatedConfig = {
        ...currentConfig,
        ...newConfiguration,
        dealershipId,
        channel
      } as ChannelConfiguration;
      
      handler.updateConfiguration(updatedConfig);
      
      logger.info('Channel configuration updated', { 
        dealershipId, 
        channel,
        updatedFields: Object.keys(newConfiguration)
      });
    }
  }

  /**
   * Get all available channel types
   */
  getAvailableChannels(): CommunicationChannel[] {
    return ['email', 'sms', 'web_chat'];
  }

  /**
   * Check if a channel is supported
   */
  isChannelSupported(channel: string): channel is CommunicationChannel {
    return this.getAvailableChannels().includes(channel as CommunicationChannel);
  }

  /**
   * Get handler statistics
   */
  getHandlerStatistics(): {
    totalHandlers: number;
    handlersByChannel: Record<CommunicationChannel, number>;
    handlersByDealership: Record<number, number>;
  } {
    
    const stats = {
      totalHandlers: this.handlers.size,
      handlersByChannel: {} as Record<CommunicationChannel, number>,
      handlersByDealership: {} as Record<number, number>
    };

    // Initialize counters
    this.getAvailableChannels().forEach(channel => {
      stats.handlersByChannel[channel] = 0;
    });

    // Count handlers
    this.handlers.forEach((handler, key) => {
      const [dealershipId, channel] = key.split('-');
      const dealershipIdNum = parseInt(dealershipId);
      const channelType = channel as CommunicationChannel;

      stats.handlersByChannel[channelType]++;
      stats.handlersByDealership[dealershipIdNum] = 
        (stats.handlersByDealership[dealershipIdNum] || 0) + 1;
    });

    return stats;
  }

  /**
   * Cleanup unused handlers (for memory management)
   */
  cleanupUnusedHandlers(maxIdleTime: number = 3600000): void { // 1 hour default
    const now = Date.now();
    const handlersToRemove: string[] = [];

    this.handlers.forEach((handler, key) => {
      // In a real implementation, you'd track last usage time
      // For now, we'll just log that cleanup would happen here
      logger.debug('Handler cleanup check', { handlerKey: key });
    });

    handlersToRemove.forEach(key => {
      this.handlers.delete(key);
    });

    if (handlersToRemove.length > 0) {
      logger.info('Cleaned up unused channel handlers', { 
        count: handlersToRemove.length 
      });
    }
  }
}

// Export singleton instance
export const channelFactory = ChannelFactory.getInstance();