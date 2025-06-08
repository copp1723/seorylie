import React, { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useToast } from "./ui/use-toast";

// Define the metrics structure
interface SystemMetrics {
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    percentUsed: number;
  };
  cpu: {
    usage: number;
    cores: number;
    loadAvg: number[];
  };
  disk: {
    total: number;
    free: number;
    used: number;
    percentUsed: number;
  };
  network: {
    rx: number;
    tx: number;
    connections: number;
  };
  services: {
    name: string;
    status: "healthy" | "degraded" | "down";
    responseTime: number;
  }[];
  alerts: {
    level: "info" | "warning" | "critical";
    message: string;
    timestamp: string;
  }[];
}

// Sample data for development
const sampleMetrics: SystemMetrics = {
  uptime: 1209600, // 14 days in seconds
  memory: {
    total: 16384, // MB
    free: 8192,
    used: 8192,
    percentUsed: 50,
  },
  cpu: {
    usage: 35,
    cores: 8,
    loadAvg: [1.2, 1.5, 1.7],
  },
  disk: {
    total: 1024000, // MB
    free: 512000,
    used: 512000,
    percentUsed: 50,
  },
  network: {
    rx: 1500, // KB/s
    tx: 750,
    connections: 42,
  },
  services: [
    { name: "API Server", status: "healthy", responseTime: 120 },
    { name: "Database", status: "healthy", responseTime: 35 },
    { name: "Cache", status: "degraded", responseTime: 210 },
    { name: "Auth Service", status: "healthy", responseTime: 85 },
    { name: "File Storage", status: "healthy", responseTime: 150 },
  ],
  alerts: [
    {
      level: "warning",
      message: "High memory usage detected",
      timestamp: "2023-05-15T14:30:00Z",
    },
    {
      level: "info",
      message: "Scheduled maintenance in 24 hours",
      timestamp: "2023-05-15T12:00:00Z",
    },
    {
      level: "critical",
      message: "Cache service degraded performance",
      timestamp: "2023-05-15T13:45:00Z",
    },
  ],
};

export const MonitoringDashboard = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>(sampleMetrics);
  const { toast } = useToast();

  useEffect(() => {
    // In a real app, this would fetch from an API
    const fetchMetrics = async () => {
      try {
        // Mock API call
        // const response = await fetch('/api/system/metrics');
        // const data = await response.json();
        // setMetrics(data);

        // For demo, we'll use sample data with slight variations
        setMetrics((prevMetrics) => ({
          ...prevMetrics,
          cpu: {
            ...prevMetrics.cpu,
            usage: Math.min(
              100,
              Math.max(10, prevMetrics.cpu.usage + (Math.random() * 10 - 5)),
            ),
            loadAvg: prevMetrics.cpu.loadAvg.map((load) =>
              Math.max(0.1, load + (Math.random() * 0.4 - 0.2)),
            ),
          },
        }));
      } catch (error) {
        toast({
          title: "Error fetching metrics",
          description:
            "Could not retrieve system metrics. Please try again later.",
          variant: "destructive",
        });
      }
    };

    // Update metrics every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [toast]);

  // Format uptime from seconds to days, hours, minutes
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">System Monitoring Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">System Uptime</h3>
          <p className="text-2xl font-bold">{formatUptime(metrics.uptime)}</p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">CPU Usage</h3>
          <p className="text-2xl font-bold">{metrics.cpu.usage.toFixed(1)}%</p>
          <p className="text-sm text-gray-500">{metrics.cpu.cores} cores</p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Memory Usage</h3>
          <p className="text-2xl font-bold">{metrics.memory.percentUsed}%</p>
          <p className="text-sm text-gray-500">
            {(metrics.memory.used / 1024).toFixed(1)} GB /{" "}
            {(metrics.memory.total / 1024).toFixed(1)} GB
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Disk Usage</h3>
          <p className="text-2xl font-bold">{metrics.disk.percentUsed}%</p>
          <p className="text-sm text-gray-500">
            {(metrics.disk.used / 1024).toFixed(1)} GB /{" "}
            {(metrics.disk.total / 1024).toFixed(1)} GB
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Load */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">System Load</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={metrics.cpu.loadAvg.map((load: number, i: number) => ({
                name: `${i * 5}min`,
                value: load,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Service Response Times */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Service Response Times (ms)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.services}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="responseTime" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Services Status */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Services Status</h3>
        <div className="space-y-2">
          {metrics.services.map((service, index) => (
            <div
              key={index}
              className="flex justify-between items-center border-b pb-2"
            >
              <span>{service.name}</span>
              <div className="flex items-center">
                <span className="mr-2">{service.responseTime}ms</span>
                <Badge
                  className={
                    service.status === "healthy"
                      ? "bg-green-500"
                      : service.status === "degraded"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }
                >
                  {service.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Alerts */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Recent Alerts</h3>
        <div className="space-y-3">
          {metrics.alerts.map((alert, index) => (
            <div
              key={index}
              className="flex items-start space-x-3 border-b pb-3"
            >
              <Badge
                className={
                  alert.level === "info"
                    ? "bg-blue-500"
                    : alert.level === "warning"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }
              >
                {alert.level}
              </Badge>
              <div>
                <p>{alert.message}</p>
                <p className="text-sm text-gray-500">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
