import * as React from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw, RefreshCw, HelpCircle, Copy, Home } from "lucide-react";
import { useActionableToast, ErrorCategory } from "@/components/ui/actionable-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Error boundary feature flags
export enum ErrorFeatureFlag {
  SHOW_TRACE_ID = "error.showTraceId",
  ENABLE_TELEMETRY = "error.enableTelemetry",
  SHOW_TECHNICAL_DETAILS = "error.showTechnicalDetails",
  ENABLE_AUTO_RETRY = "error.enableAutoRetry",
  USE_MINIMAL_FALLBACK = "error.useMinimalFallback"
}

// Error severity levels
export enum ErrorSeverity {
  CRITICAL = "critical", // Application cannot continue
  HIGH = "high",         // Feature is completely broken
  MEDIUM = "medium",     // Feature is partially broken but usable
  LOW = "low"            // Minor issues that don't affect core functionality
}

// Error location/context
export enum ErrorContext {
  APP = "app",           // Top-level app error
  PAGE = "page",         // Page-level error
  COMPONENT = "component", // Component-level error
  DATA = "data",         // Data loading/processing error
  FORM = "form",         // Form submission error
  MEDIA = "media"        // Media loading error
}

// Error type classification
export enum ErrorType {
  NETWORK = "network",   // Network/API errors
  RENDERING = "rendering", // React rendering errors
  LOGIC = "logic",       // Business logic errors
  VALIDATION = "validation", // Input validation errors
  AUTHENTICATION = "authentication", // Auth errors
  PERMISSION = "permission", // Permission errors
  RESOURCE = "resource", // Resource not found/unavailable
  TIMEOUT = "timeout",   // Operation timeout
  UNKNOWN = "unknown"    // Unclassified errors
}

// Extended error interface with metadata
export interface ExtendedError extends Error {
  code?: string;
  status?: number;
  traceId?: string;
  context?: ErrorContext;
  type?: ErrorType;
  severity?: ErrorSeverity;
  retry?: () => Promise<void>;
  timestamp?: string;
  metadata?: Record<string, any>;
  originalError?: unknown;
}

// Error boundary props
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((props: ErrorFallbackProps) => React.ReactNode);
  onError?: (error: ExtendedError, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  context?: ErrorContext;
  resetKeys?: any[];
  showToast?: boolean;
  featureFlags?: Partial<Record<ErrorFeatureFlag, boolean>>;
  telemetryService?: {
    captureException: (error: Error, context?: any) => void;
    setContext: (name: string, context: Record<string, any>) => void;
  };
  className?: string;
  maxRetries?: number;
  retryInterval?: number;
  supportEmail?: string;
  supportUrl?: string;
  homeUrl?: string;
}

// Error fallback props
export interface ErrorFallbackProps {
  error: ExtendedError;
  errorInfo?: React.ErrorInfo | null | undefined;
  resetErrorBoundary: () => void;
  context?: ErrorContext;
  featureFlags?: Partial<Record<ErrorFeatureFlag, boolean>>;
  retryCount?: number;
  maxRetries?: number;
  retryError?: () => Promise<void>;
  isRetrying?: boolean;
  supportEmail?: string;
  supportUrl?: string;
  homeUrl?: string;
}

// Default feature flags
const DEFAULT_FEATURE_FLAGS: Record<ErrorFeatureFlag, boolean> = {
  [ErrorFeatureFlag.SHOW_TRACE_ID]: true,
  [ErrorFeatureFlag.ENABLE_TELEMETRY]: true,
  [ErrorFeatureFlag.SHOW_TECHNICAL_DETAILS]: false,
  [ErrorFeatureFlag.ENABLE_AUTO_RETRY]: true,
  [ErrorFeatureFlag.USE_MINIMAL_FALLBACK]: false
};

