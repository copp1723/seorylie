import * as React from "react";
import { 
  Toast,
  ToastActionElement,
  ToastProps 
} from "@/components/ui/toast";

// Unique ID generation for toasts
const generateId = () => Math.random().toString(36).substring(2, 9);

// Toast types and interfaces
export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info' | 'loading';

export interface Toast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: ToastVariant;
  duration?: number;
  dismissible?: boolean;
  onDismiss?: () => void;
  createdAt: Date;
}

export type ToastOptions = Partial<
  Pick<Toast, 'id' | 'title' | 'description' | 'action' | 'variant' | 'duration' | 'dismissible' | 'onDismiss'>
>;

// Reducer actions
type ToastAction =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'UPDATE_TOAST'; id: string; toast: Partial<Toast> }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'REMOVE_TOAST'; id: string };

// Default toast durations by variant
const DEFAULT_TOAST_DURATION: Record<ToastVariant, number> = {
  default: 5000,
  destructive: 8000,
  success: 4000,
  warning: 6000,
  info: 5000,
  loading: 10000,
};

// Maximum number of toasts to show at once
const MAX_TOASTS = 5;

// Reducer function for toast state management
const toastReducer = (state: Toast[], action: ToastAction): Toast[] => {
  switch (action.type) {
    case 'ADD_TOAST': {
      // Limit the number of toasts
      const newToasts = [...state];
      if (newToasts.length >= MAX_TOASTS) {
        // Remove the oldest toast
        newToasts.shift();
      }
      return [...newToasts, action.toast];
    }
    
    case 'UPDATE_TOAST': {
      return state.map((toast) =>
        toast.id === action.id ? { ...toast, ...action.toast } : toast
      );
    }
    
    case 'DISMISS_TOAST': {
      return state.map((toast) =>
        toast.id === action.id
          ? {
              ...toast,
              dismissible: false,
            }
          : toast
      );
    }
    
    case 'REMOVE_TOAST': {
      return state.filter((toast) => toast.id !== action.id);
    }
    
    default:
      return state;
  }
};

