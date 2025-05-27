import { useLocation } from "wouter";

/**
 * A hook to parse URL query parameters
 * Returns an object with query parameters as key-value pairs
 */
export function useQueryParams(): Record<string, string> {
  const [location] = useLocation();

  // Parse query string into a params object
  const getParams = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const params: Record<string, string> = {};

    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }

    return params;
  };

  return getParams();
}
