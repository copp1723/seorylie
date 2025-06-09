import axios, { AxiosResponse, AxiosError } from 'axios';
import { ApiResponse, ApiError } from '../types/api';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    
    if (error.response?.status === 403) {
      // Forbidden - show access denied message
      console.error('Access denied');
    }
    
    if (error.response?.status >= 500) {
      // Server error - show generic error message
      console.error('Server error occurred');
    }
    
    return Promise.reject(error);
  }
);

// Helper function to handle API responses
export const handleApiResponse = <T>(response: AxiosResponse<ApiResponse<T>>): T => {
  if (response.data.success) {
    return response.data.data;
  }
  throw new Error(response.data.message || 'API request failed');
};

// Helper function to handle API errors
export const handleApiError = (error: AxiosError): ApiError => {
  if (error.response?.data) {
    return error.response.data as ApiError;
  }
  
  if (error.request) {
    return {
      message: 'Network error - please check your connection',
      code: 'NETWORK_ERROR',
    };
  }
  
  return {
    message: error.message || 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
};

// Helper function for file uploads
export const uploadFile = async (file: File, endpoint: string, onProgress?: (progress: number) => void) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post(endpoint, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = (progressEvent.loaded / progressEvent.total) * 100;
        onProgress(Math.round(progress));
      }
    },
  });
};

// Helper function for downloading files
export const downloadFile = async (url: string, filename: string) => {
  const response = await api.get(url, {
    responseType: 'blob',
  });
  
  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};

export default api;