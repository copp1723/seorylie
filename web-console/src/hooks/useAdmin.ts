import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../services/admin';
import { queryKeys } from '../lib/queryClient';

// Client management hooks
export const useAdminClients = (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  plan?: string;
}) => {
  return useQuery({
    queryKey: queryKeys.admin.clients(params),
    queryFn: () => adminAPI.clients.list(params),
    keepPreviousData: true,
  });
};

export const useAdminClient = (clientId: string) => {
  return useQuery({
    queryKey: ['admin', 'clients', clientId],
    queryFn: () => adminAPI.clients.get(clientId),
    enabled: !!clientId,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      plan: 'basic' | 'pro' | 'enterprise';
      website?: string;
      industry?: string;
    }) => adminAPI.clients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: any }) => 
      adminAPI.clients.update(clientId, data),
    onSuccess: (updatedClient) => {
      queryClient.setQueryData(['admin', 'clients', updatedClient.id], updatedClient);
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });
};

export const useSuspendClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason: string }) => 
      adminAPI.clients.suspend(clientId, reason),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });
};

export const useUnsuspendClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => adminAPI.clients.unsuspend(clientId),
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => adminAPI.clients.delete(clientId),
    onSuccess: (_, clientId) => {
      queryClient.removeQueries({ queryKey: ['admin', 'clients', clientId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
  });
};

export const useImpersonateClient = () => {
  return useMutation({
    mutationFn: (clientId: string) => adminAPI.clients.impersonate(clientId),
    onSuccess: (data) => {
      // Store impersonation token and redirect
      localStorage.setItem('impersonationToken', data.impersonationToken);
      // Reload the page to apply impersonation
      window.location.reload();
    },
  });
};

// System monitoring hooks
export const useSystemHealth = () => {
  return useQuery({
    queryKey: queryKeys.admin.systemHealth,
    queryFn: adminAPI.system.getHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useSystemMetrics = (timeRange: string = '1h') => {
  return useQuery({
    queryKey: ['admin', 'system', 'metrics', timeRange],
    queryFn: () => adminAPI.system.getMetrics(timeRange),
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useSystemLogs = (params?: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  service?: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: ['admin', 'system', 'logs', params],
    queryFn: () => adminAPI.system.getLogs(params),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useRestartService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceName: string) => adminAPI.system.restartService(serviceName),
    onSuccess: () => {
      // Invalidate system health and metrics
      queryClient.invalidateQueries({ queryKey: ['admin', 'system'] });
    },
  });
};

export const useUpdateConfiguration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Record<string, any>) => adminAPI.system.updateConfiguration(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system'] });
    },
  });
};

// Analytics hooks
export const useAdminAnalytics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: queryKeys.admin.analytics(dateRange),
    queryFn: () => adminAPI.analytics.getOverview(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUserMetrics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: ['admin', 'analytics', 'users', dateRange],
    queryFn: () => adminAPI.analytics.getUserMetrics(dateRange),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useRevenueMetrics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', dateRange],
    queryFn: () => adminAPI.analytics.getRevenueMetrics(dateRange),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useUsageMetrics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: ['admin', 'analytics', 'usage', dateRange],
    queryFn: () => adminAPI.analytics.getUsageMetrics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Feature flags hooks
export const useFeatureFlags = () => {
  return useQuery({
    queryKey: ['admin', 'features'],
    queryFn: adminAPI.features.list,
  });
};

export const useToggleFeature = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureId, enabled }: { featureId: string; enabled: boolean }) => 
      adminAPI.features.toggle(featureId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'features'] });
    },
  });
};

export const useUpdateFeatureRollout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureId, percentage }: { featureId: string; percentage: number }) => 
      adminAPI.features.updateRollout(featureId, percentage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'features'] });
    },
  });
};

// Billing hooks
export const useBillingOverview = () => {
  return useQuery({
    queryKey: ['admin', 'billing', 'overview'],
    queryFn: adminAPI.billing.getOverview,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useSubscriptions = (params?: {
  status?: string;
  plan?: string;
  page?: number;
  pageSize?: number;
}) => {
  return useQuery({
    queryKey: ['admin', 'billing', 'subscriptions', params],
    queryFn: () => adminAPI.billing.getSubscriptions(params),
    keepPreviousData: true,
  });
};

export const useProcessRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subscriptionId, amount, reason }: {
      subscriptionId: string;
      amount: number;
      reason: string;
    }) => adminAPI.billing.processRefund(subscriptionId, amount, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'billing'] });
    },
  });
};