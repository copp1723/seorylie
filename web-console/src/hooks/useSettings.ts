import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '../services/settings';
import { queryKeys } from '../lib/queryClient';
import { ProfileInput, NotificationSettingsInput, BrandingSettingsInput, PasswordChangeInput } from '../schemas/validation';
import { useBranding } from '../contexts/BrandingContext';

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

export const useUpdateBranding = () => {
  const queryClient = useQueryClient();
  const { updateBranding } = useBranding();

  return useMutation({
    mutationFn: (data: BrandingSettingsInput) => settingsAPI.branding.update(data),
    onSuccess: (updatedBranding) => {
      // Update cache
      queryClient.setQueryData(queryKeys.settings.branding, updatedBranding);
      
      // Update branding context
      updateBranding(updatedBranding);
    },
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => settingsAPI.branding.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.branding });
    },
  });
};