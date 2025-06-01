import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { useTheme } from '../contexts/ThemeContext'; // Removed to avoid context conflicts
import { logEvent } from '../utils/analytics';

// Define the loading state interface
export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress: number;
  indeterminate: boolean;
  cancelable: boolean;
  onCancel?: () => void;
}

// Define the context interface with state and actions
interface LoadingContextType {
  // New key-based API
  startLoading: (key: string, options?: { message?: string; progress?: number }) => void;
  stopLoading: (key: string) => void;
  setProgress: (key: string, progress: number) => void;
  updateLoading: (key: string, updates: Partial<LoadingState>) => void;
  isLoadingKey: (key: string) => boolean;
  getLoadingState: (key: string) => LoadingState | undefined;
  // Legacy support
  state: LoadingState;
}

// Default loading state
const defaultLoadingState: LoadingState = {
  isLoading: false,
  message: 'Loading...',
  progress: 0,
  indeterminate: true,
  cancelable: false,
};

// Create the context with a default value
const LoadingContext = createContext<LoadingContextType>({
  state: defaultLoadingState,
  startLoading: () => {},
  stopLoading: () => {},
  setProgress: () => {},
  updateLoading: () => {},
  isLoadingKey: () => false,
  getLoadingState: () => undefined,
});

// Props for the provider component
interface LoadingProviderProps {
  children: ReactNode;
  initialState?: Partial<LoadingState>;
}

// LoadingProvider component
export const LoadingProvider: React.FC<LoadingProviderProps> = ({
  children,
  initialState = {},
}) => {
  // Remove theme dependency for now to avoid context conflicts
  // Individual components can handle their own theming
  // const { theme } = useTheme();
  const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState>>(new Map());
  const [state, setState] = useState<LoadingState>({
    ...defaultLoadingState,
    ...initialState,
  });

  // Start a loading operation by key
  const startLoading = (key: string, options: { message?: string; progress?: number } = {}) => {
    const newState: LoadingState = {
      isLoading: true,
      message: options.message || 'Loading...',
      progress: options.progress || 0,
      indeterminate: options.progress === undefined,
      cancelable: false,
    };

    setLoadingStates(prev => new Map(prev.set(key, newState)));
    
    // Update legacy state if this is the first loading operation
    if (loadingStates.size === 0) {
      setState(newState);
    }

    // Log loading start event
    logEvent('loading_started', {
      key,
      message: newState.message,
      indeterminate: newState.indeterminate,
    });
  };

  // Stop a loading operation by key
  const stopLoading = (key: string) => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      
      // Update legacy state
      if (newMap.size === 0) {
        setState(defaultLoadingState);
      } else {
        // Set to the most recent loading state
        const lastState = Array.from(newMap.values()).pop();
        if (lastState) setState(lastState);
      }
      
      return newMap;
    });

    // Log loading complete event
    logEvent('loading_completed', {
      key,
      duration: 0,
    });
  };

  // Set progress for a specific loading operation
  const setProgress = (key: string, progress: number) => {
    setLoadingStates(prev => {
      const current = prev.get(key);
      if (!current) return prev;
      
      const updated = { ...current, progress, indeterminate: false };
      const newMap = new Map(prev.set(key, updated));
      
      // Update legacy state if this is the current operation
      if (state.isLoading && prev.size === 1) {
        setState(updated);
      }
      
      return newMap;
    });

    // Log progress update
    logEvent('loading_progress_update', {
      key,
      progress,
    });
  };

  // Update a loading operation with partial state
  const updateLoading = (key: string, updates: Partial<LoadingState>) => {
    setLoadingStates(prev => {
      const current = prev.get(key);
      if (!current) return prev;
      
      const updated = { ...current, ...updates };
      const newMap = new Map(prev.set(key, updated));
      
      // Update legacy state if this is the current operation
      if (state.isLoading && prev.size === 1) {
        setState(updated);
      }
      
      return newMap;
    });
  };

  // Check if a specific key is loading
  const isLoadingKey = (key: string): boolean => {
    return loadingStates.has(key) && loadingStates.get(key)?.isLoading === true;
  };

  // Get loading state for a specific key
  const getLoadingState = (key: string): LoadingState | undefined => {
    return loadingStates.get(key);
  };

  // Provide the loading context to children
  return (
    <LoadingContext.Provider
      value={{
        state,
        startLoading,
        stopLoading,
        setProgress,
        updateLoading,
        isLoadingKey,
        getLoadingState,
      }}
    >
      {children}
      {state.isLoading && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-${
            theme === 'dark' ? 'black' : 'white'
          }/80 backdrop-blur-sm transition-all duration-300`}
        >
          <div className="w-full max-w-md p-6 rounded-lg shadow-lg bg-background">
            <h3 className="text-xl font-semibold mb-4">{state.message}</h3>
            
            {state.indeterminate ? (
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse-loading"></div>
              </div>
            ) : (
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-in-out"
                  style={{ width: `${state.progress}%` }}
                ></div>
              </div>
            )}
            
            <div className="flex justify-between mt-2">
              <span className="text-sm text-muted-foreground">
                {state.indeterminate ? 'Please wait...' : `${Math.round(state.progress)}%`}
              </span>
              
              {state.cancelable && state.onCancel && (
                <button
                  onClick={state.onCancel}
                  className="text-sm text-destructive hover:text-destructive/80"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

// Custom hook to use the loading context
export const useLoading = () => {
  const context = useContext(LoadingContext);
  
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  
  return context;
};

// Alias for backwards compatibility
export const useLoadingContext = useLoading;
export default LoadingContext;
