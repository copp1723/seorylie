import { useState } from 'react';
import { Bell, Check, CheckCircle, FileText, MessageSquare } from 'lucide-react';
import { useSEONotifications } from '../hooks/useSEONotifications';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useSEONotifications();
  const [isOpen, setIsOpen] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deliverable_ready':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'client_feedback':
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getNotificationTitle = (notification: any) => {
    switch (notification.type) {
      case 'task_completed':
        return `Task Completed: ${notification.data.task_type}`;
      case 'deliverable_ready':
        return `Deliverable Ready: ${notification.data.task_type}`;
      case 'task_created':
        return `New Task: ${notification.data.task_type}`;
      case 'client_feedback':
        return `Client Feedback: ${notification.data.rating}/5 stars`;
      default:
        return 'New Notification';
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read_at) {
      markAsRead([notification.id]);
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'task_completed':
      case 'task_created':
        window.location.href = `/tasks/${notification.taskId}`;
        break;
      case 'deliverable_ready':
        window.location.href = `/deliverables/${notification.deliverableId}`;
        break;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          {isConnected && (
            <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
              className="text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`p-3 cursor-pointer ${
                  !notification.read_at ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-3 w-full">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getNotificationTitle(notification)}
                    </p>
                    {notification.data.dealership_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {notification.data.dealership_name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.timestamp), {
                        addSuffix: true
                      })}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <div className="flex-shrink-0">
                      <span className="h-2 w-2 bg-blue-500 rounded-full block" />
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}