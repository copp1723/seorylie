import { useCallback } from 'react';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

export interface AnalyticsUser {
  id: string;
  email?: string;
  name?: string;
  properties?: Record<string, any>;
}

export interface AnalyticsHook {
  track: (event: string, properties?: Record<string, any>) => void;
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackTiming: (category: string, variable: string, value: number) => void;
  identify: (user: AnalyticsUser) => void;
  page: (name: string, properties?: Record<string, any>) => void;
  reset: () => void;
  isEnabled: boolean;
}

export const useAnalytics = (): AnalyticsHook => {
  const track = useCallback((event: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, properties);
    }
    console.log('[Analytics] Track:', event, properties);
  }, []);

  const identify = useCallback((user: AnalyticsUser) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_TRACKING_ID', {
        user_id: user.id,
        custom_map: user.properties
      });
    }
    console.log('[Analytics] Identify:', user);
  }, []);

  const page = useCallback((name: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_TRACKING_ID', {
        page_title: name,
        page_location: window.location.href,
        ...properties
      });
    }
    console.log('[Analytics] Page:', name, properties);
  }, []);

  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    track(event, properties);
  }, [track]);

  const trackTiming = useCallback((category: string, variable: string, value: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: variable,
        value: value,
        event_category: category
      });
    }
    console.log('[Analytics] Timing:', category, variable, value);
  }, []);

  const reset = useCallback(() => {
    console.log('[Analytics] Reset');
  }, []);

  return {
    track,
    trackEvent,
    trackTiming,
    identify,
    page,
    reset,
    isEnabled: process.env.NODE_ENV === 'production'
  };
};

export default useAnalytics;