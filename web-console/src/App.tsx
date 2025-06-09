import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AppErrorBoundary } from './components/ErrorBoundary';
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
          <AuthProvider>
            <Router>
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/requests" element={<Requests />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/internal" element={<Internal />} />
                  <Route path="/orders" element={<Orders />} />
                </Routes>
              </MainLayout>
            </Router>
          </AuthProvider>
        </BrandingProvider>
      </AppErrorBoundary>
      {/* Show React Query DevTools in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;