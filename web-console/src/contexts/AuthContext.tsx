import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/api';
// Real API client for authentication
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000';

const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    const data = await response.json();
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.name.split(' ')[0] || '',
        lastName: data.user.name.split(' ')[1] || '',
        role: data.user.role as 'dealer' | 'agency' | 'super',
        dealership: data.user.dealership,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      token: data.token,
      refreshToken: data.token // Using same token for now
    };
  },
  
  logout: async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
  },
  
  getProfile: async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get profile');
    }
    
    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      firstName: data.name.split(' ')[0] || '',
      lastName: data.name.split(' ')[1] || '',
      role: data.role as 'dealer' | 'agency' | 'super',
      dealership: data.dealership,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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
      const response = await authAPI.login(email, password);
      
      // Store tokens
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      
      // Set user state
      setUser(response.user);
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.message || 'Invalid credentials');
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
    
    // Navigate to login page to prevent users from staying on protected pages
    navigate('/login');
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