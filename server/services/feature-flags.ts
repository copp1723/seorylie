/**
 * Feature Flag Configuration System
 * 
 * Provides runtime feature toggles for safe rollout and quick rollback
 * 
 * @file server/services/feature-flags.ts
 */

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  deprecated?: boolean;
  deprecationDate?: string;
  rolloutPercentage?: number;
  environments?: string[];
}

export interface FeatureFlagConfig {
  flags: Record<string, FeatureFlag>;
  version: string;
  lastUpdated: string;
}

/**
 * Default feature flags configuration
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),
  flags: {
    // Authentication & Security
    "jwt-refresh-rotation": {
      name: "jwt-refresh-rotation",
      enabled: true,
      description: "JWT token refresh rotation for enhanced security",
      environments: ["production", "staging"]
    },
    "global-error-handling": {
      name: "global-error-handling",
      enabled: true,
      description: "Centralized error handling and reporting",
      environments: ["production", "staging", "development"]
    },
    
    // AI & Agent Features
    "agent-squad-integration": {
      name: "agent-squad-integration",
      enabled: false,
      description: "Multi-agent conversation handling",
      rolloutPercentage: 0,
      environments: ["development"]
    },
    "unified-ai-agent-squad": {
      name: "unified-ai-agent-squad",
      enabled: false,
      description: "Unified AI agent squad orchestration",
      rolloutPercentage: 0,
      environments: ["development"]
    },
    
    // Infrastructure & Performance
    "redis-websocket-scaling": {
      name: "redis-websocket-scaling",
      enabled: false,
      description: "Redis-based WebSocket scaling for high availability",
      rolloutPercentage: 25,
      environments: ["staging"]
    },
    "sandbox-pause-resume": {
      name: "sandbox-pause-resume",
      enabled: false,
      description: "Sandbox environment pause/resume functionality",
      environments: ["development", "staging"]
    },
    
    // Data & Analytics
    "event-schema-validation": {
      name: "event-schema-validation",
      enabled: true,
      description: "Event schema validation for data integrity",
      environments: ["production", "staging", "development"]
    },
    "mindsdb-service-hook": {
      name: "mindsdb-service-hook",
      enabled: false,
      description: "MindsDB integration service hooks",
      rolloutPercentage: 0,
      environments: ["development"]
    },
    "tempo-trace-correlation": {
      name: "tempo-trace-correlation",
      enabled: false,
      description: "Distributed tracing with Tempo correlation",
      environments: ["staging", "development"]
    },
    
    // UI & User Experience
    "loading-progress-ui": {
      name: "loading-progress-ui",
      enabled: true,
      description: "Enhanced loading progress indicators",
      environments: ["production", "staging", "development"]
    },
    "error-messages": {
      name: "error-messages",
      enabled: true,
      description: "Improved user-facing error messages",
      environments: ["production", "staging", "development"]
    },
    
    // Testing & Development
    "typescript-strict-mode": {
      name: "typescript-strict-mode",
      enabled: false,
      description: "TypeScript strict mode enforcement",
      environments: ["development"]
    },
    "performance-testing": {
      name: "performance-testing",
      enabled: false,
      description: "Performance testing and monitoring",
      environments: ["staging", "development"]
    }
  }
};

/**
 * Feature Flag Service
 */
export class FeatureFlagService {
  private config: FeatureFlagConfig;
  private environment: string;

  constructor(config: FeatureFlagConfig = DEFAULT_FEATURE_FLAGS) {
    this.config = config;
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Check if a feature flag is enabled
   */
  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.config.flags[flagName];
    
    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found, defaulting to false`);
      return false;
    }

    // Check if flag is deprecated
    if (flag.deprecated) {
      console.warn(`Feature flag '${flagName}' is deprecated and will be removed`);
    }

    // Check environment restrictions
    if (flag.environments && !flag.environments.includes(this.environment)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const userHash = this.getUserHash(userId);
      return userHash < flag.rolloutPercentage;
    }

    return flag.enabled;
  }

  /**
   * Get all feature flags for current environment
   */
  getAllFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    
    Object.keys(this.config.flags).forEach(flagName => {
      result[flagName] = this.isEnabled(flagName);
    });

    return result;
  }

  /**
   * Get feature flag configuration for admin UI
   */
  getConfiguration(): FeatureFlagConfig {
    return this.config;
  }

  /**
   * Update feature flag configuration (admin only)
   */
  updateConfiguration(newConfig: FeatureFlagConfig): void {
    this.config = {
      ...newConfig,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Toggle a specific feature flag (admin only)
   */
  toggleFlag(flagName: string, enabled: boolean): boolean {
    if (this.config.flags[flagName]) {
      this.config.flags[flagName].enabled = enabled;
      this.config.lastUpdated = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Add a new feature flag
   */
  addFlag(flag: FeatureFlag): void {
    this.config.flags[flag.name] = flag;
    this.config.lastUpdated = new Date().toISOString();
  }

  /**
   * Mark a feature flag as deprecated
   */
  deprecateFlag(flagName: string, deprecationDate?: string): boolean {
    if (this.config.flags[flagName]) {
      this.config.flags[flagName].deprecated = true;
      this.config.flags[flagName].deprecationDate = deprecationDate || new Date().toISOString();
      this.config.lastUpdated = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Remove deprecated flags older than specified days
   */
  cleanupDeprecatedFlags(daysOld: number = 30): string[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const removedFlags: string[] = [];
    
    Object.entries(this.config.flags).forEach(([flagName, flag]) => {
      if (flag.deprecated && flag.deprecationDate) {
        const deprecationDate = new Date(flag.deprecationDate);
        if (deprecationDate < cutoffDate) {
          delete this.config.flags[flagName];
          removedFlags.push(flagName);
        }
      }
    });

    if (removedFlags.length > 0) {
      this.config.lastUpdated = new Date().toISOString();
    }

    return removedFlags;
  }

  /**
   * Generate a consistent hash for user-based rollouts
   */
  private getUserHash(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagService();

/**
 * Convenience function to check if a feature is enabled
 */
export function isFeatureEnabled(flagName: string, userId?: string): boolean {
  return featureFlags.isEnabled(flagName, userId);
}

/**
 * Environment variable override support
 */
export function getFeatureFlagFromEnv(flagName: string): boolean | null {
  const envVar = `FEATURE_${flagName.toUpperCase().replace(/-/g, '_')}`;
  const value = process.env[envVar];
  
  if (value === undefined) return null;
  return value.toLowerCase() === 'true';
}