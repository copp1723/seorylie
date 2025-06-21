import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BrandingSettings } from '../types/api';
import { useBrandingSettings } from '../hooks/useSettings';
import { settingsAPI } from '../services/settings';
import { queryKeys } from '../lib/queryClient';

interface BrandingContextType {
  branding: BrandingSettings;
  updateBranding: (newBranding: Partial<BrandingSettings>) => Promise<void>;
  isPending: boolean;
  isUpdating: boolean;
}

const defaultBranding: BrandingSettings = {
  companyName: 'Rylie SEO',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  theme: 'light'
};

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

interface BrandingProviderProps {
  children: ReactNode;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();

  // Try to fetch branding settings from API
  const { data: remoteBranding, isPending } = useBrandingSettings();

  // Create update mutation directly here to avoid circular dependency
  const updateBrandingMutation = useMutation({
    mutationFn: (data: BrandingSettings) => settingsAPI.branding.update(data),
    onSuccess: (updatedBranding) => {
      // Update cache with server response
      queryClient.setQueryData(queryKeys.settings.branding, updatedBranding);
    },
  });

  // Use remote branding if available, otherwise use default
  const branding: BrandingSettings = remoteBranding || defaultBranding;

  const updateBranding = async (newBranding: Partial<BrandingSettings>) => {
    const updated = { ...branding, ...newBranding } as BrandingSettings;

    // Optimistically update cache immediately for instant UI feedback
    queryClient.setQueryData(queryKeys.settings.branding, updated);

    // Persist changes to the server
    try {
      await updateBrandingMutation.mutateAsync(updated);
    } catch (error) {
      // Revert optimistic update if the server update fails
      queryClient.setQueryData(queryKeys.settings.branding, remoteBranding);
      throw error;
    }
  };

  // Apply CSS custom properties for theming
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    
    // Apply theme class
    if (branding.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [branding]);

  const value = {
    branding,
    updateBranding,
    isPending,
    isUpdating: updateBrandingMutation.isPending
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};