import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import logger from '../utils/logger';
import { dealerships, users } from '../../shared/enhanced-schema';
import { eq } from 'drizzle-orm';
import { enforceRoleAccess } from '../middleware/tenant-context';
import { z } from 'zod';

const router = Router();

// Schema for validating dealership requests
const dealershipSchema = z.object({
  name: z.string().min(2, { message: "Dealership name must be at least 2 characters." }),
  subdomain: z.string().min(2, { message: "Subdomain must be at least 2 characters." })
    .regex(/^[a-z0-9-]+$/, { message: "Subdomain can only contain lowercase letters, numbers, and hyphens." }),
  contact_email: z.string().email({ message: "Please enter a valid email address." }),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  website: z.string().url({ message: "Please enter a valid website URL." }).optional().or(z.literal("")),
  description: z.string().optional(),
  logo_url: z.string().url({ message: "Please enter a valid logo URL." }).optional().or(z.literal("")),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: "Please enter a valid hex color code (e.g., #000000)." }).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: "Please enter a valid hex color code (e.g., #FFFFFF)." }).optional(),
});

// Schema for validating dealership status updates
const dealershipStatusSchema = z.object({
  active: z.boolean()
});

/**
 * Middleware to ensure only super admins can access admin routes
 */
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.user || req.session.user.role !== 'super_admin') {
    logger.warn('Unauthorized access attempt to admin routes', {
      userId: req.session?.user?.id,
      userRole: req.session?.user?.role,
      path: req.path,
    });
    
    return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
  }
  
  next();
};

// Apply admin-only middleware to all routes in this router
router.use(adminOnly);

// Middleware to check if user has access to the dealership
const checkDealershipAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Check if dealership exists
    const dealershipResult = await db.select().from(dealerships).where(eq(dealerships.id, dealershipId));
    
    if (dealershipResult.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    // Super admins can access any dealership
    if (req.session?.user?.role === 'super_admin') {
      return next();
    }
    
    // Regular users can only access their own dealership
    if (req.session?.user?.dealership_id !== dealershipId) {
      logger.warn('Unauthorized access attempt to dealership', {
        userId: req.session?.user?.id,
        userDealershipId: req.session?.user?.dealership_id,
        requestedDealershipId: dealershipId,
      });
      
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking dealership access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/dealerships
 * Retrieves all dealerships in the system
 * @returns {Object} Object containing array of dealership objects
 * @throws {500} Internal Server Error - If database query fails
 */
router.get('/dealerships', async (req: Request, res: Response) => {
  try {
    const allDealerships = await db.select().from(dealerships).orderBy(dealerships.name);
    
    res.json({ dealerships: allDealerships });
  } catch (error) {
    logger.error('Error fetching dealerships:', error);
    res.status(500).json({ error: 'Failed to fetch dealerships' });
  }
});

/**
 * GET /api/admin/dealerships/:id
 * Retrieves a specific dealership by ID
 * @param {string} id - Dealership ID
 * @returns {Object} Object containing dealership data
 * @throws {400} Bad Request - If dealership ID is invalid
 * @throws {404} Not Found - If dealership doesn't exist
 * @throws {500} Internal Server Error - If database query fails
 */
router.get('/dealerships/:id', async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    const dealershipResult = await db.select().from(dealerships).where(eq(dealerships.id, dealershipId));
    
    if (dealershipResult.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    res.json({ dealership: dealershipResult[0] });
  } catch (error) {
    logger.error('Error fetching dealership:', error);
    res.status(500).json({ error: 'Failed to fetch dealership' });
  }
});

/**
 * POST /api/admin/dealerships
 * Creates a new dealership
 * @returns {Object} Object containing created dealership data
 * @throws {400} Bad Request - If request body validation fails or subdomain is taken
 * @throws {500} Internal Server Error - If database operation fails
 */
router.post('/dealerships', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = dealershipSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid dealership data', 
        details: validationResult.error.format() 
      });
    }
    
    const dealershipData = validationResult.data;
    
    // Check if subdomain is already taken
    const existingSubdomain = await db.select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.subdomain, dealershipData.subdomain));
    
    if (existingSubdomain.length > 0) {
      return res.status(400).json({ error: 'Subdomain is already taken' });
    }
    
    // Create new dealership
    const newDealership = await db.insert(dealerships).values({
      ...dealershipData,
      active: true,
    }).returning();
    
    logger.info('New dealership created', { 
      dealershipId: newDealership[0].id,
      name: newDealership[0].name,
      createdBy: req.session.user.id
    });
    
    res.status(201).json({ 
      message: 'Dealership created successfully', 
      dealership: newDealership[0] 
    });
  } catch (error) {
    logger.error('Error creating dealership:', error);
    res.status(500).json({ error: 'Failed to create dealership' });
  }
});

