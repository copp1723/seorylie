import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { logEvent } from '../utils/analytics';

// Types
export interface LoadingState {
  isLoading: boolean;
  loadingKeys: Record<string, boolean>;
  progress: Record<string, number>;
  errors: Record<string, string | null>;
  messages: Record<string, string>;
  showOverlay: boolean;
  overlayMessage: string;
  overlayProgress: number;
  performanceMetrics: Record<string, PerformanceMetric>;
  batchOperations: Record<string, string[]>;
}

interface PerformanceMetric {
  startTime: number;
  endTime?: number;
  duration?: number;
  completed: boolean;
}

type LoadingAction =
  | { type: 'START_LOADING'; key: string; message?: string }
  | { type: 'STOP_LOADING'; key: string }
  | { type: 'SET_PROGRESS'; key: string; progress: number }
  | { type: 'SET_ERROR'; key: string; error: string | null }
  | { type: 'SHOW_OVERLAY'; message: string; progress?: number }
  | { type: 'HIDE_OVERLAY' }
  | { type: 'RESET_ALL' }
  | { type: 'START_BATCH'; batchId: string; keys: string[] }
  | { type: 'COMPLETE_BATCH'; batchId: string }
  | { type: 'PERSIST_LOADING_STATE' }
  | { type: 'RESTORE_LOADING_STATE'; state: Partial<LoadingState> };

interface LoadingContextType extends LoadingState {
  startLoading: (key: string, message?: string, timeout?: number) => void;
  stopLoading: (key: string) => void;
  setProgress: (key: string, progress: number) => void;
  setError: (key: string, error: string | null) => void;
  showLoadingOverlay: (message: string, progress?: number) => void;
  hideLoadingOverlay: () => void;
  resetLoadingState: () => void;
  isLoadingKey: (key: string) => boolean;
  getKeyProgress: (key: string) => number;
  getKeyError: (key: string) => string | null;
  getKeyMessage: (key: string) => string;
  startBatchOperation: (batchId: string, keys: string[]) => void;
  completeBatchOperation: (batchId: string) => void;
  withLoading: <T>(key: string, fn: () => Promise<T>, message?: string) => Promise<T>;
  getLoadingPerformance: (key: string) => PerformanceMetric | undefined;
  getAverageLoadTime: () => number;
}

// Initial state
const initialState: LoadingState = {
  isLoading: false,
  loadingKeys: {},
  progress: {},
  errors: {},
  messages: {},
  showOverlay: false,
  overlayMessage: '',
  overlayProgress: 0,
  performanceMetrics: {},
  batchOperations: {},
};

// Reducer
const loadingReducer = (state: LoadingState, action: LoadingAction): LoadingState => {
  switch (action.type) {
    case 'START_LOADING': {
      const now = performance.now();
      return {
        ...state,
        isLoading: true,
        loadingKeys: {
          ...state.loadingKeys,
          [action.key]: true,
        },
        progress: {
          ...state.progress,
          [action.key]: 0,
        },
        messages: {
          ...state.messages,
          [action.key]: action.message || 'Loading...',
        },
        performanceMetrics: {
          ...state.performanceMetrics,
          [action.key]: {
            startTime: now,
            completed: false,
          },
        },
      };
    }

    case 'STOP_LOADING': {
      const { [action.key]: _, ...remainingKeys } = state.loadingKeys;
      const { [action.key]: __, ...remainingProgress } = state.progress;
      const isStillLoading = Object.keys(remainingKeys).length > 0;
      
      const now = performance.now();
      const metric = state.performanceMetrics[action.key];
      const updatedMetric = metric ? {
        ...metric,
        endTime: now,
        duration: now - metric.startTime,
        completed: true,
      } : undefined;
      
      return {
        ...state,
        isLoading: isStillLoading,
        loadingKeys: remainingKeys,
        progress: remainingProgress,
        performanceMetrics: {
          ...state.performanceMetrics,
          ...(updatedMetric ? { [action.key]: updatedMetric } : {}),
        },
      };
    }

    case 'SET_PROGRESS':
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.key]: action.progress,
        },
      };

    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.key]: action.error,
        },
      };

    case 'SHOW_OVERLAY':
      return {
        ...state,
        showOverlay: true,
        overlayMessage: action.message,
        overlayProgress: action.progress !== undefined ? action.progress : 0,
      };

    case 'HIDE_OVERLAY':
      return {
        ...state,
        showOverlay: false,
        overlayMessage: '',
        overlayProgress: 0,
      };

    case 'START_BATCH':
      return {
        ...state,
        batchOperations: {
          ...state.batchOperations,
          [action.batchId]: action.keys,
        },
        isLoading: true,
      };

    case 'COMPLETE_BATCH': {
      const { [action.batchId]: batchKeys, ...remainingBatches } = state.batchOperations;
      
      if (!batchKeys) return state;
      
      const newLoadingKeys = { ...state.loadingKeys };
      const newProgress = { ...state.progress };
      
      batchKeys.forEach(key => {
        delete newLoadingKeys[key];
        delete newProgress[key];
      });
      
      const isStillLoading = Object.keys(newLoadingKeys).length > 0 || 
                             Object.keys(remainingBatches).length > 0;
      
      return {
        ...state,
        loadingKeys: newLoadingKeys,
        progress: newProgress,
        batchOperations: remainingBatches,
        isLoading: isStillLoading,
      };
    }

    case 'RESET_ALL':
      return {
        ...initialState,
        performanceMetrics: state.performanceMetrics, // Preserve metrics for analytics
      };

    case 'PERSIST_LOADING_STATE':
      return state; // The actual persistence is handled in the effect

    case 'RESTORE_LOADING_STATE':
      return {
        ...state,
        ...action.state,
      };

    default:
      return state;
  }
};

