import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely log objects to console without [object Object] issues
 * @param label - Label for the log entry
 * @param obj - Object to log
 * @param options - Logging options
 */
export function safeLog(label: string, obj: any, options: {
  compact?: boolean
} = {}) {
  const { compact = false } = options;

  try {
    if (typeof obj === 'object' && obj !== null) {
      console.log(`${label}:`, JSON.stringify(obj, null, compact ? 0 : 2));
    } else {
      console.log(`${label}:`, obj);
    }
  } catch (error) {
    // Handle circular references or other JSON.stringify errors
    console.log(`${label}: [Complex Object - cannot stringify]`, obj);
  }
}

/**
 * Safe error logging that handles Error objects properly
 * @param label - Label for the error log
 * @param error - Error to log
 */
export function safeLogError(label: string, error: any) {
  if (error instanceof Error) {
    console.error(`${label}:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  } else {
    safeLog(`${label} (non-Error)`, error);
  }
}
