import { useEffect, useState } from 'react';

/**
 * Event parameters type for analytics tracking
 */
export interface EventParameters {
  [key: string]: string | number | boolean | object | null | undefined;
}

/**
 * Configuration for analytics
 */
interface AnalyticsConfig {
  enabled: boolean;
  debugMode: boolean;
  endpoint?: string;
  apiKey?: string;
  userId?: string;
  sessionId?: string;
  dealershipId?: string;
}

// Default configuration
const defaultConfig: AnalyticsConfig = {
  enabled: process.env.NODE_ENV === 'production',
  debugMode: process.env.NODE_ENV === 'development',
  sessionId: generateSessionId(),
};

// Current configuration
let analyticsConfig: AnalyticsConfig = { ...defaultConfig };

/**
 * Generate a random session ID
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Configure analytics settings
 */
export function configureAnalytics(config: Partial<AnalyticsConfig>): void {
  analyticsConfig = { ...analyticsConfig, ...config };
}

/**
 * Log an event to analytics
 * @param eventName Name of the event
 * @param parameters Event parameters
 */
export function logEvent(eventName: string, parameters: EventParameters = {}): void {
  if (!analyticsConfig.enabled && !analyticsConfig.debugMode) {
    return;
  }

  const eventData = {
    event: eventName,
    timestamp: new Date().toISOString(),
    sessionId: analyticsConfig.sessionId,
    userId: analyticsConfig.userId,
    dealershipId: analyticsConfig.dealershipId,
    ...parameters,
  };

  // Log to console in debug mode
  if (analyticsConfig.debugMode) {
    console.log(`📊 Analytics Event: ${eventName}`, eventData);
  }

  // In production, send to analytics endpoint
  if (analyticsConfig.enabled && analyticsConfig.endpoint) {
    // This would be replaced with actual API call in production
    // For now, just stub the implementation
    if (analyticsConfig.debugMode) {
      console.log(`📤 Sending to ${analyticsConfig.endpoint}`, eventData);
    }
    
    // Example implementation:
    // fetch(analyticsConfig.endpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-API-Key': analyticsConfig.apiKey || '',
    //   },
    //   body: JSON.stringify(eventData),
    // }).catch(error => {
    //   console.error('Analytics error:', error);
    // });
  }
}

/**
 * Track a page view
 * @param pageName Name of the page
 * @param parameters Additional parameters
 */
export function trackPageView(pageName: string, parameters: EventParameters = {}): void {
  logEvent('page_view', { pageName, ...parameters });
}

/**
 * React hook for tracking page views
 * @param pageName Name of the page
 * @param parameters Additional parameters
 */
export function usePageTracking(pageName: string, parameters: EventParameters = {}): void {
  useEffect(() => {
    trackPageView(pageName, parameters);
  }, [pageName, JSON.stringify(parameters)]);
}

/**
 * React hook for tracking component renders
 * @param componentName Name of the component
 * @param parameters Additional parameters
 */
export function useComponentTracking(componentName: string, parameters: EventParameters = {}): void {
  useEffect(() => {
    logEvent('component_render', { componentName, ...parameters });
  }, [componentName, JSON.stringify(parameters)]);
}

/**
 * React hook for tracking user presence
 * @returns Object with isActive status
 */
export function useUserPresence(): { isActive: boolean } {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const handleActivity = () => setIsActive(true);
    const handleInactivity = () => {
      setIsActive(false);
      logEvent('user_inactive', { duration: 60 });
    };

    // Set up activity listeners
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Set up inactivity timer (60 seconds)
    const inactivityTimer = setTimeout(handleInactivity, 60000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearTimeout(inactivityTimer);
    };
  }, [isActive]);

  return { isActive };
}

// Initialize with any environment variables
if (typeof window !== 'undefined') {
  configureAnalytics({
    enabled: process.env.REACT_APP_ANALYTICS_ENABLED === 'true',
    endpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT,
    apiKey: process.env.REACT_APP_ANALYTICS_API_KEY,
  });
}