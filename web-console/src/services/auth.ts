import { api } from '../lib/api';
import { User, LoginCredentials, RegisterCredentials } from '../types/api';

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    return api.post('/auth/login', credentials);
  },

  async register(credentials: RegisterCredentials): Promise<{ user: User; token: string }> {
    return api.post('/auth/register', credentials);
  },

  async logout(): Promise<void> {
    return api.post('/auth/logout', {});
  },

  async getCurrentUser(): Promise<User> {
    return api.get('/auth/me');
  },

  async refreshToken(): Promise<{ token: string }> {
    return api.post('/auth/refresh', {});
  },
};