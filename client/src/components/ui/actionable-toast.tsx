import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastTitle
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, AlertTriangle, Info, CheckCircle, Copy, RotateCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

// Error categories for better organization and handling
export enum ErrorCategory {
  NETWORK = "network",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  SERVER = "server",
  CLIENT = "client",
  UNKNOWN = "unknown"
}

// Props for the ActionableToast component
export interface ActionableToastProps {
  // Error information
  title: string;
  description: string;
  errorCode?: string;
  traceId?: string;
  category?: ErrorCategory;
  
  // Visual and behavior configuration
  variant?: "default" | "destructive" | "success" | "warning" | "info";
  duration?: number;
  showCloseButton?: boolean;
  
  // Action callbacks
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  onCopyDetails?: () => void;
  onContactSupport?: () => void;
  
  // Additional actions
  actions?: React.ReactNode;
  
  // Technical details (only shown to appropriate users)
  technicalDetails?: string;
  showTechnicalDetails?: boolean;
  
  // Telemetry
  reportToTelemetry?: boolean;
  
  // Accessibility
  ariaLive?: "assertive" | "polite" | "off";
}

// Rate limiting cache to prevent duplicate error toasts
const errorRateLimitCache = new Map<string, { timestamp: number, count: number }>();
const ERROR_RATE_LIMIT_WINDOW = 5000; // 5 seconds
const ERROR_RATE_LIMIT_MAX = 3; // Max 3 similar errors in window

/**
 * Utility to check if an error should be rate limited
 */
export const shouldRateLimitError = (errorKey: string): boolean => {
  const now = Date.now();
  const cached = errorRateLimitCache.get(errorKey);
  
  // Clean up old entries
  for (const [key, value] of errorRateLimitCache.entries()) {
    if (now - value.timestamp > ERROR_RATE_LIMIT_WINDOW) {
      errorRateLimitCache.delete(key);
    }
  }
  
  if (!cached) {
    errorRateLimitCache.set(errorKey, { timestamp: now, count: 1 });
    return false;
  }
  
  if (now - cached.timestamp > ERROR_RATE_LIMIT_WINDOW) {
    errorRateLimitCache.set(errorKey, { timestamp: now, count: 1 });
    return false;
  }
  
  cached.count += 1;
  errorRateLimitCache.set(errorKey, cached);
  
  return cached.count > ERROR_RATE_LIMIT_MAX;
};

/**
 * Format error message for user display
 */
