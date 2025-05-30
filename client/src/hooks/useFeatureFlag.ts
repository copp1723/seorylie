import { useState, useEffect, useCallback } from 'react';

// Types for feature flags
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
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
   * Reset all feature flags to their default values
   */
  resetToDefaults: () => void;
  
  /**
   * Check if the feature flags have been loaded
   */
  isLoaded: boolean;
}

// Default feature flags - can be extended later
const DEFAULT_FEATURES: FeatureFlagState = {
  'advanced-analytics': true,
  'experimental-ui': false,
  'keyboard-shortcuts': true,
  'dark-mode': true,
  'real-time-notifications': true,
  'beta-features': false,
  'debug-tools': process.env.NODE_ENV === 'development',
};

// Storage key for feature flags
const STORAGE_KEY = 'feature-flags';

/**
 * Hook for managing feature flags throughout the application
 * @returns Feature flag functions and state
 */
export const useFeatureFlag = (): FeatureFlagHook => {
  const [features, setFeatures] = useState<FeatureFlagState>({});
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Load feature flags from localStorage on mount
  useEffect(() => {
    const loadFeatureFlags = () => {
      try {
        const storedFlags = localStorage.getItem(STORAGE_KEY);
        if (storedFlags) {
          const parsedFlags = JSON.parse(storedFlags);
          // Merge with defaults to ensure new flags are included
          setFeatures({ ...DEFAULT_FEATURES, ...parsedFlags });
        } else {
          setFeatures(DEFAULT_FEATURES);
        }
      } catch (error) {
        console.error('Failed to load feature flags:', error);
        setFeatures(DEFAULT_FEATURES);
      }
      
      setIsLoaded(true);
    };
    
    loadFeatureFlags();
  }, []);
  
  // Save feature flags to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
    }
  }, [features, isLoaded]);
  
  // Check if a feature is enabled
  const isEnabled = useCallback((featureId: string): boolean => {
    // If the feature doesn't exist, default to false
    if (!(featureId in features)) {
      return false;
    }
    
    return features[featureId];
  }, [features]);
  
  // Toggle a feature flag
  const toggleFeature = useCallback((featureId: string): void => {
    setFeatures(prev => {
      // If the feature doesn't exist, add it as enabled
      if (!(featureId in prev)) {
        return { ...prev, [featureId]: true };
      }
      
      return { ...prev, [featureId]: !prev[featureId] };
    });
  }, []);
  
  // Set a feature flag to a specific state
  const setFeatureEnabled = useCallback((featureId: string, enabled: boolean): void => {
    setFeatures(prev => ({ ...prev, [featureId]: enabled }));
  }, []);
  
  // Get all feature flags
  const getAllFeatures = useCallback((): FeatureFlagState => {
    return { ...features };
  }, [features]);
  
  // Reset all feature flags to their default values
  const resetToDefaults = useCallback((): void => {
    setFeatures(DEFAULT_FEATURES);
  }, []);
  
  return {
    isEnabled,
    toggleFeature,
    setFeatureEnabled,
    getAllFeatures,
    resetToDefaults,
    isLoaded,
  };
};

export default useFeatureFlag;
