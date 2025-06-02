import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/index.css";

// Global error handling for debugging
window.addEventListener('error', (event) => {
  console.error('🚨 Global JavaScript Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled Promise Rejection:', event.reason);
});

// Log when React starts mounting
console.log('🚀 Starting React app...');

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  console.log('✅ Root element found, creating React root...');
  const root = createRoot(rootElement);

  console.log('✅ React root created, rendering App...');
  root.render(<App />);

  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ Failed to start React app:', error);

  // Fallback error display
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        font-family: Arial, sans-serif;
      ">
        <h2>🚨 App Failed to Start</h2>
        <p>React could not initialize properly.</p>
        <pre style="background: #333; padding: 10px; border-radius: 4px; font-size: 12px;">
          ${error}
        </pre>
        <button onclick="window.location.reload()" style="
          background: white;
          color: #ff4444;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 15px;
          font-weight: bold;
        ">
          Reload Page
        </button>
      </div>
    `;
  }
}
