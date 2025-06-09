import api, { handleApiResponse } from '../lib/api';
import { DashboardMetrics, KeywordData, TrafficData, ApiResponse } from '../types/api';

export const reportsAPI = {
  // Get dashboard metrics
  getDashboardMetrics: async (dateRange: string = '30d'): Promise<DashboardMetrics> => {
    const response = await api.get<ApiResponse<DashboardMetrics>>('/reports/metrics', {
      params: { range: dateRange },
    });
    return handleApiResponse(response);
  },

  // Get keyword rankings
  getKeywordRankings: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: 'keyword' | 'position' | 'change';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: KeywordData[];
    total: number;
    averagePosition: number;
    totalKeywords: number;
  }> => {
    const response = await api.get<ApiResponse<any>>('/reports/keywords', {
      params,
    });
    return handleApiResponse(response);
  },

  // Get traffic data
  getTrafficData: async (dateRange: string = '30d'): Promise<{
    data: TrafficData[];
    summary: {
      totalSessions: number;
      totalPageviews: number;
      totalUsers: number;
      averageSessionDuration: number;
      bounceRate: number;
    };
  }> => {
    const response = await api.get<ApiResponse<any>>('/reports/traffic', {
      params: { range: dateRange },
    });
    return handleApiResponse(response);
  },

  // Get top performing pages
  getTopPages: async (dateRange: string = '30d', limit: number = 10): Promise<Array<{
    url: string;
    pageViews: number;
    sessions: number;
    bounceRate: number;
    averagePosition: number;
    clicks: number;
    impressions: number;
    ctr: number;
  }>> => {
    const response = await api.get<ApiResponse<any>>('/reports/top-pages', {
      params: { range: dateRange, limit },
    });
    return handleApiResponse(response);
  },

  // Get conversion data
  getConversions: async (dateRange: string = '30d'): Promise<{
    goals: Array<{
      name: string;
      completions: number;
      conversionRate: number;
      value: number;
    }>;
    ecommerce: {
      transactions: number;
      revenue: number;
      averageOrderValue: number;
    };
  }> => {
    const response = await api.get<ApiResponse<any>>('/reports/conversions', {
      params: { range: dateRange },
    });
    return handleApiResponse(response);
  },

  // Get competitor analysis
  getCompetitorAnalysis: async (): Promise<Array<{
    domain: string;
    organicKeywords: number;
    organicTraffic: number;
    paidKeywords: number;
    commonKeywords: number;
    keywordGaps: number;
  }>> => {
    const response = await api.get<ApiResponse<any>>('/reports/competitors');
    return handleApiResponse(response);
  },

  // Get technical SEO issues
  getTechnicalIssues: async (): Promise<{
    critical: Array<{
      type: string;
      description: string;
      affected_pages: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    warnings: Array<{
      type: string;
      description: string;
      affected_pages: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    notices: Array<{
      type: string;
      description: string;
      affected_pages: number;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> => {
    const response = await api.get<ApiResponse<any>>('/reports/technical-issues');
    return handleApiResponse(response);
  },

  // Generate custom report
  generateReport: async (config: {
    type: 'monthly' | 'quarterly' | 'custom';
    dateRange: string;
    sections: string[];
    format: 'pdf' | 'html' | 'csv';
  }): Promise<{ reportId: string; downloadUrl: string }> => {
    const response = await api.post<ApiResponse<any>>('/reports/generate', config);
    return handleApiResponse(response);
  },

  // Get report download status
  getReportStatus: async (reportId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    downloadUrl?: string;
    error?: string;
  }> => {
    const response = await api.get<ApiResponse<any>>(`/reports/status/${reportId}`);
    return handleApiResponse(response);
  },
};

export default reportsAPI;