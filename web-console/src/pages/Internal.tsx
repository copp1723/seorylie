import { useState } from "react";
import { 
  Users, 
  Shield, 
  Database, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Server,
  Settings,
  Eye,
  UserCheck,
  FileText,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useBranding } from "../contexts/BrandingContext";
import { useAuth } from "../contexts/AuthContext";

export default function Internal() {
  const [activeTab, setActiveTab] = useState('overview');
  const { branding } = useBranding();
  const { user } = useAuth();

  // Mock data for admin dashboard
  const systemStats = {
    totalClients: 847,
    activeProjects: 234,
    completedThisMonth: 156,
    systemUptime: '99.9%',
    apiCalls: 1247293,
    aiProxyStatus: 'operational'
  };

  const recentActivity = [
    {
      id: 1,
      type: 'new_client',
      message: 'New client onboarded: Tech Solutions Inc.',
      timestamp: '2025-06-09T10:30:00Z',
      severity: 'info'
    },
    {
      id: 2,
      type: 'ai_proxy',
      message: 'AI Proxy processed 1,247 anonymization requests',
      timestamp: '2025-06-09T09:15:00Z',
      severity: 'success'
    },
    {
      id: 3,
      type: 'system',
      message: 'Database backup completed successfully',
      timestamp: '2025-06-09T08:00:00Z',
      severity: 'success'
    },
    {
      id: 4,
      type: 'alert',
      message: 'High API usage detected for client_892',
      timestamp: '2025-06-09T07:45:00Z',
      severity: 'warning'
    }
  ];

  const clientMetrics = [
    { tenantId: 'tenant_001', name: 'Tech Solutions Inc.', requests: 24, lastActive: '2 hours ago', status: 'active' },
    { tenantId: 'tenant_002', name: 'Digital Marketing Pro', requests: 18, lastActive: '5 hours ago', status: 'active' },
    { tenantId: 'tenant_003', name: 'Local Business Hub', requests: 31, lastActive: '1 day ago', status: 'active' },
    { tenantId: 'tenant_004', name: 'E-commerce Solutions', requests: 12, lastActive: '3 days ago', status: 'inactive' }
  ];

  const tabs = [
    { id: 'overview', label: 'System Overview', icon: Activity },
    { id: 'clients', label: 'Client Management', icon: Users },
    { id: 'ai-proxy', label: 'AI Proxy Monitoring', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'system', label: 'System Health', icon: Server }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'text-green-700 bg-green-50';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50';
      case 'error':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-blue-700 bg-blue-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  // Only show this page for admin users
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
            <p className="text-muted-foreground text-center">
              This area is restricted to administrators only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Internal Dashboard</h2>
          <p className="text-muted-foreground">
            {branding.companyName} Administrative Interface
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-muted-foreground">All Systems Operational</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* System Overview */}
          {activeTab === 'overview' && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemStats.totalClients}</div>
                    <p className="text-xs text-muted-foreground">+12% from last month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemStats.activeProjects}</div>
                    <p className="text-xs text-muted-foreground">Processing requests</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{systemStats.systemUptime}</div>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent System Activity</CardTitle>
                  <CardDescription>Latest events and alerts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        {getSeverityIcon(activity.severity)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getSeverityColor(activity.severity)}`}>
                          {activity.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Client Management */}
          {activeTab === 'clients' && (
            <Card>
              <CardHeader>
                <CardTitle>Client Overview</CardTitle>
                <CardDescription>Manage and monitor client accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clientMetrics.map((client) => (
                    <div key={client.tenantId} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{client.name}</h4>
                        <p className="text-sm text-muted-foreground">ID: {client.tenantId}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <span>{client.requests} requests</span>
                          <span className="text-muted-foreground">Last active: {client.lastActive}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                          client.status === 'active' 
                            ? 'text-green-700 bg-green-50 ring-green-600/20' 
                            : 'text-gray-700 bg-gray-50 ring-gray-600/20'
                        }`}>
                          {client.status}
                        </span>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Proxy Monitoring */}
          {activeTab === 'ai-proxy' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>AI Proxy Status</CardTitle>
                  <CardDescription>Monitor anonymization and request routing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-foreground mb-4">Current Status</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Proxy Status</span>
                          <span className="text-sm text-green-600 font-medium">Operational</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Anonymization</span>
                          <span className="text-sm text-green-600 font-medium">Active</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Audit Logging</span>
                          <span className="text-sm text-green-600 font-medium">Enabled</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Total Requests Today</span>
                          <span className="text-sm font-medium">1,247</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-4">Security Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">PII Exposures</span>
                          <span className="text-sm text-green-600 font-medium">0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Failed Anonymizations</span>
                          <span className="text-sm text-green-600 font-medium">0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Audit Log Entries</span>
                          <span className="text-sm font-medium">12,847</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Data Retention</span>
                          <span className="text-sm font-medium">90 days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Proxy Configuration</CardTitle>
                  <CardDescription>Manage AI proxy settings and rules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Anonymization Rules
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      View Audit Logs
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <UserCheck className="h-4 w-4 mr-2" />
                      Manage Access Controls
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Analytics */}
          {activeTab === 'analytics' && (
            <Card>
              <CardHeader>
                <CardTitle>System Analytics</CardTitle>
                <CardDescription>Performance metrics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Usage Statistics</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">API Requests (24h)</span>
                        <span className="text-sm font-medium">12,847</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Peak Concurrent Users</span>
                        <span className="text-sm font-medium">234</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Average Response Time</span>
                        <span className="text-sm font-medium">284ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Error Rate</span>
                        <span className="text-sm text-green-600 font-medium">0.03%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Growth Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">New Clients (30d)</span>
                        <span className="text-sm font-medium text-green-600">+47</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Churn Rate</span>
                        <span className="text-sm font-medium">2.1%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Avg. Projects per Client</span>
                        <span className="text-sm font-medium">3.2</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Revenue Growth</span>
                        <span className="text-sm font-medium text-green-600">+18.5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Health */}
          {activeTab === 'system' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Monitor infrastructure and services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-foreground">Services</h4>
                      {[
                        { name: 'API Gateway', status: 'healthy' },
                        { name: 'Database', status: 'healthy' },
                        { name: 'AI Proxy', status: 'healthy' },
                        { name: 'Redis Cache', status: 'healthy' },
                        { name: 'Email Service', status: 'healthy' }
                      ].map((service) => (
                        <div key={service.name} className="flex items-center justify-between">
                          <span className="text-sm">{service.name}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600">Healthy</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-medium text-foreground">Resources</h4>
                      {[
                        { name: 'CPU Usage', value: '23%', status: 'normal' },
                        { name: 'Memory Usage', value: '67%', status: 'normal' },
                        { name: 'Disk Usage', value: '45%', status: 'normal' },
                        { name: 'Network I/O', value: 'Normal', status: 'normal' }
                      ].map((resource) => (
                        <div key={resource.name} className="flex items-center justify-between">
                          <span className="text-sm">{resource.name}</span>
                          <span className="text-sm font-medium">{resource.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}