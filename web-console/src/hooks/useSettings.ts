import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../services/settings';
import { queryKeys } from '../lib/queryClient';
import { ProfileInput, NotificationSettingsInput, BrandingSettingsInput, PasswordChangeInput } from '../schemas/validation';

// Profile hooks
export const useProfile = () => {
  return useQuery({
    queryKey: queryKeys.settings.profile,
    queryFn: settingsAPI.profile.get,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProfileInput) => settingsAPI.profile.update(data),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(queryKeys.settings.profile, updatedProfile);
      // Also update auth profile if it exists
      queryClient.setQueryData(queryKeys.auth.profile, (old: any) => ({
        ...old,
        ...updatedProfile,
      }));
    },
  });
};

export const useUploadAvatar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => settingsAPI.profile.uploadAvatar(file),
    onSuccess: () => {
      // Invalidate profile to refetch with new avatar
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.profile });
    },
  });
};

// Notification hooks
export const useNotificationSettings = () => {
  return useQuery({
    queryKey: queryKeys.settings.notifications,
    queryFn: settingsAPI.notifications.get,
  });
};

export const useUpdateNotifications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: NotificationSettingsInput) => settingsAPI.notifications.update(data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(queryKeys.settings.notifications, updatedSettings);
    },
  });
};

// Security hooks
export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: PasswordChangeInput) => settingsAPI.security.changePassword(data),
  });
};

export const useEnable2FA = () => {
  return useMutation({
    mutationFn: () => settingsAPI.security.enable2FA(),
  });
};

export const useVerify2FA = () => {
  return useMutation({
    mutationFn: (token: string) => settingsAPI.security.verify2FA(token),
  });
};

export const useDisable2FA = () => {
  return useMutation({
    mutationFn: (token: string) => settingsAPI.security.disable2FA(token),
  });
};

export const useSessions = () => {
  return useQuery({
    queryKey: ['settings', 'security', 'sessions'],
    queryFn: settingsAPI.security.getSessions,
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => settingsAPI.security.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'security', 'sessions'] });
    },
  });
};

// Branding hooks
export const useBrandingSettings = () => {
  return useQuery({
    queryKey: queryKeys.settings.branding,
    queryFn: settingsAPI.branding.get,
  });
};

// Note: useUpdateBranding removed to avoid circular dependency with BrandingContext
// Use the updateBranding function from useBranding() hook directly instead

export const useUploadLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => settingsAPI.branding.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.branding });
    },
  });
};

// Website integration hooks
export const useWebsiteIntegrations = () => {
  return useQuery({
    queryKey: ['settings', 'website', 'integrations'],
    queryFn: settingsAPI.website.getIntegrations,
  });
};

export const useConnectGoogleAnalytics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, credentials }: { propertyId: string; credentials: any }) => 
      settingsAPI.website.connectGoogleAnalytics(propertyId, credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'website', 'integrations'] });
    },
  });
};

export const useDisconnectGoogleAnalytics = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => settingsAPI.website.disconnectGoogleAnalytics(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'website', 'integrations'] });
    },
  });
};

export const useConnectSearchConsole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteUrl, credentials }: { siteUrl: string; credentials: any }) => 
      settingsAPI.website.connectSearchConsole(siteUrl, credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'website', 'integrations'] });
    },
  });
};

export const useVerifyWebsite = () => {
  return useMutation({
    mutationFn: ({ url, method }: { url: string; method: 'dns' | 'file' | 'meta' }) => 
      settingsAPI.website.verifyWebsite(url, method),
  });
};

// API Keys hooks
export const useApiKeys = () => {
  return useQuery({
    queryKey: ['settings', 'api-keys'],
    queryFn: settingsAPI.apiKeys.list,
  });
};

export const useCreateApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, permissions }: { name: string; permissions: string[] }) => 
      settingsAPI.apiKeys.create(name, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
    },
  });
};

export const useRevokeApiKey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => settingsAPI.apiKeys.revoke(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'api-keys'] });
    },
  });
};