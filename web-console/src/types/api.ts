// API Response Types
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// User Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'client' | 'agency' | 'admin';
  tenantId?: string;
  agencyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Request Types
export interface SeoRequest {
  id: string;
  type: 'page' | 'blog' | 'gbp' | 'maintenance';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high';
  targetKeywords?: string[];
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  assignedTo?: string;
}

export interface CreateRequestInput {
  type: 'page' | 'blog' | 'gbp' | 'maintenance';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  targetKeywords?: string;
  additionalNotes?: string;
}

// Analytics Types
export interface DashboardMetrics {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  averageCompletion: string;
  organicTraffic: number;
  keywordRankings: number;
  pageViews: number;
  clickThroughRate: number;
  averagePosition: number;
  indexedPages: number;
}

export interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number;
  searchVolume: number;
  url: string;
  change: number;
}

export interface TrafficData {
  date: string;
  sessions: number;
  pageviews: number;
  users: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  userId?: string;
  metadata?: any;
}

export interface ChatResponse {
  message: ChatMessage;
  suggestions?: string[];
}

// Order Types
export interface Order {
  id: string;
  service: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  orderDate: string;
  completedDate?: string;
  deliverables: Deliverable[];
  paymentStatus: 'pending' | 'paid' | 'refunded';
  userId: string;
}

export interface Deliverable {
  id: string;
  name: string;
  type: 'document' | 'report' | 'analysis';
  url?: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

// Client Management Types (Admin)
export interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'trial';
  plan: 'basic' | 'pro' | 'enterprise';
  joinDate: string;
  lastActive: string;
  requestsCount: number;
  monthlySpend: number;
  website?: string;
  industry?: string;
}

// System Types (Admin)
export interface SystemMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  change: number;
  timestamp: string;
}

export interface SystemHealth {
  webServer: 'operational' | 'degraded' | 'down';
  database: 'operational' | 'degraded' | 'down';
  aiService: 'operational' | 'degraded' | 'down';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

// Settings Types
export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  address?: string;
  bio?: string;
}

export interface NotificationSettings {
  emailReports: boolean;
  emailUpdates: boolean;
  smsAlerts: boolean;
  weeklyDigest: boolean;
  projectUpdates: boolean;
}

export interface BrandingSettings {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  theme: 'light' | 'dark';
  logo?: string;
}

// File Upload Types
export interface FileUploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Settings Request Types
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  website?: string;
  address?: string;
  bio?: string;
}

export interface UpdateBrandingRequest {
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  theme?: 'light' | 'dark';
  logo?: string;
}

export interface UpdateNotificationRequest {
  emailReports?: boolean;
  emailUpdates?: boolean;
  smsAlerts?: boolean;
  weeklyDigest?: boolean;
  projectUpdates?: boolean;
}

// Order Types
export interface OrderStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface CreateOrderRequest {
  service: string;
  description: string;
  price: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'paypal';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  revenue: number;
  averageOrderValue: number;
  completionRate: number;
}

// Admin Types
export interface AdminClient extends Client {
  apiKey?: string;
  permissions: string[];
}

export interface AdminStats {
  totalClients: number;
  activeClients: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalRequests: number;
  completedRequests: number;
}

export interface ImpersonationResponse {
  token: string;
  user: User;
}

export interface SystemHealthResponse {
  health: SystemHealth;
  metrics: SystemMetric[];
  uptime: number;
  version: string;
}

export interface SystemMetrics {
  metrics: SystemMetric[];
  timestamp: string;
}

export interface SystemLogs {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  metadata?: any;
}

export interface AdminAnalyticsOverview {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  userGrowth: number;
  requestGrowth: number;
  revenueGrowth: number;
}

export interface UserMetrics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  churnRate: number;
  retentionRate: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  churnRevenue: number;
}

export interface UsageMetrics {
  apiCalls: number;
  storageUsed: number;
  bandwidthUsed: number;
  aiCreditsUsed: number;
}

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetedUsers?: string[];
}

export interface BillingOverview {
  currentPlan: string;
  billingCycle: 'monthly' | 'annual';
  nextBillingDate: string;
  amount: number;
  paymentMethod?: PaymentMethod;
}

export interface Subscription {
  id: string;
  clientId: string;
  plan: string;
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  endDate?: string;
  amount: number;
}

export interface SubscriptionQuery {
  status?: 'active' | 'cancelled' | 'expired';
  plan?: string;
  startDate?: string;
  endDate?: string;
}

// Settings Input Types
export interface BrandingSettingsInput extends BrandingSettings {}
export interface NotificationSettingsInput extends NotificationSettings {}
export interface ProfileSettingsInput extends UserProfile {}