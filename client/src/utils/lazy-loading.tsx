import React, { 
  lazy as reactLazy, 
  Suspense, 
  ComponentType, 
  LazyExoticComponent,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
  createElement,
  forwardRef,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes
} from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { logEvent } from '../utils/analytics';

// Types
export interface LazyComponentOptions {
  fallback?: React.ReactNode;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  preload?: boolean;
  trackProgress?: boolean;
  suspenseFallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onTimeout?: () => void;
  id?: string;
  priority?: 'high' | 'medium' | 'low';
  disableCache?: boolean;
}

export interface LazyLoadingState {
  loaded: boolean;
  loading: boolean;
  error: Error | null;
  progress: number;
  retryCount: number;
}

export interface PreloadOptions {
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
}

export interface IntersectionOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType<any> }>;
  preload?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

// Component cache
interface CacheEntry {
  component: LazyExoticComponent<ComponentType<any>>;
  promise: Promise<{ default: ComponentType<any> }> | null;
  loaded: boolean;
  error: Error | null;
  timestamp: number;
  loadTime?: number;
}

const componentCache = new Map<string, CacheEntry>();
const preloadQueue: Array<{ importFn: () => Promise<any>, priority: number }> = [];
let isProcessingQueue = false;

// Performance metrics
const performanceMetrics = {
  totalLoaded: 0,
  successfulLoads: 0,
  failedLoads: 0,
  averageLoadTime: 0,
  totalLoadTime: 0,
  timeouts: 0,
  retries: 0,
};

// Utility to generate a unique component ID
const generateComponentId = (importFn: () => Promise<{ default: ComponentType<any> }>): string => {
  return `lazy-component-${Math.random().toString(36).substring(2, 9)}`;
};

// Process preload queue
const processPreloadQueue = async () => {
  if (isProcessingQueue || preloadQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  // Sort by priority (lower number = higher priority)
  preloadQueue.sort((a, b) => a.priority - b.priority);
  
  // Take the highest priority item
  const { importFn } = preloadQueue.shift()!;
  
  try {
    await importFn();
  } catch (error) {
    console.error('Error preloading component:', error);
  }
  
  isProcessingQueue = false;
  
  // Continue processing queue if there are more items
  if (preloadQueue.length > 0) {
    // Small delay to allow other operations
    setTimeout(processPreloadQueue, 10);
  }
};

// Add to preload queue
const addToPreloadQueue = (importFn: () => Promise<any>, priority: number) => {
  preloadQueue.push({ importFn, priority });
  
  if (!isProcessingQueue) {
    processPreloadQueue();
  }
};

// Custom lazy loading implementation with enhanced features
export function enhancedLazy<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): LazyExoticComponent<T> & { preload: () => Promise<void> } {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1500,
    preload = false,
    id = generateComponentId(importFn),
    priority = 'medium',
    disableCache = false,
  } = options;
  
  // Check if component is already in cache
  if (!disableCache && componentCache.has(id)) {
    return componentCache.get(id)!.component as LazyExoticComponent<T> & { preload: () => Promise<void> };
  }
  
  // Create wrapper for the import function with retries and timeout
  const loadComponent = async (): Promise<{ default: T }> => {
    let lastError: Error | null = null;
    let attempts = 0;
    
    const startTime = performance.now();
    
    while (attempts <= retries) {
      try {
        // Create a promise with timeout
        const result = await Promise.race([
          importFn(),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              performanceMetrics.timeouts++;
              reject(new Error(`Component load timeout after ${timeout}ms`));
              if (options.onTimeout) options.onTimeout();
            }, timeout);
          })
        ]);
        
        const loadTime = performance.now() - startTime;
        
        // Update performance metrics
        performanceMetrics.totalLoaded++;
        performanceMetrics.successfulLoads++;
        performanceMetrics.totalLoadTime += loadTime;
        performanceMetrics.averageLoadTime = performanceMetrics.totalLoadTime / performanceMetrics.successfulLoads;
        
        // Log performance
        logEvent('component_lazy_loaded', {
          componentId: id,
          loadTime,
          retryAttempts: attempts,
        });
        
        // Update cache if using cache
        if (!disableCache && componentCache.has(id)) {
          const cacheEntry = componentCache.get(id)!;
          cacheEntry.loaded = true;
          cacheEntry.error = null;
          cacheEntry.loadTime = loadTime;
        }
        
        if (options.onLoad) options.onLoad();
        
        return result;
      } catch (error) {
        lastError = error as Error;
        performanceMetrics.retries++;
        
        // Log error
        logEvent('component_lazy_load_error', {
          componentId: id,
          error: lastError.message,
          attempt: attempts + 1,
          maxRetries: retries,
        });
        
        // Update cache if using cache
        if (!disableCache && componentCache.has(id)) {
          const cacheEntry = componentCache.get(id)!;
          cacheEntry.error = lastError;
        }
        
        if (options.onError) options.onError(lastError);
        
        if (attempts < retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempts + 1)));
          attempts++;
        } else {
          performanceMetrics.failedLoads++;
          throw lastError;
        }
      }
    }
    
    throw lastError;
  };
  
  // Create the lazy component
  const LazyComponent = reactLazy(loadComponent) as LazyExoticComponent<T> & { preload: () => Promise<void> };
  
  // Add preload method
  LazyComponent.preload = async () => {
    try {
      await loadComponent();
    } catch (error) {
      console.error('Error preloading component:', error);
    }
  };
  
  // Store in cache if using cache
  if (!disableCache) {
    componentCache.set(id, {
      component: LazyComponent,
      promise: null,
      loaded: false,
      error: null,
      timestamp: Date.now(),
    });
  }
  
  // Preload if requested
  if (preload) {
    const priorityValue = priority === 'high' ? 1 : priority === 'medium' ? 2 : 3;
    addToPreloadQueue(loadComponent, priorityValue);
  }
  
  return LazyComponent;
}

