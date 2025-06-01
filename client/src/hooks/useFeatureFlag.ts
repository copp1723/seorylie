import { useState, useEffect, useCallback } from 'react';

// Types for feature flags
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value?: any;
  description?: string;
  category?: string;
  requiresPermission?: boolean;
}

interface FeatureFlagState {
  [key: string]: boolean;
}

interface FeatureFlagHook {
  /**
   * Check if a feature is enabled
   */
  isEnabled: (featureId: string) => boolean;
  
  /**
   * Get the value of a feature flag
   */
  getValue: (flag: string, defaultValue?: any) => any;
  
  /**
   * Toggle a feature flag
   */
  toggleFeature: (featureId: string) => void;
  
  /**
   * Set a feature flag to a specific state
   */
  setFeatureEnabled: (featureId: string, enabled: boolean) => void;
  
  /**
   * Get all feature flags
   */
  getAllFeatures: () => FeatureFlagState;
  
  /**
   * Get all feature flag details
   */
  getAllFlags: () => Record<string, FeatureFlag>;
  
  /**
   * Reset all feature flags to their default values
   */
  resetToDefaults: () => void;
  
  /**
   * Refresh flags from external source
   */
  refreshFlags: () => Promise<void>;
  
  /**
   * Check if the feature flags have been loaded
   */
  isLoaded: boolean;
}

// Default feature flags - combining both implementations
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  'bulk-operations': {
    key: 'bulk-operations',
    enabled: true,
    description: 'Enable bulk operations panel',
    category: 'operations'
  },
  'command-palette': {
    key: 'command-palette',
    enabled: true,
    description: 'Enable command palette',
    category: 'ui'
  },
  'feature-tour': {
    key: 'feature-tour',
    enabled: true,
    description: 'Enable feature tour',
    category: 'onboarding'
  },
  'advanced-analytics': {
    key: 'advanced-analytics',
    enabled: true,
    description: 'Enable advanced analytics features',
    category: 'analytics'
  },
  'ai-assistance': {
    key: 'ai-assistance',
    enabled: true,
    description: 'Enable AI assistance features',
    category: 'ai'
  },
  'experimental-ui': {
    key: 'experimental-ui',
    enabled: false,
    description: 'Enable experimental UI features',
    category: 'ui'
  },
  'keyboard-shortcuts': {
    key: 'keyboard-shortcuts',
    enabled: true,
    description: 'Enable keyboard shortcuts',
    category: 'ui'
  },
  'dark-mode': {
    key: 'dark-mode',
    enabled: true,
    description: 'Enable dark mode',
    category: 'ui'
  },
  'real-time-notifications': {
    key: 'real-time-notifications',
    enabled: true,
    description: 'Enable real-time notifications',
    category: 'notifications'
  },
  'beta-features': {
    key: 'beta-features',
    enabled: false,
    description: 'Enable beta features',
    category: 'experimental'
  },
  'debug-tools': {
    key: 'debug-tools',
    enabled: process.env.NODE_ENV === 'development',
    description: 'Enable debug tools',
    category: 'development'
  }
};

// Storage key for feature flags
const STORAGE_KEY = 'feature-flags';

/**
 * Hook for managing feature flags throughout the application
 * @returns Feature flag functions and state
 */
