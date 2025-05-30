import * as React from "react";
import { useEffect, useState } from "react";

// Error boundary feature flags
export enum ErrorFeatureFlag {
  SHOW_TRACE_ID = "error.showTraceId",
  ENABLE_TELEMETRY = "error.enableTelemetry",
  SHOW_TECHNICAL_DETAILS = "error.showTechnicalDetails",
  ENABLE_AUTO_RETRY = "error.enableAutoRetry",
  USE_MINIMAL_FALLBACK = "error.useMinimalFallback"
}

// Error context for categorizing errors
export enum ErrorContext {
  COMPONENT = "component",
  ROUTE = "route",
  API = "api",
  AUTH = "auth",
  WEBSOCKET = "websocket"
}

// Enhanced error interface
export interface ExtendedError extends Error {
  errorId?: string;
  timestamp?: Date;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'ui' | 'api' | 'auth' | 'data' | 'network';
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
  retryCount?: number;
  isRetryable?: boolean;
  supportContact?: {
    email?: string;
    phone?: string;
    url?: string;
  };
}

// Error boundary props
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: ExtendedError, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  featureFlags?: Partial<Record<ErrorFeatureFlag, boolean>>;
  context?: ErrorContext;
  level?: 'page' | 'section' | 'component';
  maxRetries?: number;
  retryDelay?: number;
  enableAutoRetry?: boolean;
  enableTelemetry?: boolean;
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

// State interface
interface ErrorBoundaryState {
  error: ExtendedError | null;
  errorInfo: React.ErrorInfo | null | undefined;
  retryCount: number;
  isRetrying: boolean;
}

// Main error boundary component
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const extendedError: ExtendedError = {
      ...error,
      errorId: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    return {
      error: extendedError,
      errorInfo: null
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const extendedError: ExtendedError = {
      ...this.state.error,
      ...error,
      component: this.props.context || ErrorContext.COMPONENT,
      category: this.categorizeError(error),
      severity: this.getSeverity(error),
      isRetryable: this.isRetryableError(error)
    };

    this.setState({
      error: extendedError,
      errorInfo: errorInfo as React.ErrorInfo | undefined,
    });

    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(extendedError, errorInfo);
    }

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

  override componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  resetErrorBoundary = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.setState({
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false
    });
  };

  retryError = async () => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: false
      }));
    }, retryDelay);
  };

  private categorizeError(error: Error): ExtendedError['category'] {
    if (error.message?.includes('ChunkLoadError') || error.message?.includes('Loading chunk')) {
      return 'network';
    }
    if (error.message?.includes('Unauthorized') || error.message?.includes('token')) {
      return 'auth';
    }
    if (error.message?.includes('fetch') || error.message?.includes('API')) {
      return 'api';
    }
    return 'ui';
  }

  private getSeverity(error: Error): ExtendedError['severity'] {
    if (error.message?.includes('CRITICAL') || error.message?.includes('FATAL')) {
      return 'critical';
    }
    if (error.message?.includes('ChunkLoadError')) {
      return 'medium';
    }
    return 'low';
  }

  private isRetryableError(error: Error): boolean {
    return error.message?.includes('ChunkLoadError') || 
           error.message?.includes('Loading chunk') ||
           error.message?.includes('Network');
  }

  override render() {
    const { error, errorInfo, retryCount, isRetrying } = this.state;
    const { 
      children, 
      fallback: Fallback, 
      featureFlags, 
      context, 
      maxRetries,
      supportEmail,
      supportUrl,
      homeUrl
    } = this.props;

    if (error) {
      // Props for fallback component
      const fallbackProps: ErrorFallbackProps = {
        error,
        errorInfo: errorInfo ?? undefined,
        resetErrorBoundary: this.resetErrorBoundary,
        context: context || ErrorContext.COMPONENT,
        featureFlags: featureFlags || {},
        retryCount,
        maxRetries: maxRetries || 3,
        retryError: this.retryError,
        isRetrying,
        supportEmail,
        supportUrl,
        homeUrl
      };

      if (Fallback) {
        return <Fallback {...fallbackProps} />;
      }

      // Default fallback UI (simplified for CI)
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>{error.message}</p>
          <button onClick={this.resetErrorBoundary}>
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;