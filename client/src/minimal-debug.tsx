import React from 'react';
import { createRoot } from 'react-dom/client';

// Minimal component to test if React is working
const MinimalApp = () => {
  const [count, setCount] = React.useState(0);
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>
        🚨 Debug Mode - React is Working!
      </h1>
      
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2>Interactive Test</h2>
        <button 
          onClick={() => setCount(count + 1)}
          style={{
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Clicked {count} times
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#333',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <h3>Debug Info:</h3>
        <p>✅ React: {React.version}</p>
        <p>✅ Component rendered at: {new Date().toLocaleTimeString()}</p>
        <p>✅ Window location: {window.location.href}</p>
        <p>✅ User Agent: {navigator.userAgent.substring(0, 50)}...</p>
      </div>
      
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeeba',
        borderRadius: '4px',
        color: '#856404'
      }}>
        <strong>If you see this page:</strong>
        <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li>React is working correctly</li>
          <li>The issue is likely in the main App component or routing</li>
          <li>Check the browser console for specific errors</li>
          <li>Try accessing <a href="/login">/login</a> or <a href="/simple-prompt-test">/simple-prompt-test</a></li>
        </ul>
      </div>
    </div>
  );
};

// Mount the app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<MinimalApp />);
  console.log('✅ Minimal debug app mounted successfully');
} else {
  console.error('❌ Could not find root element');
}