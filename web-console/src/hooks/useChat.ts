import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../services/chat';
import { queryKeys } from '../lib/queryClient';
import { ChatMessageInput } from '../schemas/validation';
import { ChatMessage } from '../types/api';

export const useChat = (threadId?: string) => {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: queryKeys.chat.messages(threadId),
    queryFn: () => chatAPI.getMessages(threadId),
    enabled: !!threadId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: ChatMessageInput & { threadId?: string }) => 
      chatAPI.sendMessage(data),
    onSuccess: (response) => {
      // Add the new message to the cache
      queryClient.setQueryData(
        queryKeys.chat.messages(threadId),
        (old: any) => {
          if (!old) return { messages: [response.message], hasMore: false, threadId: response.message.threadId };
          return {
            ...old,
            messages: [...old.messages, response.message],
          };
        }
      );
    },
  });

  return {
    messages: messagesQuery.data?.messages || [],
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isLoading,
    hasMore: messagesQuery.data?.hasMore || false,
  };
};

export const useChatThreads = () => {
  return useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: chatAPI.getThreads,
  });
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => chatAPI.createThread(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });
};

export const useUpdateThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) => 
      chatAPI.updateThread(threadId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });
};

export const useDeleteThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => chatAPI.deleteThread(threadId),
    onSuccess: (_, deletedThreadId) => {
      // Remove thread from cache
      queryClient.removeQueries({ queryKey: queryKeys.chat.messages(deletedThreadId) });
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });
};

export const useChatSuggestions = (context?: string) => {
  return useQuery({
    queryKey: queryKeys.chat.suggestions,
    queryFn: () => chatAPI.getSuggestions(context),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useRateMessage = () => {
  return useMutation({
    mutationFn: ({ messageId, rating, feedback }: {
      messageId: string;
      rating: 'positive' | 'negative';
      feedback?: string;
    }) => chatAPI.rateMessage(messageId, rating, feedback),
  });
};

export const useChatAnalytics = (dateRange: string = '30d') => {
  return useQuery({
    queryKey: ['chat', 'analytics', dateRange],
    queryFn: () => chatAPI.getChatAnalytics(dateRange),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// WebSocket hook for real-time chat
export const useWebSocketChat = (threadId?: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!threadId) return;

    const wsUrl = `${import.meta.env.VITE_WEBSOCKET_URL}/chat/${threadId}`;
    const token = localStorage.getItem('authToken');
    
    if (!token) return;

    const connectWebSocket = () => {
      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      
      ws.onopen = () => {
        setIsConnected(true);
        setSocket(ws);
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ChatMessage;
          setMessages(prev => [...prev, message]);
          
          // Also update React Query cache
          queryClient.setQueryData(
            queryKeys.chat.messages(threadId),
            (old: any) => {
              if (!old) return { messages: [message], hasMore: false, threadId };
              return {
                ...old,
                messages: [...old.messages, message],
              };
            }
          );
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setSocket(null);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [threadId, queryClient]);

  const sendMessage = (content: string, metadata?: any) => {
    if (socket && isConnected) {
      const message = {
        content,
        metadata,
        timestamp: new Date().toISOString(),
      };
      socket.send(JSON.stringify(message));
    }
  };

  return {
    isConnected,
    messages,
    sendMessage,
  };
};