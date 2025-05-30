import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { AppError, ErrorCode } from '../utils/error-codes';
import { monitoringService } from './monitoring';
import { EventEmitter } from 'events';

// Redis client configuration
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  keyPrefix: 'feature_flags:'
});

// Feature flag definition interface
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetDealerships?: number[];
  targetUsers?: number[];
  rules?: FeatureFlagRule[];
  lastUpdated: string;
  updatedBy?: string;
  environment?: string;
  abTestGroup?: string;
  version: number;
  isRollback?: boolean;
}

// Complex rule interface for advanced targeting
export interface FeatureFlagRule {
  id: string;
  type: 'dealership' | 'user' | 'percentage' | 'date' | 'custom';
  condition: string;
  value: any;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'contains' | 'not_contains';
}

// Feature flag evaluation context
export interface FlagContext {
  userId?: number;
  dealershipId?: number;
  environment?: string;
  abTestGroup?: string;
  [key: string]: any;
}

// Flag change event interface
export interface FlagChangeEvent {
  flagId: string;
  previousValue: FeatureFlag | null;
  newValue: FeatureFlag;
  timestamp: string;
  changedBy: string;
}

// Feature flag names enum
export enum FeatureFlagNames {
  SANDBOX_PAUSE_RESUME = 'SANDBOX_PAUSE_RESUME',
  REDIS_WEBSOCKET_SCALING = 'REDIS_WEBSOCKET_SCALING'
}

// Default flag definitions
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  [FeatureFlagNames.SANDBOX_PAUSE_RESUME]: {
    id: FeatureFlagNames.SANDBOX_PAUSE_RESUME,
    name: 'Sandbox Pause/Resume',
    description: 'Enables the ability to pause and resume agent sandbox execution',
    enabled: false,
    rolloutPercentage: 0,
    lastUpdated: new Date().toISOString(),
    version: 1
  },
  [FeatureFlagNames.REDIS_WEBSOCKET_SCALING]: {
    id: FeatureFlagNames.REDIS_WEBSOCKET_SCALING,
    name: 'Redis WebSocket Scaling',
    description: 'Enables Redis-backed WebSocket scaling for high concurrency',
    enabled: false,
    rolloutPercentage: 0,
    lastUpdated: new Date().toISOString(),
    version: 1
  }
};

class FeatureFlagsService extends EventEmitter {
  private cache: Map<string, { flag: FeatureFlag, timestamp: number }> = new Map();
  private cacheTTL = 60 * 1000; // 1 minute cache TTL
  private initialized = false;
  private redisHealthy = true;
  private pubSubClient: Redis | null = null;

  constructor() {
    super();
    this.initPubSub();
  }

