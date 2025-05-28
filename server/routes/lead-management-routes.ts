/**
 * Routes for lead scoring and follow-up management
 */
import express from 'express';
import { calculateLeadScore, getLeadScore, getTopLeads } from '../services/lead-scoring';
import { 
  scheduleFollowUp, 
  getUserFollowUps, 
  getDealershipFollowUps, 
  completeFollowUp, 
  cancelFollowUp 
} from '../services/follow-up-scheduler';
import { logAuditEvent } from '../services/user-management';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { conversations } from '../../shared/lead-management-schema';
import { followUps } from '../../shared/schema-extensions';

const router = express.Router();

// Get lead score for a conversation
router.get('/conversations/:conversationId/lead-score', async (req, res) => {
  try {
    const conversationId = req.params.conversationId; // Keep as string for UUID
    
    // Get conversation to check permissions
    const [conversation] = await db.select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.dealershipId !== conversation.dealershipId && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const leadScore = await getLeadScore(conversationId);
    
    if (!leadScore) {
      // Calculate score if it doesn't exist
      const score = await calculateLeadScore(conversationId);
      res.json({ score });
    } else {
      res.json(leadScore);
    }
  } catch (error) {
    console.error('Error getting lead score:', error);
    res.status(500).json({ error: 'Failed to get lead score' });
  }
});

// Get top leads for a dealership
router.get('/dealerships/:dealershipId/top-leads', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== dealershipId && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const topLeads = await getTopLeads(dealershipId, limit);
    res.json({ leads: topLeads });
  } catch (error) {
    console.error('Error getting top leads:', error);
    res.status(500).json({ error: 'Failed to get top leads' });
  }
});

// Schedule a follow-up
router.post('/follow-ups', async (req, res) => {
  try {
    const { 
      conversationId, 
      dealershipId, 
      customerName, 
      customerContact, 
      assignedTo, 
      scheduledTime, 
      notes 
    } = req.body;
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== dealershipId && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Validate required fields
    if (!conversationId || !dealershipId || !customerName || !assignedTo || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const followUp = await scheduleFollowUp({
      conversationId,
      dealershipId,
      customerName,
      customerContact,
      assignedTo,
      scheduledTime: new Date(scheduledTime),
      notes
    });
    
    // Log the action
    await logAuditEvent({
      userId: req.user.id,
      dealershipId,
      action: 'schedule_follow_up',
      resourceType: 'follow_up',
      resourceId: followUp.id,
      details: { customerName, assignedTo, scheduledTime }
    });
    
    res.status(201).json({ followUp });
  } catch (error) {
    console.error('Error scheduling follow-up:', error);
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

// Get follow-ups for current user
router.get('/my-follow-ups', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const status = req.query.status as string;
    const followUps = await getUserFollowUps(req.user.id, status);
    
    res.json({ followUps });
  } catch (error) {
    console.error('Error getting follow-ups:', error);
    res.status(500).json({ error: 'Failed to get follow-ups' });
  }
});

// Get follow-ups for a dealership
router.get('/dealerships/:dealershipId/follow-ups', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== dealershipId && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const status = req.query.status as string;
    
    // Parse date range if provided
    let dateRange;
    if (req.query.startDate && req.query.endDate) {
      dateRange = {
        start: new Date(req.query.startDate as string),
        end: new Date(req.query.endDate as string)
      };
    }
    
    const followUps = await getDealershipFollowUps(dealershipId, status, dateRange);
    
    res.json({ followUps });
  } catch (error) {
    console.error('Error getting dealership follow-ups:', error);
    res.status(500).json({ error: 'Failed to get follow-ups' });
  }
});

// Mark a follow-up as completed
router.put('/follow-ups/:followUpId/complete', async (req, res) => {
  try {
    const followUpId = parseInt(req.params.followUpId);
    const { notes } = req.body;
    
    // Get follow-up to check permissions
    const [followUp] = await db.select()
      .from(followUps)
      .where(eq(followUps.id, followUpId));
    
    if (!followUp) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.id !== followUp.assigned_to && 
        req.user.dealership_id !== followUp.dealership_id && 
        req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const updatedFollowUp = await completeFollowUp(followUpId, notes);
    
    // Log the action
    await logAuditEvent({
      userId: req.user.id,
      dealershipId: followUp.dealership_id,
      action: 'complete_follow_up',
      resourceType: 'follow_up',
      resourceId: followUpId
    });
    
    res.json({ followUp: updatedFollowUp });
  } catch (error) {
    console.error('Error completing follow-up:', error);
    res.status(500).json({ error: 'Failed to complete follow-up' });
  }
});

// Cancel a follow-up
router.put('/follow-ups/:followUpId/cancel', async (req, res) => {
  try {
    const followUpId = parseInt(req.params.followUpId);
    const { reason } = req.body;
    
    // Get follow-up to check permissions
    const [followUp] = await db.select()
      .from(followUps)
      .where(eq(followUps.id, followUpId));
    
    if (!followUp) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.id !== followUp.assigned_to && 
        req.user.dealership_id !== followUp.dealership_id && 
        req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const updatedFollowUp = await cancelFollowUp(followUpId, reason);
    
    // Log the action
    await logAuditEvent({
      userId: req.user.id,
      dealershipId: followUp.dealership_id,
      action: 'cancel_follow_up',
      resourceType: 'follow_up',
      resourceId: followUpId,
      details: { reason }
    });
    
    res.json({ followUp: updatedFollowUp });
  } catch (error) {
    console.error('Error canceling follow-up:', error);
    res.status(500).json({ error: 'Failed to cancel follow-up' });
  }
});

export default router;