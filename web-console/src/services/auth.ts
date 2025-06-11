import api, { handleApiResponse } from '../lib/api';
import { AuthResponse, User, ApiResponse } from '../types/api';
import { LoginInput, RegisterInput } from '../schemas/validation';

export const authAPI = {
  // Login user
  login: async (credentials: LoginInput): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    return handleApiResponse(response);
  },

  // Register new user
  register: async (userData: RegisterInput): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', userData);
    return handleApiResponse(response);
  },

  // Logout user
  logout: async (): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/auth/logout');
    return handleApiResponse(response);
  },

  // Get current user profile
  getProfile: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>('/auth/profile');
    return handleApiResponse(response);
  },

  // Refresh access token
  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/refresh', {
      refreshToken,
    });
    return handleApiResponse(response);
  },

  // Forgot password
  forgotPassword: async (email: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/auth/forgot-password', {
      email,
    });
    return handleApiResponse(response);
  },

  // Reset password
  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/auth/reset-password', {
      token,
      newPassword,
    });
    return handleApiResponse(response);
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await api.put<ApiResponse<void>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return handleApiResponse(response);
  },

  // Verify email
  verifyEmail: async (token: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/auth/verify-email', {
      token,
    });
    return handleApiResponse(response);
  },

  // Resend verification email
  resendVerification: async (): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/auth/resend-verification');
    return handleApiResponse(response);
  },
};

export default authAPI;