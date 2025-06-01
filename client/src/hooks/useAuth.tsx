import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { toastSuccess, toastError } from "@/components/ui/use-toast";

export interface User {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  dealership_id: number | null;
}

export interface LoginData {
  username?: string;
  email?: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

// API functions
async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/user", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      return null; // Not authenticated
    }

    if (!response.ok) {
      return null;
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

async function loginUser(credentials: LoginData): Promise<User> {
  const identifier = credentials.username || credentials.email;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Login failed:", errorData);
      throw new Error(errorData.error || "Login failed");
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

async function registerUser(credentials: RegisterData): Promise<User> {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Registration failed");
  }

  return response.json();
}

async function logoutUser(): Promise<void> {
  const response = await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

async function loginWithMagicLink(email: string): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to send magic link");
    }

    return true;
  } catch (error) {
    console.error("Magic link error:", error);
    throw error;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch current user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoading(true);
        const userData = await fetchCurrentUser();
        setUser(userData);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUser();
  }, []);

  // Login function
  const login = async (credentials: LoginData) => {
    try {
      setIsLoading(true);
      const userData = await loginUser(credentials);
      setUser(userData);
      setError(null);
      
      toastSuccess({
        title: "Login Successful",
        description: `Welcome back, ${userData.name || userData.username}!`,
      });
    } catch (err) {
      const error = err as Error;
      setError(error);
      toastError({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (credentials: RegisterData) => {
    try {
      setIsLoading(true);
      const userData = await registerUser(credentials);
      setUser(userData);
      setError(null);
      
      toastSuccess({
        title: "Account Created",
        description: "Welcome to CleanRylie! Your account has been created successfully.",
      });
    } catch (err) {
      const error = err as Error;
      setError(error);
      toastError({
        title: "Registration Failed",
        description: error.message || "Unable to create account. Please try again.",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setError(null);
      
      toastSuccess({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (err) {
      const error = err as Error;
      setUser(null); // Clear user locally even if logout fails
      toastError({
        title: "Logout Error",
        description: "There was an issue logging out, but you have been signed out locally.",
      });
    }
  };

  // Magic link function
  const sendMagicLink = async (email: string) => {
    try {
      await loginWithMagicLink(email);
      toastSuccess({
        title: "Magic Link Sent",
        description: "Check your email for a login link.",
      });
    } catch (err) {
      const error = err as Error;
      toastError({
        title: "Failed to Send Magic Link",
        description: error.message || "Unable to send magic link. Please try again.",
      });
      throw error;
    }
  };

  // Refetch user
  const refetchUser = async () => {
    try {
      setIsLoading(true);
      const userData = await fetchCurrentUser();
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(err as Error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    register,
    refetchUser,
    loginWithMagicLink: sendMagicLink,
    // Legacy mutation-style objects for backward compatibility
    loginMutation: { 
      mutate: login, 
      mutateAsync: login,
      isPending: isLoading,
      isError: !!error,
      error: error
    },
    logoutMutation: { 
      mutate: logout,
      isPending: isLoading,
      isError: !!error,
      error: error
    },
    registerMutation: { 
      mutate: register, 
      mutateAsync: register,
      isPending: isLoading,
      isError: !!error,
      error: error
    },
    magicLinkMutation: { 
      mutate: sendMagicLink, 
      mutateAsync: sendMagicLink,
      isPending: isLoading,
      isError: !!error,
      error: error
    },
  };
}

// Auth Context
const AuthContext = createContext<ReturnType<typeof useAuth> | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}
