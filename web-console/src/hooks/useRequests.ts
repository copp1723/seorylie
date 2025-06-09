import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestsAPI } from '../services/requests';
import { queryKeys } from '../lib/queryClient';
import { CreateRequestInput, UpdateRequestInput, SearchInput } from '../schemas/validation';

export const useRequests = (filters?: Partial<SearchInput>) => {
  return useQuery({
    queryKey: queryKeys.requests.list(filters),
    queryFn: () => requestsAPI.getRequests(filters),
    keepPreviousData: true,
  });
};

export const useRequest = (id: string) => {
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: () => requestsAPI.getRequest(id),
    enabled: !!id,
  });
};

export const useCreateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRequestInput) => requestsAPI.createRequest(data),
    onSuccess: () => {
      // Invalidate and refetch requests list
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
      // Also invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.metrics() });
    },
  });
};

export const useUpdateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRequestInput }) => 
      requestsAPI.updateRequest(id, data),
    onSuccess: (updatedRequest) => {
      // Update the specific request in cache
      queryClient.setQueryData(
        queryKeys.requests.detail(updatedRequest.id),
        updatedRequest
      );
      
      // Invalidate requests list to show updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
};

export const useDeleteRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => requestsAPI.deleteRequest(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.requests.detail(deletedId) });
      
      // Invalidate requests list
      queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    },
  });
};

export const useRequestStats = () => {
  return useQuery({
    queryKey: ['requests', 'stats'],
    queryFn: requestsAPI.getRequestStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUploadRequestFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) => 
      requestsAPI.uploadRequestFile(requestId, file),
    onSuccess: (_, { requestId }) => {
      // Invalidate request files
      queryClient.invalidateQueries({ 
        queryKey: ['requests', requestId, 'files']
      });
    },
  });
};

export const useRequestFiles = (requestId: string) => {
  return useQuery({
    queryKey: ['requests', requestId, 'files'],
    queryFn: () => requestsAPI.getRequestFiles(requestId),
    enabled: !!requestId,
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, comment }: { requestId: string; comment: string }) => 
      requestsAPI.addComment(requestId, comment),
    onSuccess: (_, { requestId }) => {
      // Invalidate comments for this request
      queryClient.invalidateQueries({ 
        queryKey: ['requests', requestId, 'comments']
      });
    },
  });
};

export const useRequestComments = (requestId: string) => {
  return useQuery({
    queryKey: ['requests', requestId, 'comments'],
    queryFn: () => requestsAPI.getComments(requestId),
    enabled: !!requestId,
  });
};