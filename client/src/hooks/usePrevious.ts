import { useRef, useEffect } from 'react';

/**
 * Hook to get the previous value of a variable
 * @param value The current value
 * @returns The previous value
 */
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
};

export default usePrevious;