import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, LoginData } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const { loginMutation, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Login form state
  const [loginData, setLoginData] = useState<LoginData>({
    username: "",
    password: "",
  });

  const [loginType, setLoginType] = useState<"username" | "email">("username");

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle login form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare login data based on login type
    const submitData: LoginData = {
      password: loginData.password,
    };

    if (loginType === "email") {
      submitData.email = loginData.username; // Use username field for email input
    } else {
      submitData.username = loginData.username;
    }

    loginMutation.mutate(submitData);
  };

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard or saved redirect path
    if (isAuthenticated) {
      const redirectPath = localStorage.getItem("redirectAfterLogin") || "/";
      localStorage.removeItem("redirectAfterLogin"); // Clear the stored path
      setLocation(redirectPath);
    }
  }, [isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Welcome to Rylie AI
          </CardTitle>
          <CardDescription>
            Please log in to access the platform
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {loginMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {loginMutation.error instanceof Error
                    ? loginMutation.error.message
                    : "Login failed. Please check your credentials and try again."}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex space-x-2 mb-2">
                <Button
                  type="button"
                  variant={loginType === "username" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLoginType("username")}
                >
                  Username
                </Button>
                <Button
                  type="button"
                  variant={loginType === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLoginType("email")}
                >
                  Email
                </Button>
              </div>
              <Label htmlFor="username">
                {loginType === "email" ? "Email" : "Username"}
              </Label>
              <Input
                id="username"
                name="username"
                type={loginType === "email" ? "email" : "text"}
                placeholder={
                  loginType === "email"
                    ? "Enter your email"
                    : "Enter your username"
                }
                value={loginData.username}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={loginData.password}
                onChange={handleInputChange}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Log in
                </>
              )}
            </Button>
          </CardContent>
        </form>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p>This is a secure service provided by Rylie AI.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
