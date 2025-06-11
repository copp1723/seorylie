import api, { handleApiResponse } from '../lib/api';
import { ApiResponse } from '../types/api';
import { OnboardingInput } from '../schemas/validation';

export const onboardingAPI = {
  // Submit onboarding data
  submit: async (data: OnboardingInput): Promise<{
    success: boolean;
    nextSteps: Array<{
      title: string;
      description: string;
      eta: string;
      status: 'pending' | 'in_progress' | 'completed';
    }>;
  }> => {
    const response = await api.post<ApiResponse<any>>('/onboarding/submit', data);
    return handleApiResponse(response);
  },

  // Get onboarding status
  getStatus: async (): Promise<{
    completed: boolean;
    currentStep: number;
    totalSteps: number;
    data?: Partial<OnboardingInput>;
  }> => {
    const response = await api.get<ApiResponse<any>>('/onboarding/status');
    return handleApiResponse(response);
  },

  // Save partial onboarding data (draft)
  saveDraft: async (step: number, data: Partial<OnboardingInput>): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/onboarding/draft', {
      step,
      data,
    });
    return handleApiResponse(response);
  },

  // Get industry suggestions
  getIndustries: async (): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/onboarding/industries');
    return handleApiResponse(response);
  },

  // Get business type suggestions
  getBusinessTypes: async (): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/onboarding/business-types');
    return handleApiResponse(response);
  },

  // Validate website URL
  validateWebsite: async (url: string): Promise<{
    valid: boolean;
    accessible: boolean;
    hasAnalytics: boolean;
    seoScore?: number;
    issues?: string[];
  }> => {
    const response = await api.post<ApiResponse<any>>('/onboarding/validate-website', {
      url,
    });
    return handleApiResponse(response);
  },

  // Analyze competitors
  analyzeCompetitors: async (urls: string[]): Promise<Array<{
    url: string;
    domain: string;
    title?: string;
    description?: string;
    estimatedTraffic?: number;
    keywordCount?: number;
    backlinks?: number;
  }>> => {
    const response = await api.post<ApiResponse<any>>('/onboarding/analyze-competitors', {
      urls: urls.filter(url => url.trim()),
    });
    return handleApiResponse(response);
  },

  // Get keyword suggestions based on business info
  getKeywordSuggestions: async (businessType: string, industry: string): Promise<Array<{
    keyword: string;
    searchVolume: number;
    difficulty: 'low' | 'medium' | 'high';
    relevance: number;
  }>> => {
    const response = await api.post<ApiResponse<any>>('/onboarding/keyword-suggestions', {
      businessType,
      industry,
    });
    return handleApiResponse(response);
  },
};

export default onboardingAPI;