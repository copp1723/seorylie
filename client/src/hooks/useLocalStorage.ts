import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

/**
 * Options for the useLocalStorage hook
 */
export interface LocalStorageOptions {
  /**
   * Whether to use sessionStorage instead of localStorage
   * @default false
   */
  useSessionStorage?: boolean;
  
  /**
   * Whether to serialize/deserialize objects using JSON
   * @default true
   */
  serialize?: boolean;
  
  /**
   * Prefix to add to all keys
   * @default ''
   */
  prefix?: string;
  
  /**
   * Function to call when an error occurs
   */
  onError?: (error: Error) => void;
}

/**
 * Check if localStorage is available
 */
const isStorageAvailable = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const storage = window[type];
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Hook for managing localStorage with React state
 * @param key The key to store the value under
 * @param initialValue The initial value (or a function that returns it)
 * @param options Configuration options
 * @returns A stateful value, a function to update it, and utility functions
 */
export const useLocalStorage = <T>(
  key: string,
  initialValue: T | (() => T),
  options: LocalStorageOptions = {}
): [T, Dispatch<SetStateAction<T>>, { remove: () => void, error: Error | null }] => {
  const {
    useSessionStorage = false,
    serialize = true,
    prefix = '',
    onError,
  } = options;

  // Determine which storage to use
  const storageType = useSessionStorage ? 'sessionStorage' : 'localStorage';
  const storageAvailable = isStorageAvailable(storageType);
  
  // Prefixed key
  const prefixedKey = `${prefix}${key}`;
  
  // State for tracking errors
  const [error, setError] = useState<Error | null>(null);

  // Helper function to safely access storage
  const safelyAccessStorage = useCallback((operation: () => void) => {
    if (!storageAvailable) {
      const storageError = new Error(`${storageType} is not available`);
      setError(storageError);
      if (onError) onError(storageError);
      return false;
    }
    
    try {
      operation();
      return true;
    } catch (e) {
      const storageError = e instanceof Error ? e : new Error('Storage operation failed');
      setError(storageError);
      if (onError) onError(storageError);
      return false;
    }
  }, [storageType, storageAvailable, onError]);

  // Function to get the value from storage
  const getStoredValue = useCallback((): T => {
    // If storage is not available, return the initial value
    if (!storageAvailable) {
      return typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;
    }
    
    // Get from storage
    const storage = window[storageType];
    const storedValue = storage.getItem(prefixedKey);
    
    // If the key doesn't exist, return the initial value
    if (storedValue === null) {
      const value = typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;
      
      // Initialize storage with the initial value
      if (serialize && typeof value !== 'string') {
        safelyAccessStorage(() => storage.setItem(prefixedKey, JSON.stringify(value)));
      } else {
        safelyAccessStorage(() => storage.setItem(prefixedKey, value as unknown as string));
      }
      
      return value;
    }
    
    // Parse the stored value
    if (serialize) {
      try {
        return JSON.parse(storedValue);
      } catch (e) {
        // If parsing fails, return the raw value
        return storedValue as unknown as T;
      }
    }
    
    return storedValue as unknown as T;
  }, [initialValue, storageAvailable, storageType, prefixedKey, serialize, safelyAccessStorage]);

  // State to keep track of the current value
  const [storedValue, setStoredValue] = useState<T>(getStoredValue);

  // Listen for changes to this key from other components
  useEffect(() => {
    if (!storageAvailable) return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === prefixedKey && e.newValue !== null) {
        // Update state when the storage changes
        try {
          const newValue = serialize ? JSON.parse(e.newValue) : e.newValue;
          setStoredValue(newValue);
        } catch (error) {
          // If parsing fails, use the raw value
          setStoredValue(e.newValue as unknown as T);
        }
      } else if (e.key === prefixedKey && e.newValue === null) {
        // Key was removed, reset to initial value
        setStoredValue(
          typeof initialValue === 'function'
            ? (initialValue as () => T)()
            : initialValue
        );
      }
    };
    
    // Add event listener
    window.addEventListener('storage', handleStorageChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [prefixedKey, serialize, storageAvailable, initialValue]);

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      // Allow value to be a function
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to storage
      if (storageAvailable) {
        const storage = window[storageType];
        
        safelyAccessStorage(() => {
          if (valueToStore === undefined) {
            storage.removeItem(prefixedKey);
          } else if (serialize && typeof valueToStore !== 'string') {
            storage.setItem(prefixedKey, JSON.stringify(valueToStore));
          } else {
            storage.setItem(prefixedKey, valueToStore as unknown as string);
          }
        });
      }
    },
    [storedValue, storageAvailable, storageType, prefixedKey, serialize, safelyAccessStorage]
  );

  // Function to remove the item from storage
  const remove = useCallback(() => {
    if (storageAvailable) {
      const storage = window[storageType];
      safelyAccessStorage(() => storage.removeItem(prefixedKey));
    }
    
    // Reset to initial value
    setStoredValue(
      typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue
    );
  }, [storageAvailable, storageType, prefixedKey, initialValue, safelyAccessStorage]);

  return [storedValue, setValue, { remove, error }];
};

export default useLocalStorage;
