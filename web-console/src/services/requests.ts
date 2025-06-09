import api, { handleApiResponse } from '../lib/api';
import { SeoRequest, ApiResponse, PaginatedResponse } from '../types/api';
import { CreateRequestInput, UpdateRequestInput, SearchInput } from '../schemas/validation';

export const requestsAPI = {
  // Get all requests with optional filters
  getRequests: async (params?: Partial<SearchInput>): Promise<PaginatedResponse<SeoRequest>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<SeoRequest>>>('/requests', {
      params,
    });
    return handleApiResponse(response);
  },

  // Get single request by ID
  getRequest: async (id: string): Promise<SeoRequest> => {
    const response = await api.get<ApiResponse<SeoRequest>>(`/requests/${id}`);
    return handleApiResponse(response);
  },

  // Create new request
  createRequest: async (data: CreateRequestInput): Promise<SeoRequest> => {
    const response = await api.post<ApiResponse<SeoRequest>>('/requests', data);
    return handleApiResponse(response);
  },

  // Update existing request
  updateRequest: async (id: string, data: UpdateRequestInput): Promise<SeoRequest> => {
    const response = await api.put<ApiResponse<SeoRequest>>(`/requests/${id}`, data);
    return handleApiResponse(response);
  },

  // Delete request
  deleteRequest: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<void>>(`/requests/${id}`);
    return handleApiResponse(response);
  },

  // Get request statistics
  getRequestStats: async (): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    onHold: number;
  }> => {
    const response = await api.get<ApiResponse<any>>('/requests/stats');
    return handleApiResponse(response);
  },

  // Upload file for request
  uploadRequestFile: async (requestId: string, file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<ApiResponse<any>>(`/requests/${requestId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return handleApiResponse(response);
  },

  // Get request files
  getRequestFiles: async (requestId: string): Promise<Array<{ id: string; filename: string; url: string; uploadedAt: string }>> => {
    const response = await api.get<ApiResponse<any>>(`/requests/${requestId}/files`);
    return handleApiResponse(response);
  },

  // Add comment to request
  addComment: async (requestId: string, comment: string): Promise<{
    id: string;
    comment: string;
    createdAt: string;
    user: { name: string; role: string };
  }> => {
    const response = await api.post<ApiResponse<any>>(`/requests/${requestId}/comments`, {
      comment,
    });
    return handleApiResponse(response);
  },

  // Get request comments
  getComments: async (requestId: string): Promise<Array<{
    id: string;
    comment: string;
    createdAt: string;
    user: { name: string; role: string };
  }>> => {
    const response = await api.get<ApiResponse<any>>(`/requests/${requestId}/comments`);
    return handleApiResponse(response);
  },
};

export default requestsAPI;