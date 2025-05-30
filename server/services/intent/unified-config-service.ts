import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import chokidar from 'chokidar';
import NodeCache from 'node-cache';
import db from '../../db';
import { sql } from 'drizzle-orm';
import { monitoringService } from '../monitoring';
import crypto from 'crypto';

/**
 * Configuration source type
 */
export enum ConfigSource {
  FILE = 'file',
  DATABASE = 'database',
  MEMORY = 'memory'
}

/**
 * Configuration environment type
 */
export enum ConfigEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

/**
 * Configuration change type
 */
export enum ConfigChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted'
}

/**
 * Configuration entry interface
 */
export interface ConfigEntry {
  id: string;
  dealershipId: number;
  namespace: string;
  key: string;
  value: any;
  source: ConfigSource;
  version: number;
  environment: ConfigEnvironment;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  description?: string;
  isActive: boolean;
}

/**
 * Configuration change log entry interface
 */
export interface ConfigChangeLogEntry {
  id: string;
  configId: string;
  dealershipId: number;
  namespace: string;
  key: string;
  oldValue: any;
  newValue: any;
  changeType: ConfigChangeType;
  version: number;
  environment: ConfigEnvironment;
  timestamp: Date;
  userId?: string;
  reason?: string;
}

/**
 * Configuration template interface
 */
export interface ConfigTemplate {
  namespace: string;
  description: string;
  schema: z.ZodType<any>;
  defaults: any;
  examples: any[];
}

/**
 * Feature flag interface
 */
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  dealershipOverrides: Record<number, boolean>;
  environment: ConfigEnvironment;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * A/B test configuration interface
 */
export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  variants: {
    id: string;
    name: string;
    percentage: number;
    config: any;
  }[];
  dealershipOverrides: Record<number, string>; // dealershipId -> variantId
  environment: ConfigEnvironment;
  startedAt: Date;
  endsAt?: Date;
  metrics: string[];
}

/**
 * Unified Config Service - Central configuration management system
 * 
 * Provides a comprehensive configuration management system with support for
 * hot-reloadable YAML files, database storage, caching, validation, versioning,
 * environment-specific configs, and more.
 */
export class UnifiedConfigService extends EventEmitter {
  // Configuration cache
  private cache: NodeCache;
  
  // File watchers
  private fileWatchers: Map<string, chokidar.FSWatcher> = new Map();
  
  // Configuration templates
  private templates: Map<string, ConfigTemplate> = new Map();
  
  // Feature flags
  private featureFlags: Map<string, FeatureFlag> = new Map();
  
  // A/B tests
  private abTests: Map<string, ABTestConfig> = new Map();
  
  // Configuration paths
  private configPaths: {
    base: string;
    global: string;
    dealerships: string;
    templates: string;
    featureFlags: string;
    abTests: string;
  };
  
  // Current environment
  private environment: ConfigEnvironment;
  
  // Database enabled flag
  private databaseEnabled: boolean = false;
  
  // Configuration reload interval (in milliseconds)
  private reloadIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  
  // Reload timer
  private reloadTimer: NodeJS.Timeout | null = null;
  
  constructor(private namespace: string) {
    super();
    
    // Initialize cache with 1 hour TTL and 10,000 max items
    this.cache = new NodeCache({
      stdTTL: 3600,
      maxKeys: 10000,
      checkperiod: 600
    });
    
    // Set environment from env var or default to development
    this.environment = this.getEnvironment();
    
    // Set configuration paths
    this.configPaths = {
      base: process.env.CONFIG_PATH || path.join(process.cwd(), 'configs'),
      global: path.join(process.env.CONFIG_PATH || path.join(process.cwd(), 'configs'), 'global'),
      dealerships: path.join(process.env.CONFIG_PATH || path.join(process.cwd(), 'configs'), 'dealerships'),
      templates: path.join(process.env.CONFIG_PATH || path.join(process.cwd(), 'configs'), 'templates'),
      featureFlags: path.join(process.env.CONFIG_PATH || path.join(process.cwd(), 'configs'), 'feature-flags'),
      abTests: path.join(process.env.CONFIG_PATH || path.join(process.cwd(), 'configs'), 'ab-tests')
    };
    
    // Check if database is enabled
    this.databaseEnabled = process.env.CONFIG_DB_ENABLED === 'true';
    
    logger.info('Unified Config Service initialized', {
      namespace: this.namespace,
      environment: this.environment,
      databaseEnabled: this.databaseEnabled,
      configPaths: this.configPaths
    });
  }
  
  /**
   * Initialize the configuration service
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Unified Config Service', {
        namespace: this.namespace
      });
      
      // Register metrics
      monitoringService.registerMetric('config_service_reloads_total', 'counter');
      monitoringService.registerMetric('config_service_cache_hits', 'counter');
      monitoringService.registerMetric('config_service_cache_misses', 'counter');
      monitoringService.registerMetric('config_service_errors_total', 'counter');
      
      // Create base directories if they don't exist
      this.createDirectories();
      
      // Load configuration templates
      await this.loadConfigTemplates();
      
      // Load feature flags
      await this.loadFeatureFlags();
      
      // Load A/B tests
      await this.loadABTests();
      
      // Load global configurations
      await this.loadGlobalConfigs();
      
      // Set up file watchers
      this.setupFileWatchers();
      
      // Schedule periodic reload
      this.scheduleConfigReload();
      
      logger.info('Unified Config Service initialized successfully', {
        namespace: this.namespace,
        templatesLoaded: this.templates.size,
        featureFlagsLoaded: this.featureFlags.size,
        abTestsLoaded: this.abTests.size
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to initialize Unified Config Service', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Get configuration for a specific dealership
   */
  public async getDealershipConfig(dealershipId: number): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `${this.namespace}:dealership:${dealershipId}`;
      const cachedConfig = this.cache.get(cacheKey);
      
      if (cachedConfig) {
        monitoringService.incrementMetric('config_service_cache_hits');
        return cachedConfig;
      }
      
