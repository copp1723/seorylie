// Analytics utility for logging events
// Simple implementation for CI/build compatibility

export interface AnalyticsEvent {
  [key: string]: any;
}

export const logEvent = (eventName: string, eventData?: AnalyticsEvent): void => {
  // In development/test environment, just log to console
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log(`Analytics Event: ${eventName}`, eventData);
    return;
  }
  
  // In production, implement actual analytics tracking
  // This is a placeholder that prevents build errors
  try {
    // Add your analytics service here (e.g., Google Analytics, Mixpanel, etc.)
    // Example: gtag('event', eventName, eventData);
    console.debug(`Analytics: ${eventName}`, eventData);
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
};

export const setUserId = (userId: string): void => {
  try {
    // Set user ID for analytics tracking
    console.debug('Analytics: Set User ID', userId);
  } catch (error) {
    console.warn('Analytics user ID setting failed:', error);
  }
};

export const setUserProperties = (properties: AnalyticsEvent): void => {
  try {
    // Set user properties for analytics
    console.debug('Analytics: Set User Properties', properties);
  } catch (error) {
    console.warn('Analytics user properties setting failed:', error);
  }
};

export default {
  logEvent,
  setUserId,
  setUserProperties,
};