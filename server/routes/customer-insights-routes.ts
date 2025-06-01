/**
 * Routes for customer insights and journey tracking
 */
import express from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { customerProfiles } from '../../shared/index';
import { 
  getOrCreateCustomerProfile, 
  recordCustomerInteraction, 
  getCustomerJourney, 
  analyzeCustomerPreferences,
  predictBuyingWindow
} from '../services/customer-insights';

const router = express.Router();

// Get or create a customer profile
router.post('/dealerships/:dealershipId/customer-profiles', async (req, res) => {
  try {
    const dealershipId = parseInt(req.params.dealershipId);
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== dealershipId && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { customerId, name, email, phone } = req.body;
    
    const profile = await getOrCreateCustomerProfile(
      dealershipId,
      customerId,
      { name, email, phone }
    );
    
    res.status(201).json({ profile });
  } catch (error) {
    console.error('Error creating customer profile:', error);
    res.status(500).json({ error: 'Failed to create customer profile' });
  }
});

// Record a customer interaction
router.post('/customer-profiles/:profileId/interactions', async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    
    // Get profile to check permissions
    const [profile] = await db.select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, profileId));
    
    if (!profile) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== profile.dealership_id && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { conversationId, interactionType, details } = req.body;
    
    if (!conversationId || !interactionType) {
      return res.status(400).json({ error: 'Conversation ID and interaction type are required' });
    }
    
    const interaction = await recordCustomerInteraction(
      profileId,
      conversationId,
      interactionType,
      details
    );
    
    res.status(201).json({ interaction });
  } catch (error) {
    console.error('Error recording customer interaction:', error);
    res.status(500).json({ error: 'Failed to record customer interaction' });
  }
});

// Get customer journey
router.get('/customer-profiles/:profileId/journey', async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    
    // Get profile to check permissions
    const [profile] = await db.select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, profileId));
    
    if (!profile) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== profile.dealership_id && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const journey = await getCustomerJourney(profileId);
    
    res.json({ journey });
  } catch (error) {
    console.error('Error getting customer journey:', error);
    res.status(500).json({ error: 'Failed to get customer journey' });
  }
});

// Analyze customer preferences
router.get('/customer-profiles/:profileId/preferences', async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    
    // Get profile to check permissions
    const [profile] = await db.select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, profileId));
    
    if (!profile) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== profile.dealership_id && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Optional conversation ID to analyze
    const conversationId = req.query.conversationId 
      ? parseInt(req.query.conversationId as string) 
      : undefined;
    
    const preferences = await analyzeCustomerPreferences(profileId, conversationId);
    
    res.json({ preferences });
  } catch (error) {
    console.error('Error analyzing customer preferences:', error);
    res.status(500).json({ error: 'Failed to analyze customer preferences' });
  }
});

// Predict buying window
router.get('/customer-profiles/:profileId/buying-window', async (req, res) => {
  try {
    const profileId = parseInt(req.params.profileId);
    
    // Get profile to check permissions
    const [profile] = await db.select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, profileId));
    
    if (!profile) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }
    
    // Check permissions
    if (!req.user || (req.user.dealership_id !== profile.dealership_id && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const prediction = await predictBuyingWindow(profileId);
    
    res.json({ prediction });
  } catch (error) {
    console.error('Error predicting buying window:', error);
    res.status(500).json({ error: 'Failed to predict buying window' });
  }
});

export default router;