import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';
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
  state: LoadingState;
  startLoading: (options?: Partial<LoadingState>) => void;
  updateLoading: (options: Partial<LoadingState>) => void;
  stopLoading: () => void;
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
  updateLoading: () => {},
  stopLoading: () => {},
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
  const { theme } = useTheme();
  const [state, setState] = useState<LoadingState>({
    ...defaultLoadingState,
    ...initialState,
  });

  // Start a loading operation
  const startLoading = (options: Partial<LoadingState> = {}) => {
    setState(prevState => ({
      ...prevState,
      ...options,
      isLoading: true,
      progress: options.progress ?? 0,
    }));

    // Log loading start event
    logEvent('loading_started', {
      message: options.message || prevState.message,
      indeterminate: options.indeterminate !== undefined ? options.indeterminate : prevState.indeterminate,
    });
  };

  // Update an in-progress loading operation
  const updateLoading = (options: Partial<LoadingState>) => {
    if (!state.isLoading) return;

    setState(prevState => ({
      ...prevState,
      ...options,
    }));

    // Log progress update for determinate loaders
    if (!state.indeterminate && options.progress !== undefined) {
      logEvent('loading_progress_update', {
        progress: options.progress,
        message: options.message || state.message,
      });
    }
  };

  // Stop the current loading operation
  const stopLoading = () => {
    if (!state.isLoading) return;

    setState(prevState => ({
      ...prevState,
      isLoading: false,
      progress: 100,
    }));

    // Log loading complete event
    logEvent('loading_completed', {
      message: state.message,
      duration: 0, // Would calculate real duration in a production implementation
    });

    // Reset to default state after a short delay to allow for animations
    setTimeout(() => {
      setState(prevState => ({
        ...defaultLoadingState,
        ...initialState,
      }));
    }, 300);
  };

  // Provide the loading context to children
  return (
    <LoadingContext.Provider
      value={{
        state,
        startLoading,
        updateLoading,
        stopLoading,
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

// Add alias for backward compatibility
export const useLoadingContext = useLoading;

// Default export for direct imports
export default LoadingContext;