// Preload a component without rendering it
export const preloadComponent = async (
  importFn: () => Promise<{ default: ComponentType<any> }>,
  options: PreloadOptions = {}
): Promise<void> => {
  const { priority = 'medium', timeout = 10000 } = options;
  
  const priorityValue = priority === 'high' ? 1 : priority === 'medium' ? 2 : 3;
  
  return new Promise((resolve, reject) => {
    // Add timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`Preload timeout after ${timeout}ms`));
    }, timeout);
    
    // Add to queue
    addToPreloadQueue(async () => {
      try {
        await importFn();
        clearTimeout(timeoutId);
        resolve();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    }, priorityValue);
  });
};

// Preload multiple components
export const preloadComponents = async (
  importFns: Array<() => Promise<{ default: ComponentType<any> }>>,
  options: PreloadOptions = {}
): Promise<void[]> => {
  return Promise.all(importFns.map(importFn => preloadComponent(importFn, options)));
};

// Create a wrapper component that handles loading state, errors, and retries
export function withLazyLoading<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentOptions = {}
): React.FC<P> {
  const {
    fallback,
    suspenseFallback,
    errorFallback,
    id = generateComponentId(importFn),
    trackProgress = false,
  } = options;
  
  const LazyComponent = enhancedLazy(importFn, options);
  
  // Create the wrapper component
  const WrappedComponent: React.FC<P> = (props) => {
    const { startLoading, stopLoading, setProgress, setError, isLoadingKey } = useLoading();
    const [state, setState] = useState<LazyLoadingState>({
      loaded: false,
      loading: true,
      error: null,
      progress: 0,
      retryCount: 0,
    });
    const loadingKey = `lazy-load-${id}`;
    const isMounted = useRef(true);
    
    // Handle component loading
    useEffect(() => {
      if (!isLoadingKey(loadingKey)) {
        startLoading(loadingKey, `Loading component ${id}...`);
      }
      
      return () => {
        isMounted.current = false;
        stopLoading(loadingKey);
      };
    }, []);
    
    // Track progress if enabled
    useEffect(() => {
      if (!trackProgress) return;
      
      let progressInterval: NodeJS.Timeout;
      
      // Simulate progress
      if (state.loading && !state.loaded && !state.error) {
        progressInterval = setInterval(() => {
          if (!isMounted.current) return;
          
          setState(prev => {
            // Gradually increase progress, but never reach 100% until actually loaded
            const newProgress = Math.min(prev.progress + (Math.random() * 5), 95);
            setProgress(loadingKey, newProgress);
            return { ...prev, progress: newProgress };
          });
        }, 300);
      }
      
      return () => {
        if (progressInterval) clearInterval(progressInterval);
      };
    }, [state.loading, state.loaded, state.error, trackProgress]);
    
    // Handle successful load
    const handleLoad = useCallback(() => {
      if (!isMounted.current) return;
      
      setState(prev => ({ ...prev, loaded: true, loading: false, progress: 100 }));
      setProgress(loadingKey, 100);
      stopLoading(loadingKey);
    }, []);
    
    // Handle load error
    const handleError = useCallback((error: Error) => {
      if (!isMounted.current) return;
      
      setState(prev => ({ ...prev, error, loading: false }));
      setError(loadingKey, error.message);
    }, []);
    
    // Retry loading
    const handleRetry = useCallback(() => {
      if (!isMounted.current) return;
      
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        progress: 0,
        retryCount: prev.retryCount + 1,
      }));
      
      startLoading(loadingKey, `Retrying component load (${state.retryCount + 1})...`);
      
      // Force re-evaluation of the lazy component
      LazyComponent.preload().then(handleLoad).catch(handleError);
    }, [state.retryCount]);
    
    // Determine what to render
    if (state.error && errorFallback) {
      return createElement(errorFallback, { error: state.error, retry: handleRetry });
    }
    
    // Use custom fallback or loading state
    const actualFallback = suspenseFallback || fallback || (
      <div 
        role="progressbar" 
        aria-busy={true} 
        aria-valuemin={0} 
        aria-valuemax={100} 
        aria-valuenow={state.progress}
        className="lazy-loading-fallback"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100px',
          width: '100%',
        }}
      >
        {trackProgress ? (
          <div style={{ textAlign: 'center' }}>
            <div>Loading... {Math.round(state.progress)}%</div>
            <div 
              style={{
                width: '200px',
                height: '4px',
                backgroundColor: '#e0e0e0',
                borderRadius: '2px',
                overflow: 'hidden',
                margin: '8px auto',
              }}
            >
              <div 
                style={{
                  width: `${state.progress}%`,
                  height: '100%',
                  backgroundColor: '#2196f3',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    );
    
    return (
      <Suspense fallback={actualFallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
  
  WrappedComponent.displayName = `LazyLoaded(${id})`;
  
  return WrappedComponent;
}

// Higher-order component for forwarded refs
export function withLazyLoadingForwardRef<P extends object, R = any>(
  importFn: () => Promise<{ default: React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<R>> }>,
  options: LazyComponentOptions = {}
): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<R>> {
  const {
    fallback,
    suspenseFallback,
    errorFallback,
    id = generateComponentId(importFn),
    trackProgress = false,
  } = options;
  
  const LazyComponent = enhancedLazy(importFn, options);
  
  // Create the wrapper component with forwarded ref
  const WrappedComponent = forwardRef<R, P>((props, ref) => {
    const { startLoading, stopLoading, setProgress, setError, isLoadingKey } = useLoading();
    const [state, setState] = useState<LazyLoadingState>({
      loaded: false,
      loading: true,
      error: null,
      progress: 0,
      retryCount: 0,
    });
    const loadingKey = `lazy-load-${id}`;
    const isMounted = useRef(true);
    
    // Handle component loading
    useEffect(() => {
      if (!isLoadingKey(loadingKey)) {
        startLoading(loadingKey, `Loading component ${id}...`);
      }
      
      return () => {
        isMounted.current = false;
        stopLoading(loadingKey);
      };
    }, []);
    
    // Track progress if enabled
    useEffect(() => {
      if (!trackProgress) return;
      
      let progressInterval: NodeJS.Timeout;
      
      // Simulate progress
      if (state.loading && !state.loaded && !state.error) {
        progressInterval = setInterval(() => {
          if (!isMounted.current) return;
          
          setState(prev => {
            // Gradually increase progress, but never reach 100% until actually loaded
            const newProgress = Math.min(prev.progress + (Math.random() * 5), 95);
            setProgress(loadingKey, newProgress);
            return { ...prev, progress: newProgress };
          });
        }, 300);
      }
      
      return () => {
        if (progressInterval) clearInterval(progressInterval);
      };
    }, [state.loading, state.loaded, state.error, trackProgress]);
    
    // Handle successful load
    const handleLoad = useCallback(() => {
      if (!isMounted.current) return;
      
      setState(prev => ({ ...prev, loaded: true, loading: false, progress: 100 }));
      setProgress(loadingKey, 100);
      stopLoading(loadingKey);
    }, []);
    
    // Handle load error
    const handleError = useCallback((error: Error) => {
      if (!isMounted.current) return;
      
      setState(prev => ({ ...prev, error, loading: false }));
      setError(loadingKey, error.message);
    }, []);
    
    // Retry loading
    const handleRetry = useCallback(() => {
      if (!isMounted.current) return;
      
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        progress: 0,
        retryCount: prev.retryCount + 1,
      }));
      
      startLoading(loadingKey, `Retrying component load (${state.retryCount + 1})...`);
      
      // Force re-evaluation of the lazy component
      LazyComponent.preload().then(handleLoad).catch(handleError);
    }, [state.retryCount]);
    
    // Determine what to render
    if (state.error && errorFallback) {
      return createElement(errorFallback, { error: state.error, retry: handleRetry });
    }
    
    // Use custom fallback or loading state
    const actualFallback = suspenseFallback || fallback || (
      <div 
        role="progressbar" 
        aria-busy={true} 
        aria-valuemin={0} 
        aria-valuemax={100} 
        aria-valuenow={state.progress}
        className="lazy-loading-fallback"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100px',
          width: '100%',
        }}
      >
        {trackProgress ? (
          <div style={{ textAlign: 'center' }}>
            <div>Loading... {Math.round(state.progress)}%</div>
            <div 
              style={{
                width: '200px',
                height: '4px',
                backgroundColor: '#e0e0e0',
                borderRadius: '2px',
                overflow: 'hidden',
                margin: '8px auto',
              }}
            >
              <div 
                style={{
                  width: `${state.progress}%`,
                  height: '100%',
                  backgroundColor: '#2196f3',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    );
    
    return (
      <Suspense fallback={actualFallback}>
        <LazyComponent ref={ref} {...props} />
      </Suspense>
    );
  });
  
  WrappedComponent.displayName = `LazyLoadedWithRef(${id})`;
  
  return WrappedComponent;
}

// Intersection Observer hook for viewport-based loading
export const useIntersectionLazyLoad = (
  options: IntersectionOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] => {
  const { root = null, rootMargin = '100px', threshold = 0 } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, disconnect the observer
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold }
    );
    
    observer.observe(currentRef);
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [root, rootMargin, threshold]);
  
  return [ref, isVisible];
};