      monitoringService.incrementMetric('config_service_cache_misses');
      
      // Merge global and dealership-specific configurations
      const globalConfig = await this.getGlobalConfig();
      const dealershipConfig = await this.loadDealershipConfig(dealershipId);
      
      // Deep merge configurations
      const mergedConfig = this.deepMerge(globalConfig, dealershipConfig);
      
      // Apply environment-specific overrides
      const envConfig = mergedConfig[this.environment.toLowerCase()] || {};
      const baseConfig = { ...mergedConfig };
      delete baseConfig.development;
      delete baseConfig.staging;
      delete baseConfig.production;
      
      const finalConfig = this.deepMerge(baseConfig, envConfig);
      
      // Apply A/B test variants if applicable
      const configWithABTests = await this.applyABTestVariants(finalConfig, dealershipId);
      
      // Cache the result
      this.cache.set(cacheKey, configWithABTests);
      
      return configWithABTests;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get dealership configuration', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      // Return empty object as fallback
      return {};
    }
  }
  
  /**
   * Get global configuration
   */
  public async getGlobalConfig(): Promise<any> {
    try {
      // Check cache first
      const cacheKey = `${this.namespace}:global`;
      const cachedConfig = this.cache.get(cacheKey);
      
      if (cachedConfig) {
        monitoringService.incrementMetric('config_service_cache_hits');
        return cachedConfig;
      }
      
      monitoringService.incrementMetric('config_service_cache_misses');
      
      // Load global configuration
      const globalConfig = await this.loadGlobalConfigs();
      
      // Cache the result
      this.cache.set(cacheKey, globalConfig);
      
      return globalConfig;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get global configuration', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      // Return empty object as fallback
      return {};
    }
  }
  
  /**
   * Get feature flag status
   */
  public isFeatureEnabled(flagName: string, dealershipId?: number): boolean {
    try {
      // Get feature flag
      const flag = this.featureFlags.get(flagName);
      
      if (!flag) {
        logger.warn('Feature flag not found', {
          flagName,
          namespace: this.namespace
        });
        return false;
      }
      
      // Check if flag is enabled globally
      if (!flag.isEnabled) {
        return false;
      }
      
      // Check if there's a dealership override
      if (dealershipId !== undefined && flag.dealershipOverrides[dealershipId] !== undefined) {
        return flag.dealershipOverrides[dealershipId];
      }
      
      // Check if flag is expired
      if (flag.expiresAt && flag.expiresAt < new Date()) {
        return false;
      }
      
      // Check rollout percentage
      if (dealershipId !== undefined && flag.rolloutPercentage < 100) {
        // Use deterministic hashing for consistent assignment
        const hash = this.hashDealershipId(dealershipId, flagName);
        return hash < flag.rolloutPercentage;
      }
      
      return flag.isEnabled;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to check feature flag', {
        error: err.message,
        namespace: this.namespace,
        flagName
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      // Default to disabled on error
      return false;
    }
  }
  
  /**
   * Get A/B test variant for a dealership
   */
  public getABTestVariant(testName: string, dealershipId: number): string | null {
    try {
      // Get A/B test
      const test = this.abTests.get(testName);
      
      if (!test || !test.isActive) {
        return null;
      }
      
      // Check if test is expired
      if (test.endsAt && test.endsAt < new Date()) {
        return null;
      }
      
      // Check if there's a dealership override
      if (test.dealershipOverrides[dealershipId]) {
        return test.dealershipOverrides[dealershipId];
      }
      
      // Use deterministic hashing for consistent variant assignment
      const hash = this.hashDealershipId(dealershipId, testName);
      let cumulativePercentage = 0;
      
      for (const variant of test.variants) {
        cumulativePercentage += variant.percentage;
        if (hash < cumulativePercentage) {
          return variant.id;
        }
      }
      
      // Default to first variant if no match (should not happen with proper percentages)
      return test.variants[0]?.id || null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get A/B test variant', {
        error: err.message,
        namespace: this.namespace,
        testName,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      return null;
    }
  }
  
  /**
   * Clear cache for a specific dealership
   */
  public clearCache(dealershipId?: number): void {
    if (dealershipId !== undefined) {
      const cacheKey = `${this.namespace}:dealership:${dealershipId}`;
      this.cache.del(cacheKey);
      logger.info('Cleared cache for dealership', {
        namespace: this.namespace,
        dealershipId
      });
    } else {
      this.cache.flushAll();
      logger.info('Cleared all cache', {
        namespace: this.namespace
      });
    }
  }
  
  /**
   * Get configuration template
   */
  public getConfigTemplate(templateName: string): ConfigTemplate | undefined {
    return this.templates.get(templateName);
  }
  
  /**
   * Get all configuration templates
   */
  public getAllConfigTemplates(): Map<string, ConfigTemplate> {
    return new Map(this.templates);
  }
  
  /**
   * Get all feature flags
   */
  public getAllFeatureFlags(): Map<string, FeatureFlag> {
    return new Map(this.featureFlags);
  }
  
  /**
   * Get all A/B tests
   */
  public getAllABTests(): Map<string, ABTestConfig> {
    return new Map(this.abTests);
  }
  
  /**
   * Update feature flag
   */
  public async updateFeatureFlag(flag: FeatureFlag): Promise<void> {
    try {
      // Validate flag
      if (!flag.id || !flag.name) {
        throw new Error('Invalid feature flag: missing id or name');
      }
      
      // Update in-memory map
      this.featureFlags.set(flag.name, {
        ...flag,
        updatedAt: new Date()
      });
      
      // Save to file
      await this.saveFeatureFlag(flag);
      
      // Save to database if enabled
      if (this.databaseEnabled) {
        await this.saveFeatureFlagToDatabase(flag);
      }
      
      // Log change
      logger.info('Feature flag updated', {
        namespace: this.namespace,
        flagName: flag.name,
        isEnabled: flag.isEnabled,
        rolloutPercentage: flag.rolloutPercentage
      });
      
      // Emit event
      this.emit('feature.flag.updated', flag);
      
      // Clear cache
      this.clearCache();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update feature flag', {
        error: err.message,
        namespace: this.namespace,
        flagName: flag.name
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Update A/B test
   */
  public async updateABTest(test: ABTestConfig): Promise<void> {
    try {
      // Validate test
      if (!test.id || !test.name || !test.variants || test.variants.length === 0) {
        throw new Error('Invalid A/B test: missing id, name, or variants');
      }
      
      // Validate variant percentages sum to 100
      const totalPercentage = test.variants.reduce((sum, variant) => sum + variant.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.1) {
        throw new Error(`Variant percentages must sum to 100, got ${totalPercentage}`);
      }
      
      // Update in-memory map
      this.abTests.set(test.name, test);
      
      // Save to file
      await this.saveABTest(test);
      
      // Save to database if enabled
      if (this.databaseEnabled) {
        await this.saveABTestToDatabase(test);
      }
      
      // Log change
      logger.info('A/B test updated', {
        namespace: this.namespace,
        testName: test.name,
        isActive: test.isActive,
        variantCount: test.variants.length
      });
      
      // Emit event
      this.emit('ab.test.updated', test);
      
      // Clear cache
      this.clearCache();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update A/B test', {
        error: err.message,
        namespace: this.namespace,
        testName: test.name
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Update dealership configuration
   */
  public async updateDealershipConfig(dealershipId: number, config: any, userId?: string, reason?: string): Promise<void> {
    try {
      // Get current configuration
      const currentConfig = await this.getDealershipConfig(dealershipId);
      
      // Create change log entry
      const changeLogEntry: ConfigChangeLogEntry = {
        id: crypto.randomUUID(),
        configId: `${this.namespace}:dealership:${dealershipId}`,
        dealershipId,
        namespace: this.namespace,
        key: 'config',
        oldValue: currentConfig,
        newValue: config,
        changeType: ConfigChangeType.UPDATED,
        version: 1, // Would be incremented in a real implementation
        environment: this.environment,
        timestamp: new Date(),
        userId,
        reason
      };
      
      // Save to file
      await this.saveDealershipConfig(dealershipId, config);
      
      // Save to database if enabled
      if (this.databaseEnabled) {
        await this.saveDealershipConfigToDatabase(dealershipId, config, changeLogEntry);
      }
      
      // Log change
      logger.info('Dealership configuration updated', {
        namespace: this.namespace,
        dealershipId,
        userId,
        reason
      });
      
      // Emit event
      this.emit('config.updated', dealershipId);
      
      // Clear cache for this dealership
      this.clearCache(dealershipId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update dealership configuration', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Rollback dealership configuration to a previous version
   */
  public async rollbackDealershipConfig(dealershipId: number, version: number, userId?: string, reason?: string): Promise<void> {
    try {
      // This would get the configuration at the specified version from database
      // For now, we'll just log that it would be rolled back
      logger.info('Would rollback dealership configuration', {
        namespace: this.namespace,
        dealershipId,
        version,
        userId,
        reason
      });
      
      // In a real implementation, this would:
      // 1. Get the configuration at the specified version from database
      // 2. Save it as the current configuration
      // 3. Create a change log entry
      // 4. Clear cache for this dealership
      // 5. Emit event
      
      // Clear cache for this dealership
      this.clearCache(dealershipId);
      
      // Emit event
      this.emit('config.rollback', {
        dealershipId,
        version,
        userId,
        reason
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to rollback dealership configuration', {
        error: err.message,
        namespace: this.namespace,
        dealershipId,
        version
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Get configuration change history for a dealership
   */
  public async getConfigChangeHistory(dealershipId: number): Promise<ConfigChangeLogEntry[]> {
    try {
      // This would get the change history from database
      // For now, we'll just return an empty array
      return [];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get configuration change history', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      return [];
    }
  }
  
  /**
   * Create directories for configuration files
   */
  private createDirectories(): void {
    try {
      // Create base directory
      if (!fs.existsSync(this.configPaths.base)) {
        fs.mkdirSync(this.configPaths.base, { recursive: true });
      }
      
      // Create global directory
      if (!fs.existsSync(this.configPaths.global)) {
        fs.mkdirSync(this.configPaths.global, { recursive: true });
      }
      
      // Create dealerships directory
      if (!fs.existsSync(this.configPaths.dealerships)) {
        fs.mkdirSync(this.configPaths.dealerships, { recursive: true });
      }
      
      // Create templates directory
      if (!fs.existsSync(this.configPaths.templates)) {
        fs.mkdirSync(this.configPaths.templates, { recursive: true });
      }
      
      // Create feature flags directory
      if (!fs.existsSync(this.configPaths.featureFlags)) {
        fs.mkdirSync(this.configPaths.featureFlags, { recursive: true });
      }
      
      // Create A/B tests directory
      if (!fs.existsSync(this.configPaths.abTests)) {
        fs.mkdirSync(this.configPaths.abTests, { recursive: true });
      }
      
      // Create namespace-specific directories
      const namespacePaths = [
        path.join(this.configPaths.global, this.namespace),
        path.join(this.configPaths.templates, this.namespace),
        path.join(this.configPaths.featureFlags, this.namespace),
        path.join(this.configPaths.abTests, this.namespace)
      ];
      
      for (const dirPath of namespacePaths) {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
      
      logger.info('Configuration directories created', {
        namespace: this.namespace
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create configuration directories', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Set up file watchers for configuration files
   */
  private setupFileWatchers(): void {
    try {
      // Watch global configuration directory
      const globalWatcher = chokidar.watch(
        path.join(this.configPaths.global, this.namespace, '*.yml'),
        { persistent: true }
      );
      
      globalWatcher
        .on('add', this.handleGlobalConfigChange.bind(this))
        .on('change', this.handleGlobalConfigChange.bind(this))
        .on('unlink', this.handleGlobalConfigChange.bind(this));
      
      this.fileWatchers.set('global', globalWatcher);
      
      // Watch dealership configuration directory
      const dealershipWatcher = chokidar.watch(
        path.join(this.configPaths.dealerships, '*', this.namespace, '*.yml'),
        { persistent: true }
      );
      
      dealershipWatcher
        .on('add', this.handleDealershipConfigChange.bind(this))
        .on('change', this.handleDealershipConfigChange.bind(this))
        .on('unlink', this.handleDealershipConfigChange.bind(this));
      
      this.fileWatchers.set('dealerships', dealershipWatcher);
      
      // Watch feature flags directory
      const featureFlagsWatcher = chokidar.watch(
        path.join(this.configPaths.featureFlags, this.namespace, '*.yml'),
        { persistent: true }
      );
      
      featureFlagsWatcher
        .on('add', this.handleFeatureFlagChange.bind(this))
        .on('change', this.handleFeatureFlagChange.bind(this))
        .on('unlink', this.handleFeatureFlagChange.bind(this));
      
      this.fileWatchers.set('featureFlags', featureFlagsWatcher);
      
      // Watch A/B tests directory
      const abTestsWatcher = chokidar.watch(
        path.join(this.configPaths.abTests, this.namespace, '*.yml'),
        { persistent: true }
      );
      
      abTestsWatcher
        .on('add', this.handleABTestChange.bind(this))
        .on('change', this.handleABTestChange.bind(this))
        .on('unlink', this.handleABTestChange.bind(this));
      
      this.fileWatchers.set('abTests', abTestsWatcher);
      
      logger.info('File watchers set up', {
        namespace: this.namespace
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to set up file watchers', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Handle global configuration file change
   */
  private handleGlobalConfigChange(filePath: string): void {
    try {
      logger.info('Global configuration file changed', {
        namespace: this.namespace,
        filePath
      });
      
      // Clear cache
      this.clearCache();
      
      // Reload global configurations
      this.loadGlobalConfigs().catch(err => {
        logger.error('Failed to reload global configurations', {
          error: err.message,
          namespace: this.namespace
        });
      });
      
      // Emit event
      this.emit('config.global.changed', filePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle global configuration file change', {
        error: err.message,
        namespace: this.namespace,
        filePath
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Handle dealership configuration file change
   */
  private handleDealershipConfigChange(filePath: string): void {
    try {
      // Extract dealership ID from path
      const match = filePath.match(/\/dealerships\/(\d+)\//);
      if (!match) {
        logger.warn('Could not extract dealership ID from path', {
          namespace: this.namespace,
          filePath
        });
        return;
      }
      
      const dealershipId = parseInt(match[1], 10);
      
      logger.info('Dealership configuration file changed', {
        namespace: this.namespace,
        dealershipId,
        filePath
      });
      
      // Clear cache for this dealership
      this.clearCache(dealershipId);
      
      // Emit event
      this.emit('config.updated', dealershipId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle dealership configuration file change', {
        error: err.message,
        namespace: this.namespace,
        filePath
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Handle feature flag file change
   */
  private handleFeatureFlagChange(filePath: string): void {
    try {
      logger.info('Feature flag file changed', {
        namespace: this.namespace,
        filePath
      });
      
      // Reload feature flags
      this.loadFeatureFlags().catch(err => {
        logger.error('Failed to reload feature flags', {
          error: err.message,
          namespace: this.namespace
        });
      });
      
      // Clear cache
      this.clearCache();
      
      // Emit event
      this.emit('feature.flags.changed', filePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle feature flag file change', {
        error: err.message,
        namespace: this.namespace,
        filePath
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Handle A/B test file change
   */
  private handleABTestChange(filePath: string): void {
    try {
      logger.info('A/B test file changed', {
        namespace: this.namespace,
        filePath
      });
      
      // Reload A/B tests
      this.loadABTests().catch(err => {
        logger.error('Failed to reload A/B tests', {
          error: err.message,
          namespace: this.namespace
        });
      });
      
      // Clear cache
      this.clearCache();
      
      // Emit event
      this.emit('ab.tests.changed', filePath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle A/B test file change', {
        error: err.message,
        namespace: this.namespace,
        filePath
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Schedule periodic configuration reload
   */
  private scheduleConfigReload(): void {
    // Clear existing timer if any
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
    }
    
    // Schedule new timer
    this.reloadTimer = setInterval(async () => {
      try {
        logger.info('Reloading configurations', {
          namespace: this.namespace
        });
        
        // Reload configurations
        await Promise.all([
          this.loadGlobalConfigs(),
          this.loadFeatureFlags(),
          this.loadABTests()
        ]);
        
        // Clear cache
        this.clearCache();
        
        // Increment reload counter
        monitoringService.incrementMetric('config_service_reloads_total');
        
        logger.info('Configurations reloaded successfully', {
          namespace: this.namespace
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to reload configurations', {
          error: err.message,
          namespace: this.namespace
        });
        
        monitoringService.incrementMetric('config_service_errors_total');
      }
    }, this.reloadIntervalMs);
  }
  
  /**
   * Load global configurations
   */
  private async loadGlobalConfigs(): Promise<any> {
    try {
      const globalConfigPath = path.join(this.configPaths.global, this.namespace);
      
      // Check if directory exists
      if (!fs.existsSync(globalConfigPath)) {
        logger.warn('Global configuration directory does not exist', {
          namespace: this.namespace,
          path: globalConfigPath
        });
        return {};
      }
      
      // Get all YAML files
      const files = fs.readdirSync(globalConfigPath)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      
      if (files.length === 0) {
        logger.warn('No global configuration files found', {
          namespace: this.namespace,
          path: globalConfigPath
        });
        return {};
      }
      
      // Load and merge all files
      const configs: any[] = [];
      
      for (const file of files) {
        const filePath = path.join(globalConfigPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const config = yaml.load(content);
        
        if (config && typeof config === 'object') {
          configs.push(config);
        }
      }
      
      // Merge all configs
      const mergedConfig = configs.reduce((acc, config) => this.deepMerge(acc, config), {});
      
      logger.info('Global configurations loaded', {
        namespace: this.namespace,
        fileCount: files.length
      });
      
      return mergedConfig;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load global configurations', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      return {};
    }
  }
  
  /**
   * Load dealership configuration
   */
  private async loadDealershipConfig(dealershipId: number): Promise<any> {
    try {
      const dealershipConfigPath = path.join(
        this.configPaths.dealerships,
        dealershipId.toString(),
        this.namespace
      );
      
      // Check if directory exists
      if (!fs.existsSync(dealershipConfigPath)) {
        // Create directory
        fs.mkdirSync(dealershipConfigPath, { recursive: true });
        
        // Create default configuration file
        await this.createDefaultDealershipConfig(dealershipId);
        
        logger.info('Created default dealership configuration', {
          namespace: this.namespace,
          dealershipId
        });
      }
      
      // Get all YAML files
      const files = fs.readdirSync(dealershipConfigPath)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      
      if (files.length === 0) {
        logger.warn('No dealership configuration files found', {
          namespace: this.namespace,
          dealershipId,
          path: dealershipConfigPath
        });
        return {};
      }
      
      // Load and merge all files
      const configs: any[] = [];
      
      for (const file of files) {
        const filePath = path.join(dealershipConfigPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const config = yaml.load(content);
        
        if (config && typeof config === 'object') {
          configs.push(config);
        }
      }
      
      // Merge all configs
      const mergedConfig = configs.reduce((acc, config) => this.deepMerge(acc, config), {});
      
      logger.info('Dealership configuration loaded', {
        namespace: this.namespace,
        dealershipId,
        fileCount: files.length
      });
      
      return mergedConfig;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load dealership configuration', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      return {};
    }
  }
  
  /**
   * Create default dealership configuration
   */
  private async createDefaultDealershipConfig(dealershipId: number): Promise<void> {
    try {
      const dealershipConfigPath = path.join(
        this.configPaths.dealerships,
        dealershipId.toString(),
        this.namespace
      );
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dealershipConfigPath)) {
        fs.mkdirSync(dealershipConfigPath, { recursive: true });
      }
      
      // Get template for this namespace
      const template = this.templates.get(this.namespace);
      
      // Create default configuration
      const defaultConfig = template ? template.defaults : {};
      
      // Add dealership-specific metadata
      const config = {
        ...defaultConfig,
        metadata: {
          dealershipId,
          createdAt: new Date().toISOString(),
          version: 1
        }
      };
      
      // Save to file
      const filePath = path.join(dealershipConfigPath, 'config.yml');
      const yamlContent = yaml.dump(config, { indent: 2 });
      fs.writeFileSync(filePath, yamlContent, 'utf8');
      
      logger.info('Default dealership configuration created', {
        namespace: this.namespace,
        dealershipId,
        filePath
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create default dealership configuration', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Save dealership configuration
   */
  private async saveDealershipConfig(dealershipId: number, config: any): Promise<void> {
    try {
      const dealershipConfigPath = path.join(
        this.configPaths.dealerships,
        dealershipId.toString(),
        this.namespace
      );
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dealershipConfigPath)) {
        fs.mkdirSync(dealershipConfigPath, { recursive: true });
      }
      
      // Add metadata
      const configWithMetadata = {
        ...config,
        metadata: {
          ...config.metadata,
          dealershipId,
          updatedAt: new Date().toISOString(),
          version: (config.metadata?.version || 0) + 1
        }
      };
      
      // Save to file
      const filePath = path.join(dealershipConfigPath, 'config.yml');
      const yamlContent = yaml.dump(configWithMetadata, { indent: 2 });
      fs.writeFileSync(filePath, yamlContent, 'utf8');
      
      logger.info('Dealership configuration saved', {
        namespace: this.namespace,
        dealershipId,
        filePath
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save dealership configuration', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Save dealership configuration to database
   */
  private async saveDealershipConfigToDatabase(
    dealershipId: number,
    config: any,
    changeLogEntry: ConfigChangeLogEntry
  ): Promise<void> {
    try {
      // This would save the configuration to database
      // For now, we'll just log that it would be saved
      logger.info('Would save dealership configuration to database', {
        namespace: this.namespace,
        dealershipId,
        changeLogId: changeLogEntry.id
      });
      
      // In a real implementation, this would:
      // 1. Save the configuration to database
      // 2. Save the change log entry
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save dealership configuration to database', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Load configuration templates
   */
  private async loadConfigTemplates(): Promise<void> {
    try {
      const templatesPath = path.join(this.configPaths.templates, this.namespace);
      
      // Check if directory exists
      if (!fs.existsSync(templatesPath)) {
        // Create directory
        fs.mkdirSync(templatesPath, { recursive: true });
        
        // Create default template
        await this.createDefaultTemplate();
        
        logger.info('Created default template', {
          namespace: this.namespace
        });
      }
      
      // Get all YAML files
      const files = fs.readdirSync(templatesPath)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      
      if (files.length === 0) {
        logger.warn('No template files found', {
          namespace: this.namespace,
          path: templatesPath
        });
        return;
      }
      
      // Load all templates
      for (const file of files) {
        const filePath = path.join(templatesPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const templateData = yaml.load(content) as any;
        
        if (!templateData || typeof templateData !== 'object') {
          logger.warn('Invalid template file', {
            namespace: this.namespace,
            filePath
          });
          continue;
        }
        
        // Extract template name from filename
        const templateName = file.replace(/\.(yml|yaml)$/, '');
        
        // Create template object
        const template: ConfigTemplate = {
          namespace: this.namespace,
          description: templateData.description || `Template for ${templateName}`,
          schema: this.createSchemaFromTemplate(templateData.schema || {}),
          defaults: templateData.defaults || {},
          examples: templateData.examples || []
        };
        
        // Add to templates map
        this.templates.set(templateName, template);
      }
      
      logger.info('Configuration templates loaded', {
        namespace: this.namespace,
        templateCount: this.templates.size
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load configuration templates', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Create default template
   */
  private async createDefaultTemplate(): Promise<void> {
    try {
      const templatesPath = path.join(this.configPaths.templates, this.namespace);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(templatesPath)) {
        fs.mkdirSync(templatesPath, { recursive: true });
      }
      
      // Create default template
      const defaultTemplate = {
        description: `Default template for ${this.namespace}`,
        schema: {
          type: 'object',
          properties: {
            handover: {
              type: 'object',
              properties: {
                rules: {
                  type: 'object',
                  properties: {
                    include: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    exclude: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                },
                ml_threshold: { type: 'number', minimum: 0, maximum: 1 },
                behavioural: {
                  type: 'object',
                  properties: {
                    engaged_replies: { type: 'integer', minimum: 1 },
                    window_minutes: { type: 'integer', minimum: 1 }
                  }
                },
                sla: {
                  type: 'object',
                  properties: {
                    no_response_hours: { type: 'number', minimum: 1 }
                  }
                }
              }
            }
          }
        },
        defaults: {
          handover: {
            rules: {
              include: ['R-BUY-1', 'R-TEST-1'],
              exclude: []
            },
            ml_threshold: 0.8,
            behavioural: {
              engaged_replies: 3,
              window_minutes: 30
            },
            sla: {
              no_response_hours: 48
            }
          }
        },
        examples: [
          {
            handover: {
              rules: {
                include: ['R-BUY-1', 'R-TEST-1', 'R-PRICE-1'],
                exclude: []
              },
              ml_threshold: 0.85,
              behavioural: {
                engaged_replies: 4,
                window_minutes: 20
              },
              sla: {
                no_response_hours: 24
              }
            }
          },
          {
            handover: {
              rules: {
                include: ['R-BUY-1'],
                exclude: ['R-PRICE-1']
              },
              ml_threshold: 0.9,
              behavioural: {
                engaged_replies: 2,
                window_minutes: 60
              },
              sla: {
                no_response_hours: 72
              }
            }
          }
        ]
      };
      
      // Save to file
      const filePath = path.join(templatesPath, `${this.namespace}.yml`);
      const yamlContent = yaml.dump(defaultTemplate, { indent: 2 });
      fs.writeFileSync(filePath, yamlContent, 'utf8');
      
      logger.info('Default template created', {
        namespace: this.namespace,
        filePath
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create default template', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Create Zod schema from template schema
   */
  private createSchemaFromTemplate(schema: any): z.ZodType<any> {
    try {
      // This is a simplified implementation
      // In a real implementation, this would recursively create a Zod schema from the template schema
      
      // For now, we'll just create a generic object schema
      return z.object({}).passthrough();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create schema from template', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      // Return a generic object schema
      return z.object({}).passthrough();
    }
  }
  
  /**
   * Load feature flags
   */
  private async loadFeatureFlags(): Promise<void> {
    try {
      const featureFlagsPath = path.join(this.configPaths.featureFlags, this.namespace);
      
      // Check if directory exists
      if (!fs.existsSync(featureFlagsPath)) {
        // Create directory
        fs.mkdirSync(featureFlagsPath, { recursive: true });
        
        // Create default feature flags
        await this.createDefaultFeatureFlags();
        
        logger.info('Created default feature flags', {
          namespace: this.namespace
        });
      }
      
      // Get all YAML files
      const files = fs.readdirSync(featureFlagsPath)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      
      if (files.length === 0) {
        logger.warn('No feature flag files found', {
          namespace: this.namespace,
          path: featureFlagsPath
        });
        return;
      }
      
      // Clear existing feature flags
      this.featureFlags.clear();
      
      // Load all feature flags
      for (const file of files) {
        const filePath = path.join(featureFlagsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const flagData = yaml.load(content) as any;
        
        if (!flagData || typeof flagData !== 'object') {
          logger.warn('Invalid feature flag file', {
            namespace: this.namespace,
            filePath
          });
          continue;
        }
        
        // Extract flag name from filename
        const flagName = file.replace(/\.(yml|yaml)$/, '');
        
        // Create feature flag object
        const flag: FeatureFlag = {
          id: flagData.id || crypto.randomUUID(),
          name: flagName,
          description: flagData.description || `Feature flag for ${flagName}`,
          isEnabled: flagData.isEnabled !== undefined ? flagData.isEnabled : false,
          rolloutPercentage: flagData.rolloutPercentage !== undefined ? flagData.rolloutPercentage : 0,
          dealershipOverrides: flagData.dealershipOverrides || {},
          environment: this.getEnvironmentFromString(flagData.environment) || this.environment,
          createdAt: flagData.createdAt ? new Date(flagData.createdAt) : new Date(),
          updatedAt: flagData.updatedAt ? new Date(flagData.updatedAt) : new Date(),
          expiresAt: flagData.expiresAt ? new Date(flagData.expiresAt) : undefined
        };
        
        // Add to feature flags map
        this.featureFlags.set(flagName, flag);
      }
      
      logger.info('Feature flags loaded', {
        namespace: this.namespace,
        flagCount: this.featureFlags.size
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load feature flags', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Create default feature flags
   */
  private async createDefaultFeatureFlags(): Promise<void> {
    try {
      const featureFlagsPath = path.join(this.configPaths.featureFlags, this.namespace);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(featureFlagsPath)) {
        fs.mkdirSync(featureFlagsPath, { recursive: true });
      }
      
      // Create default feature flags
      const defaultFlags = [
        {
          id: crypto.randomUUID(),
          name: 'INTENT_DETECTION_V2',
          description: 'Enable the new intent detection system',
          isEnabled: false,
          rolloutPercentage: 0,
          dealershipOverrides: {},
          environment: this.environment.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: crypto.randomUUID(),
          name: 'INTENT_DETECTION_SHADOW_MODE',
          description: 'Run intent detection in shadow mode (no actual handovers)',
          isEnabled: false,
          rolloutPercentage: 0,
          dealershipOverrides: {},
          environment: this.environment.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      // Save each flag to a file
      for (const flag of defaultFlags) {
        const filePath = path.join(featureFlagsPath, `${flag.name}.yml`);
        const yamlContent = yaml.dump(flag, { indent: 2 });
        fs.writeFileSync(filePath, yamlContent, 'utf8');
        
        // Add to feature flags map
        this.featureFlags.set(flag.name, {
          ...flag,
          createdAt: new Date(flag.createdAt),
          updatedAt: new Date(flag.updatedAt),
          environment: this.getEnvironmentFromString(flag.environment) || this.environment
        });
      }
      
      logger.info('Default feature flags created', {
        namespace: this.namespace,
        flagCount: defaultFlags.length
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create default feature flags', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Save feature flag
   */
  private async saveFeatureFlag(flag: FeatureFlag): Promise<void> {
    try {
      const featureFlagsPath = path.join(this.configPaths.featureFlags, this.namespace);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(featureFlagsPath)) {
        fs.mkdirSync(featureFlagsPath, { recursive: true });
      }
      
      // Update timestamps
      const updatedFlag = {
        ...flag,
        updatedAt: new Date()
      };
      
      // Convert to serializable object
      const flagData = {
        ...updatedFlag,
        createdAt: updatedFlag.createdAt.toISOString(),
        updatedAt: updatedFlag.updatedAt.toISOString(),
        expiresAt: updatedFlag.expiresAt ? updatedFlag.expiresAt.toISOString() : undefined,
        environment: updatedFlag.environment.toString()
      };
      
      // Save to file
      const filePath = path.join(featureFlagsPath, `${flag.name}.yml`);
      const yamlContent = yaml.dump(flagData, { indent: 2 });
      fs.writeFileSync(filePath, yamlContent, 'utf8');
      
      logger.info('Feature flag saved', {
        namespace: this.namespace,
        flagName: flag.name,
        filePath
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save feature flag', {
        error: err.message,
        namespace: this.namespace,
        flagName: flag.name
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Save feature flag to database
   */
  private async saveFeatureFlagToDatabase(flag: FeatureFlag): Promise<void> {
    try {
      // This would save the feature flag to database
      // For now, we'll just log that it would be saved
      logger.info('Would save feature flag to database', {
        namespace: this.namespace,
        flagName: flag.name
      });
      
      // In a real implementation, this would save the feature flag to database
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save feature flag to database', {
        error: err.message,
        namespace: this.namespace,
        flagName: flag.name
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Load A/B tests
   */
  private async loadABTests(): Promise<void> {
    try {
      const abTestsPath = path.join(this.configPaths.abTests, this.namespace);
      
      // Check if directory exists
      if (!fs.existsSync(abTestsPath)) {
        // Create directory
        fs.mkdirSync(abTestsPath, { recursive: true });
        
        // Create default A/B tests
        await this.createDefaultABTests();
        
        logger.info('Created default A/B tests', {
          namespace: this.namespace
        });
      }
      
      // Get all YAML files
      const files = fs.readdirSync(abTestsPath)
        .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
      
      if (files.length === 0) {
        logger.warn('No A/B test files found', {
          namespace: this.namespace,
          path: abTestsPath
        });
        return;
      }
      
      // Clear existing A/B tests
      this.abTests.clear();
      
      // Load all A/B tests
      for (const file of files) {
        const filePath = path.join(abTestsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const testData = yaml.load(content) as any;
        
        if (!testData || typeof testData !== 'object') {
          logger.warn('Invalid A/B test file', {
            namespace: this.namespace,
            filePath
          });
          continue;
        }
        
        // Extract test name from filename
        const testName = file.replace(/\.(yml|yaml)$/, '');
        
        // Create A/B test object
        const test: ABTestConfig = {
          id: testData.id || crypto.randomUUID(),
          name: testName,
          description: testData.description || `A/B test for ${testName}`,
          isActive: testData.isActive !== undefined ? testData.isActive : false,
          variants: testData.variants || [],
          dealershipOverrides: testData.dealershipOverrides || {},
          environment: this.getEnvironmentFromString(testData.environment) || this.environment,
          startedAt: testData.startedAt ? new Date(testData.startedAt) : new Date(),
          endsAt: testData.endsAt ? new Date(testData.endsAt) : undefined,
          metrics: testData.metrics || []
        };
        
        // Add to A/B tests map
        this.abTests.set(testName, test);
      }
      
      logger.info('A/B tests loaded', {
        namespace: this.namespace,
        testCount: this.abTests.size
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load A/B tests', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Create default A/B tests
   */
  private async createDefaultABTests(): Promise<void> {
    try {
      const abTestsPath = path.join(this.configPaths.abTests, this.namespace);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(abTestsPath)) {
        fs.mkdirSync(abTestsPath, { recursive: true });
      }
      
      // Create default A/B tests
      const defaultTests = [
        {
          id: crypto.randomUUID(),
          name: 'ML_THRESHOLD_TEST',
          description: 'Test different ML thresholds for intent detection',
          isActive: false,
          variants: [
            {
              id: 'control',
              name: 'Control (0.8)',
              percentage: 50,
              config: {
                ml_threshold: 0.8
              }
            },
            {
              id: 'variant_a',
              name: 'Variant A (0.7)',
              percentage: 25,
              config: {
                ml_threshold: 0.7
              }
            },
            {
              id: 'variant_b',
              name: 'Variant B (0.9)',
              percentage: 25,
              config: {
                ml_threshold: 0.9
              }
            }
          ],
          dealershipOverrides: {},
          environment: this.environment.toString(),
          startedAt: new Date().toISOString(),
          metrics: [
            'intent_detection_precision',
            'intent_detection_recall',
            'handover_conversion_rate'
          ]
        }
      ];
      
      // Save each test to a file
      for (const test of defaultTests) {
        const filePath = path.join(abTestsPath, `${test.name}.yml`);
        const yamlContent = yaml.dump(test, { indent: 2 });
        fs.writeFileSync(filePath, yamlContent, 'utf8');
        
        // Add to A/B tests map
        this.abTests.set(test.name, {
          ...test,
          startedAt: new Date(test.startedAt),
          environment: this.getEnvironmentFromString(test.environment) || this.environment
        });
      }
      
      logger.info('Default A/B tests created', {
        namespace: this.namespace,
        testCount: defaultTests.length
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create default A/B tests', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Save A/B test
   */
  private async saveABTest(test: ABTestConfig): Promise<void> {
    try {
      const abTestsPath = path.join(this.configPaths.abTests, this.namespace);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(abTestsPath)) {
        fs.mkdirSync(abTestsPath, { recursive: true });
      }
      
      // Convert to serializable object
      const testData = {
        ...test,
        startedAt: test.startedAt.toISOString(),
        endsAt: test.endsAt ? test.endsAt.toISOString() : undefined,
        environment: test.environment.toString()
      };
      
      // Save to file
      const filePath = path.join(abTestsPath, `${test.name}.yml`);
      const yamlContent = yaml.dump(testData, { indent: 2 });
      fs.writeFileSync(filePath, yamlContent, 'utf8');
      
      logger.info('A/B test saved', {
        namespace: this.namespace,
        testName: test.name,
        filePath
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save A/B test', {
        error: err.message,
        namespace: this.namespace,
        testName: test.name
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      throw err;
    }
  }
  
  /**
   * Save A/B test to database
   */
  private async saveABTestToDatabase(test: ABTestConfig): Promise<void> {
    try {
      // This would save the A/B test to database
      // For now, we'll just log that it would be saved
      logger.info('Would save A/B test to database', {
        namespace: this.namespace,
        testName: test.name
      });
      
      // In a real implementation, this would save the A/B test to database
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to save A/B test to database', {
        error: err.message,
        namespace: this.namespace,
        testName: test.name
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
  
  /**
   * Apply A/B test variants to configuration
   */
  private async applyABTestVariants(config: any, dealershipId: number): Promise<any> {
    try {
      // Clone config to avoid modifying the original
      const result = { ...config };
      
      // Get all active A/B tests
      const activeTests = Array.from(this.abTests.values())
        .filter(test => test.isActive && (!test.endsAt || test.endsAt > new Date()));
      
      // Apply each test's variant if applicable
      for (const test of activeTests) {
        const variantId = this.getABTestVariant(test.name, dealershipId);
        
        if (!variantId) {
          continue;
        }
        
        // Find the variant
        const variant = test.variants.find(v => v.id === variantId);
        
        if (!variant || !variant.config) {
          continue;
        }
        
        // Apply variant config
        this.deepMerge(result, variant.config);
        
        logger.debug('Applied A/B test variant', {
          namespace: this.namespace,
          dealershipId,
          testName: test.name,
          variantId,
          variantName: variant.name
        });
      }
      
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to apply A/B test variants', {
        error: err.message,
        namespace: this.namespace,
        dealershipId
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
      
      // Return original config
      return config;
    }
  }
  
  /**
   * Get environment from string
   */
  private getEnvironmentFromString(env?: string): ConfigEnvironment | undefined {
    if (!env) {
      return undefined;
    }
    
    switch (env.toLowerCase()) {
      case 'development':
        return ConfigEnvironment.DEVELOPMENT;
      case 'staging':
        return ConfigEnvironment.STAGING;
      case 'production':
        return ConfigEnvironment.PRODUCTION;
      default:
        return undefined;
    }
  }
  
  /**
   * Get current environment
   */
  private getEnvironment(): ConfigEnvironment {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env.toLowerCase()) {
      case 'production':
        return ConfigEnvironment.PRODUCTION;
      case 'staging':
        return ConfigEnvironment.STAGING;
      default:
        return ConfigEnvironment.DEVELOPMENT;
    }
  }
  
  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    if (!source) {
      return target;
    }
    
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
    
    function isObject(item: any): boolean {
      return item && typeof item === 'object' && !Array.isArray(item);
    }
  }
  
  /**
   * Hash dealership ID for consistent assignment
   */
  private hashDealershipId(dealershipId: number, salt: string = ''): number {
    try {
      // Create hash from dealership ID and salt
      const hash = crypto.createHash('md5')
        .update(`${dealershipId}:${salt}`)
        .digest('hex');
      
      // Convert first 4 bytes of hash to number (0-100)
      const hashNum = parseInt(hash.substring(0, 8), 16);
      return hashNum % 100;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to hash dealership ID', {
        error: err.message,
        dealershipId,
        salt
      });
      
      // Fallback to simple hash
      return (dealershipId * 13) % 100;
    }
  }
  
  /**
   * Clean up resources on shutdown
   */
  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Unified Config Service', {
        namespace: this.namespace
      });
      
      // Clear reload timer
      if (this.reloadTimer) {
        clearInterval(this.reloadTimer);
        this.reloadTimer = null;
      }
      
      // Close file watchers
      for (const [key, watcher] of this.fileWatchers.entries()) {
        await watcher.close();
        logger.info(`Closed file watcher: ${key}`, {
          namespace: this.namespace
        });
      }
      
      // Clear cache
      this.cache.flushAll();
      
      logger.info('Unified Config Service shut down successfully', {
        namespace: this.namespace
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to shut down Unified Config Service', {
        error: err.message,
        namespace: this.namespace
      });
      
      monitoringService.incrementMetric('config_service_errors_total');
    }
  }
}

// Export singleton instance creation function
export function createConfigService(namespace: string): UnifiedConfigService {
  return new UnifiedConfigService(namespace);
}
