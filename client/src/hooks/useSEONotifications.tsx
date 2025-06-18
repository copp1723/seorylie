import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '../components/ui/use-toast';
import { useAuth } from './useAuth';
import { Bell, CheckCircle, FileText, AlertCircle } from 'lucide-react';

interface SEONotification {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'deliverable_ready' | 'client_feedback';
  taskId?: string;
  deliverableId?: string;
  dealershipId: string;
  data: any;
  timestamp: Date;
  read_at?: Date;
}

interface SEONotificationContextType {
  notifications: SEONotification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (notificationIds: string[]) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  refetchNotifications: () => void;
}

const SEONotificationContext = createContext<SEONotificationContextType | undefined>(undefined);

export function SEONotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<SEONotification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const socketInstance = io(process.env.REACT_APP_WS_URL || 'http://localhost:3001', {
      path: '/ws/seo',
      auth: {
        token: localStorage.getItem('auth_token'),
        userId: user.id,
        dealershipId: user.dealership_id,
        agencyId: user.agency_id
      }
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('Connected to SEO notification service');
      setIsConnected(true);
      
      // Subscribe to relevant notification types
      socketInstance.emit('subscribe', [
        'task_created',
        'task_updated',
        'task_completed',
        'deliverable_ready',
        'client_feedback'
      ]);

      // Request notification history
      socketInstance.emit('get-notifications', 50);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from SEO notification service');
      setIsConnected(false);
    });

    // Handle notification history
    socketInstance.on('notification-history', (history: SEONotification[]) => {
      setNotifications(history);
    });

    // Handle new notifications
    socketInstance.on('notification', (notification: SEONotification) => {
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast notification
      showNotificationToast(notification);
    });

    // Handle errors
    socketInstance.on('error', (error: { message: string }) => {
      console.error('SEO Notification error:', error);
      toast({
        title: 'Notification Error',
        description: error.message,
        variant: 'destructive'
      });
    });

    setSocket(socketInstance);

    // Cleanup
    return () => {
      socketInstance.disconnect();
    };
  }, [user, toast]);

  // Show toast for new notifications
  const showNotificationToast = (notification: SEONotification) => {
    let icon: ReactNode;
    let title: string;
    let description: string;

    switch (notification.type) {
      case 'task_completed':
        icon = <CheckCircle className="h-4 w-4" />;
        title = 'Task Completed';
        description = `${notification.data.task_type} has been completed`;
        break;
      
      case 'deliverable_ready':
        icon = <FileText className="h-4 w-4" />;
        title = 'Deliverable Ready';
        description = `New deliverable available for ${notification.data.task_type}`;
        break;
      
      case 'task_created':
        icon = <Bell className="h-4 w-4" />;
        title = 'New Task Created';
        description = `${notification.data.task_type} task has been created`;
        break;
      
      case 'client_feedback':
        icon = <AlertCircle className="h-4 w-4" />;
        title = 'Client Feedback';
        description = `New feedback received: ${notification.data.rating}/5 stars`;
        break;
      
      default:
        icon = <Bell className="h-4 w-4" />;
        title = 'Notification';
        description = 'You have a new notification';
    }

    toast({
      title: (
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
      ) as any,
      description
    });
  };

  // Mark notifications as read
  const markAsRead = useCallback((notificationIds: string[]) => {
    if (!socket) return;

    socket.emit('mark-read', notificationIds);
    
    // Optimistically update UI
    setNotifications(prev =>
      prev.map(n =>
        notificationIds.includes(n.id)
          ? { ...n, read_at: new Date() }
          : n
      )
    );
  }, [socket]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    const unreadIds = notifications
      .filter(n => !n.read_at)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  }, [notifications, markAsRead]);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Refetch notifications
  const refetchNotifications = useCallback(() => {
    if (socket) {
      socket.emit('get-notifications', 50);
    }
  }, [socket]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read_at).length;

  const value: SEONotificationContextType = {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refetchNotifications
  };

  return (
    <SEONotificationContext.Provider value={value}>
      {children}
    </SEONotificationContext.Provider>
  );
}

// Hook to use SEO notifications
export function useSEONotifications() {
  const context = useContext(SEONotificationContext);
  if (!context) {
    throw new Error('useSEONotifications must be used within SEONotificationProvider');
  }
  return context;
}