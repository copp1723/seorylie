import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./hooks/useAuth";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
import Dashboard from "./pages/dashboard";

// Simple test components
const HomePage = () => (
  <div
    style={{
      padding: "10px",
      background: "#444",
      borderRadius: "5px",
      margin: "10px 0",
    }}
  >
    <h3>🏠 Home Page</h3>
    <p>This is the home page route</p>
  </div>
);

const AboutPage = () => (
  <div
    style={{
      padding: "10px",
      background: "#444",
      borderRadius: "5px",
      margin: "10px 0",
    }}
  >
    <h3>📋 About Page</h3>
    <p>This is the about page route</p>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <div
            style={{
              padding: "20px",
              fontFamily: "Arial, sans-serif",
              color: "white",
            }}
          >
            <h1>CleanRylie - Dashboard Test</h1>
            <p>Testing with Dashboard component added...</p>

            <div
              style={{
                background: "#333",
                padding: "10px",
                marginTop: "20px",
                borderRadius: "5px",
              }}
            >
              <h2>System Status</h2>
              <ul>
                <li>✅ React rendering</li>
                <li>✅ QueryClient configured</li>
                <li>✅ ThemeProvider added (dark theme)</li>
                <li>✅ AuthProvider added</li>
                <li>✅ Wouter router added</li>
                <li>✅ Dashboard component added</li>
                <li>✅ Basic styling</li>
              </ul>
            </div>

            <div
              style={{
                background: "#333",
                padding: "10px",
                marginTop: "20px",
                borderRadius: "5px",
              }}
            >
              <h2>Dashboard Test</h2>
              <p>Testing Dashboard component render:</p>

              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/home" component={HomePage} />
                <Route path="/about" component={AboutPage} />
                <Route>
                  <div
                    style={{
                      padding: "10px",
                      background: "#444",
                      borderRadius: "5px",
                    }}
                  >
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
