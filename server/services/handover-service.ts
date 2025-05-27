import { eq, and, desc } from 'drizzle-orm';
import db from '../db';
import {
  handovers,
  conversations,
  leads,
  leadActivities,
  type InsertHandover,
  type Handover,
  type HandoverReason,
  type HandoverStatus,
  type LeadPriority
} from '../../shared/lead-management-schema';
import { users } from '../../shared/schema';
import logger from '../utils/logger';

export interface HandoverRequest {
  conversationId: string;
  reason: HandoverReason;
  description: string;
  toUserId?: number;
  urgency?: LeadPriority;
  context?: Record<string, any>;
}

export interface HandoverResult {
  success: boolean;
  handoverId?: string;
  conversationId?: string;
  status?: string;
  estimatedResponseTime?: string;
  errors: string[];
  conversationNotFound?: boolean;
}

export interface HandoverUpdateData {
  status: HandoverStatus;
  userId?: number;
  notes?: string;
  customerSatisfaction?: number;
}

export interface HandoverUpdateResult {
  success: boolean;
  handover?: Handover;
  errors: string[];
  handoverNotFound?: boolean;
}

export interface ConversationContext {
  customerName: string;
  relevantVehicles?: Array<{
    year: number;
    make: string;
    model: string;
    trim?: string;
    price: number;
  }>;
  previousMessages: Array<{
    content: string;
    isFromCustomer: boolean;
  }>;
}

