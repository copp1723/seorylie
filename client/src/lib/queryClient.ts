// API request interfaces and functions
export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
}

export const apiRequest = async <T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const { method = "GET", body, headers = {} } = options;

  // Ensure endpoint starts with /
  const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    credentials: "include", // Important for session cookies
  };

  // Only add body for methods that support it
  if (body && (method === "POST" || method === "PUT")) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("API Request failed:", { endpoint, options, error });
    throw error;
  }
};

// Specific API functions for prompt testing
export const promptLibraryApi = {
  testPrompt: async (data: {
    prompt: string;
    variables?: Record<string, string>;
  }) => {
    return apiRequest<{
      success: boolean;
      processedPrompt: string;
      aiResponse: string;
      timestamp: string;
    }>("/api/prompt-library/test", {
      method: "POST",
      body: data,
    });
  },

  getTestHistory: async () => {
    return apiRequest<{
      tests: Array<{
        id: number;
        original_prompt: string;
        processed_prompt: string;
        ai_response: string;
        variables: Record<string, any>;
        created_at: string;
      }>;
    }>("/api/prompt-library/history");
  },

  getSystemPrompts: async () => {
    return apiRequest<{
      prompts: Array<{
        id: number;
        name: string;
        description: string;
        template: string;
        variables: string[];
        category: string;
        is_active: boolean;
      }>;
    }>("/api/prompt-library/system-prompts");
  },
};

// Auth-related API functions
export const authApi = {
  login: async (username: string, password: string) => {
    return apiRequest<{
      message: string;
      user: { id: number; username: string };
    }>("/api/login", {
      method: "POST",
      body: { username, password },
    });
  },

  register: async (username: string, password: string) => {
    return apiRequest<{
      message: string;
      user: { id: number; username: string };
    }>("/api/register", {
      method: "POST",
      body: { username, password },
    });
  },

  logout: async () => {
    return apiRequest<{ message: string }>("/api/logout", {
      method: "POST",
    });
  },

  getUser: async () => {
    return apiRequest<any>("/api/user");
  },
};

import { QueryClient } from "@tanstack/react-query";

// Create a QueryClient instance with default configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export default queryClient;
