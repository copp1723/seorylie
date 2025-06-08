import { useState, useEffect, useCallback } from "react";

// Breakpoint definitions (in pixels)
export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export type Breakpoint = keyof typeof breakpoints;

export interface WindowSize {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
}

/**
 * Hook that tracks the browser window dimensions and provides responsive breakpoint information
 * @returns Current window dimensions and responsive breakpoint data
 */
export const useWindowSize = (): WindowSize => {
  // Initialize with reasonable defaults for SSR
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
    breakpoint: "lg",
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: false,
  });

  // Determine the current breakpoint based on window width
  const getBreakpoint = useCallback((width: number): Breakpoint => {
    if (width < breakpoints.sm) return "xs";
    if (width < breakpoints.md) return "sm";
    if (width < breakpoints.lg) return "md";
    if (width < breakpoints.xl) return "lg";
    if (width < breakpoints["2xl"]) return "xl";
    return "2xl";
  }, []);

  // Calculate all window size properties
  const calculateWindowSize = useCallback((): WindowSize => {
    if (typeof window === "undefined") {
      // Default values for SSR
      return {
        width: 1024,
        height: 768,
        breakpoint: "lg",
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLargeDesktop: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpoint(width);

    return {
      width,
      height,
      breakpoint,
      isMobile: width < breakpoints.md,
      isTablet: width >= breakpoints.md && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      isLargeDesktop: width >= breakpoints.xl,
    };
  }, [getBreakpoint]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Update state on mount
    setWindowSize(calculateWindowSize());

    // Debounce the resize handler for better performance
    let timeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setWindowSize(calculateWindowSize());
      }, 150); // 150ms debounce
    };

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateWindowSize]);

  return windowSize;
};

export default useWindowSize;
