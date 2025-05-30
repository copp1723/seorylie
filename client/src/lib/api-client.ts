import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Define a custom error type for API errors
export interface ApiErrorResponse {
  message: string;
  status?: number;
  data?: any;
}

export class ApiError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for session cookies
});

// Request interceptor to add auth token or other headers
apiClient.interceptors.request.use(
  (config) => {
    // Example: Add a token if available (e.g., from localStorage or a state manager)
    // const token = localStorage.getItem('authToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data, // Return data directly
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { data, status } = error.response;
      const message = data?.message || error.message || 'An unexpected error occurred';
      return Promise.reject(new ApiError(message, status, data));
    } else if (error.request) {
      // The request was made but no response was received
      return Promise.reject(new ApiError('No response received from server.', undefined, error.request));
    } else {
      // Something happened in setting up the request that triggered an Error
      return Promise.reject(new ApiError(error.message || 'Error setting up request.'));
    }
  }
);

// Generic request function
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response: T = await apiClient.request<T, T>(config);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      // Re-throw ApiError to be caught by the caller
      throw error;
    }
    // Catch any other unexpected errors and wrap them
    throw new ApiError('An unexpected network error occurred.', undefined, error);
  }
}

// HTTP methods
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'GET', url }),

  post: <T, D = any>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'POST', url, data }),

  put: <T, D = any>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'PUT', url, data }),

  patch: <T, D = any>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'PATCH', url, data }),

  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'DELETE', url }),
};

export default http;

// Example usage (can be removed or kept for reference):
/*
interface User {
  id: number;
  name: string;
}

async function fetchUsers() {
  try {
    const users = await http.get<User[]>('/users');
    console.log(users);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', error.message, error.status, error.data);
    } else {
      console.error('Unknown error:', error);
    }
  }
}
*/
