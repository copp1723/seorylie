import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useBranding } from "../contexts/BrandingContext";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { branding } = useBranding();
  const { user } = useAuth();

  // Mock data - in real app, fetch from API
  const stats = {
    totalRequests: 24,
    completedRequests: 18,
    pendingRequests: 6,
    averageCompletion: "2.3 days"
  };

  const recentRequests = [
    {
      id: "req_001",
      type: "Blog Post",
      title: "SEO Best Practices for 2025",
      status: "completed",
      createdAt: "2025-06-07T10:00:00Z",
      completedAt: "2025-06-08T15:30:00Z"
    },
    {
      id: "req_002", 
      type: "Page Creation",
      title: "New Service Landing Page",
      status: "in_progress",
      createdAt: "2025-06-08T09:15:00Z"
    },
    {
      id: "req_003",
      type: "Technical SEO",
      title: "Site Speed Optimization",
      status: "pending",
      createdAt: "2025-06-08T14:20:00Z"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-50 ring-green-600/20';
      case 'in_progress':
        return 'text-blue-700 bg-blue-50 ring-blue-600/20';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50 ring-yellow-600/20';
      default:
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="rounded-lg border border-border bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome back to {branding.companyName}! 👋
            </h2>
            <p className="mt-2 text-gray-600">
              Here's what's happening with your SEO projects today.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link to="/requests">
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Request</span>
              </Button>
            </Link>
            <Link to="/chat">
              <Button variant="outline" className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              +3 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedRequests}</div>
            <p className="text-xs text-muted-foreground">
              75% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">
              Average: {stats.averageCompletion}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">
              SEO score improvement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>
              Your latest SEO project submissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(request.status)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {request.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      {request.type} • {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(request.status)}`}>
                  {request.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            <div className="pt-2">
              <Link to="/requests">
                <Button variant="outline" className="w-full">
                  View All Requests
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to get you started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/requests">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Create New SEO Request
              </Button>
            </Link>
            
            <Link to="/chat">
              <Button variant="outline" className="w-full justify-start">
                <MessageSquare className="mr-2 h-4 w-4" />
                Start a Conversation
              </Button>
            </Link>
            
            <Link to="/reports">
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="mr-2 h-4 w-4" />
                View SEO Reports
              </Button>
            </Link>
            
            <Link to="/onboarding">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Update Business Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Tasks</CardTitle>
          <CardDescription>
            Scheduled SEO activities and deadlines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 rounded-lg border border-border p-4">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Weekly SEO Report</p>
                <p className="text-sm text-muted-foreground">Due in 2 days</p>
              </div>
              <Button size="sm" variant="outline">Review</Button>
            </div>
            
            <div className="flex items-center space-x-4 rounded-lg border border-border p-4">
              <Calendar className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Content Calendar Review</p>
                <p className="text-sm text-muted-foreground">Scheduled for Friday</p>
              </div>
              <Button size="sm" variant="outline">Preview</Button>
            </div>
          </div>
        </CardContent>
      </div>
    </div>
  );
}