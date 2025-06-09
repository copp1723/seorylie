import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '../services/reports';
import { queryKeys } from '../lib/queryClient';

export const useDashboardMetrics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: queryKeys.dashboard.metrics(dateRange),
    queryFn: () => reportsAPI.getDashboardMetrics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useKeywordRankings = (params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'keyword' | 'position' | 'change';
  sortOrder?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: queryKeys.reports.keywords(params),
    queryFn: () => reportsAPI.getKeywordRankings(params),
    keepPreviousData: true,
  });
};

export const useTrafficData = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: queryKeys.reports.traffic(dateRange),
    queryFn: () => reportsAPI.getTrafficData(dateRange),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useTopPages = (dateRange: string = '30d', limit: number = 10) => {
  return useQuery({
    queryKey: queryKeys.reports.topPages(dateRange),
    queryFn: () => reportsAPI.getTopPages(dateRange, limit),
    staleTime: 10 * 60 * 1000,
  });
};

export const useConversions = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: ['reports', 'conversions', dateRange],
    queryFn: () => reportsAPI.getConversions(dateRange),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useCompetitorAnalysis = () => {
  return useQuery({
    queryKey: ['reports', 'competitors'],
    queryFn: reportsAPI.getCompetitorAnalysis,
    staleTime: 60 * 60 * 1000, // 1 hour - this data changes slowly
  });
};

export const useTechnicalIssues = () => {
  return useQuery({
    queryKey: ['reports', 'technical-issues'],
    queryFn: reportsAPI.getTechnicalIssues,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useGenerateReport = () => {
  return useMutation({
    mutationFn: (config: {
      type: 'monthly' | 'quarterly' | 'custom';
      dateRange: string;
      sections: string[];
      format: 'pdf' | 'html' | 'csv';
    }) => reportsAPI.generateReport(config),
  });
};

export const useReportStatus = (reportId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['reports', 'status', reportId],
    queryFn: () => reportsAPI.getReportStatus(reportId),
    enabled: enabled && !!reportId,
    refetchInterval: (data) => {
      // Stop polling when report is completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 5000; // Poll every 5 seconds
    },
  });
};