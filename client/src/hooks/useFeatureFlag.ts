import { useState, useEffect, useCallback } from 'react';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value?: any;
  description?: string;
}

export interface FeatureFlagHook {
  isEnabled: (flag: string) => boolean;
  getValue: (flag: string, defaultValue?: any) => any;
  getAllFlags: () => Record<string, FeatureFlag>;
  refreshFlags: () => Promise<void>;
}

// Default feature flags
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  'bulk-operations': {
    key: 'bulk-operations',
    enabled: true,
    description: 'Enable bulk operations panel'
  },
  'command-palette': {
    key: 'command-palette',
    enabled: true,
    description: 'Enable command palette'
  },
  'feature-tour': {
    key: 'feature-tour',
    enabled: true,
    description: 'Enable feature tour'
  },
  'advanced-analytics': {
    key: 'advanced-analytics',
    enabled: false,
    description: 'Enable advanced analytics features'
  },
  'ai-assistance': {
    key: 'ai-assistance',
    enabled: true,
    description: 'Enable AI assistance features'
  }
};

export const useFeatureFlag = (): FeatureFlagHook => {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>(DEFAULT_FLAGS);

  const isEnabled = useCallback((flag: string): boolean => {
    return flags[flag]?.enabled ?? false;
  }, [flags]);

  const getValue = useCallback((flag: string, defaultValue?: any): any => {
    const flagConfig = flags[flag];
    if (!flagConfig || !flagConfig.enabled) {
      return defaultValue;
    }
    return flagConfig.value ?? defaultValue;
  }, [flags]);

  const getAllFlags = useCallback((): Record<string, FeatureFlag> => {
    return flags;
  }, [flags]);

  const refreshFlags = useCallback(async (): Promise<void> => {
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll just use the default flags
      console.log('[FeatureFlags] Refreshing flags...');
      setFlags(DEFAULT_FLAGS);
    } catch (error) {
      console.error('[FeatureFlags] Failed to refresh flags:', error);
    }
  }, []);

  useEffect(() => {
    refreshFlags();
  }, [refreshFlags]);

  return {
    isEnabled,
    getValue,
    getAllFlags,
    refreshFlags
  };
};

export default useFeatureFlag;