import React from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  // Redirect to dashboard if already logged in
  if (user && !isLoading) {
    setLocation("/");
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Welcome to CleanRylie
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to access your dealership's AI assistant
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="text-center space-y-2 mb-6">
            <p>
              Receive a secure login link to your email address. No password
              required.
            </p>
          </div>

          <MagicLinkForm />
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Need help? Contact your system administrator
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
