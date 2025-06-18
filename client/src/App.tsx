import React from "react";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./hooks/useAuth";
import { SEONotificationProvider } from "./hooks/useSEONotifications";
import ProtectedRoute from "./components/protected-route";
import Layout from "./components/layout/layout";
import DebugTest from "./components/debug-test";
import SimpleErrorBoundary from "./components/simple-error-boundary";
import CSSDebug from "./components/css-debug";
import EmergencyCSSFix from "./components/emergency-css-fix"; // Re-enabled to fix white screen issue
import { VerifyCSSLoading } from "./components/VerifyCSSLoading"; // Added CSS verification component

// Page imports - Light pages loaded normally
import Dashboard from "./pages/seo-dashboard";
import Login from "./pages/login";
import AuthPage from "./pages/auth-page";
import VerifyMagicLink from "./pages/verify-magic-link";
import SimplePromptTestPage from "./pages/SimplePromptTestPage";
import EnhancedPromptTesting from "./pages/enhanced-prompt-testing";
import Conversations from "./pages/conversations";
import Personas from "./pages/personas";
import Settings from "./pages/settings";
import Security from "./pages/security";
import NotFound from "./pages/not-found";
import AdminDealershipsPage from "./pages/admin/dealerships";
import PublicOnboarding from "./pages/public-onboarding";
import AdminSEOWerksOnboarding from "./pages/admin/seoworks-onboarding";
import SEOWorksQueueDashboard from "./pages/admin/seowerks-queue";
import SEOWorksChatPage from "./pages/seoworks-chat";
import AgencyAnalytics from "./pages/agency/analytics";
import AgencyPerformance from "./pages/agency/performance";

// Lazy load agency users page
const LazyAgencyUsers = React.lazy(() => import('./pages/agency/users'));

// Heavy pages loaded lazily
import { 
  LazyAnalyticsPage,
  LazyAgentStudioPage,
  LazyLoadWrapper,
  PageSkeleton
} from "./utils/lazy-loading";
import IntegrationDashboardPage from "./pages/integration-dashboard";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <SimpleErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SEONotificationProvider>
              {import.meta.env.DEV && (
                <>
                  <EmergencyCSSFix />
                  <DebugTest />
                  <CSSDebug />
                  <VerifyCSSLoading />
                </>
              )}
              <Toaster />
              <Switch>
              {/* Public routes */}
              <Route path="/login" component={Login} />
              <Route path="/auth" component={AuthPage} />
              <Route path="/verify-magic-link" component={VerifyMagicLink} />
              <Route path="/onboarding" component={PublicOnboarding} />
              <Route path="/seoworks-signup" component={PublicOnboarding} />
              <Route
                path="/simple-prompt-test"
                component={SimplePromptTestPage}
              />

              {/* Protected routes with layout */}
              <Route path="/">
                <Layout>
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/dashboard" component={Dashboard} />
                    <Route path="/prompt-testing">
                      <ProtectedRoute>
                        <SimplePromptTestPage />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/enhanced-prompt-testing">
                      <ProtectedRoute>
                        <EnhancedPromptTesting />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/conversations">
                      <ProtectedRoute>
                        <Conversations />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/analytics">
                      <ProtectedRoute>
                        <LazyLoadWrapper fallback={<PageSkeleton />}>
                          <LazyAnalyticsPage />
                        </LazyLoadWrapper>
                      </ProtectedRoute>
                    </Route>
                    <Route path="/personas">
                      <ProtectedRoute>
                        <Personas />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/settings">
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    </Route>
                    <Route path="/security">
                      <ProtectedRoute>
                        <Security />
                      </ProtectedRoute>
                    </Route>
                    {/* SEOWerks Chat for dealerships */}
                    <Route path="/seoworks-chat">
                      <ProtectedRoute>
                        <SEOWorksChatPage />
                      </ProtectedRoute>
                    </Route>
                    {/* Agent Studio route - added as requested */}
                    <Route path="/agent-studio">
                      <ProtectedRoute>
                        <LazyLoadWrapper fallback={<PageSkeleton />}>
                          <LazyAgentStudioPage />
                        </LazyLoadWrapper>
                      </ProtectedRoute>
                    </Route>
                    {/* Integration Dashboard route */}
                    <Route path="/integration">
                      <ProtectedRoute>
                        <IntegrationDashboardPage />
                      </ProtectedRoute>
                    </Route>
                    {/* Admin Dealerships route */}
                    <Route path="/admin/dealerships">
                      <ProtectedRoute>
                        <AdminDealershipsPage />
                      </ProtectedRoute>
                    </Route>
                    {/* Admin SEOWerks Onboarding route */}
                    <Route path="/admin/seoworks-onboarding">
                      <ProtectedRoute>
                        <AdminSEOWerksOnboarding />
                      </ProtectedRoute>
                    </Route>
                    {/* Admin SEOWerks Queue route */}
                    <Route path="/admin/seowerks-queue">
                      <ProtectedRoute>
                        <SEOWorksQueueDashboard />
                      </ProtectedRoute>
                    </Route>
                    {/* Agency Analytics route */}
                    <Route path="/agency/analytics">
                      <ProtectedRoute>
                        <AgencyAnalytics />
                      </ProtectedRoute>
                    </Route>
                    {/* Agency Performance route */}
                    <Route path="/agency/performance">
                      <ProtectedRoute>
                        <AgencyPerformance />
                      </ProtectedRoute>
                    </Route>
                    {/* Agency Users route */}
                    <Route path="/agency/users">
                      <ProtectedRoute>
                        <LazyLoadWrapper fallback={<PageSkeleton />}>
                          <LazyAgencyUsers />
                        </LazyLoadWrapper>
                      </ProtectedRoute>
                    </Route>
                    {/* Catch-all route */}
                    <Route component={NotFound} />
                  </Switch>
                </Layout>
              </Route>
            </Switch>
            </SEONotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SimpleErrorBoundary>
  );
}

export default App;
