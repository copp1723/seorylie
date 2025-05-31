import { useRef, useEffect } from 'react';

/**
 * A hook that returns the previous value of a state or prop.
 * Useful for comparing current and previous values in effects.
 * 
 * @param value The value to track
 * @returns The previous value (undefined on first render)
 * 
 * @example
 * const count = useState(0);
 * const prevCount = usePrevious(count);
 * 
 * useEffect(() => {
 *   if (prevCount !== undefined && count !== prevCount) {
 *     console.log(`Count changed from ${prevCount} to ${count}`);
 *   }
 * }, [count, prevCount]);
 */
export function usePrevious<T>(value: T): T | undefined {
  // Use a ref to store the previous value
  const ref = useRef<T | undefined>(undefined);
  
  // Update the ref value after each render
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  // Return the previous value (which is now stored in ref.current)
  // This will be undefined on the first render
  return ref.current;
}

export default usePrevious;
