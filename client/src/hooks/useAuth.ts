import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  // Get current user
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/user"],
    queryFn: fetchCurrentUser,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (userData) => {
      // Update cache with user data
      queryClient.setQueryData(["/api/user"], userData);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (userData) => {
      // Update cache with user data
      queryClient.setQueryData(["/api/user"], userData);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear user from cache
      queryClient.setQueryData(["/api/user"], null);
    },
  });

  // Magic link mutation
  const magicLinkMutation = useMutation({
    mutationFn: loginWithMagicLink,
  });

  // Simple logout function that uses the mutation
  const logout = () => {
    logoutMutation.mutate();
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
    loginMutation,
    logoutMutation,
    registerMutation,
    magicLinkMutation,
    refetchUser: refetch,
    logout, // Add the simple logout function
    loginWithMagicLink: (email: string) => magicLinkMutation.mutateAsync(email),
  };
}
