import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';

export type AgentRole = 'agent' | 'supervisor' | 'admin';
export type AgentStatus = 'online' | 'busy' | 'away' | 'offline';
export type HandoverStatus = 'pending' | 'claimed' | 'in_progress' | 'resolved' | 'escalated';
export type HandoverReason = 'customer_request' | 'ai_limitation' | 'complex_inquiry' | 'escalation' | 'technical_issue';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Agent {
  id: string;
  dealershipId: number;
  employeeId?: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  role: AgentRole;
  status: AgentStatus;
  maxConcurrentConversations: number;
  skills?: string[];
  languages?: string[];
  workSchedule?: any;
  lastActiveAt?: Date;
  active: boolean;
}

export interface ConversationHandover {
  id: string;
  conversationId: number;
  customerId: number;
  dealershipId: number;
  status: HandoverStatus;
  reason: HandoverReason;
  priority: ConversationPriority;
  requestedBy: string;
  requestedAt: Date;
  claimedBy?: string;
  claimedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  contextSummary?: string;
  customerSentiment?: string;
  estimatedResolutionTime?: number;
  actualResolutionTime?: number;
  metadata?: Record<string, any>;
}

export interface AgentNotification {
  id: string;
  agentId: string;
  type: string;
  title: string;
  message: string;
  priority: ConversationPriority;
  relatedConversationId?: number;
  relatedHandoverId?: string;
  readAt?: Date;
  createdAt: Date;
}

export interface AgentDashboardSummary {
  agentId: string;
  displayName: string;
  status: AgentStatus;
  role: AgentRole;
  activeConversations: number;
  pendingHandovers: number;
  unreadNotifications: number;
  lastActiveAt?: Date;
  dealershipName: string;
}

export class AgentDashboardService {
  private static instance: AgentDashboardService;

  private constructor() {}

  static getInstance(): AgentDashboardService {
    if (!AgentDashboardService.instance) {
      AgentDashboardService.instance = new AgentDashboardService();
    }
    return AgentDashboardService.instance;
  }

