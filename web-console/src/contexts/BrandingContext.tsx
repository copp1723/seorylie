import React, { createContext, useContext, ReactNode } from 'react';

interface BrandingConfig {
  companyName: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  theme: 'light' | 'dark';
}

interface BrandingContextType {
  branding: BrandingConfig;
  updateBranding: (newBranding: Partial<BrandingConfig>) => void;
}

const defaultBranding: BrandingConfig = {
  companyName: 'Rylie SEO',
  primaryColor: '#2563eb',
  secondaryColor: '#1e40af',
  accentColor: '#3b82f6',
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
  const [branding, setBranding] = React.useState<BrandingConfig>(defaultBranding);

  const updateBranding = (newBranding: Partial<BrandingConfig>) => {
    setBranding(prev => ({ ...prev, ...newBranding }));
  };

  // Apply CSS custom properties for theming
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-secondary', branding.secondaryColor);
    root.style.setProperty('--brand-accent', branding.accentColor);
  }, [branding]);

  const value = {
    branding,
    updateBranding
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};