import { useState, useCallback, useEffect } from 'react';
import { 
  logEvent, 
  trackPageView, 
  usePageTracking, 
  useComponentTracking,
  useUserPresence,
  EventParameters,
  configureAnalytics
} from '../utils/analytics';

/**
 * Analytics hook interface
 */
interface AnalyticsHook {
  /**
   * Track a custom event (alias for trackEvent)
   */
  track: (event: string, properties?: Record<string, any>) => void;
  
  /**
   * Track a custom event
   */
  trackEvent: (eventName: string, parameters?: EventParameters) => void;
  
  /**
   * Track timing/performance metrics
   */
  trackTiming: (name: string, duration: number) => void;
  
  /**
   * Identify a user
   */
  identify: (userId: string, traits?: Record<string, any>) => void;
  
  /**
   * Track a page view
   */
  trackPageView: (pageName: string, parameters?: EventParameters) => void;
  
  /**
   * Track a user interaction
   */
  trackInteraction: (interactionType: string, elementId: string, parameters?: EventParameters) => void;
  
  /**
   * Track a feature usage
   */
  trackFeatureUsage: (featureName: string, parameters?: EventParameters) => void;
  
  /**
   * Track an error
   */
  trackError: (errorType: string, errorMessage: string, parameters?: EventParameters) => void;
  
  /**
   * Track a conversion
   */
  trackConversion: (conversionType: string, parameters?: EventParameters) => void;
  
  /**
   * Check if analytics is enabled
   */
  isEnabled: boolean;
  
  /**
   * Toggle analytics on/off
   */
  setEnabled: (enabled: boolean) => void;
  
  /**
   * Current user presence status
   */
  isUserActive: boolean;
}

/**
 * Hook for using analytics throughout the application
 * @returns Analytics functions and state
 */
export const useAnalytics = (): AnalyticsHook => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    // Check localStorage for user preference
    const storedPreference = localStorage.getItem('analytics-enabled');
    if (storedPreference !== null) {
      return storedPreference === 'true';
    }
    // Default to true in production, false in development
    return process.env.NODE_ENV === 'production';
  });
  
  const { isActive } = useUserPresence();
  
  // Update analytics configuration when enabled state changes
  useEffect(() => {
    configureAnalytics({ enabled: isEnabled });
    localStorage.setItem('analytics-enabled', String(isEnabled));
  }, [isEnabled]);
  
  // Track event wrapper
  const trackEvent = useCallback((eventName: string, parameters: EventParameters = {}) => {
    if (isEnabled) {
      logEvent(eventName, parameters);
    }
  }, [isEnabled]);

  // Track event alias
  const track = useCallback((event: string, properties: Record<string, any> = {}) => {
    trackEvent(event, properties);
  }, [trackEvent]);

  // Track timing/performance metrics
  const trackTiming = useCallback((name: string, duration: number) => {
    trackEvent('timing', {
      name,
      duration,
      timestamp: Date.now()
    });
  }, [trackEvent]);

  // Identify user
  const identify = useCallback((userId: string, traits: Record<string, any> = {}) => {
    trackEvent('identify', {
      userId,
      traits,
      timestamp: Date.now()
    });
  }, [trackEvent]);
  
  // Track page view wrapper
  const trackPageViewFn = useCallback((pageName: string, parameters: EventParameters = {}) => {
    if (isEnabled) {
      trackPageView(pageName, parameters);
    }
  }, [isEnabled]);
  
  // Track user interaction
  const trackInteraction = useCallback((
    interactionType: string, 
    elementId: string, 
    parameters: EventParameters = {}
  ) => {
    trackEvent('user_interaction', {
      interactionType,
      elementId,
      ...parameters
    });
  }, [trackEvent]);
  
  // Track feature usage
  const trackFeatureUsage = useCallback((
    featureName: string, 
    parameters: EventParameters = {}
  ) => {
    trackEvent('feature_usage', {
      featureName,
      ...parameters
    });
  }, [trackEvent]);
  
  // Track error
  const trackError = useCallback((
    errorType: string, 
    errorMessage: string, 
    parameters: EventParameters = {}
  ) => {
    trackEvent('error', {
      errorType,
      errorMessage,
      ...parameters
    });
  }, [trackEvent]);
  
  // Track conversion
  const trackConversion = useCallback((
    conversionType: string, 
    parameters: EventParameters = {}
  ) => {
    trackEvent('conversion', {
      conversionType,
      ...parameters
    });
  }, [trackEvent]);
  
  // Set enabled state
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);
  
  return {
    track,
    trackEvent,
    trackTiming,
    identify,
    trackPageView: trackPageViewFn,
    trackInteraction,
    trackFeatureUsage,
    trackError,
    trackConversion,
    isEnabled,
    setEnabled,
    isUserActive: isActive
  };
};

export default useAnalytics;