// Create context
const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Provider component
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(loadingReducer, initialState);
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const prevLocation = useRef(location);
  const theme = useTheme();
  
  // Handle route changes
  useEffect(() => {
    if (location.pathname !== prevLocation.current.pathname) {
      // Only persist loading states that should continue across routes
      const persistentKeys = Object.keys(state.loadingKeys).filter(key => 
        key.startsWith('global:') || key.startsWith('persistent:')
      );
      
      if (persistentKeys.length > 0) {
        dispatch({ type: 'PERSIST_LOADING_STATE' });
        
        // Store in sessionStorage for recovery on refresh
        const persistentState = {
          loadingKeys: {},
          progress: {},
          messages: {},
        };
        
        persistentKeys.forEach(key => {
          persistentState.loadingKeys[key] = state.loadingKeys[key];
          persistentState.progress[key] = state.progress[key];
          persistentState.messages[key] = state.messages[key];
        });
        
        sessionStorage.setItem('persistentLoadingState', JSON.stringify(persistentState));
      } else {
        // Reset non-persistent loading states on route change
        dispatch({ type: 'RESET_ALL' });
      }
      
      prevLocation.current = location;
    }
  }, [location, state.loadingKeys, state.progress, state.messages]);
  
  // Restore persistent loading state on mount
  useEffect(() => {
    const storedState = sessionStorage.getItem('persistentLoadingState');
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState);
        dispatch({ type: 'RESTORE_LOADING_STATE', state: parsedState });
      } catch (error) {
        console.error('Failed to restore loading state:', error);
      }
    }
  }, []);
  
  // Log performance metrics
  useEffect(() => {
    const completedMetrics = Object.entries(state.performanceMetrics)
      .filter(([_, metric]) => metric.completed && !metric.logged);
    
    completedMetrics.forEach(([key, metric]) => {
      if (metric.duration && metric.duration > 250) {
        logEvent('loading_performance', {
          key,
          duration: metric.duration,
          timestamp: new Date().toISOString(),
        });
        
        // Mark as logged
        state.performanceMetrics[key].logged = true;
      }
    });
  }, [state.performanceMetrics]);
  
  // Start loading with optional timeout
  const startLoading = useCallback((key: string, message?: string, timeout?: number) => {
    dispatch({ type: 'START_LOADING', key, message });
    
    // Set timeout to automatically stop loading if it takes too long
    if (timeout) {
      // Clear any existing timeout for this key
      if (timeoutRefs.current[key]) {
        clearTimeout(timeoutRefs.current[key]);
      }
      
      timeoutRefs.current[key] = setTimeout(() => {
        dispatch({ type: 'STOP_LOADING', key });
        dispatch({ 
          type: 'SET_ERROR', 
          key, 
          error: 'Operation timed out. Please try again.' 
        });
        
        // Log timeout for analytics
        logEvent('loading_timeout', {
          key,
          timeout,
          timestamp: new Date().toISOString(),
        });
      }, timeout);
    }
  }, []);
  
  // Stop loading and clear timeout
  const stopLoading = useCallback((key: string) => {
    dispatch({ type: 'STOP_LOADING', key });
    
    // Clear timeout if it exists
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key]);
      delete timeoutRefs.current[key];
    }
  }, []);
  
  // Set progress for a loading key
  const setProgress = useCallback((key: string, progress: number) => {
    dispatch({ type: 'SET_PROGRESS', key, progress });
  }, []);
  
  // Set error for a loading key
  const setError = useCallback((key: string, error: string | null) => {
    dispatch({ type: 'SET_ERROR', key, error });
  }, []);
  
  // Show loading overlay
  const showLoadingOverlay = useCallback((message: string, progress?: number) => {
    dispatch({ type: 'SHOW_OVERLAY', message, progress });
  }, []);
  
  // Hide loading overlay
  const hideLoadingOverlay = useCallback(() => {
    dispatch({ type: 'HIDE_OVERLAY' });
  }, []);
  
  // Reset all loading states
  const resetLoadingState = useCallback(() => {
    // Clear all timeouts
    Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout));
    timeoutRefs.current = {};
    
    dispatch({ type: 'RESET_ALL' });
  }, []);
  
  // Check if a specific key is loading
  const isLoadingKey = useCallback((key: string) => {
    return !!state.loadingKeys[key];
  }, [state.loadingKeys]);
  
  // Get progress for a specific key
  const getKeyProgress = useCallback((key: string) => {
    return state.progress[key] || 0;
  }, [state.progress]);
  
  // Get error for a specific key
  const getKeyError = useCallback((key: string) => {
    return state.errors[key] || null;
  }, [state.errors]);
  
  // Get message for a specific key
  const getKeyMessage = useCallback((key: string) => {
    return state.messages[key] || '';
  }, [state.messages]);
  
  // Start a batch loading operation
  const startBatchOperation = useCallback((batchId: string, keys: string[]) => {
    keys.forEach(key => {
      dispatch({ type: 'START_LOADING', key });
    });
    
    dispatch({ type: 'START_BATCH', batchId, keys });
  }, []);
  
  // Complete a batch loading operation
  const completeBatchOperation = useCallback((batchId: string) => {
    dispatch({ type: 'COMPLETE_BATCH', batchId });
  }, []);
  
  // Higher-order function to wrap async operations with loading state
  const withLoading = useCallback(async <T,>(key: string, fn: () => Promise<T>, message?: string): Promise<T> => {
    try {
      startLoading(key, message);
      const result = await fn();
      stopLoading(key);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(key, errorMessage);
      stopLoading(key);
      throw error;
    }
  }, [startLoading, stopLoading, setError]);
  
  // Get performance metrics for a specific key
  const getLoadingPerformance = useCallback((key: string) => {
    return state.performanceMetrics[key];
  }, [state.performanceMetrics]);
  
  // Get average loading time across all completed operations
  const getAverageLoadTime = useCallback(() => {
    const completedMetrics = Object.values(state.performanceMetrics)
      .filter(metric => metric.completed && metric.duration);
    
    if (completedMetrics.length === 0) return 0;
    
    const totalDuration = completedMetrics.reduce(
      (sum, metric) => sum + (metric.duration || 0), 
      0
    );
    
    return totalDuration / completedMetrics.length;
  }, [state.performanceMetrics]);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  const contextValue: LoadingContextType = {
    ...state,
    startLoading,
    stopLoading,
    setProgress,
    setError,
    showLoadingOverlay,
    hideLoadingOverlay,
    resetLoadingState,
    isLoadingKey,
    getKeyProgress,
    getKeyError,
    getKeyMessage,
    startBatchOperation,
    completeBatchOperation,
    withLoading,
    getLoadingPerformance,
    getAverageLoadTime,
  };
  
  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
      {state.showOverlay && (
        <div 
          className="loading-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `${theme.colors.background}e6`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: theme.colors.text,
            transition: 'all 0.3s ease',
          }}
          role="alert"
          aria-live="assertive"
        >
          <div 
            className="loading-spinner"
            style={{
              width: '50px',
              height: '50px',
              border: `4px solid ${theme.colors.primary}`,
              borderRadius: '50%',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }}
            aria-hidden="true"
          />
          <div 
            className="loading-message"
            style={{
              marginTop: '20px',
              fontSize: '18px',
              fontWeight: 500,
            }}
          >
            {state.overlayMessage}
          </div>
          {state.overlayProgress > 0 && (
            <div 
              className="loading-progress"
              style={{
                width: '200px',
                marginTop: '10px',
              }}
            >
              <div 
                style={{
                  width: '100%',
                  backgroundColor: theme.colors.border,
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div 
                  style={{
                    width: `${state.overlayProgress}%`,
                    backgroundColor: theme.colors.primary,
                    height: '100%',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                  role="progressbar"
                  aria-valuenow={state.overlayProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div 
                style={{
                  textAlign: 'center',
                  marginTop: '5px',
                  fontSize: '14px',
                }}
              >
                {state.overlayProgress}%
              </div>
            </div>
          )}
        </div>
      )}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </LoadingContext.Provider>
  );
};

// Custom hook to use the loading context
export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

// Alias for backwards compatibility
export const useLoadingContext = useLoading;

export default LoadingContext;
