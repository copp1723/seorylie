/**
 * Routes for managing escalation triggers
 */
import express from 'express';
import {
  getEscalationTriggers,
  createEscalationTrigger,
  updateEscalationTrigger,
  deleteEscalationTrigger
} from '../services/escalation-triggers';
import { hasDealershipAccess } from '../utils/helpers/permissions';
import { logAuditEvent } from '../services/user-management';

const router = express.Router();

// Get all escalation triggers for a dealership
router.get('/dealerships/:dealershipId/escalation-triggers', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    
    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const triggers = await getEscalationTriggers(dealershipId);
    res.json({ triggers });
  } catch (error) {
    console.error('Error getting escalation triggers:', error);
    res.status(500).json({ error: 'Failed to get escalation triggers' });
  }
});

// Create a new escalation trigger
router.post('/dealerships/:dealershipId/escalation-triggers', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    
    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { name, description, conditions, isActive } = req.body;
    
    if (!name || !conditions || !Array.isArray(conditions)) {
      return res.status(400).json({ error: 'Invalid trigger data' });
    }
    
    const trigger = await createEscalationTrigger({
      dealershipId,
      name,
      description,
      conditions,
      isActive
    });
    
    // Log the action
    await logAuditEvent({
      userId: req.user.id,
      dealershipId,
      action: 'create_escalation_trigger',
      resourceType: 'escalation_trigger',
      resourceId: trigger.id,
      details: { name, conditionCount: conditions.length }
    });
    
    res.status(201).json({ trigger });
  } catch (error) {
    console.error('Error creating escalation trigger:', error);
    res.status(500).json({ error: 'Failed to create escalation trigger' });
  }
});

// Update an escalation trigger
router.put('/dealerships/:dealershipId/escalation-triggers/:triggerId', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    const triggerId = parseInt(req.params.triggerId);
    
    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { name, description, conditions, isActive } = req.body;
    
    const trigger = await updateEscalationTrigger(triggerId, {
      name,
      description,
      conditions,
      isActive
    });
    
    // Log the action
    await logAuditEvent({
      userId: req.user.id,
      dealershipId,
      action: 'update_escalation_trigger',
      resourceType: 'escalation_trigger',
      resourceId: triggerId,
      details: { name, conditionCount: conditions?.length }
    });
    
    res.json({ trigger });
  } catch (error) {
    console.error('Error updating escalation trigger:', error);
    res.status(500).json({ error: 'Failed to update escalation trigger' });
  }
});

// Delete an escalation trigger
router.delete('/dealerships/:dealershipId/escalation-triggers/:triggerId', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    const triggerId = parseInt(req.params.triggerId);
    
    // Check permissions
    if (!hasDealershipAccess(req.user, dealershipId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await deleteEscalationTrigger(triggerId);
    
    // Log the action
    await logAuditEvent({
      userId: req.user.id,
      dealershipId,
      action: 'delete_escalation_trigger',
      resourceType: 'escalation_trigger',
      resourceId: triggerId
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting escalation trigger:', error);
    res.status(500).json({ error: 'Failed to delete escalation trigger' });
  }
});

export default router;