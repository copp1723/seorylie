import React from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import LoginPage from "@/pages/auth-login";
import PromptTesting from "@/pages/prompt-testing";
import PromptLibrary from "@/pages/prompt-library";
import EnhancedPromptTesting from "@/pages/enhanced-prompt-testing";
import SecurityPage from "@/pages/security";
import SetupPage from "@/pages/setup";
import AnalyticsPage from "@/pages/analytics";
import SystemPage from "@/pages/system";
import DealershipsPage from "@/pages/admin/dealerships";
import BrandingPage from "@/pages/admin/branding";
import ChatDemo from "@/pages/ChatDemo";
import ChatTestPage from "@/pages/ChatTestPage";
import SimplePromptTestPage from "@/pages/SimplePromptTestPage";
import { useAuth } from "./hooks/useAuth";
import { ProtectedRoute } from "@/lib/protected-route";
import Layout from "@/components/layout/layout";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { ToastProvider } from "@/hooks/use-toast";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <div className="min-h-screen">
          <Switch>
            <Route path="/auth" component={LoginPage} />
            <Route path="/login" component={LoginPage} />
          <Route path="/prompt-testing">
            <ProtectedRoute>
              <Layout>
                <PromptTesting />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/enhanced-prompt-testing">
            <ProtectedRoute>
              <Layout>
                <EnhancedPromptTesting />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/prompt-library">
            <ProtectedRoute>
              <Layout>
                <PromptLibrary />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/system">
            <ProtectedRoute>
              <Layout>
                <SystemPage />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/admin/dealerships">
            <ProtectedRoute>
              <Layout>
                <DealershipsPage />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/admin/branding">
            <ProtectedRoute>
              <Layout>
                <BrandingPage />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/setup">
            <ProtectedRoute>
              <Layout>
                <SetupPage />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/analytics">
            <ProtectedRoute>
              <Layout>
                <AnalyticsPage />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/chat">
            <ProtectedRoute>
              <Layout>
                <ChatDemo />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/chat-test">
            <Layout>
              <ChatTestPage />
            </Layout>
          </Route>
          <Route path="/simple-prompt-test">
            <Layout>
              <SimplePromptTestPage />
            </Layout>
          </Route>
          <Route path="/">
            <ProtectedRoute>
              <Layout>
                <HomePage />
              </Layout>
            </ProtectedRoute>
          </Route>
          <Route>
            {/* 404 Page */}
            <div className="flex flex-col items-center justify-center min-h-screen">
              <h1 className="text-4xl font-bold mb-4">404 - Not Found</h1>
              <p className="text-lg mb-6">The page you're looking for doesn't exist.</p>
              <a href="/" className="text-primary hover:underline">
                Return to Home
              </a>
            </div>
          </Route>
        </Switch>
        <Toaster />
      </div>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;