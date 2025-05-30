import React from 'react';
import { Route, Switch } from 'wouter';
import { Toaster } from './components/ui/toaster';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/layout';

// Page imports
import Dashboard from './pages/dashboard';
import Login from './pages/login';
import AuthPage from './pages/auth-page';
import VerifyMagicLink from './pages/verify-magic-link';
import SimplePromptTestPage from './pages/SimplePromptTestPage';
import EnhancedPromptTesting from './pages/enhanced-prompt-testing';
import Conversations from './pages/conversations';
import Analytics from './pages/analytics';
import Personas from './pages/personas';
import Settings from './pages/settings';
import Security from './pages/security';
import NotFound from './pages/not-found';
import AgentStudio from './pages/agent-studio';
import IntegrationDashboardPage from './pages/integration-dashboard';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <Toaster />
        <Switch>
          {/* Public routes */}
          <Route path="/login" component={Login} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/verify-magic-link" component={VerifyMagicLink} />
          <Route path="/simple-prompt-test" component={SimplePromptTestPage} />

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
                    <Analytics />
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
                {/* Agent Studio route - added as requested */}
                <Route path="/agent-studio">
                  <ProtectedRoute>
                    <AgentStudio />
                  </ProtectedRoute>
                </Route>
                {/* Integration Dashboard route */}
                <Route path="/integration">
                  <ProtectedRoute>
                    <IntegrationDashboardPage />
                  </ProtectedRoute>
                </Route>
                {/* Catch-all route */}
                <Route component={NotFound} />
              </Switch>
            </Layout>
          </Route>
        </Switch>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