export const useFeatureFlag = (): FeatureFlagHook => {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>(DEFAULT_FLAGS);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load feature flags from localStorage on mount
  useEffect(() => {
    const loadFeatureFlags = () => {
      try {
        if (typeof window === 'undefined') {
          setFlags(DEFAULT_FLAGS);
          setIsLoaded(true);
          return;
        }
        
        const storedFlags = localStorage.getItem(STORAGE_KEY);
        if (storedFlags) {
          const parsedFlags = JSON.parse(storedFlags);
          // Merge with defaults to ensure new flags are included
          const mergedFlags = { ...DEFAULT_FLAGS };
          Object.keys(parsedFlags).forEach(key => {
            if (mergedFlags[key]) {
              mergedFlags[key] = { ...mergedFlags[key], ...parsedFlags[key] };
            } else {
              mergedFlags[key] = parsedFlags[key];
            }
          });
          setFlags(mergedFlags);
        } else {
          setFlags(DEFAULT_FLAGS);
        }
      } catch (error) {
        console.error('Failed to load feature flags:', error);
        setFlags(DEFAULT_FLAGS);
      }
      
      setIsLoaded(true);
    };
    
    loadFeatureFlags();
  }, []);
  
  // Save feature flags to localStorage when they change
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    }
  }, [flags, isLoaded]);
  
  // Check if a feature is enabled
  const isEnabled = useCallback((featureId: string): boolean => {
    return flags[featureId]?.enabled ?? false;
  }, [flags]);
  
  // Get the value of a feature flag
  const getValue = useCallback((flag: string, defaultValue?: any): any => {
    const flagConfig = flags[flag];
    if (!flagConfig || !flagConfig.enabled) {
      return defaultValue;
    }
    return flagConfig.value ?? defaultValue;
  }, [flags]);
  
  // Toggle a feature flag
  const toggleFeature = useCallback((featureId: string): void => {
    setFlags(prev => {
      // If the feature doesn't exist, add it as enabled
      if (!(featureId in prev)) {
        return { 
          ...prev, 
          [featureId]: {
            key: featureId,
            enabled: true,
            description: `Feature ${featureId}`
          }
        };
      }
      
      return { 
        ...prev, 
        [featureId]: { 
          ...prev[featureId], 
          enabled: !prev[featureId].enabled 
        } 
      };
    });
  }, []);
  
  // Set a feature flag to a specific state
  const setFeatureEnabled = useCallback((featureId: string, enabled: boolean): void => {
    setFlags(prev => ({
      ...prev,
      [featureId]: prev[featureId] 
        ? { ...prev[featureId], enabled }
        : { key: featureId, enabled, description: `Feature ${featureId}` }
    }));
  }, []);
  
  // Get all feature flags (simple boolean state)
  const getAllFeatures = useCallback((): FeatureFlagState => {
    const simpleFlags: FeatureFlagState = {};
    Object.keys(flags).forEach(key => {
      simpleFlags[key] = flags[key].enabled;
    });
    return simpleFlags;
  }, [flags]);
  
  // Get all feature flag details
  const getAllFlags = useCallback((): Record<string, FeatureFlag> => {
    return { ...flags };
  }, [flags]);
  
  // Reset all feature flags to their default values
  const resetToDefaults = useCallback((): void => {
    setFlags(DEFAULT_FLAGS);
  }, []);
  
  // Refresh flags from external source
  const refreshFlags = useCallback(async (): Promise<void> => {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll merge with stored flags or use defaults
      console.log('[FeatureFlags] Refreshing flags...');
      
      if (typeof window !== 'undefined') {
        const storedFlags = localStorage.getItem(STORAGE_KEY);
        if (storedFlags) {
          const parsedFlags = JSON.parse(storedFlags);
          const mergedFlags = { ...DEFAULT_FLAGS };
          Object.keys(parsedFlags).forEach(key => {
            if (mergedFlags[key]) {
              mergedFlags[key] = { ...mergedFlags[key], ...parsedFlags[key] };
            }
          });
          setFlags(mergedFlags);
        } else {
          setFlags(DEFAULT_FLAGS);
        }
      }
    } catch (error) {
      console.error('[FeatureFlags] Failed to refresh flags:', error);
    }
  }, []);
  
  return {
    isEnabled,
    getValue,
    toggleFeature,
    setFeatureEnabled,
    getAllFeatures,
    getAllFlags,
    resetToDefaults,
    refreshFlags,
    isLoaded,
  };
};

export default useFeatureFlag;
