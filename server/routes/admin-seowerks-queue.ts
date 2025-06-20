import { Router, Request, Response } from 'express';
// import { supabase } from '../supabase'; // TODO: Replace with proper database
import { z } from 'zod';

const router = Router();

// Middleware to check if user is SEOWerks team member or admin
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

    // Attach user to request
    (req as any).user = { ...user, role: userData.role };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/admin/seowerks-queue - Fetch queue tasks
router.get('/seowerks-queue', requireSEOWerksRole, async (req: Request, res: Response) => {
  try {
    const { status, type } = req.query;

    // Build query using the view
    let query = supabase
      .from('seowerks_queue_view')
      .select('*');

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (type && type !== 'all') {
      query = query.eq('task_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching queue:', error);
      return res.status(500).json({ error: 'Failed to fetch queue' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Queue fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/seowerks-queue/:id/claim - Claim a task
const claimSchema = z.object({
  id: z.string().uuid(),
});

router.post('/seowerks-queue/:id/claim', requireSEOWerksRole, async (req: Request, res: Response) => {
  try {
    const { id } = claimSchema.parse(req.params);
    const userId = (req as any).user.id;

    // Start a transaction to claim the task
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if task is already claimed
    if (task.claimed_by) {
      return res.status(400).json({ error: 'Task already claimed' });
    }

    // Check if task is in submitted status
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: 'Task cannot be claimed in current status' });
    }

    // Claim the task
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error claiming task:', updateError);
      return res.status(500).json({ error: 'Failed to claim task' });
    }

    // Log the action
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action: 'task_claimed',
        entity_type: 'task',
        entity_id: id,
        metadata: {
          task_type: task.type,
          dealership_id: task.dealership_id,
        },
      });

    res.json({ 
      success: true, 
      message: 'Task claimed successfully',
      task: updatedTask 
    });
  } catch (error) {
    console.error('Task claim error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/seowerks-queue/:id/complete - Mark task complete
const completeSchema = z.object({
  id: z.string().uuid(),
});

router.post('/seowerks-queue/:id/complete', requireSEOWerksRole, async (req: Request, res: Response) => {
  try {
    const { id } = completeSchema.parse(req.params);
    const userId = (req as any).user.id;

    // Fetch the task
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user claimed this task
    if (task.claimed_by !== userId) {
      return res.status(403).json({ error: 'You can only complete tasks you have claimed' });
    }

    // Check if task is in progress
    if (task.status !== 'in_progress') {
      return res.status(400).json({ error: 'Task must be in progress to complete' });
    }

    // Mark task as complete
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        status: 'review',
        completed_by: userId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error completing task:', updateError);
      return res.status(500).json({ error: 'Failed to complete task' });
    }

    // Log the action
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action: 'task_completed',
        entity_type: 'task',
        entity_id: id,
        metadata: {
          task_type: task.type,
          dealership_id: task.dealership_id,
          time_to_complete: task.claimed_at 
            ? Math.round((Date.now() - new Date(task.claimed_at).getTime()) / 1000 / 60) // minutes
            : null,
        },
      });

    res.json({ 
      success: true, 
      message: 'Task marked as complete',
      task: updatedTask 
    });
  } catch (error) {
    console.error('Task complete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/seowerks-queue/:id/unclaim - Release a claimed task
router.post('/seowerks-queue/:id/unclaim', requireSEOWerksRole, async (req: Request, res: Response) => {
  try {
    const { id } = claimSchema.parse(req.params);
    const userId = (req as any).user.id;

    // Fetch the task
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user claimed this task
    if (task.claimed_by !== userId) {
      return res.status(403).json({ error: 'You can only unclaim tasks you have claimed' });
    }

    // Unclaim the task
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        claimed_by: null,
        claimed_at: null,
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error unclaiming task:', updateError);
      return res.status(500).json({ error: 'Failed to unclaim task' });
    }

    res.json({ 
      success: true, 
      message: 'Task released successfully',
      task: updatedTask 
    });
  } catch (error) {
    console.error('Task unclaim error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/seowerks-queue/stats - Get queue statistics
router.get('/seowerks-queue/stats', requireSEOWerksRole, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('tasks')
      .select('status', { count: 'exact' })
      .in('status', ['submitted', 'in_progress', 'review']);

    if (statusError) {
      throw statusError;
    }

    // Get user's active tasks count
    const { data: userTasks, error: userError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact' })
      .eq('claimed_by', userId)
      .in('status', ['in_progress', 'review']);

    if (userError) {
      throw userError;
    }

    // Get package distribution
    const { data: packageCounts, error: packageError } = await supabase
      .from('seowerks_queue_view')
      .select('dealership_package', { count: 'exact' });

    if (packageError) {
      throw packageError;
    }

    res.json({
      byStatus: statusCounts || [],
      userActiveTasks: userTasks?.length || 0,
      byPackage: packageCounts || [],
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;