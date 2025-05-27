import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { LockKeyhole, Mail } from "lucide-react";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("replit");

  // Redirect to dashboard if already logged in
  if (user && !isLoading) {
    setLocation("/");
  }

  const handleLoginWithReplit = () => {
    // Redirect to Replit Auth login
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Welcome to Rylie AI
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to access your dealership's AI assistant
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="replit" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="replit">Replit Auth</TabsTrigger>
              <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
            </TabsList>

            <TabsContent value="replit" className="space-y-4">
              <div className="text-center space-y-2 mb-6">
                <p>
                  Sign in with your Replit account credentials for secure
                  access.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleLoginWithReplit}
                disabled={isLoading}
              >
                <LockKeyhole className="mr-2 h-4 w-4" />
                Continue with Replit
              </Button>
            </TabsContent>

            <TabsContent value="magic-link">
              <div className="text-center space-y-2 mb-6">
                <p>
                  Receive a secure login link to your email address. No password
                  required.
                </p>
              </div>

              <MagicLinkForm />
            </TabsContent>
          </Tabs>
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
