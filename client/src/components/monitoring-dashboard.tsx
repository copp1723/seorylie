
import React from 'react';
import { Card } from './ui/card';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function MonitoringDashboard() {
  const { data: metrics, error } = useSWR('/api/metrics', fetcher, {
    refreshInterval: 1000
  });

  if (error) return <div>Failed to load metrics</div>;
  if (!metrics) return <div>Loading...</div>;

  return (
    <div className="grid gap-4 p-4">
      <h1 className="text-2xl font-bold mb-4">System Performance Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CPU Usage */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">CPU Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={[{ value: metrics.cpu.usage }]}>
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
              <CartesianGrid stroke="#ccc" />
              <XAxis />
              <YAxis />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Memory Usage */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Memory Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={[{
              used: metrics.memory.used,
              free: metrics.memory.free
            }]}>
              <Area type="monotone" dataKey="used" stackId="1" stroke="#8884d8" fill="#8884d8" />
              <Area type="monotone" dataKey="free" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
              <CartesianGrid stroke="#ccc" />
              <XAxis />
              <YAxis />
              <Tooltip />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Network Traffic */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Requests per Second</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{
              value: metrics.network.requestsPerSecond
            }]}>
              <Bar dataKey="value" fill="#8884d8" />
              <CartesianGrid stroke="#ccc" />
              <XAxis />
              <YAxis />
              <Tooltip />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Error Rates */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Error Rate</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={[{
              value: metrics.network.errorRate
            }]}>
              <Line type="monotone" dataKey="value" stroke="#ff0000" />
              <CartesianGrid stroke="#ccc" />
              <XAxis />
              <YAxis />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* System Load */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">System Load</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metrics.cpu.loadAvg.map((load, i) => ({ 
              name: `${i * 5}min`, value: load 
            }))}>
              <Line type="monotone" dataKey="value" stroke="#82ca9d" />
              <CartesianGrid stroke="#ccc" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Heap Usage */}
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Heap Memory</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={[{
              used: metrics.memory.heapUsed,
              total: metrics.memory.heapTotal
            }]}>
              <Area type="monotone" dataKey="used" stackId="1" stroke="#8884d8" fill="#8884d8" />
              <Area type="monotone" dataKey="total" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
              <CartesianGrid stroke="#ccc" />
              <XAxis />
              <YAxis />
              <Tooltip />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