// Helper to classify errors
export const classifyError = (error: unknown): ExtendedError => {
  if (!error) {
    return new Error("Unknown error occurred") as ExtendedError;
  }

  // If it's already an ExtendedError, return it
  if (
    error instanceof Error && 
    'context' in error && 
    'type' in error && 
    'severity' in error
  ) {
    return error as ExtendedError;
  }

  let extendedError: ExtendedError;

  if (error instanceof Error) {
    extendedError = error as ExtendedError;
  } else if (typeof error === 'string') {
    extendedError = new Error(error) as ExtendedError;
  } else {
    try {
      extendedError = new Error(JSON.stringify(error)) as ExtendedError;
      extendedError.originalError = error;
    } catch (e) {
      extendedError = new Error("Unknown error occurred") as ExtendedError;
      extendedError.originalError = error;
    }
  }

  // Set defaults if not already set
  extendedError.context = extendedError.context || ErrorContext.COMPONENT;
  extendedError.type = extendedError.type || ErrorType.UNKNOWN;
  extendedError.severity = extendedError.severity || ErrorSeverity.MEDIUM;
  extendedError.timestamp = extendedError.timestamp || new Date().toISOString();

  // Try to classify network errors
  if (
    extendedError.message.includes("network") ||
    extendedError.message.includes("fetch") ||
    extendedError.message.includes("api") ||
    extendedError.message.includes("timeout") ||
    extendedError.message.includes("connection")
  ) {
    extendedError.type = ErrorType.NETWORK;
  }

  // Extract HTTP status if present
  const statusMatch = extendedError.message.match(/status (\d+)/i);
  if (statusMatch && statusMatch[1]) {
    extendedError.status = parseInt(statusMatch[1], 10);
    
    // Classify based on status code
    if (extendedError.status >= 500) {
      extendedError.type = ErrorType.NETWORK;
      extendedError.severity = ErrorSeverity.HIGH;
    } else if (extendedError.status === 404) {
      extendedError.type = ErrorType.RESOURCE;
      extendedError.severity = ErrorSeverity.MEDIUM;
    } else if (extendedError.status === 403) {
      extendedError.type = ErrorType.PERMISSION;
      extendedError.severity = ErrorSeverity.HIGH;
    } else if (extendedError.status === 401) {
      extendedError.type = ErrorType.AUTHENTICATION;
      extendedError.severity = ErrorSeverity.HIGH;
    } else if (extendedError.status >= 400) {
      extendedError.type = ErrorType.VALIDATION;
      extendedError.severity = ErrorSeverity.MEDIUM;
    }
  }

  // Extract trace ID if present
  const traceIdMatch = extendedError.message.match(/trace[_-]?id:?\s*([a-z0-9-]+)/i);
  if (traceIdMatch && traceIdMatch[1]) {
    extendedError.traceId = traceIdMatch[1];
  }

  return extendedError;
};

