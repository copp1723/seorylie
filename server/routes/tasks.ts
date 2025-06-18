// File: /server/routes/tasks.ts
// Purpose: Provides API endpoints for creating, retrieving, and updating tasks in the RylieSEO platform.
// Uses Drizzle ORM for PostgreSQL operations and Redis for queuing tasks.
// Deployment Note for Render: Ensure 'drizzle-orm', 'pg', and 'redis' are in package.json. Add this route to your main app file (e.g., server/index.js) with `app.use('/api/tasks', require('./routes/tasks'));`.
// DATABASE_URL and REDIS_URL must be set in Render environment variables. Render will deploy this as part of the Node.js service.

import express from 'express';
import { db, redisClient } from '../config/db';
import { tasks, taskQueue } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
const router = express.Router();

// Redis queue key for SEOWerks task processing
const TASK_QUEUE_KEY = 'seowerks:task:queue';

// GET /api/tasks - Retrieve all tasks (for admin dashboard or filtered views)
// Query parameters can be added later for filtering by agency_id, status, etc.
router.get('/', async (req, res) => {
  try {
    const allTasks = await db.select().from(tasks).orderBy(desc(tasks.created_at));
    return res.json(allTasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// GET /api/tasks/:id - Retrieve a specific task by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const taskResult = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json(taskResult[0]);
  } catch (err) {
    console.error('Error fetching task:', err);
    return res.status(500).json({ error: 'Failed to retrieve task' });
  }
});

// POST /api/tasks/create - Create a new task (called from chat or manual forms)
router.post('/create', async (req, res) => {
  const { type, parameters, agency_id, dealership_id, priority, due_date } = req.body;
  
  // Basic validation
  if (!type || !agency_id || !dealership_id) {
    return res.status(400).json({ error: 'Missing required fields: type, agency_id, and dealership_id are required' });
  }

  const newTask = {
    type,
    status: 'draft',
    parameters: parameters || {},
    agency_id,
    dealership_id,
    priority: priority || 'medium',
    due_date: due_date ? new Date(due_date) : null,
    created_at: new Date(),
  };

  try {
    // Insert task into tasks table
    const taskResult = await db.insert(tasks).values(newTask).returning({ id: tasks.id });
    const taskId = taskResult[0].id;

    // Insert into task_queue table
    await db.insert(taskQueue).values({
      task_id: taskId,
      status: 'pending',
      created_at: new Date(),
    });

    // Add task ID to Redis queue for SEOWerks processing (as a secondary queuing mechanism)
    await redisClient.rPush(TASK_QUEUE_KEY, taskId.toString());
    console.log(`Task ${taskId} added to Redis queue for SEOWerks processing`);

    return res.status(201).json({ taskId, message: 'Task created successfully' });
  } catch (err) {
    console.error('Error creating task:', err);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id/update - Update task details or status (e.g., from draft to submitted)
router.put('/:id/update', async (req, res) => {
  const { id } = req.params;
  const { status, parameters, priority, due_date } = req.body;

  try {
    // Build update object dynamically based on provided fields
    const updateData: Partial<typeof tasks.$inferInsert> = {
      updated_at: new Date(),
    };
    if (status) updateData.status = status;
    if (parameters) updateData.parameters = parameters;
    if (priority) updateData.priority = priority;
    if (due_date) updateData.due_date = new Date(due_date);

    if (Object.keys(updateData).length === 1) { // Only updated_at, no other changes
      return res.status(400).json({ error: 'No updates provided' });
    }

    const updateResult = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning({ id: tasks.id, status: tasks.status });

    if (updateResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // If status is updated to 'submitted', ensure it's in the queue
    if (status === 'submitted') {
      const queueCheck = await db.select().from(taskQueue).where(eq(taskQueue.task_id, id)).limit(1);
      if (queueCheck.length === 0) {
        await db.insert(taskQueue).values({
          task_id: id,
          status: 'pending',
          created_at: new Date(),
        });
        await redisClient.rPush(TASK_QUEUE_KEY, id.toString());
        console.log(`Task ${id} re-added to Redis queue for SEOWerks processing`);
      } else if (queueCheck[0].status !== 'pending' && queueCheck[0].status !== 'claimed') {
        await db.update(taskQueue)
          .set({ status: 'pending' })
          .where(eq(taskQueue.task_id, id));
        await redisClient.rPush(TASK_QUEUE_KEY, id.toString());
        console.log(`Task ${id} status updated to pending in Redis queue`);
      }
    }

    return res.json({ 
      taskId: updateResult[0].id, 
      message: 'Task updated successfully', 
      status: updateResult[0].status 
    });
  } catch (err) {
    console.error('Error updating task:', err);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

export default router;