// Component for viewport-based lazy loading
export const ViewportLazyLoad: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  margin?: string;
  threshold?: number;
  onVisible?: () => void;
}> = ({ 
  children, 
  fallback = <div style={{ minHeight: '100px' }}></div>, 
  margin = '100px',
  threshold = 0,
  onVisible
}) => {
  const [ref, isVisible] = useIntersectionLazyLoad({
    rootMargin: margin,
    threshold,
  });
  
  useEffect(() => {
    if (isVisible && onVisible) {
      onVisible();
    }
  }, [isVisible, onVisible]);
  
  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};

// Route-based code splitting utilities
export const createLazyRoutes = (routes: RouteConfig[]): RouteConfig[] => {
  return routes.map(route => ({
    ...route,
    component: () => {
      const lazyComponent = enhancedLazy(route.component, {
        preload: route.preload,
        priority: route.priority,
        id: `route-${route.path}`,
      });
      
      return lazyComponent.preload().then(() => ({ default: lazyComponent }));
    },
  }));
};

// Preload routes based on current route
export const preloadAdjacentRoutes = (
  routes: RouteConfig[],
  currentPath: string,
  depth: number = 1
): void => {
  // Find routes that might be navigated to from the current route
  const currentIndex = routes.findIndex(route => route.path === currentPath);
  if (currentIndex === -1) return;
  
  // Preload routes before and after the current route
  const startIndex = Math.max(0, currentIndex - depth);
  const endIndex = Math.min(routes.length - 1, currentIndex + depth);
  
  for (let i = startIndex; i <= endIndex; i++) {
    if (i !== currentIndex) {
      preloadComponent(routes[i].component, {
        priority: i === currentIndex + 1 ? 'high' : 'medium',
      });
    }
  }
};

