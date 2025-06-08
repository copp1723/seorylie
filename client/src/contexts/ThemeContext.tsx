import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// Color definitions
export interface ThemeColors {
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
  // Additional colors for components
  skeleton: string;
  borderLight: string;
  backgroundAlt: string;
  cardBackground: string;
  tableHeader: string;
  tableRow: string;
  tableRowAlt: string;
  userMessage: string;
  assistantMessage: string;
  tooltipBackground: string;
}

// Shadow definitions
export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  inner: string;
  // Additional shadows for components
  card: string;
  tooltip: string;
}

// Theme interface
export interface Theme {
  mode: "light" | "dark";
  colors: ThemeColors;
  shadows: ThemeShadows;
}

// Shadow definitions
const lightShadows: ThemeShadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  card: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  tooltip: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
};

const darkShadows: ThemeShadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.3)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.3)",
  card: "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
  tooltip: "0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)",
};

// Light and dark theme definitions
const lightTheme: Theme = {
  mode: "light",
  colors: {
    primary: "#3b82f6", // Blue
    secondary: "#10b981", // Emerald
    background: "#ffffff",
    foreground: "#f9fafb",
    card: "#ffffff",
    border: "#e5e7eb",
    text: "#1f2937",
    muted: "#6b7280",
    accent: "#8b5cf6", // Violet
    error: "#ef4444", // Red
    success: "#10b981", // Green
    warning: "#f59e0b", // Amber
    // Additional colors for components
    skeleton: "#e5e7eb",
    borderLight: "#f3f4f6",
    backgroundAlt: "#f9fafb",
    cardBackground: "#ffffff",
    tableHeader: "#f9fafb",
    tableRow: "#ffffff",
    tableRowAlt: "#f9fafb",
    userMessage: "#dbeafe",
    assistantMessage: "#f3f4f6",
    tooltipBackground: "#1f2937",
  },
  shadows: lightShadows,
};

const darkTheme: Theme = {
  mode: "dark",
  colors: {
    primary: "#60a5fa", // Lighter blue
    secondary: "#34d399", // Lighter emerald
    background: "#111827",
    foreground: "#1f2937",
    card: "#1f2937",
    border: "#374151",
    text: "#f9fafb",
    muted: "#9ca3af",
    accent: "#a78bfa", // Lighter violet
    error: "#f87171", // Lighter red
    success: "#34d399", // Lighter green
    warning: "#fbbf24", // Lighter amber
    // Additional colors for components
    skeleton: "#374151",
    borderLight: "#4b5563",
    backgroundAlt: "#1f2937",
    cardBackground: "#1f2937",
    tableHeader: "#374151",
    tableRow: "#1f2937",
    tableRowAlt: "#374151",
    userMessage: "#1e40af",
    assistantMessage: "#374151",
    tooltipBackground: "#f9fafb",
  },
  shadows: darkShadows,
};

// Theme context type
interface ThemeContextType {
  theme: Theme;
  setTheme: (mode: "light" | "dark") => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  colors: ThemeColors;
  shadows: ThemeShadows;
}

// Create the context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize theme from localStorage or system preference
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") return darkTheme;
    if (savedTheme === "light") return lightTheme;

    // Check system preference
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return darkTheme;
    }

    return lightTheme;
  });

  // Update document attributes when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme.mode === "dark";

    // Set data-theme attribute
    root.setAttribute("data-theme", theme.mode);

    // Set CSS variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Set dark mode class
    if (isDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }

    // Save preference to localStorage
    localStorage.setItem("theme", theme.mode);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem("theme");
      // Only auto-switch if user hasn't explicitly set a preference
      if (!savedTheme) {
        setThemeState(e.matches ? darkTheme : lightTheme);
      }
    };

    // Add listener (with compatibility check)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // For older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      // Cleanup listener
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        // For older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Set theme function
  const setTheme = useCallback((mode: "light" | "dark") => {
    setThemeState(mode === "dark" ? darkTheme : lightTheme);
  }, []);

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme) =>
      prevTheme.mode === "light" ? darkTheme : lightTheme,
    );
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isDarkMode: theme.mode === "dark",
    colors: theme.colors,
    shadows: theme.shadows,
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
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export default ThemeContext;
