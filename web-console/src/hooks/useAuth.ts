import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../services/auth';
import { queryKeys } from '../lib/queryClient';
import { LoginInput, RegisterInput, PasswordChangeInput } from '../schemas/validation';
import { useAuthContext } from '../contexts/AuthContext';

export const useAuth = () => {
  return useAuthContext();
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: (credentials: LoginInput) => authAPI.login(credentials),
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      // Update user state
      setUser(data.user);
      
      // Cache user data
      queryClient.setQueryData(queryKeys.auth.profile, data.user);
    },
    onError: (error) => {
      console.error('Login failed:', error);
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  return useMutation({
    mutationFn: (userData: RegisterInput) => authAPI.register(userData),
    onSuccess: (data) => {
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
      queryClient.setQueryData(queryKeys.auth.profile, data.user);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  return useMutation({
    mutationFn: () => authAPI.logout(),
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
    onError: () => {
      // Even if API call fails, clear local data
      logout();
      queryClient.clear();
    },
  });
};

export const useProfile = () => {
  return useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: authAPI.getProfile,
    staleTime: Infinity, // Profile data doesn't change often
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: PasswordChangeInput) => 
      authAPI.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      // Could show success message here
      console.log('Password changed successfully');
    },
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authAPI.forgotPassword(email),
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) => 
      authAPI.resetPassword(token, newPassword),
  });
};