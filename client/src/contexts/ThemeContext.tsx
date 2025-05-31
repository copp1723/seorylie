import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Theme interface
export interface Theme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    error: string;
    success: string;
    warning: string;
  };
}

// Light and dark theme definitions
const lightTheme: Theme = {
  mode: 'light',
  colors: {
    primary: '#3b82f6', // Blue
    secondary: '#10b981', // Emerald
    background: '#ffffff',
    foreground: '#f9fafb',
    card: '#ffffff',
    border: '#e5e7eb',
    text: '#1f2937',
    muted: '#6b7280',
    accent: '#8b5cf6', // Violet
    error: '#ef4444', // Red
    success: '#10b981', // Green
    warning: '#f59e0b', // Amber
  },
};

const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    primary: '#60a5fa', // Lighter blue
    secondary: '#34d399', // Lighter emerald
    background: '#111827',
    foreground: '#1f2937',
    card: '#1f2937',
    border: '#374151',
    text: '#f9fafb',
    muted: '#9ca3af',
    accent: '#a78bfa', // Lighter violet
    error: '#f87171', // Lighter red
    success: '#34d399', // Lighter green
    warning: '#fbbf24', // Lighter amber
  },
};

// Theme context type
interface ThemeContextType {
  theme: Theme;
  setTheme: (mode: 'light' | 'dark') => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

// Create the context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize theme from localStorage or system preference
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') return darkTheme;
    if (savedTheme === 'light') return lightTheme;
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return darkTheme;
    }
    
    return lightTheme;
  });

  // Update document attributes when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme.mode === 'dark';
    
    // Set data-theme attribute
    root.setAttribute('data-theme', theme.mode);
    
    // Set CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Set dark mode class
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    
    // Save preference to localStorage
    localStorage.setItem('theme', theme.mode);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme');
      // Only auto-switch if user hasn't explicitly set a preference
      if (!savedTheme) {
        setThemeState(e.matches ? darkTheme : lightTheme);
      }
    };
    
    // Add listener (with compatibility check)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // For older browsers
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      // Cleanup listener
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // For older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Set theme function
  const setTheme = useCallback((mode: 'light' | 'dark') => {
    setThemeState(mode === 'dark' ? darkTheme : lightTheme);
  }, []);

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    setThemeState(prevTheme => 
      prevTheme.mode === 'light' ? darkTheme : lightTheme
    );
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isDarkMode: theme.mode === 'dark',
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;