// Error boundary for lazy loaded components
export class LazyLoadErrorBoundary extends React.Component<{
  children: ReactNode;
  fallback: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error) => void;
}> {
  state = { hasError: false, error: null as Error | null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error);
    }
    
    logEvent('lazy_load_error', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }
  
  retry = () => {
    this.setState({ hasError: false, error: null });
  };
  
  render() {
    if (this.state.hasError && this.state.error) {
      return createElement(this.props.fallback, {
        error: this.state.error,
        retry: this.retry,
      });
    }
    
    return this.props.children;
  }
}

// Bundle analysis utility
export const analyzeBundleSize = (
  componentId: string,
  size: number
): void => {
  logEvent('bundle_size_analysis', {
    componentId,
    sizeKB: Math.round(size / 1024),
    timestamp: new Date().toISOString(),
  });
};

// Get performance metrics
export const getLazyLoadingMetrics = () => {
  return {
    ...performanceMetrics,
    cachedComponents: componentCache.size,
  };
};

// Clear component cache
export const clearComponentCache = (olderThan?: number): void => {
  if (olderThan) {
    const cutoffTime = Date.now() - olderThan;
    
    componentCache.forEach((entry, key) => {
      if (entry.timestamp < cutoffTime) {
        componentCache.delete(key);
      }
    });
  } else {
    componentCache.clear();
  }
};

// Default export with all utilities
export default {
  enhancedLazy,
  withLazyLoading,
  withLazyLoadingForwardRef,
  preloadComponent,
  preloadComponents,
  useIntersectionLazyLoad,
  ViewportLazyLoad,
  createLazyRoutes,
  preloadAdjacentRoutes,
  LazyLoadErrorBoundary,
  analyzeBundleSize,
  getLazyLoadingMetrics,
  clearComponentCache,
};
