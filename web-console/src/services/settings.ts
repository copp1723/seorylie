// import api from '../lib/api';
const api = { 
  get: async (_url: string, _config?: any) => ({ data: {} as any }), 
  post: async (_url: string, _data?: any, _config?: any) => ({ data: {} as any }), 
  put: async (_url: string, _data?: any, _config?: any) => ({ data: {} as any }), 
  delete: async (_url: string, _config?: any) => ({ data: {} as any }),
  patch: async (_url: string, _data?: any, _config?: any) => ({ data: {} as any })
};
import type { 
  UserProfile, 
  BrandingSettings, 
  NotificationSettings,
  UpdateProfileRequest,
  UpdateBrandingRequest,
  UpdateNotificationRequest
} from '../types/api';

export const settingsAPI = {
  // Profile management
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get('/settings/profile');
    return response.data;
  },

  updateProfile: async (updates: UpdateProfileRequest): Promise<UserProfile> => {
    const response = await api.patch('/settings/profile', updates);
    return response.data;
  },

  profile: {
    get: async (): Promise<UserProfile> => {
      const response = await api.get('/settings/profile');
      return response.data;
    },
    update: async (data: any): Promise<UserProfile> => {
      const response = await api.patch('/settings/profile', data);
      return response.data;
    },
    uploadAvatar: async (file: File): Promise<any> => {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await api.post('/settings/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    }
  },

  // Branding settings
  getBranding: async (): Promise<BrandingSettings> => {
    const response = await api.get('/settings/branding');
    return response.data;
  },

  updateBranding: async (updates: UpdateBrandingRequest): Promise<BrandingSettings> => {
    const response = await api.patch('/settings/branding', updates);
    return response.data;
  },

  branding: {
    get: async (): Promise<BrandingSettings> => {
      const response = await api.get('/settings/branding');
      return response.data;
    },
    update: async (data: any): Promise<BrandingSettings> => {
      const response = await api.patch('/settings/branding', data);
      return response.data;
    },
    uploadLogo: async (file: File): Promise<any> => {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await api.post('/settings/branding/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    }
  },

  // Notification settings
  getNotifications: async (): Promise<NotificationSettings> => {
    const response = await api.get('/settings/notifications');
    return response.data;
  },

  updateNotifications: async (updates: UpdateNotificationRequest): Promise<NotificationSettings> => {
    const response = await api.patch('/settings/notifications', updates);
    return response.data;
  },

  notifications: {
    get: async (): Promise<NotificationSettings> => {
      const response = await api.get('/settings/notifications');
      return response.data;
    },
    update: async (data: any): Promise<NotificationSettings> => {
      const response = await api.patch('/settings/notifications', data);
      return response.data;
    }
  },

  // Security
  security: {
    changePassword: async (data: any): Promise<void> => {
      await api.post('/settings/security/password', data);
    },
    enable2FA: async (): Promise<any> => {
      const response = await api.post('/settings/security/2fa/enable');
      return response.data;
    },
    verify2FA: async (token: string): Promise<void> => {
      await api.post('/settings/security/2fa/verify', { token });
    },
    disable2FA: async (token: string): Promise<void> => {
      await api.post('/settings/security/2fa/disable', { token });
    },
    getSessions: async (): Promise<any> => {
      const response = await api.get('/settings/security/sessions');
      return response.data;
    },
    revokeSession: async (sessionId: string): Promise<void> => {
      await api.delete(`/settings/security/sessions/${sessionId}`);
    }
  },

  // Website integrations
  website: {
    getIntegrations: async (): Promise<any> => {
      const response = await api.get('/settings/website/integrations');
      return response.data;
    },
    connectGoogleAnalytics: async (propertyId: string, credentials: any): Promise<void> => {
      await api.post('/settings/website/google-analytics', { propertyId, credentials });
    },
    disconnectGoogleAnalytics: async (): Promise<void> => {
      await api.delete('/settings/website/google-analytics');
    },
    connectSearchConsole: async (siteUrl: string, credentials: any): Promise<void> => {
      await api.post('/settings/website/search-console', { siteUrl, credentials });
    },
    verifyWebsite: async (url: string, method: string): Promise<any> => {
      const response = await api.post('/settings/website/verify', { url, method });
      return response.data;
    }
  },

  // API Keys
  apiKeys: {
    list: async (): Promise<any> => {
      const response = await api.get('/settings/api-keys');
      return response.data;
    },
    create: async (name: string, permissions: string[]): Promise<any> => {
      const response = await api.post('/settings/api-keys', { name, permissions });
      return response.data;
    },
    revoke: async (keyId: string): Promise<void> => {
      await api.delete(`/settings/api-keys/${keyId}`);
    }
  },

  // Account deletion
  deleteAccount: async (password: string): Promise<void> => {
    await api.delete('/settings/account', {
      data: { password }
    });
  }
};
