/**
 * Enhanced API client with automatic error handling and notifications
 */

import { useNotifications } from "@/hooks/useNotifications";
import { toastSuccess, toastError, toastWarning, toast } from "@/components/ui/use-toast";

// API response types matching backend
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  userMessage?: string;
  details?: any;
  code?: string;
  field?: string;
  action?: {
    label: string;
    url?: string;
    type?: 'retry' | 'navigate' | 'contact' | 'refresh';
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    public response: ApiErrorResponse,
    public status: number
  ) {
    super(response.error);
    this.name = 'ApiError';
  }

  get userMessage(): string {
    return this.response.userMessage || this.response.error;
  }

  get code(): string | undefined {
    return this.response.code;
  }

  get action(): ApiErrorResponse['action'] {
    return this.response.action;
  }
}

// Request options
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}

// Enhanced fetch wrapper with automatic error handling
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make an API request with automatic error handling and notifications
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      showSuccessToast = false,
      showErrorToast = true,
      loadingMessage,
      successMessage,
      errorMessage,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    let loadingToastId: string | undefined;

    try {
      // Show loading toast if requested
      if (loadingMessage) {
        loadingToastId = toast({
          title: loadingMessage,
          variant: "loading",
          duration: 0, // Persistent until dismissed
        }).id;
      }

      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...headers,
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });

      // Dismiss loading toast
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }

      // Parse response
      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        const apiError = new ApiError(data as ApiErrorResponse, response.status);

        // Show error toast if requested
        if (showErrorToast) {
          this.showErrorToast(apiError, errorMessage);
        }

        throw apiError;
      }

      // Show success toast if requested
      if (showSuccessToast) {
        const message = successMessage || data.message || 'Operation completed successfully';
        toastSuccess({
          title: 'Success',
          description: message,
        });
      }

      return data.data;
    } catch (error) {
      // Dismiss loading toast on error
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new ApiError({
          success: false,
          error: 'Network error',
          userMessage: 'Unable to connect to the server. Please check your internet connection.',
          code: 'NETWORK_ERROR',
          action: { label: 'Retry', type: 'retry' }
        }, 0);

        if (showErrorToast) {
          this.showErrorToast(networkError, errorMessage);
        }

        throw networkError;
      }

      // Re-throw if already an ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle other errors
      const unknownError = new ApiError({
        success: false,
        error: 'Unknown error occurred',
        userMessage: 'An unexpected error occurred. Please try again.',
        code: 'UNKNOWN_ERROR'
      }, 500);

      if (showErrorToast) {
        this.showErrorToast(unknownError, errorMessage);
      }

      throw unknownError;
    }
  }

  /**
   * Show error toast with action button if available
   */
  private showErrorToast(error: ApiError, customMessage?: string) {
    const message = customMessage || error.userMessage;
    
    toastError({
      title: 'Error',
      description: message,
      action: error.action ? {
        label: error.action.label,
        onClick: () => this.handleErrorAction(error.action!),
      } : undefined,
    });
  }

  /**
   * Handle error action clicks
   */
  private handleErrorAction(action: NonNullable<ApiErrorResponse['action']>) {
    switch (action.type) {
      case 'navigate':
        if (action.url) {
          window.location.href = action.url;
        }
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'retry':
        // This would need to be implemented based on context
        console.log('Retry action triggered');
        break;
      case 'contact':
        // Could open a contact modal or navigate to support
        console.log('Contact support action triggered');
        break;
    }
  }

  // Convenience methods for common HTTP verbs
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Hook for using the API client with notifications context
export function useApiClient() {
  const notifications = useNotifications();

  // Enhanced request method that uses the notification context
  const requestWithNotifications = async <T = any>(
    endpoint: string,
    options: RequestOptions & {
      useNotifications?: boolean;
    } = {}
  ): Promise<T> => {
    const { useNotifications: useNotifs = true, ...requestOptions } = options;

    try {
      const result = await apiClient.request<T>(endpoint, requestOptions);
      
      // Use notification system if available and requested
      if (useNotifs && options.showSuccessToast) {
        const message = options.successMessage || 'Operation completed successfully';
        notifications.success('Success', message);
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError && useNotifs && options.showErrorToast !== false) {
        const message = options.errorMessage || error.userMessage;
        notifications.error('Error', message, {
          action: error.action ? {
            label: error.action.label,
            onClick: () => {
              // Handle action based on type
              switch (error.action?.type) {
                case 'navigate':
                  if (error.action.url) {
                    window.location.href = error.action.url;
                  }
                  break;
                case 'refresh':
                  window.location.reload();
                  break;
                default:
                  console.log('Action triggered:', error.action);
              }
            }
          } : undefined
        });
      }
      throw error;
    }
  };

  return {
    ...apiClient,
    request: requestWithNotifications,
    notifications,
  };
}

// Export error types for use in components
export type { ApiSuccessResponse, ApiErrorResponse };