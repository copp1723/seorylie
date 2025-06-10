import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./hooks/useAuth";
import Dashboard from "./pages/dashboard";
import "./index.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function AppEmergency() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <div style={{ 
              padding: '20px', 
              maxWidth: '1200px', 
              margin: '0 auto',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h1 style={{ color: '#333', marginBottom: '20px' }}>
                Rylie - Emergency Mode
              </h1>
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#fff3cd', 
                border: '1px solid #ffeeba',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <strong>Running in simplified mode due to rendering issues</strong>
                <p>Main features are still accessible below:</p>
              </div>
              
              {/* Render Dashboard directly without routing */}
              <Dashboard />
              
              {/* Quick links to other pages */}
              <div style={{ marginTop: '40px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h3>Quick Access:</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <a href="/login" style={{ padding: '8px 16px', backgroundColor: '#007acc', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                    Login
                  </a>
                  <a href="/simple-prompt-test" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                    Prompt Test
                  </a>
                  <a href="/analytics" style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                    Analytics
                  </a>
                </div>
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  );
}

export default AppEmergency;