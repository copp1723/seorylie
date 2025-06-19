import React, { useState, useEffect } from "react";

interface TraceViewerProps {
  traceId?: string;
  className?: string;
}

interface TraceInfo {
  traceId: string;
  tempoUrl?: string;
  serviceName: string;
  timestamp: string;
}

export const TraceViewer: React.FC<TraceViewerProps> = ({
  traceId,
  className = "",
}) => {
  const [traceInfo, setTraceInfo] = useState<TraceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if trace correlation is enabled
  useEffect(() => {
    const checkTraceHealth = async () => {
      try {
        const response = await fetch("/api/trace/health");
        const data = await response.json();
        setIsEnabled(data.config?.enabled || false);
      } catch (err) {
        console.warn("Trace correlation not available:", err);
        setIsEnabled(false);
      }
    };

    checkTraceHealth();
  }, []);

  // Extract trace ID from response headers or current request
  useEffect(() => {
    if (!isEnabled) return;

    const extractTraceFromHeaders = () => {
      // Try to get trace ID from current request context
      fetch("/api/trace/current")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.traceContext) {
            setTraceInfo({
              traceId: data.traceContext.traceId,
              tempoUrl: data.tempoUrl,
              serviceName: data.traceContext.serviceName,
              timestamp: new Date().toISOString(),
            });
          }
        })
        .catch((err) =>
          console.warn("Could not get current trace context:", err),
        );
    };

    if (!traceId) {
      extractTraceFromHeaders();
    }
  }, [traceId, isEnabled]);

  // Fetch trace info for provided trace ID
  useEffect(() => {
    if (!isEnabled || !traceId) return;

    const fetchTraceInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/trace/tempo-url/${traceId}`);
        const data = await response.json();

        if (data.success) {
          setTraceInfo({
            traceId: data.traceId,
            tempoUrl: data.tempoUrl,
            serviceName: "cleanrylie-app",
            timestamp: new Date().toISOString(),
          });
        } else {
          setError(data.message || "Failed to get trace info");
        }
      } catch (err) {
        setError("Error fetching trace information");
        console.error("Trace fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTraceInfo();
  }, [traceId, isEnabled]);

  // Don't render if trace correlation is disabled
  if (!isEnabled) {
    return null;
  }

  // Don't render if no trace info and not loading
  if (!traceInfo && !loading && !error) {
    return null;
  }

  const openInTempo = () => {
    if (traceInfo?.tempoUrl) {
      window.open(traceInfo.tempoUrl, "_blank");
    }
  };

  const copyTraceId = () => {
    if (traceInfo?.traceId) {
      navigator.clipboard.writeText(traceInfo.traceId);
    }
  };

  return (
    <div className={`trace-viewer ${className}`}>
      <div className="trace-viewer-content">
        {loading && (
          <div className="trace-loading">
            <span>Loading trace info...</span>
          </div>
        )}

        {error && (
          <div className="trace-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {traceInfo && (
          <div className="trace-info">
            <div className="trace-header">
              <span className="trace-label">🔍 Trace</span>
              <span
                className="trace-id"
                onClick={copyTraceId}
                title="Click to copy"
              >
                {traceInfo.traceId.substring(0, 8)}...
              </span>
            </div>

            <div className="trace-actions">
              {traceInfo.tempoUrl && (
                <button
                  onClick={openInTempo}
                  className="trace-tempo-button"
                  title="Open in Grafana Tempo"
                >
                  📊 View Trace
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .trace-viewer {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          font-family: monospace;
          font-size: 12px;
        }

        .trace-viewer-content {
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          min-width: 200px;
        }

        .trace-loading,
        .trace-error {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .trace-error {
          color: #ff6b6b;
        }

        .trace-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .trace-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .trace-label {
          font-weight: bold;
          color: #4ecdc4;
        }

        .trace-id {
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .trace-id:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .trace-actions {
          display: flex;
          gap: 6px;
        }

        .trace-tempo-button {
          background: #4ecdc4;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          transition: background 0.2s;
        }

        .trace-tempo-button:hover {
          background: #45b7aa;
        }

        /* Hide in production unless explicitly enabled */
        @media (min-width: 1px) {
          .trace-viewer {
            display: ${process.env.NODE_ENV === "development" ? "block" : "none"};
          }
        }
      `}</style>
    </div>
  );
};

export default TraceViewer;
