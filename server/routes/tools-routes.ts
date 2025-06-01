import express from 'express';
import { db } from '../db';
import { tools, agentTools } from '../../shared/index';
import { z } from 'zod';
import { auth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';

// Validation schemas
const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  service: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  endpoint: z.string().max(500).optional(),
  input_schema: z.record(z.any()).optional(),
  output_schema: z.record(z.any()).optional(),
  is_active: z.boolean().default(true)
});

const updateToolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  service: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  endpoint: z.string().max(500).optional(),
  input_schema: z.record(z.any()).optional(),
  output_schema: z.record(z.any()).optional(),
  is_active: z.boolean().optional()
});

const enableToolsSchema = z.object({
  toolIds: z.array(z.number().int().positive())
});

// Helper function to check if user is admin
const isAdmin = (user: any) => {
  return user?.role === 'admin';
};

// Initialize router
const router = express.Router();

/**
 * @route   GET /api/tools
 * @desc    Get all available tools
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    // Get all tools
    const allTools = await db.select({
      id: tools.id,
      name: tools.name,
      service: tools.service,
      description: tools.description,
      category: tools.category,
      endpoint: tools.endpoint,
      input_schema: tools.inputSchema,
      output_schema: tools.outputSchema,
      is_active: tools.isActive,
      created_at: tools.createdAt,
      updated_at: tools.updatedAt
    })
    .from(tools)
    .orderBy(tools.category, tools.name);
    
    return res.status(200).json({
      success: true,
      tools: allTools
    });
  } catch (error) {
    logger.error('Error fetching tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tools'
    });
  }
});

/**
 * @route   GET /api/tools/:id
 * @desc    Get tool details
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const toolId = parseInt(req.params.id);
    
    if (isNaN(toolId)) {
      return res.status(400).json({ success: false, error: 'Invalid tool ID' });
    }
    
    // Get tool details
    const [tool] = await db.select({
      id: tools.id,
      name: tools.name,
      service: tools.service,
      description: tools.description,
      category: tools.category,
      endpoint: tools.endpoint,
      input_schema: tools.inputSchema,
      output_schema: tools.outputSchema,
      is_active: tools.isActive,
      created_at: tools.createdAt,
      updated_at: tools.updatedAt
    })
    .from(tools)
    .where(eq(tools.id, toolId));
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      tool
    });
  } catch (error) {
    logger.error(`Error fetching tool ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tool details'
    });
  }
});

/**
 * @route   POST /api/tools
 * @desc    Create a custom tool (admin only)
 * @access  Private (Admin)
 */
router.post('/', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user is admin
    if (!isAdmin(user)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    // Validate request body
    const validationResult = createToolSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    const {
      name,
      service,
      description,
      category,
      endpoint,
      input_schema,
      output_schema,
      is_active
    } = validationResult.data;
    
    // Create new tool
    const [newTool] = await db.insert(tools)
      .values({
        name,
        service,
        description: description || '',
        category: category || 'Other',
        endpoint: endpoint || '',
        inputSchema: input_schema || {},
        outputSchema: output_schema || {},
        isActive: is_active,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({
        id: tools.id,
        name: tools.name,
        service: tools.service,
        description: tools.description,
        category: tools.category,
        endpoint: tools.endpoint,
        input_schema: tools.inputSchema,
        output_schema: tools.outputSchema,
        is_active: tools.isActive,
        created_at: tools.createdAt,
        updated_at: tools.updatedAt
      });
    
    return res.status(201).json({
      success: true,
      tool: newTool
    });
  } catch (error) {
    logger.error('Error creating tool:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create tool'
    });
  }
});

