import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut } from "lucide-react";

export function LoginButton() {
  return (
    <Button
      variant="outline"
      onClick={() => (window.location.href = "/api/login")}
      className="gap-2"
    >
      <LogIn className="h-4 w-4" />
      <span>Log In</span>
    </Button>
  );
}

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      onClick={() => (window.location.href = "/api/logout")}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      <span>Log Out</span>
    </Button>
  );
}

export function AuthButtons() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return isAuthenticated ? <LogoutButton /> : <LoginButton />;
}
