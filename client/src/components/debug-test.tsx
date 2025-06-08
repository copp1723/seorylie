import React, { useState } from "react";

export function DebugTest() {
  const [clickCount, setClickCount] = useState(0);
  const [apiStatus, setApiStatus] = useState<string>("Not tested");

  const handleClick = () => {
    setClickCount((prev) => prev + 1);
    console.log("Button clicked!", clickCount + 1);
  };

  const testApi = async () => {
    try {
      setApiStatus("Testing...");
      const response = await fetch("/api/test", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setApiStatus(`✅ API Working: ${data.message}`);
      } else {
        setApiStatus(`❌ API Error: ${response.status}`);
      }
    } catch (error) {
      setApiStatus(`❌ Network Error: ${error}`);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "#000",
        color: "#fff",
        padding: "15px",
        borderRadius: "8px",
        border: "2px solid #333",
        zIndex: 9999,
        fontFamily: "monospace",
        fontSize: "12px",
        maxWidth: "300px",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", color: "#0ff" }}>🔧 Debug Panel</h3>

      <div style={{ marginBottom: "10px" }}>
        <strong>React Status:</strong> ✅ Rendering
      </div>

      <div style={{ marginBottom: "10px" }}>
        <strong>Click Test:</strong>
        <br />
        <button
          onClick={handleClick}
          style={{
            background: "#007acc",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "4px",
            cursor: "pointer",
            margin: "5px 0",
          }}
        >
          Click Me! ({clickCount})
        </button>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <strong>API Test:</strong>
        <br />
        <button
          onClick={testApi}
          style={{
            background: "#28a745",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "4px",
            cursor: "pointer",
            margin: "5px 0",
          }}
        >
          Test API
        </button>
        <div style={{ fontSize: "10px", marginTop: "5px" }}>{apiStatus}</div>
      </div>

      <div style={{ fontSize: "10px", color: "#888" }}>
        If buttons don't work, check console for errors
      </div>
    </div>
  );
}

export default DebugTest;
