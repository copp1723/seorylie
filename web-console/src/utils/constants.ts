// API endpoints and configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  WEBSOCKET_URL: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8000/ws',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
} as const;

// Request types
export const REQUEST_TYPES = {
  PAGE: 'page',
  BLOG: 'blog',
  GBP: 'gbp',
  MAINTENANCE: 'maintenance',
} as const;

export const REQUEST_TYPE_LABELS = {
  [REQUEST_TYPES.PAGE]: 'New Page',
  [REQUEST_TYPES.BLOG]: 'Blog Post',
  [REQUEST_TYPES.GBP]: 'Google Business',
  [REQUEST_TYPES.MAINTENANCE]: 'Technical SEO',
} as const;

// Status types
export const REQUEST_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
} as const;

export const REQUEST_STATUS_LABELS = {
  [REQUEST_STATUSES.PENDING]: 'Pending',
  [REQUEST_STATUSES.IN_PROGRESS]: 'In Progress',
  [REQUEST_STATUSES.COMPLETED]: 'Completed',
  [REQUEST_STATUSES.ON_HOLD]: 'On Hold',
} as const;

// Priority levels
export const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export const PRIORITY_LABELS = {
  [PRIORITIES.LOW]: 'Low',
  [PRIORITIES.MEDIUM]: 'Medium',
  [PRIORITIES.HIGH]: 'High',
} as const;

// User roles
export const USER_ROLES = {
  CLIENT: 'client',
  AGENCY: 'agency',
  ADMIN: 'admin',
} as const;

// Order statuses
export const ORDER_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Payment statuses
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
} as const;

// File types
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  SPREADSHEETS: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ARCHIVES: ['application/zip', 'application/x-rar-compressed'],
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// SEO constants
export const SEO_GOALS = [
  'Increase organic traffic',
  'Improve keyword rankings',
  'Generate more leads',
  'Boost online sales',
  'Enhance local visibility',
  'Build brand awareness',
  'Improve user experience',
  'Outrank competitors',
] as const;

export const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Real Estate',
  'Retail/E-commerce',
  'Professional Services',
  'Manufacturing',
  'Education',
  'Non-profit',
  'Other',
] as const;

export const BUSINESS_TYPES = [
  'B2B (Business to Business)',
  'B2C (Business to Consumer)',
  'B2B2C (Business to Business to Consumer)',
  'Marketplace',
  'SaaS (Software as a Service)',
  'E-commerce',
  'Service Provider',
  'Other',
] as const;

// Date ranges
export const DATE_RANGES = {
  LAST_7_DAYS: '7d',
  LAST_30_DAYS: '30d',
  LAST_90_DAYS: '90d',
  LAST_YEAR: '1y',
} as const;

export const DATE_RANGE_LABELS = {
  [DATE_RANGES.LAST_7_DAYS]: 'Last 7 days',
  [DATE_RANGES.LAST_30_DAYS]: 'Last 30 days',
  [DATE_RANGES.LAST_90_DAYS]: 'Last 90 days',
  [DATE_RANGES.LAST_YEAR]: 'Last year',
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Theme colors
export const THEME_COLORS = {
  PRIMARY: '#2563eb',
  SECONDARY: '#1e40af',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  EMAIL_REPORTS: 'emailReports',
  EMAIL_UPDATES: 'emailUpdates',
  SMS_ALERTS: 'smsAlerts',
  WEEKLY_DIGEST: 'weeklyDigest',
  PROJECT_UPDATES: 'projectUpdates',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_PREFERENCES: 'userPreferences',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
  THEME: 'theme',
} as const;

// Query stale times (in milliseconds)
export const STALE_TIMES = {
  VERY_SHORT: 1 * 60 * 1000, // 1 minute
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Feature flags
export const FEATURES = {
  CHAT_WEBSOCKET: 'chatWebsocket',
  ADVANCED_ANALYTICS: 'advancedAnalytics',
  REAL_TIME_NOTIFICATIONS: 'realTimeNotifications',
  AI_SUGGESTIONS: 'aiSuggestions',
} as const;

// External service URLs
export const EXTERNAL_URLS = {
  GOOGLE_ANALYTICS: 'https://analytics.google.com',
  GOOGLE_SEARCH_CONSOLE: 'https://search.google.com/search-console',
  GOOGLE_BUSINESS: 'https://business.google.com',
  DOCUMENTATION: 'https://docs.seorylie.com',
  SUPPORT: 'https://support.seorylie.com',
} as const;

// Regular expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  PHONE: /^[\+]?[1-9][\d]{0,15}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  HEX_COLOR: /^#[0-9A-Fa-f]{6}$/,
} as const;