  /**
   * Initialize the feature flags service
   */
  async initialize(): Promise<void> {
    try {
      // Check if Redis is available
      await redisClient.ping();
      this.redisHealthy = true;
      logger.info('Feature Flags Service: Redis connection established');

      // Initialize default flags if they don't exist
      await this.initializeDefaultFlags();
      
      // Register metrics
      this.registerMetrics();
      
      this.initialized = true;
      logger.info('Feature Flags Service initialized successfully');
    } catch (error) {
      this.redisHealthy = false;
      logger.error('Feature Flags Service initialization failed', { error });
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Failed to initialize Feature Flags Service',
        503,
        { cause: error }
      );
    }
  }

  /**
   * Initialize Redis pub/sub for flag updates across instances
   */
  private initPubSub(): void {
    try {
      this.pubSubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        connectTimeout: 10000
      });

      // Subscribe to flag update channel
      this.pubSubClient.subscribe('feature_flags:updates');
      
      this.pubSubClient.on('message', (channel, message) => {
        if (channel === 'feature_flags:updates') {
          try {
            const { flagId } = JSON.parse(message);
            // Invalidate cache for this flag
            this.cache.delete(flagId);
            logger.debug(`Feature flag cache invalidated for ${flagId}`);
            
            // Emit event for subscribers
            this.emit('flag:updated', flagId);
          } catch (error) {
            logger.error('Error processing feature flag update message', { error });
          }
        }
      });

      this.pubSubClient.on('error', (error) => {
        logger.error('Feature Flags PubSub error', { error });
      });

      logger.info('Feature Flags PubSub initialized');
    } catch (error) {
      logger.error('Failed to initialize Feature Flags PubSub', { error });
    }
  }

  /**
   * Initialize default flags if they don't exist in Redis
   */
  private async initializeDefaultFlags(): Promise<void> {
    try {
      const flags = await this.getAllFlags();
      const missingFlags = Object.values(FeatureFlagNames).filter(
        flagName => !flags.some(flag => flag.id === flagName)
      );

      for (const flagName of missingFlags) {
        if (DEFAULT_FLAGS[flagName]) {
          await this.setFlag(DEFAULT_FLAGS[flagName]);
          logger.info(`Initialized default feature flag: ${flagName}`);
        }
      }
    } catch (error) {
      logger.error('Error initializing default feature flags', { error });
    }
  }

  /**
   * Register metrics for feature flag usage
   */
  private registerMetrics(): void {
    monitoringService.registerGauge(
      'feature_flags_total',
      'Total number of feature flags',
      ['status']
    );

    monitoringService.registerCounter(
      'feature_flag_evaluations_total',
      'Total number of feature flag evaluations',
      ['flag_id', 'result']
    );

    monitoringService.registerHistogram(
      'feature_flag_evaluation_duration_seconds',
      'Duration of feature flag evaluations in seconds',
      ['flag_id'],
      [0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
    );

    // Update metrics on initialization
    this.updateMetrics();
  }

  /**
   * Update feature flag metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      const flags = await this.getAllFlags();
      
      const enabledCount = flags.filter(flag => flag.enabled).length;
      const disabledCount = flags.length - enabledCount;
      
      monitoringService.setGauge('feature_flags_total', enabledCount, ['enabled']);
      monitoringService.setGauge('feature_flags_total', disabledCount, ['disabled']);
    } catch (error) {
      logger.error('Error updating feature flag metrics', { error });
    }
  }

  /**
   * Get a feature flag by ID
   */
  async getFlag(flagId: string): Promise<FeatureFlag | null> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.cache.get(flagId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.flag;
    }

    try {
      // Fallback to Redis
      if (this.redisHealthy) {
        const flagJson = await redisClient.get(flagId);
        if (flagJson) {
          const flag = JSON.parse(flagJson) as FeatureFlag;
          // Update cache
          this.cache.set(flagId, { flag, timestamp: Date.now() });
          return flag;
        }
      }
      
      // Fallback to default if available
      if (DEFAULT_FLAGS[flagId]) {
        return DEFAULT_FLAGS[flagId];
      }
      
      return null;
    } catch (error) {
      logger.error('Error retrieving feature flag', { flagId, error });
      
      // Fallback to cache even if expired
      if (cached) {
        logger.warn('Using expired cache for feature flag due to Redis error', { flagId });
        return cached.flag;
      }
      
      // Last resort fallback to default
      if (DEFAULT_FLAGS[flagId]) {
        return DEFAULT_FLAGS[flagId];
      }
      
      return null;
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    this.ensureInitialized();
    
    try {
      if (this.redisHealthy) {
        // Get all keys with the feature_flags: prefix
        const keys = await redisClient.keys('*');
        
        if (keys.length === 0) {
          return Object.values(DEFAULT_FLAGS);
        }
        
        const flagJsons = await redisClient.mget(keys);
        const flags = flagJsons
          .filter(Boolean)
          .map(json => JSON.parse(json as string) as FeatureFlag);
        
        return flags;
      }
      
      // Fallback to defaults
      return Object.values(DEFAULT_FLAGS);
    } catch (error) {
      logger.error('Error retrieving all feature flags', { error });
      return Object.values(DEFAULT_FLAGS);
    }
  }

  /**
   * Set or update a feature flag
   */
  async setFlag(flag: FeatureFlag, updatedBy?: string): Promise<FeatureFlag> {
    this.ensureInitialized();
    
    try {
      // Get existing flag to track changes
      const existingFlag = await this.getFlag(flag.id);
      
      // Update flag metadata
      const updatedFlag: FeatureFlag = {
        ...flag,
        lastUpdated: new Date().toISOString(),
        updatedBy: updatedBy || 'system',
        version: existingFlag ? existingFlag.version + 1 : 1
      };
      
      if (this.redisHealthy) {
        // Save to Redis
        await redisClient.set(
          flag.id,
          JSON.stringify(updatedFlag),
          'EX',
          60 * 60 * 24 * 30 // 30 days expiry
        );
        
        // Publish update notification
        await redisClient.publish(
          'feature_flags:updates',
          JSON.stringify({ flagId: flag.id })
        );
        
        // Log the change
        this.logFlagChange({
          flagId: flag.id,
          previousValue: existingFlag,
          newValue: updatedFlag,
          timestamp: updatedFlag.lastUpdated,
          changedBy: updatedFlag.updatedBy || 'system'
        });
        
        // Update cache
        this.cache.set(flag.id, { flag: updatedFlag, timestamp: Date.now() });
        
        // Update metrics
        this.updateMetrics();
        
        return updatedFlag;
      }
      
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Redis is unavailable, cannot update feature flag',
        503
      );
    } catch (error) {
      logger.error('Error setting feature flag', { flagId: flag.id, error });
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to update feature flag: ${flag.id}`,
        500,
        { cause: error }
      );
    }
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      if (this.redisHealthy) {
        const deleted = await redisClient.del(flagId);
        
        if (deleted) {
          // Publish update notification
          await redisClient.publish(
            'feature_flags:updates',
            JSON.stringify({ flagId })
          );
          
          // Remove from cache
          this.cache.delete(flagId);
          
          // Update metrics
          this.updateMetrics();
          
          logger.info(`Feature flag deleted: ${flagId}`);
          return true;
        }
        
        return false;
      }
      
      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Redis is unavailable, cannot delete feature flag',
        503
      );
    } catch (error) {
      logger.error('Error deleting feature flag', { flagId, error });
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        `Failed to delete feature flag: ${flagId}`,
        500,
        { cause: error }
      );
    }
  }

  /**
   * Check if a feature flag is enabled for a given context
   */
  async isEnabled(flagId: string, context: FlagContext = {}): Promise<boolean> {
    const startTime = process.hrtime();
    
    try {
      const flag = await this.getFlag(flagId);
      
      if (!flag) {
        this.recordEvaluation(flagId, 'not_found', startTime);
        return false;
      }
      
      // If flag is disabled, short-circuit
      if (!flag.enabled) {
        this.recordEvaluation(flagId, 'disabled', startTime);
        return false;
      }
      
      // Check environment override
      if (flag.environment && context.environment && flag.environment !== context.environment) {
        this.recordEvaluation(flagId, 'environment_mismatch', startTime);
        return false;
      }
      
      // Check A/B test group
      if (flag.abTestGroup && context.abTestGroup && flag.abTestGroup !== context.abTestGroup) {
        this.recordEvaluation(flagId, 'ab_test_mismatch', startTime);
        return false;
      }
      
      // Check dealership targeting
      if (flag.targetDealerships && flag.targetDealerships.length > 0) {
        if (!context.dealershipId || !flag.targetDealerships.includes(context.dealershipId)) {
          this.recordEvaluation(flagId, 'dealership_mismatch', startTime);
          return false;
        }
      }
      
      // Check user targeting
      if (flag.targetUsers && flag.targetUsers.length > 0) {
        if (!context.userId || !flag.targetUsers.includes(context.userId)) {
          this.recordEvaluation(flagId, 'user_mismatch', startTime);
          return false;
        }
      }
      
      // Check complex rules
      if (flag.rules && flag.rules.length > 0) {
        const allRulesPassed = flag.rules.every(rule => this.evaluateRule(rule, context));
        if (!allRulesPassed) {
          this.recordEvaluation(flagId, 'rules_failed', startTime);
          return false;
        }
      }
      
      // Check percentage rollout
      if (flag.rolloutPercentage < 100) {
        const hash = this.getConsistentHash(flagId, context);
        const normalizedHash = hash % 100;
        
        if (normalizedHash >= flag.rolloutPercentage) {
          this.recordEvaluation(flagId, 'percentage_rollout', startTime);
          return false;
        }
      }
      
      // All checks passed, flag is enabled
      this.recordEvaluation(flagId, 'enabled', startTime);
      return true;
    } catch (error) {
      logger.error('Error evaluating feature flag', { flagId, error });
      this.recordEvaluation(flagId, 'error', startTime);
      return false;
    }
  }

  /**
   * Record metrics for flag evaluation
   */
  private recordEvaluation(flagId: string, result: string, startTime: [number, number]): void {
    try {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      
      monitoringService.incrementCounter('feature_flag_evaluations_total', 1, [flagId, result]);
      monitoringService.observeHistogram('feature_flag_evaluation_duration_seconds', duration, [flagId]);
    } catch (error) {
      logger.error('Error recording feature flag evaluation metrics', { error });
    }
  }

  /**
   * Evaluate a complex flag rule
   */
  private evaluateRule(rule: FeatureFlagRule, context: FlagContext): boolean {
    try {
      const contextValue = context[rule.condition];
      
      // If the context doesn't have the value we're checking, rule fails
      if (contextValue === undefined) {
        return false;
      }
      
      switch (rule.operator) {
        case 'equals':
          return contextValue === rule.value;
        case 'not_equals':
          return contextValue !== rule.value;
        case 'greater_than':
          return contextValue > rule.value;
        case 'less_than':
          return contextValue < rule.value;
        case 'in':
          return Array.isArray(rule.value) && rule.value.includes(contextValue);
        case 'not_in':
          return Array.isArray(rule.value) && !rule.value.includes(contextValue);
        case 'contains':
          return String(contextValue).includes(String(rule.value));
        case 'not_contains':
          return !String(contextValue).includes(String(rule.value));
        default:
          logger.warn(`Unknown rule operator: ${rule.operator}`);
          return false;
      }
    } catch (error) {
      logger.error('Error evaluating feature flag rule', { rule, error });
      return false;
    }
  }

  /**
   * Get a consistent hash for percentage-based rollout
   */
  private getConsistentHash(flagId: string, context: FlagContext): number {
    // Create a deterministic string based on the flag ID and user/dealership ID
    const hashInput = `${flagId}:${context.userId || ''}:${context.dealershipId || ''}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      hash = ((hash << 5) - hash) + hashInput.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Ensure positive value
    return Math.abs(hash);
  }

  /**
   * Create a rollback version of a flag
   */
  async createRollbackVersion(flagId: string): Promise<FeatureFlag | null> {
    try {
      const flag = await this.getFlag(flagId);
      
      if (!flag) {
        logger.warn(`Cannot create rollback for non-existent flag: ${flagId}`);
        return null;
      }
      
      const rollbackId = `${flagId}_rollback_${flag.version}`;
      
      const rollbackFlag: FeatureFlag = {
        ...flag,
        id: rollbackId,
        name: `${flag.name} (Rollback v${flag.version})`,
        isRollback: true,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'system_rollback'
      };
      
      await this.setFlag(rollbackFlag);
      logger.info(`Created rollback version for flag: ${flagId}`, { rollbackId });
      
      return rollbackFlag;
    } catch (error) {
      logger.error('Error creating rollback version', { flagId, error });
      return null;
    }
  }

  /**
   * Restore a flag from a rollback version
   */
  async restoreFromRollback(rollbackId: string): Promise<FeatureFlag | null> {
    try {
      const rollbackFlag = await this.getFlag(rollbackId);
      
      if (!rollbackFlag || !rollbackFlag.isRollback) {
        logger.warn(`Invalid rollback flag: ${rollbackId}`);
        return null;
      }
      
      // Extract original flag ID from rollback ID
      const originalFlagId = rollbackId.split('_rollback_')[0];
      
      // Get current flag
      const currentFlag = await this.getFlag(originalFlagId);
      
      if (!currentFlag) {
        logger.warn(`Original flag no longer exists: ${originalFlagId}`);
        return null;
      }
      
      // Create restored flag
      const restoredFlag: FeatureFlag = {
        ...rollbackFlag,
        id: originalFlagId,
        name: currentFlag.name,
        isRollback: false,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'system_restore',
        version: currentFlag.version + 1
      };
      
      await this.setFlag(restoredFlag);
      logger.info(`Restored flag from rollback: ${originalFlagId}`, { rollbackId });
      
      return restoredFlag;
    } catch (error) {
      logger.error('Error restoring from rollback', { rollbackId, error });
      return null;
    }
  }

  /**
   * Log feature flag changes for audit trail
   */
  private async logFlagChange(event: FlagChangeEvent): Promise<void> {
    try {
      const logKey = `feature_flags:audit:${event.flagId}:${Date.now()}:${uuidv4()}`;
      
      await redisClient.set(
        logKey,
        JSON.stringify(event),
        'EX',
        60 * 60 * 24 * 90 // 90 days retention
      );
      
      logger.info('Feature flag change logged', {
        flagId: event.flagId,
        changedBy: event.changedBy,
        enabled: event.newValue.enabled,
        rolloutPercentage: event.newValue.rolloutPercentage
      });
    } catch (error) {
      logger.error('Error logging feature flag change', { error });
    }
  }

  /**
   * Get audit trail for a feature flag
   */
  async getAuditTrail(flagId: string, limit = 100): Promise<FlagChangeEvent[]> {
    try {
      const keys = await redisClient.keys(`feature_flags:audit:${flagId}:*`);
      
      // Sort keys by timestamp (descending)
      keys.sort().reverse();
      
      // Limit the number of results
      const limitedKeys = keys.slice(0, limit);
      
      if (limitedKeys.length === 0) {
        return [];
      }
      
      const logs = await redisClient.mget(limitedKeys);
      
      return logs
        .filter(Boolean)
        .map(log => JSON.parse(log as string) as FlagChangeEvent);
    } catch (error) {
      logger.error('Error retrieving feature flag audit trail', { flagId, error });
      return [];
    }
  }

  /**
   * Configure a feature flag for gradual rollout
   */
  async configureGradualRollout(
    flagId: string,
    stages: { percentage: number; durationDays: number }[],
    startDate?: Date
  ): Promise<boolean> {
    try {
      const flag = await this.getFlag(flagId);
      
      if (!flag) {
        logger.warn(`Cannot configure rollout for non-existent flag: ${flagId}`);
        return false;
      }
      
      const start = startDate || new Date();
      let currentDate = new Date(start);
      
      // Schedule each rollout stage
      for (const stage of stages) {
        const scheduledDate = new Date(currentDate);
        
        // Schedule the job
        const jobKey = `feature_flags:scheduled:${flagId}:${scheduledDate.getTime()}`;
        await redisClient.set(
          jobKey,
          JSON.stringify({
            flagId,
            percentage: stage.percentage,
            scheduledFor: scheduledDate.toISOString()
          }),
          'EX',
          60 * 60 * 24 * (stage.durationDays + 7) // TTL: stage duration + 7 days buffer
        );
        
        // Move to next stage date
        currentDate.setDate(currentDate.getDate() + stage.durationDays);
      }
      
      logger.info(`Configured gradual rollout for flag: ${flagId}`, {
        stages,
        startDate: start.toISOString()
      });
      
      return true;
    } catch (error) {
      logger.error('Error configuring gradual rollout', { flagId, error });
      return false;
    }
  }

  /**
   * Invalidate the cache for a specific flag
   */
  invalidateCache(flagId: string): void {
    this.cache.delete(flagId);
    logger.debug(`Cache invalidated for flag: ${flagId}`);
  }

  /**
   * Invalidate the entire cache
   */
  invalidateAllCache(): void {
    this.cache.clear();
    logger.debug('All feature flag cache invalidated');
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      logger.warn('Feature Flags Service used before initialization, initializing now');
      this.initialize().catch(error => {
        logger.error('Failed to initialize Feature Flags Service on demand', { error });
      });
    }
  }

  /**
   * Gracefully shutdown the service
   */
  async shutdown(): Promise<void> {
    try {
      if (this.pubSubClient) {
        await this.pubSubClient.quit();
      }
      await redisClient.quit();
      logger.info('Feature Flags Service shut down successfully');
    } catch (error) {
      logger.error('Error shutting down Feature Flags Service', { error });
    }
  }
}

// Export a singleton instance
export const featureFlagsService = new FeatureFlagsService();
export default featureFlagsService;