// Default fallback UI component
export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
  context = ErrorContext.COMPONENT,
  featureFlags = DEFAULT_FEATURE_FLAGS,
  retryCount = 0,
  maxRetries = 3,
  retryError,
  isRetrying = false,
  supportEmail,
  supportUrl,
  homeUrl
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { showErrorToast } = useActionableToast();

  // Format error for display
  const errorMessage = error.message || "An unexpected error occurred";
  const errorTitle = (() => {
    switch (error.type) {
      case ErrorType.NETWORK:
        return "Connection Error";
      case ErrorType.RENDERING:
        return "Display Error";
      case ErrorType.AUTHENTICATION:
        return "Authentication Error";
      case ErrorType.PERMISSION:
        return "Permission Error";
      case ErrorType.RESOURCE:
        return "Resource Not Found";
      case ErrorType.TIMEOUT:
        return "Operation Timeout";
      case ErrorType.VALIDATION:
        return "Validation Error";
      default:
        return "Unexpected Error";
    }
  })();

  // User-friendly guidance based on error type
  const userGuidance = (() => {
    switch (error.type) {
      case ErrorType.NETWORK:
        return "Please check your internet connection and try again.";
      case ErrorType.AUTHENTICATION:
        return "Your session may have expired. Please sign in again.";
      case ErrorType.PERMISSION:
        return "You don't have permission to access this feature.";
      case ErrorType.RESOURCE:
        return "The requested resource could not be found.";
      case ErrorType.TIMEOUT:
        return "The operation took too long to complete. Please try again.";
      default:
        return "We've logged this issue and are working to fix it.";
    }
  })();

  // Handle copy error details
  const handleCopyDetails = () => {
    const details = `
Error: ${errorTitle}
Message: ${errorMessage}
${error.code ? `Code: ${error.code}` : ''}
${error.traceId && featureFlags[ErrorFeatureFlag.SHOW_TRACE_ID] ? `Trace ID: ${error.traceId}` : ''}
Type: ${error.type}
Context: ${context}
Timestamp: ${error.timestamp || new Date().toISOString()}
${error.stack && featureFlags[ErrorFeatureFlag.SHOW_TECHNICAL_DETAILS] ? `\nStack Trace:\n${error.stack}` : ''}
    `.trim();

    navigator.clipboard.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Handle retry
  const handleRetry = async () => {
    if (retryError) {
      try {
        await retryError();
      } catch (e) {
        console.error("Retry failed:", e);
      }
    } else {
      resetErrorBoundary();
    }
  };

  // Handle contact support
  const handleContactSupport = () => {
    if (supportUrl) {
      window.open(supportUrl, '_blank');
    } else if (supportEmail) {
      window.location.href = `mailto:${supportEmail}?subject=Error Report&body=Error Details:%0A%0ATrace ID: ${error.traceId || 'N/A'}%0ATimestamp: ${error.timestamp || new Date().toISOString()}%0AError: ${encodeURIComponent(errorMessage)}`;
    }
  };

  // Show toast notification for component-level errors
  useEffect(() => {
    if (context === ErrorContext.COMPONENT) {
      showErrorToast({
        title: errorTitle,
        description: errorMessage,
        errorCode: error.code,
        traceId: error.traceId,
        category: ErrorCategory.CLIENT,
        onRetry: async () => { 
          if (retryError) {
            await retryError();
          } else {
            resetErrorBoundary();
          }
        },
        onContactSupport: supportEmail || supportUrl ? handleContactSupport : undefined,
        showTechnicalDetails: featureFlags[ErrorFeatureFlag.SHOW_TECHNICAL_DETAILS],
        technicalDetails: error.stack
      });
    }
  }, []);

  // Different UI based on context
  if (featureFlags[ErrorFeatureFlag.USE_MINIMAL_FALLBACK]) {
    return (
      <div 
        className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="font-medium">{errorTitle}</h3>
        </div>
        <p className="text-sm mb-2">{errorMessage}</p>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={resetErrorBoundary}
          className="mt-2"
          aria-label="Try again"
        >
          <RotateCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  // Full error UI with different layouts based on context
  if (context === ErrorContext.APP) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold mb-2">{errorTitle}</h1>
            <p className="text-muted-foreground">{userGuidance}</p>
          </div>

          {error.traceId && featureFlags[ErrorFeatureFlag.SHOW_TRACE_ID] && (
            <div className="mb-4 text-center">
              <p className="text-xs text-muted-foreground">
                Reference ID: <code className="px-1 py-0.5 bg-muted rounded">{error.traceId}</code>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={handleRetry}
              disabled={isRetrying || retryCount >= maxRetries}
              aria-label="Try again"
            >
              {isRetrying ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>

            {(supportEmail || supportUrl) && (
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleContactSupport}
                aria-label="Contact support"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            )}

            {homeUrl && (
              <Button 
                className="w-full" 
                variant="ghost"
                onClick={() => window.location.href = homeUrl}
                aria-label="Return to home"
              >
                <Home className="h-4 w-4 mr-2" />
                Return to Home
              </Button>
            )}
          </div>

          {featureFlags[ErrorFeatureFlag.SHOW_TECHNICAL_DETAILS] && (
            <div className="mt-6">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs underline text-muted-foreground hover:text-foreground"
                aria-expanded={expanded}
              >
                {expanded ? "Hide technical details" : "Show technical details"}
              </button>
              
              {expanded && (
                <div className="mt-2 relative">
                  <pre className="text-xs p-3 bg-muted rounded overflow-x-auto max-h-[200px]">
                    {error.stack || errorMessage}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={handleCopyDetails}
                    aria-label="Copy error details"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {copied && (
            <div className="mt-2 text-xs text-center text-green-600 dark:text-green-400">
              Error details copied to clipboard
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Page-level error
  if (context === ErrorContext.PAGE) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-md">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">{errorTitle}</h2>
              <p className="text-sm text-muted-foreground mb-2">{userGuidance}</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          </div>

          {error.traceId && featureFlags[ErrorFeatureFlag.SHOW_TRACE_ID] && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground">
                Reference ID: <code className="px-1 py-0.5 bg-muted rounded">{error.traceId}</code>
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying || retryCount >= maxRetries}
              aria-label="Try again"
            >
              {isRetrying ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Try Again
                </>
              )}
            </Button>

            {(supportEmail || supportUrl) && (
              <Button 
                size="sm"
                variant="outline"
                onClick={handleContactSupport}
                aria-label="Contact support"
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                Contact Support
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyDetails}
              aria-label="Copy error details"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {copied ? "Copied!" : "Copy Details"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Component/default error
  return (
    <div 
      className="rounded-md border bg-background p-4 shadow-sm"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium mb-1">{errorTitle}</h3>
          <p className="text-sm text-muted-foreground mb-2">{errorMessage}</p>
          
          {error.traceId && featureFlags[ErrorFeatureFlag.SHOW_TRACE_ID] && (
            <p className="text-xs text-muted-foreground mb-2">
              Reference ID: <code className="px-1 py-0.5 bg-muted rounded">{error.traceId}</code>
            </p>
          )}
          
          <div className="flex flex-wrap gap-2 mt-3">
            <Button 
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying || retryCount >= maxRetries}
              aria-label="Try again"
            >
              {isRetrying ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Try Again
                </>
              )}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyDetails}
              aria-label="Copy error details"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Media error fallback
export const MediaErrorFallback: React.FC<ErrorFallbackProps> = (props) => {
  return (
    <div 
      className="rounded-md bg-muted flex items-center justify-center p-4 aspect-video"
      role="alert"
    >
      <div className="text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">Media Loading Error</p>
        <p className="text-xs text-muted-foreground mb-3">
          {props.error.message || "Failed to load media"}
        </p>
        <Button 
          size="sm" 
          onClick={props.resetErrorBoundary}
          aria-label="Try again"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reload
        </Button>
      </div>
    </div>
  );
};

// Form error fallback
export const FormErrorFallback: React.FC<ErrorFallbackProps> = (props) => {
  return (
    <div 
      className="rounded-md border border-destructive/20 bg-destructive/5 p-3 my-3"
      role="alert"
    >
      <div className="flex items-center gap-2 text-destructive mb-1">
        <AlertTriangle className="h-4 w-4" />
        <p className="font-medium">Form Submission Error</p>
      </div>
      <p className="text-sm mb-2">{props.error.message}</p>
      <Button 
        size="sm" 
        variant="outline" 
        onClick={props.resetErrorBoundary}
        className="mt-1"
        aria-label="Try again"
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Try Again
      </Button>
    </div>
  );
};

// Main Error Boundary component
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { error: ExtendedError | null; errorInfo: React.ErrorInfo | null | undefined; retryCount: number; isRetrying: boolean }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      error: null, 
      errorInfo: null, 
      retryCount: 0,
      isRetrying: false 
    };
  }

  static getDerivedStateFromError(error: unknown): { error: ExtendedError } {
    return { error: classifyError(error) };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Classify the error
    const extendedError = classifyError(error);
    
    // Update state with error details
    this.setState({ error: extendedError, errorInfo });
    
    // Call onError handler if provided
    if (this.props.onError) {
      this.props.onError(extendedError, errorInfo);
    }
    
    // Report to telemetry if enabled
    const featureFlags = { ...DEFAULT_FEATURE_FLAGS, ...this.props.featureFlags };
    if (featureFlags[ErrorFeatureFlag.ENABLE_TELEMETRY] && this.props.telemetryService) {
      try {
        this.props.telemetryService.setContext('error', {
          message: extendedError.message,
          stack: extendedError.stack,
          componentStack: errorInfo.componentStack,
          context: this.props.context || ErrorContext.COMPONENT,
          type: extendedError.type,
          severity: extendedError.severity,
          traceId: extendedError.traceId,
          timestamp: new Date().toISOString()
        });
        
        this.props.telemetryService.captureException(extendedError);
      } catch (telemetryError) {
        console.error("Failed to report error to telemetry:", telemetryError);
      }
    }
    
    // Log the error to console
    console.error("Error caught by ErrorBoundary:", extendedError);
    console.error("Component stack:", errorInfo.componentStack);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys change
    if (this.props.resetKeys && 
        prevProps.resetKeys && 
        this.state.error && 
        this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({ error: null, errorInfo: null, retryCount: 0, isRetrying: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  retryError = async () => {
    if (this.state.isRetrying) return;
    
    this.setState({ isRetrying: true });
    
    // Implement retry with exponential backoff
    const retryInterval = this.props.retryInterval || 1000;
    const backoff = Math.min(retryInterval * Math.pow(1.5, this.state.retryCount), 10000);
    
    try {
      // Wait for backoff period
      await new Promise(resolve => setTimeout(resolve, backoff));
      
      // Increment retry count
      this.setState(prevState => ({ retryCount: prevState.retryCount + 1 }));
      
      // Reset error state to trigger re-render
      this.resetErrorBoundary();
    } catch (e) {
      console.error("Error during retry:", e);
    } finally {
      this.setState({ isRetrying: false });
    }
  };

  override render() {
    const { children, fallback, context, featureFlags, maxRetries, supportEmail, supportUrl, homeUrl, className } = this.props;
    const { error, errorInfo, retryCount, isRetrying } = this.state;
    
    // If there's no error, render children
    if (!error) {
      return children;
    }
    
    // Merge feature flags with defaults
    const mergedFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
    
    // Props for fallback component
    const fallbackProps: ErrorFallbackProps = {
      error,
      errorInfo,
      resetErrorBoundary: this.resetErrorBoundary,
      context: context || ErrorContext.COMPONENT,
      featureFlags: mergedFeatureFlags,
      retryCount,
      maxRetries: maxRetries || 3,
      retryError: this.retryError,
      isRetrying,
      supportEmail,
      supportUrl,
      homeUrl
    };
    
    // Render the appropriate fallback UI
    if (fallback) {
      if (typeof fallback === 'function') {
        return <div className={className}>{fallback(fallbackProps)}</div>;
      }
      return <div className={className}>{fallback}</div>;
    }
    
    // Use context-specific fallbacks
    if (context === ErrorContext.MEDIA) {
      return <div className={className}><MediaErrorFallback {...fallbackProps} /></div>;
    }
    
    if (context === ErrorContext.FORM) {
      return <div className={className}><FormErrorFallback {...fallbackProps} /></div>;
    }
    
    // Default fallback
    return <div className={className}><DefaultErrorFallback {...fallbackProps} /></div>;
  }
}

// Error boundary hook for functional components
export const useErrorBoundary = () => {
  const [error, setError] = useState<ExtendedError | null>(null);
  
  const showBoundary = (e: unknown) => {
    setError(classifyError(e));
  };
  
  return { showBoundary, error };
};

// HOC to wrap components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  
  WrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  
  return WrappedComponent;
}

export default ErrorBoundary;