/**
 * Update a dealership
 * PUT /api/admin/dealerships/:id
 */
router.put('/dealerships/:id', async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Validate request body
    const validationResult = dealershipSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid dealership data', 
        details: validationResult.error.format() 
      });
    }
    
    const dealershipData = validationResult.data;
    
    // Check if dealership exists
    const existingDealership = await db.select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId));
    
    if (existingDealership.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    // Check if subdomain is already taken by another dealership
    const existingSubdomain = await db.select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.subdomain, dealershipData.subdomain));
    
    if (existingSubdomain.length > 0 && existingSubdomain[0].id !== dealershipId) {
      return res.status(400).json({ error: 'Subdomain is already taken by another dealership' });
    }
    
    // Update dealership
    const updatedDealership = await db.update(dealerships)
      .set({
        ...dealershipData,
        updated_at: new Date(),
      })
      .where(eq(dealerships.id, dealershipId))
      .returning();
    
    logger.info('Dealership updated', { 
      dealershipId,
      name: updatedDealership[0].name,
      updatedBy: req.session.user.id
    });
    
    res.json({ 
      message: 'Dealership updated successfully', 
      dealership: updatedDealership[0] 
    });
  } catch (error) {
    logger.error('Error updating dealership:', error);
    res.status(500).json({ error: 'Failed to update dealership' });
  }
});

/**
 * Update dealership status (active/inactive)
 * PATCH /api/admin/dealerships/:id/status
 */
router.patch('/dealerships/:id/status', async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Validate request body
    const validationResult = dealershipStatusSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid status data', 
        details: validationResult.error.format() 
      });
    }
    
    const { active } = validationResult.data;
    
    // Check if dealership exists
    const existingDealership = await db.select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId));
    
    if (existingDealership.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    // Update dealership status
    const updatedDealership = await db.update(dealerships)
      .set({
        active,
        updated_at: new Date(),
      })
      .where(eq(dealerships.id, dealershipId))
      .returning();
    
    logger.info('Dealership status updated', { 
      dealershipId,
      active,
      updatedBy: req.session.user.id
    });
    
    res.json({ 
      message: 'Dealership status updated successfully', 
      dealership: updatedDealership[0] 
    });
  } catch (error) {
    logger.error('Error updating dealership status:', error);
    res.status(500).json({ error: 'Failed to update dealership status' });
  }
});

/**
 * Update dealership branding
 * PUT /api/admin/dealerships/:id/branding
 */
router.put('/dealerships/:id/branding', checkDealershipAccess, async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Validate request body
    const brandingSchema = z.object({
      logo_url: z.string().url().optional().or(z.literal("")),
      primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      font_family: z.string(),
      persona_name: z.string().min(1),
      persona_tone: z.enum(["friendly", "professional", "casual", "formal"]),
      persona_template: z.string().optional(),
      welcome_message: z.string().optional(),
    });
    
    const validationResult = brandingSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid branding data', 
        details: validationResult.error.format() 
      });
    }
    
    const brandingData = validationResult.data;
    
    // Update dealership branding
    const updatedDealership = await db.update(dealerships)
      .set({
        logo_url: brandingData.logo_url || null,
        primary_color: brandingData.primary_color,
        secondary_color: brandingData.secondary_color,
        accent_color: brandingData.accent_color,
        font_family: brandingData.font_family,
        persona_name: brandingData.persona_name,
        persona_tone: brandingData.persona_tone,
        persona_template: brandingData.persona_template || null,
        welcome_message: brandingData.welcome_message || null,
        updated_at: new Date(),
      })
      .where(eq(dealerships.id, dealershipId))
      .returning();
    
    logger.info('Dealership branding updated', { 
      dealershipId,
      updatedBy: req.session?.user?.id
    });
    
    res.json({ 
      message: 'Dealership branding updated successfully', 
      dealership: updatedDealership[0] 
    });
  } catch (error) {
    logger.error('Error updating dealership branding:', error);
    res.status(500).json({ error: 'Failed to update dealership branding' });
  }
});

