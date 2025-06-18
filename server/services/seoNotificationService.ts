import { EventEmitter } from 'events';
import { supabaseAdmin } from '../config/supabase';
import { sendTaskCompletionEmail, sendDeliverableReadyEmail } from './emailService';
import logger from '../utils/logger';

interface NotificationEvent {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'deliverable_ready' | 'client_feedback';
  taskId?: string;
  deliverableId?: string;
  dealershipId: string;
  agencyId?: string;
  data: any;
  timestamp: Date;
}

interface NotificationSubscriber {
  userId: string;
  dealershipId?: string;
  agencyId?: string;
  eventTypes: string[];
  callback: (event: NotificationEvent) => void;
}

class SEONotificationService extends EventEmitter {
  private subscribers: Map<string, NotificationSubscriber> = new Map();
  private wsConnections: Map<string, any> = new Map(); // socketId -> socket

  constructor() {
    super();
    this.setupEventListeners();
  }

  // Subscribe to notifications
  subscribe(subscriberId: string, subscriber: NotificationSubscriber) {
    this.subscribers.set(subscriberId, subscriber);
    logger.info('Notification subscriber added', { subscriberId, userId: subscriber.userId });
  }

  // Unsubscribe from notifications
  unsubscribe(subscriberId: string) {
    this.subscribers.delete(subscriberId);
    logger.info('Notification subscriber removed', { subscriberId });
  }

  // Register WebSocket connection
  registerWebSocket(socketId: string, socket: any, userId: string, dealershipId?: string) {
    this.wsConnections.set(socketId, { socket, userId, dealershipId });
    logger.info('WebSocket registered for notifications', { socketId, userId });
  }

  // Unregister WebSocket connection
  unregisterWebSocket(socketId: string) {
    this.wsConnections.delete(socketId);
    logger.info('WebSocket unregistered', { socketId });
  }

  // Send notification
  async notify(event: NotificationEvent) {
    try {
      // Log the notification
      await this.logNotification(event);

      // Send email notifications
      await this.sendEmailNotification(event);

      // Send real-time notifications
      this.sendRealtimeNotification(event);

      // Notify subscribers
      this.notifySubscribers(event);

      logger.info('Notification sent', { type: event.type, taskId: event.taskId });
    } catch (error) {
      logger.error('Failed to send notification', { error, event });
    }
  }

  // Task lifecycle notifications
  async notifyTaskCreated(taskId: string, dealershipId: string, taskData: any) {
    await this.notify({
      type: 'task_created',
      taskId,
      dealershipId,
      data: taskData,
      timestamp: new Date()
    });
  }

  async notifyTaskUpdated(taskId: string, dealershipId: string, updates: any) {
    await this.notify({
      type: 'task_updated',
      taskId,
      dealershipId,
      data: updates,
      timestamp: new Date()
    });
  }

  async notifyTaskCompleted(taskId: string, dealershipId: string, taskData: any) {
    await this.notify({
      type: 'task_completed',
      taskId,
      dealershipId,
      data: taskData,
      timestamp: new Date()
    });
  }

  async notifyDeliverableReady(deliverableId: string, taskId: string, dealershipId: string, deliverableData: any) {
    await this.notify({
      type: 'deliverable_ready',
      deliverableId,
      taskId,
      dealershipId,
      data: deliverableData,
      timestamp: new Date()
    });
  }

  // Private methods
  private setupEventListeners() {
    // Listen for Supabase realtime events
    this.setupSupabaseListeners();
  }

  private async setupSupabaseListeners() {
    // Listen for task updates
    supabaseAdmin
      .channel('task-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'tasks',
          filter: 'status=eq.completed'
        }, 
        (payload) => {
          this.notifyTaskCompleted(
            payload.new.id,
            payload.new.dealership_id,
            payload.new
          );
        }
      )
      .subscribe();

    // Listen for deliverable inserts
    supabaseAdmin
      .channel('deliverable-updates')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deliverables'
        },
        (payload) => {
          this.notifyDeliverableReady(
            payload.new.id,
            payload.new.task_id,
            payload.new.dealership_id,
            payload.new
          );
        }
      )
      .subscribe();
  }

  private async logNotification(event: NotificationEvent) {
    try {
      await supabaseAdmin
        .from('notification_logs')
        .insert({
          type: event.type,
          task_id: event.taskId,
          deliverable_id: event.deliverableId,
          dealership_id: event.dealershipId,
          agency_id: event.agencyId,
          data: event.data,
          created_at: event.timestamp
        });
    } catch (error) {
      logger.error('Failed to log notification', { error });
    }
  }

  private async sendEmailNotification(event: NotificationEvent) {
    try {
      switch (event.type) {
        case 'task_completed':
          if (event.taskId && event.data) {
            await sendTaskCompletionEmail({
              taskId: event.taskId,
              taskType: event.data.task_type,
              dealershipName: event.data.dealership_name || 'Client',
              completedAt: event.timestamp.toISOString()
            });
          }
          break;

        case 'deliverable_ready':
          if (event.deliverableId && event.data) {
            await sendDeliverableReadyEmail({
              deliverableId: event.deliverableId,
              taskType: event.data.task_type,
              dealershipName: event.data.dealership_name || 'Client',
              deliverableUrl: event.data.file_url
            });
          }
          break;
      }
    } catch (error) {
      logger.error('Failed to send email notification', { error, event });
    }
  }

  private sendRealtimeNotification(event: NotificationEvent) {
    // Send to specific dealership connections
    for (const [socketId, connection] of this.wsConnections.entries()) {
      if (connection.dealershipId === event.dealershipId) {
        try {
          connection.socket.emit('notification', {
            type: event.type,
            data: event.data,
            timestamp: event.timestamp
          });
        } catch (error) {
          logger.error('Failed to send websocket notification', { error, socketId });
        }
      }
    }
  }

  private notifySubscribers(event: NotificationEvent) {
    for (const [subscriberId, subscriber] of this.subscribers.entries()) {
      // Check if subscriber is interested in this event type
      if (!subscriber.eventTypes.includes(event.type)) continue;

      // Check if subscriber should receive this notification
      if (subscriber.dealershipId && subscriber.dealershipId !== event.dealershipId) continue;
      if (subscriber.agencyId && subscriber.agencyId !== event.agencyId) continue;

      try {
        subscriber.callback(event);
      } catch (error) {
        logger.error('Subscriber callback failed', { error, subscriberId });
      }
    }
  }

  // Get notification history
  async getNotificationHistory(dealershipId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('notification_logs')
      .select('*')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch notification history', { error });
      return [];
    }

    return data;
  }

  // Mark notifications as read
  async markAsRead(notificationIds: string[]) {
    const { error } = await supabaseAdmin
      .from('notification_logs')
      .update({ read_at: new Date().toISOString() })
      .in('id', notificationIds);

    if (error) {
      logger.error('Failed to mark notifications as read', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const seoNotificationService = new SEONotificationService();