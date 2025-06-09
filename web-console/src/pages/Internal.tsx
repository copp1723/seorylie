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
  Search,
  Filter,
  MoreHorizontal,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";

interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'trial';
  plan: 'basic' | 'pro' | 'enterprise';
  joinDate: string;
  lastActive: string;
  requestsCount: number;
  monthlySpend: number;
}

interface SystemMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  change: number;
  icon: React.ComponentType<any>;
}

export default function Internal() {
  const { user } = useAuth();
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Role-based access control
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  // Mock system metrics
  const systemMetrics: SystemMetric[] = [
    {
      name: 'System Health',
      value: '98.9%',
      status: 'healthy',
      change: 0.2,
      icon: Activity
    },
    {
      name: 'Active Users',
      value: '1,247',
      status: 'healthy',
      change: 8.5,
      icon: Users
    },
    {
      name: 'API Response Time',
      value: '145ms',
      status: 'warning',
      change: 12.3,
      icon: Clock
    },
    {
      name: 'Database Load',
      value: '67%',
      status: 'healthy',
      change: -3.2,
      icon: Database
    },
    {
      name: 'AI Proxy Status',
      value: 'Operational',
      status: 'healthy',
      change: 0,
      icon: Server
    },
    {
      name: 'Error Rate',
      value: '0.12%',
      status: 'healthy',
      change: -0.05,
      icon: AlertTriangle
    }
  ];

  // Mock client data
  const [clients] = useState<Client[]>([
    {
      id: 'client_001',
      name: 'TechStart Solutions',
      email: 'admin@techstart.com',
      status: 'active',
      plan: 'pro',
      joinDate: '2024-11-15',
      lastActive: '2025-06-09T08:30:00Z',
      requestsCount: 24,
      monthlySpend: 1299
    },
    {
      id: 'client_002', 
      name: 'Local Retail Co',
      email: 'owner@localretail.com',
      status: 'active',
      plan: 'basic',
      joinDate: '2025-01-22',
      lastActive: '2025-06-08T15:45:00Z',
      requestsCount: 8,
      monthlySpend: 499
    },
    {
      id: 'client_003',
      name: 'Enterprise Corp',
      email: 'marketing@enterprise.com',
      status: 'trial',
      plan: 'enterprise',
      joinDate: '2025-06-01',
      lastActive: '2025-06-09T10:00:00Z',
      requestsCount: 12,
      monthlySpend: 0
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-700 bg-green-50 ring-green-600/20';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 ring-yellow-600/20';
      case 'critical':
        return 'text-red-700 bg-red-50 ring-red-600/20';
      case 'active':
        return 'text-green-700 bg-green-50 ring-green-600/20';
      case 'inactive':
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
      case 'trial':
        return 'text-blue-700 bg-blue-50 ring-blue-600/20';
      default:
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'system', label: 'System', icon: Server },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Internal Dashboard</h2>
          <p className="text-muted-foreground">
            System administration and client management
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <UserCheck className="h-4 w-4" />
            <span>Admin Access</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* System Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systemMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.value}</div>
                    <div className="flex items-center text-xs mt-1">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(metric.status)}`}>
                        {metric.status}
                      </span>
                      {metric.change !== 0 && (
                        <span className={`ml-2 ${metric.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {metric.change > 0 ? '+' : ''}{metric.change}%
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common administrative tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Client Accounts
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="mr-2 h-4 w-4" />
                  System Configuration
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Reports
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="mr-2 h-4 w-4" />
                  Security Audit
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest system events and client actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">New client registration</p>
                      <p className="text-xs text-muted-foreground">Enterprise Corp - 2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">System maintenance completed</p>
                      <p className="text-xs text-muted-foreground">Database optimization - 4 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">High API usage detected</p>
                      <p className="text-xs text-muted-foreground">TechStart Solutions - 6 hours ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          {/* Client Management Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Client Management</h3>
              <p className="text-muted-foreground">Monitor and manage client accounts</p>
            </div>
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Client</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          {/* Clients Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Plan</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Requests</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Monthly Spend</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Last Active</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-muted/50">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-foreground">{client.name}</p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(client.status)}`}>
                            {client.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium capitalize">{client.plan}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm">{client.requestsCount}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium">${client.monthlySpend}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-muted-foreground">
                            {new Date(client.lastActive).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-foreground">System Status</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Server Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Web Server</span>
                  </div>
                  <span className="text-sm text-green-600">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Database</span>
                  </div>
                  <span className="text-sm text-green-600">Operational</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">AI Service</span>
                  </div>
                  <span className="text-sm text-yellow-600">High Load</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU Usage</span>
                    <span>45%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>67%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '67%' }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Disk Usage</span>
                    <span>23%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '23%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-foreground">System Analytics</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Analytics charts would appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Revenue analytics would appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}