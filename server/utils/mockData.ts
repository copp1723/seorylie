/**
 * @file Mock Data Store
 * @description Centralized mock data to eliminate duplication across routes
 */

import { MockData, Task, Message } from './types';

export const mockData: MockData = {
  requests: [
    {
      id: 'req_1',
      type: 'blog',
      status: 'in_progress',
      title: 'SEO Blog Post Request',
      submittedAt: '2025-06-08T10:00:00Z',
      updatedAt: '2025-06-08T12:00:00Z',
      estimatedCompletion: '2025-06-10T17:00:00Z'
    },
    {
      id: 'req_2',
      type: 'page',
      status: 'completed',
      title: 'New Service Page',
      submittedAt: '2025-06-07T14:30:00Z',
      updatedAt: '2025-06-08T09:15:00Z',
      completedAt: '2025-06-08T09:15:00Z'
    }
  ],

  tasks: [
    {
      taskId: 'task_abc123def',
      type: 'blog',
      status: 'assigned',
      priority: 'high',
      deadline: '2025-06-10T17:00:00Z',
      estimatedHours: 4,
      anonymizedClient: 'client_xyz789',
      tenantType: 'automotive_dealership',
      requirements: {
        topic: 'Automotive SEO best practices',
        wordCount: 1500,
        targetKeywords: ['automotive SEO', 'car dealership marketing', 'local SEO'],
        contentType: 'howToGuide'
      },
      assignedAt: '2025-06-08T09:00:00Z',
      context: 'Client needs educational content for their automotive service pages'
    },
    {
      taskId: 'task_def456ghi',
      type: 'page',
      status: 'in_progress',
      priority: 'medium',
      deadline: '2025-06-12T15:00:00Z',
      estimatedHours: 6,
      anonymizedClient: 'client_abc456',
      tenantType: 'service_business',
      requirements: {
        title: 'Advanced Vehicle Diagnostics Services',
        purpose: 'Service page for diagnostic services',
        targetKeywords: ['vehicle diagnostics', 'car troubleshooting', 'automotive repair'],
        callToAction: 'Schedule Diagnostic Appointment'
      },
      assignedAt: '2025-06-07T14:00:00Z',
      context: 'Expansion of service offerings - new diagnostic equipment'
    }
  ],

  messages: [
    {
      id: 'msg_1',
      content: 'Hi! I need help with creating a new blog post about automotive SEO.',
      senderId: 'mock-user-id',
      senderRole: 'client',
      threadId: 'thread_1',
      timestamp: '2025-06-08T10:00:00Z',
      status: 'delivered'
    },
    {
      id: 'msg_2',
      content: 'Thanks for your request! We\'ll help you create an engaging blog post about automotive SEO. What specific topics would you like to cover?',
      senderId: 'rylie_system',
      senderRole: 'system',
      threadId: 'thread_1', 
      timestamp: '2025-06-08T10:05:00Z',
      status: 'delivered'
    }
  ],

  users: [
    {
      id: 'user_1',
      email: 'client1@dealership.com',
      role: 'client',
      status: 'active',
      tenantId: 'tenant_auto_1',
      tenantName: 'Metro Auto Dealership',
      lastLogin: '2025-06-08T14:30:00Z',
      createdAt: '2025-05-15T10:00:00Z',
      requestsCount: 23,
      completedTasks: 19
    },
    {
      id: 'user_2',
      email: 'agency1@seopartner.com',
      role: 'agency',
      status: 'active',
      agencyId: 'agency_1',
      agencyName: 'SEO Pro Agency',
      lastLogin: '2025-06-08T15:45:00Z',
      createdAt: '2025-04-20T09:30:00Z',
      tasksAssigned: 45,
      tasksCompleted: 42,
      avgCompletionTime: '2.1 days'
    }
  ],

  auditLogs: [
    {
      id: 'audit_1',
      timestamp: '2025-06-08T15:30:00Z',
      action: 'client_request_submitted',
      userId: 'user_1',
      userRole: 'client',
      details: {
        requestType: 'blog',
        requestId: 'req_123'
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0...'
    },
    {
      id: 'audit_2',
      timestamp: '2025-06-08T15:25:00Z',
      action: 'agency_task_completed',
      userId: 'user_2',
      userRole: 'agency',
      details: {
        taskId: 'task_456',
        deliverable: 'blog_post.pdf'
      },
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0...'
    }
  ],

  reports: [
    {
      id: 'report_1',
      type: 'seo_overview',
      title: 'Monthly SEO Performance Report',
      period: '30 days',
      generatedAt: '2025-06-08T15:00:00Z',
      data: {
        organicTraffic: {
          current: 12540,
          previous: 11230,
          change: '+11.7%',
          trend: 'up'
        },
        keywordRankings: {
          totalKeywords: 245,
          topTen: 23,
          topThree: 8,
          averagePosition: 12.3,
          improvement: '+2.1 positions'
        },
        conversions: {
          total: 89,
          previous: 76,
          change: '+17.1%',
          conversionRate: '7.1%'
        },
        technicalHealth: {
          score: 94,
          issues: 3,
          improvements: 12,
          status: 'excellent'
        }
      },
      summary: 'Your SEO performance continues to improve with significant gains in organic traffic and keyword rankings.',
      recommendations: [
        'Continue optimizing for local search terms',
        'Expand content strategy for automotive services',
        'Improve page load speeds on mobile devices'
      ]
    }
  ]
};

export const getFilteredData = <T>(
  data: T[],
  filters: Record<string, any>
): T[] => {
  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      return (item as any)[key] === value;
    });
  });
};