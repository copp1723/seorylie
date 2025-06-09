/**
 * @file Common Types
 * @description Shared TypeScript interfaces to eliminate duplication
 */

import { Request } from 'express';

export interface User {
  id: string;
  role: 'client' | 'agency' | 'admin';
  tenantId?: string;
  agencyId?: string;
  email?: string;
}

export interface TenantBranding {
  companyName: string;
  logo?: string;
  primaryColor?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenantBranding?: TenantBranding;
  processedByAI?: boolean;
  isAnonymized?: boolean;
  originalData?: any;
}

export interface Task {
  taskId: string;
  type: string;
  status: string;
  priority?: string;
  deadline?: string;
  estimatedHours?: number;
  anonymizedClient?: string;
  tenantType?: string;
  requirements: Record<string, any>;
  assignedAt: string;
  context?: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderRole: string;
  requestId?: string;
  threadId: string;
  timestamp: string;
  status: string;
}

export interface RequestObject {
  id: string;
  type: string;
  clientId: string;
  tenantId: string;
  status: string;
  data: any;
  createdAt: string;
  updatedAt: string;
  assignedAgency?: string;
}

export interface MockData {
  requests: any[];
  tasks: Task[];
  messages: Message[];
  users: any[];
  auditLogs: any[];
  reports: any[];
}