// Context for toast state
interface ToastContextType {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  updateToast: (id: string, options: Partial<Toast>) => void;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

// Provider component for toast context
export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, dispatch] = React.useReducer(toastReducer, []);
  
  // Refs to track timeouts for memory management
  const toastTimeoutsRef = React.useRef(new Map<string, {
    dismissTimeout: NodeJS.Timeout | undefined;
    removeTimeout: NodeJS.Timeout | undefined;
  }>());
  
  // Clean up timeouts on unmount
  React.useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeouts) => {
        if (timeouts.dismissTimeout) clearTimeout(timeouts.dismissTimeout);
        if (timeouts.removeTimeout) clearTimeout(timeouts.removeTimeout);
      });
      toastTimeoutsRef.current.clear();
    };
  }, []);
  
  // Add a new toast
  const addToast = React.useCallback((options: ToastOptions) => {
    const id = options.id || generateId();
    const variant = options.variant || 'default';
    const duration = options.duration || DEFAULT_TOAST_DURATION[variant];
    const dismissible = options.dismissible ?? true;
    
    const toast: Toast = {
      id,
      title: options.title,
      description: options.description,
      action: options.action,
      variant,
      duration,
      dismissible,
      onDismiss: options.onDismiss,
      createdAt: new Date(),
    };
    
    dispatch({ type: 'ADD_TOAST', toast });
    
    // Set up automatic dismissal if duration is provided
    if (duration && duration > 0) {
      const dismissTimeout = setTimeout(() => {
        dismissToast(id);
      }, duration);
      
      const removeTimeout = setTimeout(() => {
        removeToast(id);
      }, duration + 300); // Add animation time
      
      toastTimeoutsRef.current.set(id, {
        dismissTimeout,
        removeTimeout,
      });
    }
    
    return id;
  }, []);
  
  // Update an existing toast
  const updateToast = React.useCallback((id: string, options: Partial<Toast>) => {
    dispatch({ type: 'UPDATE_TOAST', id, toast: options });
    
    // Clear existing timeouts if duration is updated
    if (options.duration !== undefined) {
      const existingTimeouts = toastTimeoutsRef.current.get(id);
      if (existingTimeouts) {
        if (existingTimeouts.dismissTimeout) {
          clearTimeout(existingTimeouts.dismissTimeout);
        }
        if (existingTimeouts.removeTimeout) {
          clearTimeout(existingTimeouts.removeTimeout);
        }
      }
      
      // Set new timeouts if needed
      if (options.duration && options.duration > 0) {
        const dismissTimeout = setTimeout(() => {
          dismissToast(id);
        }, options.duration);
        
        const removeTimeout = setTimeout(() => {
          removeToast(id);
        }, options.duration + 300);
        
        toastTimeoutsRef.current.set(id, {
          dismissTimeout,
          removeTimeout,
        });
      }
    }
  }, []);
  
  // Dismiss a toast (trigger exit animation)
  const dismissToast = React.useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', id });
    
    // Execute onDismiss callback if provided
    const toast = toasts.find((t) => t.id === id);
    if (toast?.onDismiss) {
      toast.onDismiss();
    }
    
    // Clear dismiss timeout
    const timeouts = toastTimeoutsRef.current.get(id);
    if (timeouts?.dismissTimeout) {
      clearTimeout(timeouts.dismissTimeout);
    }
    
    // Set up removal after animation
    if (!timeouts?.removeTimeout) {
      const removeTimeout = setTimeout(() => {
        removeToast(id);
      }, 300); // Animation duration
      
      toastTimeoutsRef.current.set(id, {
        dismissTimeout: undefined,
        removeTimeout,
      });
    }
  }, [toasts]);
  
  // Remove a toast completely
  const removeToast = React.useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
    
    // Clean up timeouts
    const timeouts = toastTimeoutsRef.current.get(id);
    if (timeouts) {
      if (timeouts.dismissTimeout) clearTimeout(timeouts.dismissTimeout);
      if (timeouts.removeTimeout) clearTimeout(timeouts.removeTimeout);
      toastTimeoutsRef.current.delete(id);
    }
  }, []);
  
  // Memoize context value to prevent unnecessary re-renders
  const value = React.useMemo(
    () => ({
      toasts,
      addToast,
      updateToast,
      dismissToast,
      removeToast,
    }),
    [toasts, addToast, updateToast, dismissToast, removeToast]
  );
  
  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

// Hook for consuming toast context
export function useToast() {
  const context = React.useContext(ToastContext);
  
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  
  // Helper function for creating toast with options
  const toast = React.useCallback(
    (options: ToastOptions) => {
      return context.addToast(options);
    },
    [context]
  );
  
  // Variant-specific toast helpers
  const error = React.useCallback(
    (options: Omit<ToastOptions, "variant">) => {
      return toast({ ...options, variant: "destructive" });
    },
    [toast]
  );
  
  const success = React.useCallback(
    (options: Omit<ToastOptions, "variant">) => {
      return toast({ ...options, variant: "success" });
    },
    [toast]
  );
  
  const warning = React.useCallback(
    (options: Omit<ToastOptions, "variant">) => {
      return toast({ ...options, variant: "warning" });
    },
    [toast]
  );
  
  const info = React.useCallback(
    (options: Omit<ToastOptions, "variant">) => {
      return toast({ ...options, variant: "info" });
    },
    [toast]
  );
  
  const loading = React.useCallback(
    (options: Omit<ToastOptions, "variant">) => {
      return toast({ ...options, variant: "loading", duration: options.duration || Infinity });
    },
    [toast]
  );
  
  // Update loading toast to success/error
  const update = React.useCallback(
    (id: string, options: Partial<Toast>) => {
      return context.updateToast(id, options);
    },
    [context]
  );
  
  // Dismiss a specific toast
  const dismiss = React.useCallback(
    (id: string) => {
      return context.dismissToast(id);
    },
    [context]
  );
  
  // Dismiss all toasts
  const dismissAll = React.useCallback(() => {
    context.toasts.forEach((toast) => {
      context.dismissToast(toast.id);
    });
  }, [context]);
  
  return {
    toast,
    error,
    success,
    warning,
    info,
    loading,
    update,
    dismiss,
    dismissAll,
    toasts: context.toasts,
  };
}
