import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import axios from 'axios';

interface AgencyBranding {
  agency_id: string;
  company_name: string;
  tagline?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color?: string;
  theme: 'light' | 'dark' | 'auto';
  font_family: string;
  custom_css?: string;
  theme_config?: Record<string, any>;
  subdomain?: string;
  custom_domain?: string;
  support_email?: string;
  support_phone?: string;
  features?: Record<string, boolean>;
}

interface BrandingContextType {
  branding: AgencyBranding | null;
  isLoading: boolean;
  isUpdating: boolean;
  updateBranding: (updates: Partial<AgencyBranding>) => Promise<void>;
  previewBranding: (branding: Partial<AgencyBranding>) => void;
  resetPreview: () => void;
  isPreviewMode: boolean;
}

// Default branding fallback
const defaultBranding: AgencyBranding = {
  agency_id: 'default',
  company_name: 'RylieSEO',
  primary_color: '#2563eb',
  secondary_color: '#1e40af',
  accent_color: '#10b981',
  theme: 'light',
  font_family: 'Inter',
  features: {}
};

// In-memory cache with TTL
class BrandingCache {
  private cache = new Map<string, { data: AgencyBranding; expires: number }>();
  private readonly TTL = 3600000; // 1 hour

  get(agencyId: string): AgencyBranding | null {
    const cached = this.cache.get(agencyId);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(agencyId);
    return null;
  }

  set(agencyId: string, data: AgencyBranding): void {
    this.cache.set(agencyId, {
      data,
      expires: Date.now() + this.TTL
    });
  }

  clear(agencyId?: string): void {
    if (agencyId) {
      this.cache.delete(agencyId);
    } else {
      this.cache.clear();
    }
  }
}

const brandingCache = new BrandingCache();
const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

interface BrandingProviderProps {
  children: ReactNode;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [previewBranding, setPreviewBranding] = useState<Partial<AgencyBranding> | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Detect agency from subdomain or user context
  const detectAgencyId = async (): Promise<string | null> => {
    // First, check subdomain
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'rylieseo') {
      try {
        const response = await axios.get(`/api/agency/branding/subdomain/${subdomain}`);
        if (response.data?.agency_id) {
          return response.data.agency_id;
        }
      } catch (error) {
        console.debug('No agency found for subdomain:', subdomain);
      }
    }

    // Fall back to user's agency from auth context
    if (user?.agencyId) {
      return user.agencyId;
    }

    return null;
  };

  // Fetch branding with caching
  const { data: branding, isLoading } = useQuery({
    queryKey: ['agency-branding', user?.id],
    queryFn: async () => {
      const agencyId = await detectAgencyId();
      if (!agencyId) return defaultBranding;

      // Check cache first
      const cached = brandingCache.get(agencyId);
      if (cached) return cached;

      try {
        const response = await axios.get(`/api/agency/branding/${agencyId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}` // Assuming JWT token storage
          }
        });
        
        const brandingData = response.data;
        // Cache the result
        brandingCache.set(agencyId, brandingData);
        return brandingData;
      } catch (error) {
        console.error('Failed to fetch branding:', error);
        return defaultBranding;
      }
    },
    staleTime: 300000, // Consider data stale after 5 minutes
    gcTime: 3600000, // Keep in React Query cache for 1 hour
  });

  // Update branding mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AgencyBranding>) => {
      const agencyId = await detectAgencyId();
      if (!agencyId) throw new Error('No agency context');

      const response = await axios.put(
        `/api/agency/branding/${agencyId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      return response.data;
    },
    onSuccess: (data) => {
      // Clear cache and refetch
      brandingCache.clear(data.agency_id);
      queryClient.invalidateQueries({ queryKey: ['agency-branding'] });
    },
  });

  // Apply branding to DOM
  useEffect(() => {
    const activeBranding = isPreviewMode && previewBranding && branding
      ? { ...branding, ...previewBranding } 
      : branding;

    if (!activeBranding) return;

    const root = document.documentElement;

    // Apply CSS variables
    root.style.setProperty('--brand-primary', activeBranding.primary_color);
    root.style.setProperty('--brand-secondary', activeBranding.secondary_color);
    root.style.setProperty('--brand-accent', activeBranding.accent_color || '#10b981');
    root.style.setProperty('--brand-font', activeBranding.font_family);

    // Apply theme
    if (activeBranding.theme === 'dark') {
      root.classList.add('dark');
    } else if (activeBranding.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto theme based on system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }

    // Apply custom CSS if provided
    if (activeBranding.custom_css) {
      const styleId = 'agency-custom-styles';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      
      styleElement.textContent = activeBranding.custom_css;
    }

    // Update favicon
    if (activeBranding.favicon_url) {
      const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = activeBranding.favicon_url;
      }
    }

    // Update document title
    document.title = `${activeBranding.company_name} - SEO Management Platform`;

  }, [branding, isPreviewMode, previewBranding]);

  const value: BrandingContextType = {
    branding: branding || defaultBranding,
    isLoading,
    isUpdating: updateMutation.isPending,
    updateBranding: updateMutation.mutateAsync,
    previewBranding: (updates) => {
      setPreviewBranding(updates);
      setIsPreviewMode(true);
    },
    resetPreview: () => {
      setPreviewBranding(null);
      setIsPreviewMode(false);
    },
    isPreviewMode,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

// Hook for performance monitoring
export const useBrandingPerformance = () => {
  const [metrics, setMetrics] = useState({
    cacheHitRate: 0,
    loadTime: 0,
    lastUpdate: null as Date | null,
  });

  useEffect(() => {
    // Monitor performance metrics
    const measurePerformance = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      setMetrics({
        cacheHitRate: 0.85, // This would be calculated from actual cache hits
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        lastUpdate: new Date(),
      });
    };

    measurePerformance();
    const interval = setInterval(measurePerformance, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return metrics;
};
