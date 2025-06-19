import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/api';
// import { authAPI } from '../services/auth';
const authAPI = {
  login: async () => ({ 
    user: { 
      id: '1', 
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'dealer' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    token: 'mock-token',
    refreshToken: 'mock-refresh-token'
  }),
  logout: async () => {},
  getProfile: async () => ({ 
    id: '1', 
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'dealer' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
};
import { queryClient } from '../lib/queryClient';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Alias for backwards compatibility
export const useAuth = useAuthContext;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth token and validate
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          // Validate token with server and get user data
          const userData = await authAPI.getProfile();
          setUser(userData);
        } catch (error) {
          console.error('Token validation failed:', error);
          // Clear invalid token
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authAPI.login();
      
      // Store tokens
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      
      // Set user state
      setUser(response.user);
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Call logout API (fire and forget)
    authAPI.logout().catch(console.error);
    
    // Clear local state
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    
    // Clear all cached data
    queryClient.clear();
  };

  const value = {
    user,
    setUser,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};