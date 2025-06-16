import { QueryClient } from '@tanstack/react-query';
// import { handleApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        // const apiError = handleApiError(error);
        console.error('Mutation error:', error);
        // You can add global error handling here (e.g., toast notifications)
      },
    },
  },
});

// Query keys factory for consistent cache management
export const queryKeys = {
  // Auth
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  
  // Requests
  requests: {
    all: ['requests'] as const,
    list: (filters?: any) => ['requests', 'list', filters] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
  },
  
  // Dashboard
  dashboard: {
    metrics: (dateRange?: string) => ['dashboard', 'metrics', dateRange] as const,
    recentActivity: ['dashboard', 'recent-activity'] as const,
  },
  
  // Reports
  reports: {
    metrics: (dateRange: string) => ['reports', 'metrics', dateRange] as const,
    keywords: (filters?: any) => ['reports', 'keywords', filters] as const,
    traffic: (dateRange: string) => ['reports', 'traffic', dateRange] as const,
    topPages: (dateRange: string) => ['reports', 'top-pages', dateRange] as const,
  },
  
  // Orders
  orders: {
    all: ['orders'] as const,
    list: (filters?: any) => ['orders', 'list', filters] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  
  // Chat
  chat: {
    messages: (threadId?: string) => ['chat', 'messages', threadId] as const,
    suggestions: ['chat', 'suggestions'] as const,
  },
  
  // Settings
  settings: {
    profile: ['settings', 'profile'] as const,
    notifications: ['settings', 'notifications'] as const,
    branding: ['settings', 'branding'] as const,
  },
  
  // Admin
  admin: {
    clients: (filters?: any) => ['admin', 'clients', filters] as const,
    systemHealth: ['admin', 'system-health'] as const,
    metrics: ['admin', 'metrics'] as const,
    analytics: (dateRange: string) => ['admin', 'analytics', dateRange] as const,
  },
} as const;