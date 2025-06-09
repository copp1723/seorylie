import api, { handleApiResponse } from '../lib/api';
import { ApiResponse, BrandingSettings, UserProfile, NotificationSettings } from '../types/api';
import { ProfileInput, NotificationSettingsInput, BrandingSettingsInput, PasswordChangeInput } from '../schemas/validation';

// Minimal settings service to make the app compile
export const settingsAPI = {
  profile: {
    get: async (): Promise<UserProfile> => {
      const response = await api.get<ApiResponse<UserProfile>>('/settings/profile');
      return handleApiResponse(response);
    },
    update: async (data: ProfileInput): Promise<UserProfile> => {
      const response = await api.put<ApiResponse<UserProfile>>('/settings/profile', data);
      return handleApiResponse(response);
    },
    uploadAvatar: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await api.post<ApiResponse<{ url: string }>>('/settings/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return handleApiResponse(response).url;
    },
  },
  notifications: {
    get: async (): Promise<NotificationSettings> => {
      const response = await api.get<ApiResponse<NotificationSettings>>('/settings/notifications');
      return handleApiResponse(response);
    },
    update: async (data: NotificationSettingsInput): Promise<NotificationSettings> => {
      const response = await api.put<ApiResponse<NotificationSettings>>('/settings/notifications', data);
      return handleApiResponse(response);
    },
  },
  branding: {
    get: async (): Promise<BrandingSettings> => {
      const response = await api.get<ApiResponse<BrandingSettings>>('/settings/branding');
      return handleApiResponse(response);
    },
    update: async (data: BrandingSettingsInput): Promise<BrandingSettings> => {
      const response = await api.put<ApiResponse<BrandingSettings>>('/settings/branding', data);
      return handleApiResponse(response);
    },
    uploadLogo: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await api.post<ApiResponse<{ url: string }>>('/settings/branding/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return handleApiResponse(response).url;
    },
  },
  security: {
    changePassword: async (data: PasswordChangeInput): Promise<void> => {
      const response = await api.put<ApiResponse<void>>('/settings/security/password', data);
      return handleApiResponse(response);
    },
    enable2FA: async (): Promise<{ secret: string; qrCode: string }> => {
      const response = await api.post<ApiResponse<{ secret: string; qrCode: string }>>('/settings/security/2fa/enable');
      return handleApiResponse(response);
    },
    verify2FA: async (token: string): Promise<void> => {
      const response = await api.post<ApiResponse<void>>('/settings/security/2fa/verify', { token });
      return handleApiResponse(response);
    },
    disable2FA: async (token: string): Promise<void> => {
      const response = await api.post<ApiResponse<void>>('/settings/security/2fa/disable', { token });
      return handleApiResponse(response);
    },
    getSessions: async (): Promise<any[]> => {
      const response = await api.get<ApiResponse<any[]>>('/settings/security/sessions');
      return handleApiResponse(response);
    },
    revokeSession: async (sessionId: string): Promise<void> => {
      const response = await api.delete<ApiResponse<void>>(`/settings/security/sessions/${sessionId}`);
      return handleApiResponse(response);
    },
  },
  website: {
    getIntegrations: async (): Promise<any> => {
      const response = await api.get<ApiResponse<any>>('/settings/website/integrations');
      return handleApiResponse(response);
    },
    connectGoogleAnalytics: async (propertyId: string, credentials: any): Promise<void> => {
      const response = await api.post<ApiResponse<void>>('/settings/website/google-analytics', { propertyId, credentials });
      return handleApiResponse(response);
    },
    disconnectGoogleAnalytics: async (): Promise<void> => {
      const response = await api.delete<ApiResponse<void>>('/settings/website/google-analytics');
      return handleApiResponse(response);
    },
    connectSearchConsole: async (siteUrl: string, credentials: any): Promise<void> => {
      const response = await api.post<ApiResponse<void>>('/settings/website/search-console', { siteUrl, credentials });
      return handleApiResponse(response);
    },
    verifyWebsite: async (url: string, method: 'dns' | 'file' | 'meta'): Promise<any> => {
      const response = await api.post<ApiResponse<any>>('/settings/website/verify', { url, method });
      return handleApiResponse(response);
    },
  },
  apiKeys: {
    list: async (): Promise<any[]> => {
      const response = await api.get<ApiResponse<any[]>>('/settings/api-keys');
      return handleApiResponse(response);
    },
    create: async (name: string, permissions: string[]): Promise<any> => {
      const response = await api.post<ApiResponse<any>>('/settings/api-keys', { name, permissions });
      return handleApiResponse(response);
    },
    revoke: async (keyId: string): Promise<void> => {
      const response = await api.delete<ApiResponse<void>>(`/settings/api-keys/${keyId}`);
      return handleApiResponse(response);
    },
  },
};

export default settingsAPI;