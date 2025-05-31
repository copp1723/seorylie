import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './hooks/useAuth';
import { Route, Switch } from 'wouter';
import { queryClient } from './lib/queryClient';

// Import basic components directly without lazy loading
import StatusCard from "@/components/status-card";
import ApiStatus from "@/components/api-status";
import FeaturedDealership from "@/components/featured-dealership";

// Simple test components
const HomePage = () => (
  <div style={{ padding: '10px', background: '#444', borderRadius: '5px', margin: '10px 0' }}>
    <h3>🏠 Home Page</h3>
    <p>This is the home page route</p>
  </div>
);

function App() {
  // Simple static data
  const apiEndpoints = [
    { path: "/inbound", status: "operational" as const, uptime: "100% uptime" },
    { path: "/reply", status: "operational" as const, uptime: "99.8% uptime" },
    { path: "/handover", status: "operational" as const, uptime: "99.9% uptime" },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', color: 'white' }}>
            <h1>CleanRylie - Simple Dashboard Test</h1>
            <p>Testing Dashboard components without lazy loading...</p>
            
            <div style={{ background: '#333', padding: '10px', marginTop: '20px', borderRadius: '5px' }}>
              <h2>System Status</h2>
              <ul>
                <li>✅ React rendering</li>
                <li>✅ QueryClient configured</li>
                <li>✅ ThemeProvider added (dark theme)</li>
                <li>✅ AuthProvider added</li>
                <li>✅ Wouter router added</li>
                <li>✅ Basic Dashboard components (no lazy loading)</li>
                <li>✅ Basic styling</li>
              </ul>
            </div>

            <div style={{ background: '#333', padding: '10px', marginTop: '20px', borderRadius: '5px' }}>
              <h2>Dashboard Components Test</h2>
              <p>Testing core Dashboard components render without lazy loading:</p>
              
              {/* Test the basic Dashboard components */}
              <div style={{ marginTop: '20px' }}>
                <h3>Status Cards</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                  <StatusCard
                    title="System Status"
                    value="Operational"
                    icon="check_circle"
                    iconBgColor="bg-success/10"
                    iconColor="text-success"
                    progressValue={99}
                    progressColor="bg-success"
                    progressLabel="API & Services"
                  />
                  <StatusCard
                    title="Prompt Testing"
                    value="Ready"
                    icon="psychology"
                    iconBgColor="bg-primary/10"
                    iconColor="text-primary"
                  />
                </div>
                
                <h3>API Status</h3>
                <div style={{ marginBottom: '20px' }}>
                  <ApiStatus endpoints={apiEndpoints} />
                </div>
                
                <h3>Featured Dealership</h3>
                <div style={{ marginBottom: '20px' }}>
                  <FeaturedDealership
                    name="Dealership Configuration"
                    subtitle="Testing, Setup & Support"
                    stats={{
                      conversations: 0,
                      conversionRate: "Configure Now",
                    }}
                  />
                </div>
              </div>
              
              <Switch>
                <Route path="/" component={HomePage} />
                <Route>
                  <div style={{ padding: '10px', background: '#444', borderRadius: '5px' }}>
                    <h3>❓ Default Route</h3>
                    <p>No specific route matched</p>
                  </div>
                </Route>
              </Switch>
            </div>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;