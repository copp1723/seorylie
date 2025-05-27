import { ReactNode, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoginPage] = useRoute("/login");

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      // Save the current path to redirect back after login
      localStorage.setItem("redirectAfterLogin", window.location.pathname);
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, isLoginPage, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading...</span>
      </div>
    );
  }

  return <>{children}</>;
}

// Default export for backward compatibility
export default ProtectedRoute;