export class HandoverService {
  /**
   * Create a new handover request
   */
  async createHandover(
    dealershipId: number,
    handoverData: HandoverRequest
  ): Promise<HandoverResult> {
    const errors: string[] = [];

    try {
      logger.info('Creating handover request', {
        dealershipId,
        conversationId: handoverData.conversationId,
        reason: handoverData.reason
      });

      // Verify conversation exists and get lead information
      const conversationResults = await db
        .select({
          conversation: conversations,
          lead: leads
        })
        .from(conversations)
        .leftJoin(leads, eq(conversations.leadId, leads.id))
        .where(and(
          eq(conversations.id, handoverData.conversationId),
          eq(conversations.dealershipId, dealershipId)
        ))
        .limit(1);

      if (conversationResults.length === 0) {
        return {
          success: false,
          errors: ['Conversation not found'],
          conversationNotFound: true
        };
      }

      const { conversation, lead } = conversationResults[0];

      if (!lead) {
        errors.push('Associated lead not found');
        return { success: false, errors };
      }

      // Check if there's already a pending handover for this conversation
      const existingHandovers = await db
        .select()
        .from(handovers)
        .where(and(
          eq(handovers.conversationId, handoverData.conversationId),
          eq(handovers.status, 'pending')
        ))
        .limit(1);

      if (existingHandovers.length > 0) {
        return {
          success: false,
          errors: ['There is already a pending handover for this conversation'],
          handoverId: existingHandovers[0].id
        };
      }

      // Find available agent if not specified
      let assignedUserId = handoverData.toUserId;
      if (!assignedUserId) {
        assignedUserId = await this.findAvailableAgent(dealershipId, handoverData.urgency);
      }

      // Create handover record
      const handoverRecord: InsertHandover = {
        conversationId: handoverData.conversationId,
        leadId: lead.id,
        reason: handoverData.reason,
        description: handoverData.description,
        status: 'pending',
        toUserId: assignedUserId,
        urgency: handoverData.urgency || 'medium',
        context: handoverData.context || {},
        requestedAt: new Date()
      };

      const [newHandover] = await db
        .insert(handovers)
        .values(handoverRecord)
        .returning();

      // Update conversation status to escalated
      await db
        .update(conversations)
        .set({
          status: 'escalated',
          updatedAt: new Date()
        })
        .where(eq(conversations.id, handoverData.conversationId));

      // Log activity
      await db.insert(leadActivities).values({
        leadId: lead.id,
        type: 'handover_requested',
        description: `Handover requested: ${handoverData.reason} - ${handoverData.description}`,
        handoverId: newHandover.id
      });

      // Calculate estimated response time based on urgency
      const estimatedResponseTime = this.calculateEstimatedResponseTime(handoverData.urgency || 'medium');

      logger.info('Handover created successfully', {
        handoverId: newHandover.id,
        conversationId: handoverData.conversationId,
        assignedUserId
      });

      return {
        success: true,
        handoverId: newHandover.id,
        conversationId: handoverData.conversationId,
        status: 'pending',
        estimatedResponseTime,
        errors
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Handover creation failed', {
        error: err.message,
        dealershipId,
        conversationId: handoverData.conversationId
      });

      errors.push(`Failed to create handover: ${err.message}`);

      return {
        success: false,
        errors
      };
    }
  }

  /**
   * Update handover status
   */
  async updateHandover(
    dealershipId: number,
    handoverId: string,
    updateData: HandoverUpdateData
  ): Promise<HandoverUpdateResult> {
    const errors: string[] = [];

    try {
      logger.info('Updating handover', {
        dealershipId,
        handoverId,
        status: updateData.status
      });

      // Get existing handover with conversation info
      const handoverResults = await db
        .select({
          handover: handovers,
          conversation: conversations
        })
        .from(handovers)
        .leftJoin(conversations, eq(handovers.conversationId, conversations.id))
        .where(and(
          eq(handovers.id, handoverId),
          eq(conversations.dealershipId, dealershipId)
        ))
        .limit(1);

      if (handoverResults.length === 0) {
        return {
          success: false,
          errors: ['Handover not found'],
          handoverNotFound: true
        };
      }

      const { handover, conversation } = handoverResults[0];

      if (!conversation) {
        errors.push('Associated conversation not found');
        return { success: false, errors };
      }

      // Prepare update data
      const updateFields: Partial<Handover> = {
        status: updateData.status,
        updatedAt: new Date()
      };

      // Set timestamps based on status
      if (updateData.status === 'accepted' && !handover.acceptedAt) {
        updateFields.acceptedAt = new Date();
      }

      if (updateData.status === 'resolved' || updateData.status === 'rejected') {
        updateFields.completedAt = new Date();
        updateFields.resolutionNotes = updateData.notes;
        updateFields.customerSatisfaction = updateData.customerSatisfaction;
      }

      // Update handover
      const [updatedHandover] = await db
        .update(handovers)
        .set(updateFields)
        .where(eq(handovers.id, handoverId))
        .returning();

      // Update conversation status based on handover status
      let conversationStatus = conversation.status;
      if (updateData.status === 'accepted' || updateData.status === 'in_progress') {
        conversationStatus = 'active';
      } else if (updateData.status === 'resolved') {
        conversationStatus = 'resolved';
      } else if (updateData.status === 'rejected') {
        conversationStatus = 'active'; // Return to AI
      }

      await db
        .update(conversations)
        .set({
          status: conversationStatus as any,
          assignedUserId: updateData.userId,
          updatedAt: new Date()
        })
        .where(eq(conversations.id, conversation.id));

      // Log activity
      await db.insert(leadActivities).values({
        leadId: handover.leadId,
        userId: updateData.userId,
        type: 'handover_updated',
        description: `Handover ${updateData.status}: ${updateData.notes || ''}`,
        handoverId: handover.id
      });

      logger.info('Handover updated successfully', {
        handoverId,
        status: updateData.status,
        userId: updateData.userId
      });

      return {
        success: true,
        handover: updatedHandover,
        errors
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Handover update failed', {
        error: err.message,
        dealershipId,
        handoverId
      });

      errors.push(`Failed to update handover: ${err.message}`);

      return {
        success: false,
        errors
      };
    }
  }

  /**
   * Get handovers for a dealership
   */
  async getHandovers(
    dealershipId: number,
    options: {
      limit?: number;
      offset?: number;
      status?: HandoverStatus;
      userId?: number;
      urgency?: LeadPriority;
    } = {}
  ): Promise<Handover[]> {
    try {
      const { limit = 50, offset = 0, status, userId, urgency } = options;

      // Join with conversations to filter by dealership
      let query = db
        .select({ handover: handovers })
        .from(handovers)
        .leftJoin(conversations, eq(handovers.conversationId, conversations.id))
        .where(eq(conversations.dealershipId, dealershipId));

      if (status) {
        query = query.where(and(
          eq(conversations.dealershipId, dealershipId),
          eq(handovers.status, status)
        ));
      }

      if (userId) {
        query = query.where(and(
          eq(conversations.dealershipId, dealershipId),
          eq(handovers.toUserId, userId)
        ));
      }

      if (urgency) {
        query = query.where(and(
          eq(conversations.dealershipId, dealershipId),
          eq(handovers.urgency, urgency)
        ));
      }

      const results = await query
        .orderBy(desc(handovers.requestedAt))
        .limit(limit)
        .offset(offset);

      return results.map(r => r.handover);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Get handovers failed', {
        error: err.message,
        dealershipId
      });

      return [];
    }
  }

  /**
   * Get handover by ID
   */
  async getHandoverById(
    dealershipId: number,
    handoverId: string
  ): Promise<Handover | null> {
    try {
      const results = await db
        .select({ handover: handovers })
        .from(handovers)
        .leftJoin(conversations, eq(handovers.conversationId, conversations.id))
        .where(and(
          eq(handovers.id, handoverId),
          eq(conversations.dealershipId, dealershipId)
        ))
        .limit(1);

      return results[0]?.handover || null;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Get handover by ID failed', {
        error: err.message,
        dealershipId,
        handoverId
      });

      return null;
    }
  }

  /**
   * Find available agent for handover
   */
  private async findAvailableAgent(
    dealershipId: number,
    urgency?: LeadPriority
  ): Promise<number | undefined> {
    try {
      // Simple round-robin assignment for now
      // In a more sophisticated system, this would consider:
      // - Agent availability/working hours
      // - Current workload
      // - Skill matching
      // - Priority queues

      const availableAgents = await db
        .select()
        .from(users)
        .where(and(
          eq(users.dealership_id, dealershipId),
          eq(users.role, 'user') // or other agent roles
        ))
        .limit(10);

      if (availableAgents.length === 0) {
        return undefined;
      }

      // For urgent requests, try to find agents with fewer active handovers
      if (urgency === 'urgent' || urgency === 'high') {
        // This would require a more complex query to count active handovers per agent
        // For now, just return the first available agent
      }

      // Return first available agent
      return availableAgents[0].id;

    } catch (error) {
      logger.error('Find available agent failed', { error, dealershipId, urgency });
      return undefined;
    }
  }

  /**
   * Calculate estimated response time based on urgency
   */
  private calculateEstimatedResponseTime(urgency: LeadPriority): string {
    switch (urgency) {
      case 'urgent':
        return '5 minutes';
      case 'high':
        return '15 minutes';
      case 'medium':
        return '1 hour';
      case 'low':
        return '4 hours';
      default:
        return '1 hour';
    }
  }
}