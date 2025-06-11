import api from '../lib/api';
import type {
  AdminClient,
  AdminStats,
  ImpersonationResponse,
  SystemHealthResponse,
  SystemMetrics,
  SystemLogs,
  AdminAnalyticsOverview,
  UserMetrics,
  RevenueMetrics,
  UsageMetrics,
  FeatureFlag,
  BillingOverview,
  Subscription,
  SubscriptionQuery
} from '../types/api';

export const adminAPI = {
  // Get admin statistics
  getStats: async (): Promise<AdminStats> => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // Client management
  clients: {
    list: async (params?: any): Promise<AdminClient[]> => {
      const response = await api.get('/admin/clients', { params });
      return response.data;
    },
    get: async (clientId: string): Promise<AdminClient> => {
      const response = await api.get(`/admin/clients/${clientId}`);
      return response.data;
    },
    create: async (data: any): Promise<AdminClient> => {
      const response = await api.post('/admin/clients', data);
      return response.data;
    },
    update: async (clientId: string, data: any): Promise<AdminClient> => {
      const response = await api.patch(`/admin/clients/${clientId}`, data);
      return response.data;
    },
    delete: async (clientId: string): Promise<void> => {
      await api.delete(`/admin/clients/${clientId}`);
    },
    suspend: async (clientId: string, reason: string): Promise<void> => {
      await api.post(`/admin/clients/${clientId}/suspend`, { reason });
    },
    unsuspend: async (clientId: string): Promise<void> => {
      await api.post(`/admin/clients/${clientId}/unsuspend`);
    },
    impersonate: async (clientId: string): Promise<ImpersonationResponse> => {
      const response = await api.post(`/admin/clients/${clientId}/impersonate`);
      return response.data;
    }
  },

  // System management
  system: {
    getHealth: async (): Promise<SystemHealthResponse> => {
      const response = await api.get('/admin/system/health');
      return response.data;
    },
    getMetrics: async (timeRange: string): Promise<SystemMetrics> => {
      const response = await api.get('/admin/system/metrics', { params: { timeRange } });
      return response.data;
    },
    getLogs: async (params: {
      level?: 'error' | 'warn' | 'info' | 'debug';
      service?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    }): Promise<SystemLogs> => {
      const response = await api.get('/admin/system/logs', { params });
      return response.data;
    },
    restartService: async (serviceName: string): Promise<void> => {
      await api.post(`/admin/system/restart/${serviceName}`);
    },
    updateConfiguration: async (config: Record<string, any>): Promise<void> => {
      await api.patch('/admin/system/config', config);
    }
  },

  // Analytics
  analytics: {
    getOverview: async (dateRange: string): Promise<AdminAnalyticsOverview> => {
      const response = await api.get('/admin/analytics/overview', { params: { dateRange } });
      return response.data;
    },
    getUserMetrics: async (dateRange: string): Promise<UserMetrics> => {
      const response = await api.get('/admin/analytics/users', { params: { dateRange } });
      return response.data;
    },
    getRevenueMetrics: async (dateRange: string): Promise<RevenueMetrics> => {
      const response = await api.get('/admin/analytics/revenue', { params: { dateRange } });
      return response.data;
    },
    getUsageMetrics: async (dateRange: string): Promise<UsageMetrics> => {
      const response = await api.get('/admin/analytics/usage', { params: { dateRange } });
      return response.data;
    }
  },

  // Feature flags
  features: {
    list: async (): Promise<FeatureFlag[]> => {
      const response = await api.get('/admin/features');
      return response.data;
    },
    toggle: async (featureId: string, enabled: boolean): Promise<void> => {
      await api.patch(`/admin/features/${featureId}`, { enabled });
    },
    updateRollout: async (featureId: string, percentage: number): Promise<void> => {
      await api.patch(`/admin/features/${featureId}/rollout`, { percentage });
    }
  },

  // Billing
  billing: {
    getOverview: async (): Promise<BillingOverview> => {
      const response = await api.get('/admin/billing/overview');
      return response.data;
    },
    getSubscriptions: async (params: SubscriptionQuery): Promise<{
      subscriptions: Subscription[];
      total: number;
      page: number;
      pageSize: number;
    }> => {
      const response = await api.get('/admin/billing/subscriptions', { params });
      return response.data;
    },
    processRefund: async (subscriptionId: string, amount: number, reason: string): Promise<void> => {
      await api.post(`/admin/billing/refund`, { subscriptionId, amount, reason });
    }
  }
};