  /**
   * Get agent dashboard summary
   */
  async getAgentDashboard(agentId: string): Promise<AgentDashboardSummary | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM agent_dashboard_summary
        WHERE agent_id = ${agentId}
      `);

      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0] as any;
      return {
        agentId: row.agent_id,
        displayName: row.display_name,
        status: row.status,
        role: row.role,
        activeConversations: parseInt(row.active_conversations) || 0,
        pendingHandovers: parseInt(row.pending_handovers) || 0,
        unreadNotifications: parseInt(row.unread_notifications) || 0,
        lastActiveAt: row.last_active_at,
        dealershipName: row.dealership_name
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get agent dashboard', err, { agentId });
      throw err;
    }
  }

  /**
   * Get escalated conversations for an agent
   */
  async getEscalatedConversations(
    agentId: string,
    status?: HandoverStatus,
    limit: number = 50
  ): Promise<ConversationHandover[]> {
    try {
      const whereClause = status ?
        sql`WHERE (claimed_by = ${agentId} OR status = 'pending') AND status = ${status}` :
        sql`WHERE claimed_by = ${agentId} OR status = 'pending'`;

      const result = await db.execute(sql`
        SELECT
          ch.*,
          c.id as conversation_id,
          cu.first_name as customer_first_name,
          cu.last_name as customer_last_name,
          cu.email as customer_email,
          cu.phone as customer_phone
        FROM conversation_handovers ch
        LEFT JOIN conversations c ON ch.conversation_id = c.id
        LEFT JOIN customers cu ON ch.customer_id = cu.id
        ${whereClause}
        ORDER BY
          CASE ch.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          ch.requested_at ASC
        LIMIT ${limit}
      `);

      return (result || []).map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        customerId: row.customer_id,
        dealershipId: row.dealership_id,
        status: row.status,
        reason: row.reason,
        priority: row.priority,
        requestedBy: row.requested_by,
        requestedAt: row.requested_at,
        claimedBy: row.claimed_by,
        claimedAt: row.claimed_at,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        resolutionNotes: row.resolution_notes,
        contextSummary: row.context_summary,
        customerSentiment: row.customer_sentiment,
        estimatedResolutionTime: row.estimated_resolution_time,
        actualResolutionTime: row.actual_resolution_time,
        metadata: row.metadata || {}
      }));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get escalated conversations', err, { agentId, status });
      throw err;
    }
  }

  /**
   * Claim a conversation handover
   */
  async claimHandover(handoverId: string, agentId: string): Promise<boolean> {
    try {
      // Check if handover is still available
      const checkResult = await db.execute(sql`
        SELECT id, status, claimed_by
        FROM conversation_handovers
        WHERE id = ${handoverId}
      `);

      if (!checkResult.rows || checkResult.rows.length === 0) {
        throw new Error('Handover not found');
      }

      const handover = checkResult.rows[0] as any;
      if (handover.status !== 'pending') {
        throw new Error('Handover is no longer available');
      }

      if (handover.claimed_by && handover.claimed_by !== agentId) {
        throw new Error('Handover already claimed by another agent');
      }

      // Claim the handover
      await db.execute(sql`
        UPDATE conversation_handovers
        SET status = 'claimed',
            claimed_by = ${agentId},
            claimed_at = NOW()
        WHERE id = ${handoverId}
        AND status = 'pending'
      `);

      // Create conversation assignment
      await db.execute(sql`
        INSERT INTO agent_conversation_assignments (
          agent_id, conversation_id, handover_id, is_primary
        )
        SELECT ${agentId}, conversation_id, ${handoverId}, true
        FROM conversation_handovers
        WHERE id = ${handoverId}
      `);

      // Update agent status to busy if they weren't already
      await this.updateAgentStatus(agentId, 'busy');

      logger.info('Handover claimed successfully', {
        handoverId,
        agentId
      });

      return true;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to claim handover', err, { handoverId, agentId });
      throw err;
    }
  }

  /**
   * Update handover status
   */
  async updateHandoverStatus(
    handoverId: string,
    agentId: string,
    status: HandoverStatus,
    notes?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date()
      };

      if (status === 'in_progress') {
        // No additional fields needed
      } else if (status === 'resolved') {
        updateData.resolved_by = agentId;
        updateData.resolved_at = new Date();
        updateData.resolution_notes = notes;

        // Calculate actual resolution time
        const handoverResult = await db.execute(sql`
          SELECT claimed_at FROM conversation_handovers WHERE id = ${handoverId}
        `);

        if (handoverResult.rows && handoverResult.rows.length > 0) {
          const claimedAt = handoverResult.rows[0].claimed_at;
          if (claimedAt) {
            const resolutionTime = Math.round(
              (updateData.resolved_at.getTime() - new Date(claimedAt).getTime()) / 60000
            );
            updateData.actual_resolution_time = resolutionTime;
          }
        }
      }

      await db.execute(sql`
        UPDATE conversation_handovers
        SET status = ${status},
            resolved_by = ${updateData.resolved_by || null},
            resolved_at = ${updateData.resolved_at || null},
            resolution_notes = ${updateData.resolution_notes || null},
            actual_resolution_time = ${updateData.actual_resolution_time || null}
        WHERE id = ${handoverId}
        AND claimed_by = ${agentId}
      `);

      // If resolved, unassign from agent
      if (status === 'resolved') {
        await db.execute(sql`
          UPDATE agent_conversation_assignments
          SET unassigned_at = NOW()
          WHERE handover_id = ${handoverId}
          AND agent_id = ${agentId}
        `);
      }

      logger.info('Handover status updated', {
        handoverId,
        agentId,
        status,
        notes
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update handover status', err, {
        handoverId,
        agentId,
        status
      });
      throw err;
    }
  }

  /**
   * Send message in conversation
   */
  async sendMessage(
    agentId: string,
    conversationId: number,
    content: string,
    isInternal: boolean = false
  ): Promise<void> {
    try {
      // Verify agent has access to this conversation
      const accessResult = await db.execute(sql`
        SELECT id FROM agent_conversation_assignments
        WHERE agent_id = ${agentId}
        AND conversation_id = ${conversationId}
        AND unassigned_at IS NULL
      `);

      if (!accessResult.rows || accessResult.rows.length === 0) {
        throw new Error('Agent does not have access to this conversation');
      }

      // Add message to conversation
      // This would integrate with the main conversation system
      // For now, we'll just log the message

      if (isInternal) {
        // Add as internal note
        await db.execute(sql`
          INSERT INTO conversation_agent_notes (
            conversation_id, agent_id, note_type, content, is_visible_to_customer
          )
          VALUES (${conversationId}, ${agentId}, 'internal', ${content}, false)
        `);
      } else {
        // Add as regular message to conversation
        // This would typically integrate with the message delivery service
        logger.info('Agent message sent', {
          agentId,
          conversationId,
          messageLength: content.length,
          isInternal
        });
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send agent message', err, {
        agentId,
        conversationId,
        isInternal
      });
      throw err;
    }
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE agents
        SET status = ${status},
            last_active_at = NOW()
        WHERE id = ${agentId}
      `);

      logger.info('Agent status updated', { agentId, status });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update agent status', err, { agentId, status });
      throw err;
    }
  }

  /**
   * Get agent notifications
   */
  async getAgentNotifications(
    agentId: string,
    unreadOnly: boolean = false,
    limit: number = 50
  ): Promise<AgentNotification[]> {
    try {
      const whereClause = unreadOnly ?
        sql`WHERE agent_id = ${agentId} AND read_at IS NULL AND dismissed_at IS NULL` :
        sql`WHERE agent_id = ${agentId}`;

      const result = await db.execute(sql`
        SELECT * FROM agent_notifications
        ${whereClause}
        ORDER BY
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
          END,
          created_at DESC
        LIMIT ${limit}
      `);

      return (result || []).map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        title: row.title,
        message: row.message,
        priority: row.priority,
        relatedConversationId: row.related_conversation_id,
        relatedHandoverId: row.related_handover_id,
        readAt: row.read_at,
        createdAt: row.created_at
      }));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get agent notifications', err, { agentId });
      throw err;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, agentId: string): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE agent_notifications
        SET read_at = NOW()
        WHERE id = ${notificationId}
        AND agent_id = ${agentId}
        AND read_at IS NULL
      `);

      logger.info('Notification marked as read', { notificationId, agentId });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to mark notification as read', err, {
        notificationId,
        agentId
      });
      throw err;
    }
  }

  /**
   * Create handover notification for agents
   */
  async createHandoverNotification(handover: ConversationHandover): Promise<void> {
    try {
      // Get available agents for this dealership
      const agentsResult = await db.execute(sql`
        SELECT id FROM agents
        WHERE dealership_id = ${handover.dealershipId}
        AND status IN ('online', 'busy')
        AND active = true
      `);

      const agents = agentsResult.rows || [];

      for (const agent of agents) {
        await db.execute(sql`
          INSERT INTO agent_notifications (
            agent_id, type, title, message, priority,
            related_conversation_id, related_handover_id
          )
          VALUES (
            ${agent.id},
            'new_handover',
            ${`New ${handover.priority} priority handover`},
            ${`Customer needs assistance: ${handover.reason.replace('_', ' ')}`},
            ${handover.priority},
            ${handover.conversationId},
            ${handover.id}
          )
        `);
      }

      logger.info('Handover notifications created', {
        handoverId: handover.id,
        dealershipId: handover.dealershipId,
        agentCount: agents.length
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create handover notification', err, {
        handoverId: handover.id
      });
    }
  }

  /**
   * Get conversation history with agent notes
   */
  async getConversationHistory(
    conversationId: number,
    agentId: string
  ): Promise<any> {
    try {
      // Verify agent has access
      const accessResult = await db.execute(sql`
        SELECT id FROM agent_conversation_assignments
        WHERE agent_id = ${agentId}
        AND conversation_id = ${conversationId}
      `);

      if (!accessResult.rows || accessResult.rows.length === 0) {
        throw new Error('Agent does not have access to this conversation');
      }

      // Get conversation messages and agent notes
      const notesResult = await db.execute(sql`
        SELECT * FROM conversation_agent_notes
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `);

      // This would typically also fetch the main conversation messages
      // and merge them with agent notes for a complete timeline

      return {
        conversationId,
        agentNotes: (notesResult.rows || []).map((row: any) => ({
          id: row.id,
          agentId: row.agent_id,
          noteType: row.note_type,
          content: row.content,
          isVisibleToCustomer: row.is_visible_to_customer,
          tags: row.tags,
          createdAt: row.created_at
        })),
        // messages: [] // Would be populated from main conversation system
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get conversation history', err, {
        conversationId,
        agentId
      });
      throw err;
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformanceMetrics(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT
          date_recorded,
          conversations_handled,
          avg_response_time_minutes,
          avg_resolution_time_minutes,
          customer_satisfaction_avg,
          handovers_claimed,
          handovers_resolved,
          handovers_escalated,
          online_time_minutes
        FROM agent_performance_metrics
        WHERE agent_id = ${agentId}
        AND date_recorded BETWEEN ${startDate} AND ${endDate}
        ORDER BY date_recorded ASC
      `);

      return result || [];

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get agent performance metrics', err, {
        agentId,
        startDate,
        endDate
      });
      throw err;
    }
  }
}

// Export singleton instance
export const agentDashboardService = AgentDashboardService.getInstance();