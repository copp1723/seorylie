import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { BrandingSettings } from '../types/api';
import { useBrandingSettings } from '../hooks/useSettings';

interface BrandingContextType {
  branding: BrandingSettings;
  updateBranding: (newBranding: Partial<BrandingSettings>) => void;
  isLoading: boolean;
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
  const [localBranding, setLocalBranding] = React.useState<BrandingSettings>(defaultBranding);
  
  // Try to fetch branding settings from API
  const { data: remoteBranding, isLoading } = useBrandingSettings();

  // Use remote branding if available, otherwise use local/default
  const branding = remoteBranding || localBranding;

  const updateBranding = (newBranding: Partial<BrandingSettings>) => {
    const updated = { ...branding, ...newBranding };
    setLocalBranding(updated);
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
    isLoading
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};