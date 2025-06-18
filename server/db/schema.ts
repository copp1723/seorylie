// File: /server/db/schema.ts
// Purpose: Defines the database schema for tasks and task queue using Drizzle ORM for PostgreSQL in the RylieSEO platform.
// This file is used by Drizzle ORM to interact with the database; it does not create tables automatically.
// Deployment Note for Render: Use this schema with Drizzle ORM for queries. To create tables, run the SQL migration script (below) manually via 'psql' or a Render one-off command.
// Ensure DATABASE_URL is set in Render environment variables for database connection.

import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

// Define the 'tasks' table schema
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(), // e.g., 'landing_page', 'blog_post', 'gbp_post', 'maintenance'
  status: varchar('status', { length: 20 }).notNull().default('draft'), // e.g., 'draft', 'submitted', 'in_progress', 'review', 'completed', 'published'
  parameters: jsonb('parameters').default({}), // Stores task-specific details, e.g., {"target": "F-150", "keywords": ["ford", "truck"]}
  agency_id: uuid('agency_id').notNull(), // Links to agency for multi-tenancy
  dealership_id: uuid('dealership_id').notNull(), // Links to dealership for tracking
  priority: varchar('priority', { length: 20 }).default('medium'), // e.g., 'high', 'medium', 'low'
  due_date: timestamp('due_date', { withTimezone: true }), // Optional deadline for task completion
  assigned_to: uuid('assigned_to'), // Optional reference to assigned user or SEOWerks handler
  deliverable_url: varchar('deliverable_url', { length: 255 }), // URL to completed deliverable after processing
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), // Timestamp of task creation
  updated_at: timestamp('updated_at', { withTimezone: true }) // Timestamp of last update
}, (table) => ({
  statusIdx: index('idx_tasks_status').on(table.status),
  agencyIdx: index('idx_tasks_agency_id').on(table.agency_id),
}));

// Define the 'task_queue' table schema for SEOWerks processing
export const taskQueue = pgTable('task_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }), // Links to task in tasks table
  status: varchar('status', { length: 50 }).notNull().default('pending'), // e.g., 'pending', 'claimed', 'completed'
  claimed_by: varchar('claimed_by', { length: 255 }), // Name or ID of SEOWerks team member who claimed the task
  claimed_at: timestamp('claimed_at', { withTimezone: true }), // Timestamp when task was claimed
  completed_at: timestamp('completed_at', { withTimezone: true }), // Timestamp when task was completed
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() // Timestamp of queue entry creation
}, (table) => ({
  statusIdx: index('idx_task_queue_status').on(table.status),
}));