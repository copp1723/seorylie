/**
 * Deliverables API Routes
 * Handles file uploads from SEOWerks and downloads for agencies
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { 
  processDeliverable, 
  getAgencyDeliverables, 
  getDeliverableDownloadUrl 
} from '../services/deliverableProcessor';
import { supabase } from '../supabase';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept common document types
    const allowedTypes = [
      'application/pdf',
      'text/html',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported types: PDF, HTML, DOCX, DOC, JPEG, PNG, GIF'));
    }
  }
});

// Middleware to verify SEOWerks team member
const requireSEOWerksRole = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return res.status(403).json({ error: 'User not found' });
    }

    if (!['seowerks_team', 'super_admin'].includes(userData.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    (req as any).user = { ...user, role: userData.role };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to verify agency access
const requireAgencyRole = async (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user's agency associations
    const { data: agencies, error: agencyError } = await supabase
      .from('user_agencies')
      .select('agency_id')
      .eq('user_id', user.id);

    if (agencyError || !agencies || agencies.length === 0) {
      return res.status(403).json({ error: 'No agency access' });
    }

    (req as any).user = user;
    (req as any).userAgencies = agencies.map(a => a.agency_id);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/deliverables/upload/:taskId - Upload deliverable for a task (SEOWerks only)
const uploadSchema = z.object({
  taskId: z.string().uuid(),
});

router.post('/upload/:taskId', requireSEOWerksRole, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { taskId } = uploadSchema.parse(req.params);
    const userId = (req as any).user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing deliverable upload for task ${taskId}`);

    const result = await processDeliverable(taskId, req.file, userId);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to process deliverable' });
    }

    res.json({
      success: true,
      message: 'Deliverable uploaded and processed successfully',
      deliverableId: result.deliverableId,
      publicUrl: result.publicUrl
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deliverables/agency/:agencyId - Get deliverables for an agency
const listSchema = z.object({
  agencyId: z.string().uuid(),
});

const querySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
});

router.get('/agency/:agencyId', requireAgencyRole, async (req: Request, res: Response) => {
  try {
    const { agencyId } = listSchema.parse(req.params);
    const { limit, offset } = querySchema.parse(req.query);
    const userAgencies = (req as any).userAgencies;

    // Verify user has access to this agency
    if (!userAgencies.includes(agencyId)) {
      return res.status(403).json({ error: 'Access denied to this agency' });
    }

    const result = await getAgencyDeliverables(agencyId, limit, offset);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to fetch deliverables' });
    }

    res.json({
      success: true,
      deliverables: result.data,
      pagination: {
        limit,
        offset,
        total: result.data?.length || 0
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    console.error('List error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deliverables/:deliverableId/download - Get download URL for a deliverable
const downloadSchema = z.object({
  deliverableId: z.string().uuid(),
});

router.get('/:deliverableId/download', requireAgencyRole, async (req: Request, res: Response) => {
  try {
    const { deliverableId } = downloadSchema.parse(req.params);
    const userAgencies = (req as any).userAgencies;

    // Get download URL (will verify agency access internally)
    // For now, use the first agency (in production, might need to specify)
    const agencyId = userAgencies[0];

    const result = await getDeliverableDownloadUrl(deliverableId, agencyId);

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Deliverable not found' });
    }

    res.json({
      success: true,
      downloadUrl: result.url,
      expiresIn: 3600 // 1 hour
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deliverables/task/:taskId - Get deliverables for a specific task
router.get('/task/:taskId', requireSEOWerksRole, async (req: Request, res: Response) => {
  try {
    const { taskId } = z.object({ taskId: z.string().uuid() }).parse(req.params);

    const { data, error } = await supabase
      .from('deliverables')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching task deliverables:', error);
      return res.status(500).json({ error: 'Failed to fetch deliverables' });
    }

    res.json({
      success: true,
      deliverables: data
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    console.error('Task deliverables error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;