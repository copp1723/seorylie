import api, { handleApiResponse } from '../lib/api';
import { ChatMessage, ChatResponse, ApiResponse } from '../types/api';
import { ChatMessageInput } from '../schemas/validation';

export const chatAPI = {
  // Send message to AI assistant
  sendMessage: async (data: ChatMessageInput & { threadId?: string }): Promise<ChatResponse> => {
    const response = await api.post<ApiResponse<ChatResponse>>('/chat/messages', data);
    return handleApiResponse(response);
  },

  // Get chat history
  getMessages: async (threadId?: string, limit: number = 50): Promise<{
    messages: ChatMessage[];
    hasMore: boolean;
    threadId: string;
  }> => {
    const response = await api.get<ApiResponse<any>>('/chat/messages', {
      params: { threadId, limit },
    });
    return handleApiResponse(response);
  },

  // Get chat threads
  getThreads: async (): Promise<Array<{
    id: string;
    title: string;
    lastMessage: string;
    lastMessageAt: string;
    messageCount: number;
  }>> => {
    const response = await api.get<ApiResponse<any>>('/chat/threads');
    return handleApiResponse(response);
  },

  // Create new chat thread
  createThread: async (title?: string): Promise<{ id: string; title: string }> => {
    const response = await api.post<ApiResponse<any>>('/chat/threads', { title });
    return handleApiResponse(response);
  },

  // Update thread title
  updateThread: async (threadId: string, title: string): Promise<void> => {
    const response = await api.put<ApiResponse<void>>(`/chat/threads/${threadId}`, { title });
    return handleApiResponse(response);
  },

  // Delete chat thread
  deleteThread: async (threadId: string): Promise<void> => {
    const response = await api.delete<ApiResponse<void>>(`/chat/threads/${threadId}`);
    return handleApiResponse(response);
  },

  // Get suggested questions
  getSuggestions: async (context?: string): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/chat/suggestions', {
      params: { context },
    });
    return handleApiResponse(response);
  },

  // Rate message (thumbs up/down)
  rateMessage: async (messageId: string, rating: 'positive' | 'negative', feedback?: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/chat/messages/${messageId}/rate`, {
      rating,
      feedback,
    });
    return handleApiResponse(response);
  },

  // Get chat analytics
  getChatAnalytics: async (dateRange: string = '30d'): Promise<{
    totalMessages: number;
    totalThreads: number;
    averageResponseTime: number;
    satisfactionRating: number;
    commonTopics: Array<{ topic: string; count: number }>;
    usageByDay: Array<{ date: string; messages: number }>;
  }> => {
    const response = await api.get<ApiResponse<any>>('/chat/analytics', {
      params: { range: dateRange },
    });
    return handleApiResponse(response);
  },
};

export default chatAPI;