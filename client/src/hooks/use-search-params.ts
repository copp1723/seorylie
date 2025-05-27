import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * Custom hook to handle URL search parameters
 * Useful for handling magic link tokens and other query parameters
 */
export function useSearchParams() {
  const [location] = useLocation();
  const [searchParams, setParams] = useState<URLSearchParams>(
    new URLSearchParams(window.location.search)
  );

  useEffect(() => {
    // Update search params when the location changes
    setParams(new URLSearchParams(window.location.search));
  }, [location]);

  /**
   * Get a specific parameter from the URL
   */
  const getParam = useCallback(
    (key: string): string | null => {
      return searchParams.get(key);
    },
    [searchParams]
  );

  /**
   * Get all parameters as an object
   */
  const getAllParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }, [searchParams]);

  /**
   * Check if a parameter exists
   */
  const hasParam = useCallback(
    (key: string): boolean => {
      return searchParams.has(key);
    },
    [searchParams]
  );

  return {
    getParam,
    getAllParams,
    hasParam,
  };
}