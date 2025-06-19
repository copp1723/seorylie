import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Target,
  Activity,
  Zap,
  Award
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Progress } from "../../components/ui/progress";
import { useToast } from "../../components/ui/use-toast";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

interface PerformanceMetrics {
  overview: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    completionRate: number;
    avgCompletionTime: number;
    totalDeliverables: number;
    activeClients: number;
    clientSatisfaction: number;
  };
  taskBreakdown: {
    landingPages: { total: number; completed: number; avgTime: number };
    blogPosts: { total: number; completed: number; avgTime: number };
    gbpPosts: { total: number; completed: number; avgTime: number };
    maintenance: { total: number; completed: number; avgTime: number };
  };
  monthlyTrends: Array<{
    month: string;
    tasks: number;
    completed: number;
    deliverables: number;
    satisfaction: number;
  }>;
  packagePerformance: Array<{
    package: string;
    clients: number;
    tasks: number;
    completionRate: number;
    revenue: number;
  }>;
  clientMetrics: Array<{
    clientName: string;
    package: string;
    tasksCompleted: number;
    pendingTasks: number;
    satisfaction: number;
    lastActivity: string;
  }>;
  teamPerformance: Array<{
    member: string;
    tasksCompleted: number;
    avgCompletionTime: number;
    quality: number;
    efficiency: number;
  }>;
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AgencyPerformancePage() {
  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date())
  });
  const [selectedPackage, setSelectedPackage] = useState('all');
  const { toast } = useToast();

  // Fetch performance data
  const { data: performanceData, isLoading, error, refetch } = useQuery({
    queryKey: ['performance', dateRange, selectedPackage],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
        endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
        package: selectedPackage
      });

      const response = await fetch(`/api/agency/performance?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      return response.json() as Promise<PerformanceMetrics>;
    },
    // Mock data for development
    placeholderData: {
      overview: {
        totalTasks: 156,
        completedTasks: 142,
        inProgressTasks: 14,
        completionRate: 91,
        avgCompletionTime: 2.3,
        totalDeliverables: 284,
        activeClients: 23,
        clientSatisfaction: 4.7
      },
      taskBreakdown: {
        landingPages: { total: 45, completed: 42, avgTime: 3.2 },
        blogPosts: { total: 68, completed: 63, avgTime: 1.8 },
        gbpPosts: { total: 32, completed: 29, avgTime: 1.2 },
        maintenance: { total: 11, completed: 8, avgTime: 2.5 }
      },
      monthlyTrends: [
        { month: 'Jan', tasks: 42, completed: 38, deliverables: 76, satisfaction: 4.5 },
        { month: 'Feb', tasks: 48, completed: 45, deliverables: 90, satisfaction: 4.6 },
        { month: 'Mar', tasks: 56, completed: 52, deliverables: 104, satisfaction: 4.7 },
        { month: 'Apr', tasks: 62, completed: 59, deliverables: 118, satisfaction: 4.8 }
      ],
      packagePerformance: [
        { package: 'PLATINUM', clients: 5, tasks: 60, completionRate: 95, revenue: 25000 },
        { package: 'GOLD', clients: 10, tasks: 70, completionRate: 92, revenue: 30000 },
        { package: 'SILVER', clients: 8, tasks: 26, completionRate: 88, revenue: 12000 }
      ],
      clientMetrics: [
        { clientName: 'AutoMax Dallas', package: 'PLATINUM', tasksCompleted: 12, pendingTasks: 1, satisfaction: 4.9, lastActivity: '2 hours ago' },
        { clientName: 'Premier Motors', package: 'GOLD', tasksCompleted: 8, pendingTasks: 2, satisfaction: 4.7, lastActivity: '1 day ago' },
        { clientName: 'City Auto Group', package: 'GOLD', tasksCompleted: 10, pendingTasks: 0, satisfaction: 4.8, lastActivity: '3 hours ago' },
        { clientName: 'Valley Cars', package: 'SILVER', tasksCompleted: 5, pendingTasks: 1, satisfaction: 4.5, lastActivity: '2 days ago' }
      ],
      teamPerformance: [
        { member: 'SEOWerks Team A', tasksCompleted: 45, avgCompletionTime: 2.1, quality: 95, efficiency: 92 },
        { member: 'SEOWerks Team B', tasksCompleted: 38, avgCompletionTime: 2.4, quality: 93, efficiency: 88 },
        { member: 'SEOWerks Team C', tasksCompleted: 41, avgCompletionTime: 2.2, quality: 94, efficiency: 90 }
      ]
    }
  });

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getPackageColor = (pkg: string) => {
    switch (pkg) {
      case 'PLATINUM': return "bg-purple-100 text-purple-800";
      case 'GOLD': return "bg-yellow-100 text-yellow-800";
      case 'SILVER': return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your performance report is being generated.",
    });
    // TODO: Implement CSV export
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !performanceData) {
    return (
      <div className="p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg">Failed to load performance data</p>
        </div>
      </div>
    );
  }

  const { overview, taskBreakdown, monthlyTrends, packagePerformance, clientMetrics, teamPerformance } = performanceData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Track your agency's SEO performance and client satisfaction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Date Range</label>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  {format(dateRange.startDate, 'MMM d')} - {format(dateRange.endDate, 'MMM d, yyyy')}
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Package Filter</label>
                <select
                  value={selectedPackage}
                  onChange={(e) => setSelectedPackage(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="all">All Packages</option>
                  <option value="PLATINUM">Platinum</option>
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Task Completion
              <CheckCircle className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.completedTasks}/{overview.totalTasks}</div>
            <Progress value={overview.completionRate} className="mt-2" />
            <p className={`text-sm mt-1 ${getStatusColor(overview.completionRate)}`}>
              {overview.completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Active Clients
              <Users className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.activeClients}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {overview.inProgressTasks} tasks in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Avg Completion Time
              <Clock className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.avgCompletionTime} days</div>
            <p className="text-sm text-muted-foreground mt-1">
              Per task average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Client Satisfaction
              <Award className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.clientSatisfaction}/5.0</div>
            <div className="flex items-center mt-1">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`h-4 w-4 ${i < Math.floor(overview.clientSatisfaction) ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Task Analytics</TabsTrigger>
          <TabsTrigger value="packages">Package Performance</TabsTrigger>
          <TabsTrigger value="clients">Client Overview</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Breakdown by Type</CardTitle>
                <CardDescription>Distribution of tasks across different content types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Landing Pages</span>
                      <span className="text-sm text-muted-foreground">
                        {taskBreakdown.landingPages.completed}/{taskBreakdown.landingPages.total}
                      </span>
                    </div>
                    <Progress 
                      value={(taskBreakdown.landingPages.completed / taskBreakdown.landingPages.total) * 100} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Blog Posts</span>
                      <span className="text-sm text-muted-foreground">
                        {taskBreakdown.blogPosts.completed}/{taskBreakdown.blogPosts.total}
                      </span>
                    </div>
                    <Progress 
                      value={(taskBreakdown.blogPosts.completed / taskBreakdown.blogPosts.total) * 100} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">GBP Posts</span>
                      <span className="text-sm text-muted-foreground">
                        {taskBreakdown.gbpPosts.completed}/{taskBreakdown.gbpPosts.total}
                      </span>
                    </div>
                    <Progress 
                      value={(taskBreakdown.gbpPosts.completed / taskBreakdown.gbpPosts.total) * 100} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Maintenance</span>
                      <span className="text-sm text-muted-foreground">
                        {taskBreakdown.maintenance.completed}/{taskBreakdown.maintenance.total}
                      </span>
                    </div>
                    <Progress 
                      value={(taskBreakdown.maintenance.completed / taskBreakdown.maintenance.total) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance Trend</CardTitle>
                <CardDescription>Task completion and satisfaction over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="completed" 
                        stroke="#4F46E5" 
                        name="Completed Tasks"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="satisfaction" 
                        stroke="#10B981" 
                        name="Satisfaction"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="packages">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Package Distribution</CardTitle>
                <CardDescription>Revenue and task distribution by package</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={packagePerformance}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.package}: $${(entry.revenue / 1000).toFixed(0)}k`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {packagePerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Package Performance Metrics</CardTitle>
                <CardDescription>Detailed breakdown by package tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {packagePerformance.map((pkg, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={getPackageColor(pkg.package)}>
                          {pkg.package}
                        </Badge>
                        <span className="text-lg font-semibold">
                          ${(pkg.revenue / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Clients</p>
                          <p className="font-medium">{pkg.clients}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tasks</p>
                          <p className="font-medium">{pkg.tasks}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Completion</p>
                          <p className={`font-medium ${getStatusColor(pkg.completionRate)}`}>
                            {pkg.completionRate}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle>Client Performance Overview</CardTitle>
              <CardDescription>Track individual client metrics and satisfaction</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clientMetrics.map((client, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">{client.clientName}</p>
                        <Badge className={getPackageColor(client.package)} variant="secondary">
                          {client.package}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last activity: {client.lastActivity}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{client.tasksCompleted}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">{client.pendingTasks}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`h-4 w-4 ${i < Math.floor(client.satisfaction) ? 'text-yellow-400' : 'text-gray-300'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{client.satisfaction}/5.0</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>SEOWerks Team Performance</CardTitle>
              <CardDescription>Track team productivity and quality metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={teamPerformance}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="member" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Quality" dataKey="quality" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.6} />
                    <Radar name="Efficiency" dataKey="efficiency" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 space-y-3">
                {teamPerformance.map((member, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{member.member}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.tasksCompleted} tasks completed
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Avg time:</span>{' '}
                        <span className="font-medium">{member.avgCompletionTime} days</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}