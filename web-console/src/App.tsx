import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AppErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Requests from './pages/Requests';
import Reports from './pages/Reports';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Internal from './pages/Internal';
import Orders from './pages/Orders';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <BrandingProvider>
          {/* Router must wrap AuthProvider so hooks have access to navigation context */}
          <Router>
            <AuthProvider>
              <MainLayout>
                <Routes>
                  {/* Public / landing */}
                  <Route path="/" element={<Dashboard />} />

                  {/* Protected – any authenticated role */}
                  <Route
                    path="/chat"
                    element={
                      <ProtectedRoute>
                        <Chat />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/requests"
                    element={
                      <ProtectedRoute>
                        <Requests />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />

                  {/* Role-restricted pages */}
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute roles={['agency', 'super']}>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute roles={['dealer', 'agency', 'super']}>
                        <Orders />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/internal"
                    element={
                      <ProtectedRoute roles={['super']}>
                        <Internal />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </MainLayout>
            </AuthProvider>
          </Router>
        </BrandingProvider>
      </AppErrorBoundary>
      {/* Show React Query DevTools in development */}
      {/* {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />} */}
    </QueryClientProvider>
  );
}

export default App;