import { z } from 'zod';

// Authentication Schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  company: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Request Schemas
export const createRequestSchema = z.object({
  type: z.enum(['page', 'blog', 'gbp', 'maintenance'], {
    required_error: 'Please select a request type',
  }),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description is too long'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  targetKeywords: z.string().optional(),
  additionalNotes: z.string().max(1000, 'Additional notes are too long').optional(),
});

export const updateRequestSchema = createRequestSchema.partial().extend({
  status: z.enum(['pending', 'in_progress', 'completed', 'on_hold']).optional(),
});

// Profile Schemas
export const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  address: z.string().optional(),
  bio: z.string().max(500, 'Bio is too long').optional(),
});

// Password Change Schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Notification Settings Schema
export const notificationSettingsSchema = z.object({
  emailReports: z.boolean(),
  emailUpdates: z.boolean(),
  smsAlerts: z.boolean(),
  weeklyDigest: z.boolean(),
  projectUpdates: z.boolean(),
});

// Branding Settings Schema
export const brandingSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  theme: z.enum(['light', 'dark']),
});

// Onboarding Schema
export const onboardingSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  websiteUrl: z.string().url('Invalid website URL'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().min(1, 'Industry is required'),
  businessType: z.string().min(1, 'Business type is required'),
  targetAudience: z.string().min(1, 'Target audience description is required'),
  primaryGoals: z.array(z.string()).min(1, 'Please select at least one goal'),
  currentChallenges: z.string().optional(),
  competitorUrls: z.array(z.string().url().optional()),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  additionalInfo: z.string().optional(),
});

// Chat Message Schema
export const chatMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
  metadata: z.record(z.any()).optional(),
});

// File Upload Schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
  category: z.enum(['document', 'image', 'report']).optional(),
});

// Search and Filter Schemas
export const searchSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(10),
});

// Export inferred types
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type SearchInput = z.infer<typeof searchSchema>;