export const formatErrorMessage = (message: string, isUserFriendly: boolean = true): string => {
  if (!message) return "An unknown error occurred";
  
  if (isUserFriendly) {
    // Remove technical details, stack traces, etc.
    let userMessage = message
      .replace(/Error:\s/g, '')
      .replace(/\{.*\}/g, '')
      .replace(/at\s.*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
      
    // Cap length for display
    if (userMessage.length > 150) {
      userMessage = userMessage.substring(0, 147) + '...';
    }
    
    return userMessage;
  }
  
  return message;
};

/**
 * ActionableToast component for enhanced error UX
 */
export const ActionableToast: React.FC<ActionableToastProps> = ({
  title,
  description,
  errorCode,
  traceId,
  category = ErrorCategory.UNKNOWN,
  variant = "destructive",
  duration = 8000,
  showCloseButton = true,
  onRetry,
  onDismiss,
  onCopyDetails,
  onContactSupport,
  actions,
  technicalDetails,
  showTechnicalDetails = false,
  reportToTelemetry = true,
  ariaLive = "assertive"
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const progressTimerRef = useRef<number | null>(null);
  
  // Handle retry logic
  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return;
    
    setIsRetrying(true);
    setRetryProgress(0);
    
    // Animate progress
    const startTime = Date.now();
    const animationDuration = 2000; // 2 seconds for retry animation
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / animationDuration) * 100);
      setRetryProgress(progress);
      
      if (progress < 100) {
        progressTimerRef.current = window.setTimeout(updateProgress, 50);
      }
    };
    
    progressTimerRef.current = window.setTimeout(updateProgress, 50);
    
    try {
      await onRetry();
      setRetryCount(prev => prev + 1);
      // Success handling can be added here
    } catch (error) {
      // Failed retry handling
      console.error("Retry failed:", error);
    } finally {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
      setIsRetrying(false);
    }
  }, [onRetry, isRetrying]);
  
  // Report to telemetry on mount
  useEffect(() => {
    if (reportToTelemetry) {
      // Integration with telemetry system
      try {
        const telemetryData = {
          errorCode,
          traceId,
          category,
          message: description,
          timestamp: new Date().toISOString(),
          technicalDetails: showTechnicalDetails ? technicalDetails : undefined
        };
        
        // Send to telemetry service (mock implementation)
        console.info("Reporting to telemetry:", telemetryData);
        // Actual implementation would call a telemetry service
      } catch (err) {
        console.error("Failed to report to telemetry:", err);
      }
    }
    
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, [reportToTelemetry, errorCode, traceId, category, description, technicalDetails, showTechnicalDetails]);
  
  // Handle copy to clipboard
  const handleCopyDetails = useCallback(() => {
    const detailsText = `
Error: ${title}
Description: ${description}
${errorCode ? `Error Code: ${errorCode}` : ''}
${traceId ? `Trace ID: ${traceId}` : ''}
${category ? `Category: ${category}` : ''}
${technicalDetails ? `Technical Details: ${technicalDetails}` : ''}
Timestamp: ${new Date().toISOString()}
    `.trim();
    
    navigator.clipboard.writeText(detailsText).then(() => {
      if (onCopyDetails) {
        onCopyDetails();
      }
    }).catch(err => {
      console.error("Failed to copy error details:", err);
    });
  }, [title, description, errorCode, traceId, category, technicalDetails, onCopyDetails]);
  
  // Get icon based on variant
  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "success":
        return <CheckCircle className="h-5 w-5" />;
      case "info":
      default:
        return <Info className="h-5 w-5" />;
    }
  };
  
  return (
    <Toast 
      variant={variant}
      className={cn(
        "group flex flex-col",
        expanded && "min-h-[150px]"
      )}
      aria-live={ariaLive}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-1">
          {getIcon()}
        </div>
        
        <div className="flex-1 space-y-1">
          <ToastTitle className="font-medium">
            {title}
            {errorCode && (
              <span className="ml-2 text-xs opacity-70">[{errorCode}]</span>
            )}
          </ToastTitle>
          
          <ToastDescription className="text-sm">
            {formatErrorMessage(description, !showTechnicalDetails)}
          </ToastDescription>
          
          {/* Trace ID display (only when appropriate) */}
          {traceId && showTechnicalDetails && (
            <div className="mt-2 flex items-center text-xs opacity-70">
              <span className="mr-1">Trace ID:</span>
              <code className="px-1 py-0.5 bg-muted rounded">{traceId}</code>
            </div>
          )}
          
          {/* Technical details (expandable) */}
          {technicalDetails && showTechnicalDetails && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs underline opacity-70 hover:opacity-100"
                aria-expanded={expanded}
              >
                {expanded ? "Hide technical details" : "Show technical details"}
              </button>
              
              {expanded && (
                <pre className="mt-2 p-2 text-xs bg-muted rounded overflow-x-auto max-h-[200px]">
                  {technicalDetails}
                </pre>
              )}
            </div>
          )}
          
          {/* Retry progress indicator */}
          {isRetrying && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Retrying...</span>
                <span>{Math.round(retryProgress)}%</span>
              </div>
              <Progress value={retryProgress} className="h-1" />
            </div>
          )}
          
          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && !isRetrying && (
              <ToastAction 
                onClick={handleRetry} 
                className="flex items-center gap-1"
                altText="Retry the operation"
                disabled={isRetrying}
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Retry</span>
                {retryCount > 0 && (
                  <span className="text-xs ml-1">({retryCount})</span>
                )}
              </ToastAction>
            )}
            
            {onContactSupport && (
              <ToastAction 
                onClick={onContactSupport}
                className="flex items-center gap-1"
                altText="Contact support"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Support</span>
              </ToastAction>
            )}
            
            <Tooltip content="Copy error details">
              <button
                onClick={handleCopyDetails}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Copy error details to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            
            {/* Additional custom actions */}
            {actions}
          </div>
        </div>
      </div>
      
      {showCloseButton && (
        <ToastClose 
          onClick={onDismiss}
          aria-label="Close error notification"
        />
      )}
    </Toast>
  );
};

/**
 * Hook for using ActionableToast with the toast system
 */
export const useActionableToast = () => {
  const { toast } = useToast();
  
  const showErrorToast = useCallback((
    props: Omit<ActionableToastProps, 'variant'> & { id?: string }
  ) => {
    const { id, ...restProps } = props;
    
    // Rate limit similar errors
    if (props.errorCode) {
      const errorKey = `${props.errorCode}-${props.category || ''}`;
      if (shouldRateLimitError(errorKey)) {
        console.info(`Rate limited error toast: ${errorKey}`);
        return;
      }
    }
    
    return toast({
      id,
      variant: "destructive",
      duration: props.duration || 8000,
      title: props.title,
      description: props.description,
      action: (
        <ActionableToast 
          {...restProps}
          variant="destructive"
        />
      ),
    });
  }, [toast]);
  
  const showWarningToast = useCallback((
    props: Omit<ActionableToastProps, 'variant'> & { id?: string }
  ) => {
    const { id, ...restProps } = props;
    
    return toast({
      id,
      variant: "warning",
      duration: props.duration || 6000,
      title: props.title,
      description: props.description,
      action: (
        <ActionableToast 
          {...restProps}
          variant="warning"
        />
      ),
    });
  }, [toast]);
  
  const showInfoToast = useCallback((
    props: Omit<ActionableToastProps, 'variant'> & { id?: string }
  ) => {
    const { id, ...restProps } = props;
    
    return toast({
      id,
      variant: "info",
      duration: props.duration || 5000,
      title: props.title,
      description: props.description,
      action: (
        <ActionableToast 
          {...restProps}
          variant="info"
        />
      ),
    });
  }, [toast]);
  
  const showSuccessToast = useCallback((
    props: Omit<ActionableToastProps, 'variant'> & { id?: string }
  ) => {
    const { id, ...restProps } = props;
    
    return toast({
      id,
      variant: "success",
      duration: props.duration || 4000,
      title: props.title,
      description: props.description,
      action: (
        <ActionableToast 
          {...restProps}
          variant="success"
        />
      ),
    });
  }, [toast]);
  
  return {
    showErrorToast,
    showWarningToast,
    showInfoToast,
    showSuccessToast
  };
};

export default ActionableToast;