/**
 * @route   PUT /api/tools/:id
 * @desc    Update tool (admin only)
 * @access  Private (Admin)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const user = req.user;
    const toolId = parseInt(req.params.id);
    
    // Check if user is admin
    if (!isAdmin(user)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    if (isNaN(toolId)) {
      return res.status(400).json({ success: false, error: 'Invalid tool ID' });
    }
    
    // Validate request body
    const validationResult = updateToolSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    // Check if tool exists
    const [existingTool] = await db.select({ id: tools.id })
      .from(tools)
      .where(eq(tools.id, toolId));
    
    if (!existingTool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }
    
    // Update tool
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (validationResult.data.name !== undefined) {
      updateData.name = validationResult.data.name;
    }
    
    if (validationResult.data.service !== undefined) {
      updateData.service = validationResult.data.service;
    }
    
    if (validationResult.data.description !== undefined) {
      updateData.description = validationResult.data.description;
    }
    
    if (validationResult.data.category !== undefined) {
      updateData.category = validationResult.data.category;
    }
    
    if (validationResult.data.endpoint !== undefined) {
      updateData.endpoint = validationResult.data.endpoint;
    }
    
    if (validationResult.data.input_schema !== undefined) {
      updateData.inputSchema = validationResult.data.input_schema;
    }
    
    if (validationResult.data.output_schema !== undefined) {
      updateData.outputSchema = validationResult.data.output_schema;
    }
    
    if (validationResult.data.is_active !== undefined) {
      updateData.isActive = validationResult.data.is_active;
    }
    
    const [updatedTool] = await db.update(tools)
      .set(updateData)
      .where(eq(tools.id, toolId))
      .returning({
        id: tools.id,
        name: tools.name,
        service: tools.service,
        description: tools.description,
        category: tools.category,
        endpoint: tools.endpoint,
        input_schema: tools.inputSchema,
        output_schema: tools.outputSchema,
        is_active: tools.isActive,
        updated_at: tools.updatedAt
      });
    
    return res.status(200).json({
      success: true,
      tool: updatedTool
    });
  } catch (error) {
    logger.error(`Error updating tool ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update tool'
    });
  }
});

/**
 * @route   GET /api/agents/:agentId/tools
 * @desc    Get agent-specific tools
 * @access  Private
 */
router.get('/agents/:agentId/tools', auth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(agentId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID' });
    }
    
    // Get agent tools
    const agentToolsResult = await db.select({
      id: agentTools.id,
      agentId: agentTools.agentId,
      toolId: agentTools.toolId,
      createdAt: agentTools.createdAt
    })
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId));
    
    // Get tool details for each tool
    const toolIds = agentToolsResult.map(at => at.toolId);
    
    const toolDetails = await db.select({
      id: tools.id,
      name: tools.name,
      service: tools.service,
      description: tools.description,
      category: tools.category,
      is_active: tools.isActive
    })
    .from(tools)
    .where(inArray(tools.id, toolIds));
    
    return res.status(200).json({
      success: true,
      agentTools: toolDetails
    });
  } catch (error) {
    logger.error(`Error fetching agent tools for agent ${req.params.agentId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch agent tools'
    });
  }
});

/**
 * @route   POST /api/agents/:agentId/tools
 * @desc    Enable tools for an agent
 * @access  Private
 */
router.post('/agents/:agentId/tools', auth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(agentId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID' });
    }
    
    // Validate request body
    const validationResult = enableToolsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    const { toolIds } = validationResult.data;
    
    // Verify all tools exist
    const existingTools = await db.select({ id: tools.id })
      .from(tools)
      .where(inArray(tools.id, toolIds));
    
    if (existingTools.length !== toolIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more tools do not exist'
      });
    }
    
    // First, remove all existing tools for this agent
    await db.delete(agentTools)
      .where(eq(agentTools.agentId, agentId));
    
    // Then add the new tools
    const toolsToAdd = toolIds.map(toolId => ({
      agentId,
      toolId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(agentTools)
      .values(toolsToAdd);
    
    return res.status(200).json({
      success: true,
      message: 'Agent tools updated successfully',
      toolCount: toolIds.length
    });
  } catch (error) {
    logger.error(`Error enabling tools for agent ${req.params.agentId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to enable tools for agent'
    });
  }
});

/**
 * @route   DELETE /api/agents/:agentId/tools/:toolId
 * @desc    Disable tool for an agent
 * @access  Private
 */
router.delete('/agents/:agentId/tools/:toolId', auth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const toolId = parseInt(req.params.toolId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(agentId) || isNaN(toolId)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID or tool ID' });
    }
    
    // Delete the agent-tool association
    const result = await db.delete(agentTools)
      .where(
        and(
          eq(agentTools.agentId, agentId),
          eq(agentTools.toolId, toolId)
        )
      );
    
    return res.status(200).json({
      success: true,
      message: 'Tool disabled for agent successfully'
    });
  } catch (error) {
    logger.error(`Error disabling tool ${req.params.toolId} for agent ${req.params.agentId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to disable tool for agent'
    });
  }
});

export default router;