/**
 * Test chat with dealership's AI persona
 * POST /api/admin/dealerships/:id/test-chat
 */
router.post('/dealerships/:id/test-chat', checkDealershipAccess, async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Validate request body
    const chatSchema = z.object({
      message: z.string().min(1, { message: "Message is required" }),
    });
    
    const validationResult = chatSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid chat data', 
        details: validationResult.error.format() 
      });
    }
    
    const { message } = validationResult.data;
    
    // Get dealership data to create the persona
    const dealershipResult = await db.select().from(dealerships).where(eq(dealerships.id, dealershipId));
    
    if (dealershipResult.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    const dealership = dealershipResult[0];
    
    // Create a prompt with the dealership's persona
    const personaPrefix = dealership.persona_template || 
      `You are ${dealership.persona_name}, a ${dealership.persona_tone} automotive sales assistant at ${dealership.name}. 
      Your job is to help customers find the right vehicle and answer their questions in a helpful, conversational way.`;
    
    // For simplicity, we're directly using OpenAI here
    // In production, you would use your structured AI service with proper error handling
    try {
      // Check if OpenAI API key is configured
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'sk-actualOpenAIKeyHere') {
        return res.status(503).json({ 
          error: 'OpenAI API key not configured - test chat is disabled' 
        });
      }
      
      // Import OpenAI
      const { OpenAI } = await import("openai");
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey
      });
      
      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          // System message provides the persona
          {
            role: "system",
            content: personaPrefix
          },
          // User message contains the actual message
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 500
      });
      
      // Extract the response text
      const responseText = completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
      
      // Log test chat for analytics
      logger.info('Test chat completed', { 
        dealershipId,
        userId: req.session?.user?.id,
        messageLength: message.length,
        responseLength: responseText.length
      });
      
      // Return the AI response
      res.json({ response: responseText });
      
    } catch (error) {
      logger.error('OpenAI error during test chat:', error);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  } catch (error) {
    logger.error('Error processing test chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

/**
 * Delete a dealership
 * DELETE /api/admin/dealerships/:id
 */
router.delete('/dealerships/:id', async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Check if dealership exists
    const existingDealership = await db.select({ id: dealerships.id, name: dealerships.name })
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId));
    
    if (existingDealership.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    // Get dealership name for logging
    const dealershipName = existingDealership[0].name;
    
    // First, update any users associated with this dealership to have null dealership_id
    await db.update(users)
      .set({ dealership_id: null })
      .where(eq(users.dealership_id, dealershipId));
    
    // Delete the dealership
    // Note: Due to cascading deletes set up in the schema, this will also delete
    // all related data like prompts, variables, vehicles, customers, etc.
    await db.delete(dealerships).where(eq(dealerships.id, dealershipId));
    
    logger.info('Dealership deleted', { 
      dealershipId,
      name: dealershipName,
      deletedBy: req.session.user.id
    });
    
    res.json({ message: 'Dealership and all associated data deleted successfully' });
  } catch (error) {
    logger.error('Error deleting dealership:', error);
    res.status(500).json({ error: 'Failed to delete dealership' });
  }
});

/**
 * Get users for a specific dealership
 * GET /api/admin/dealerships/:id/users
 */
router.get('/dealerships/:id/users', async (req: Request, res: Response) => {
  try {
    const dealershipId = parseInt(req.params.id);
    
    if (isNaN(dealershipId)) {
      return res.status(400).json({ error: 'Invalid dealership ID' });
    }
    
    // Check if dealership exists
    const existingDealership = await db.select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId));
    
    if (existingDealership.length === 0) {
      return res.status(404).json({ error: 'Dealership not found' });
    }
    
    // Get all users for this dealership
    const dealershipUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      name: users.name,
      role: users.role,
      is_verified: users.is_verified,
      created_at: users.created_at,
      last_login: users.last_login
    })
    .from(users)
    .where(eq(users.dealership_id, dealershipId))
    .orderBy(users.username);
    
    res.json({ users: dealershipUsers });
  } catch (error) {
    logger.error('Error fetching dealership users:', error);
    res.status(500).json({ error: 'Failed to fetch dealership users' });
  }
});

export default router;