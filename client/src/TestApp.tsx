import React from "react";

function TestApp() {
  return (
    <div style={{
      padding: "20px",
      backgroundColor: "#f0f0f0",
      minHeight: "100vh",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1 style={{ color: "#333", marginBottom: "20px" }}>
        ✅ React App is Working!
      </h1>
      <p style={{ color: "#666" }}>
        If you can see this, React is loading correctly.
      </p>
      <div style={{ marginTop: "20px", padding: "10px", backgroundColor: "white", borderRadius: "8px" }}>
        <h2 style={{ color: "#333" }}>Debug Info:</h2>
        <ul style={{ color: "#666" }}>
          <li>Time: {new Date().toLocaleString()}</li>
          <li>URL: {window.location.href}</li>
          <li>React Version: {React.version}</li>
        </ul>
      </div>
      <button 
        onClick={() => window.location.href = "/login"}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "16px"
        }}
      >
        Go to Login Page
      </button>
    </div>
  );
}

export default TestApp;