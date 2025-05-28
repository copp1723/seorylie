import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, XCircle, Info, Clock } from "lucide-react";

export type NotificationType = "success" | "error" | "warning" | "info" | "loading";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number; // milliseconds, 0 for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => string;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Convenience methods
  success: (title: string, description?: string, options?: Partial<Notification>) => string;
  error: (title: string, description?: string, options?: Partial<Notification>) => string;
  warning: (title: string, description?: string, options?: Partial<Notification>) => string;
  info: (title: string, description?: string, options?: Partial<Notification>) => string;
  loading: (title: string, description?: string, options?: Partial<Notification>) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATION_ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  loading: Clock,
} as const;

const NOTIFICATION_STYLES = {
  success: {
    containerClass: "border-green-200 bg-green-50 text-green-800",
    iconClass: "text-green-600",
    actionClass: "bg-green-100 hover:bg-green-200 text-green-800"
  },
  error: {
    containerClass: "border-red-200 bg-red-50 text-red-800",
    iconClass: "text-red-600",
    actionClass: "bg-red-100 hover:bg-red-200 text-red-800"
  },
  warning: {
    containerClass: "border-yellow-200 bg-yellow-50 text-yellow-800",
    iconClass: "text-yellow-600",
    actionClass: "bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
  },
  info: {
    containerClass: "border-blue-200 bg-blue-50 text-blue-800",
    iconClass: "text-blue-600",
    actionClass: "bg-blue-100 hover:bg-blue-200 text-blue-800"
  },
  loading: {
    containerClass: "border-gray-200 bg-gray-50 text-gray-800",
    iconClass: "text-gray-600 animate-spin",
    actionClass: "bg-gray-100 hover:bg-gray-200 text-gray-800"
  }
} as const;

const DEFAULT_DURATIONS = {
  success: 5000,
  error: 0, // Persistent until dismissed
  warning: 8000,
  info: 6000,
  loading: 0, // Persistent until dismissed
} as const;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = useCallback(() => {
    return `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, "id">) => {
    const id = generateId();
    const duration = notification.duration !== undefined
      ? notification.duration
      : DEFAULT_DURATIONS[notification.type];

    const newNotification: Notification = {
      ...notification,
      id,
      duration,
      dismissible: notification.dismissible !== false, // Default to true
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-dismiss if duration > 0
    if (duration > 0) {
      setTimeout((): void => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, [generateId]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification?.onDismiss) {
        notification.onDismiss();
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, description?: string, options?: Partial<Notification>) => {
    return addNotification({ type: "success", title, description, ...options });
  }, [addNotification]);

  const error = useCallback((title: string, description?: string, options?: Partial<Notification>) => {
    return addNotification({ type: "error", title, description, ...options });
  }, [addNotification]);

  const warning = useCallback((title: string, description?: string, options?: Partial<Notification>) => {
    return addNotification({ type: "warning", title, description, ...options });
  }, [addNotification]);

  const info = useCallback((title: string, description?: string, options?: Partial<Notification>) => {
    return addNotification({ type: "info", title, description, ...options });
  }, [addNotification]);

  const loading = useCallback((title: string, description?: string, options?: Partial<Notification>) => {
    return addNotification({ type: "loading", title, description, ...options });
  }, [addNotification]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    success,
    error,
    warning,
    info,
    loading,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

// Notification Container Component
export function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

// Individual Notification Component
function NotificationItem({
  notification,
  onDismiss
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  const Icon = NOTIFICATION_ICONS[notification.type];
  const styles = NOTIFICATION_STYLES[notification.type];

  return (
    <div
      className={`
        relative rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out
        animate-in slide-in-from-top-2 fade-in-0
        ${styles.containerClass}
      `}
      role="alert"
      aria-live={notification.type === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${styles.iconClass}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{notification.title}</h4>
          {notification.description && (
            <p className="text-sm mt-1 opacity-90">{notification.description}</p>
          )}

          {/* Action Button */}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`
                inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium
                transition-colors duration-200 mt-2
                ${styles.actionClass}
              `}
            >
              {notification.action.label}
            </button>
          )}
        </div>

        {/* Dismiss Button */}
        {notification.dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 rounded-md p-1.5 hover:bg-black/5 transition-colors duration-200"
            aria-label="Dismiss notification"
          >
            <XCircle className="h-4 w-4 opacity-60 hover:opacity-80" />
          </button>
        )}
      </div>

      {/* Progress Bar for timed notifications */}
      {notification.duration && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-current opacity-30 transition-all duration-linear"
            style={{
              animation: `shrink ${notification.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// Add CSS animation for progress bar
const progressBarStyles = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = progressBarStyles;
  document.head.appendChild(style);
}