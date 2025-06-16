import React from "react";
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
import { Link } from "wouter";

export default function SEODashboard() {
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

  const upcomingTasks = [
    { title: "Keyword Research Report", dueDate: "Jun 12", priority: "high" },
    { title: "Monthly Performance Review", dueDate: "Jun 15", priority: "medium" },
    { title: "Content Calendar Update", dueDate: "Jun 18", priority: "low" }
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
        return 'text-green-700 bg-green-50';
      case 'in_progress':
        return 'text-blue-700 bg-blue-50';
      case 'pending':
        return 'text-yellow-700 bg-yellow-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="space-y-8 p-8">
      {/* Welcome Section */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome to OneKeelSEO! 👋
            </h2>
            <p className="mt-2 text-gray-600">
              Here's what's happening with your SEO projects today.
            </p>
          </div>
          <div className="flex space-x-3">
            <Link href="/tasks">
              <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                <span>New Request</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold">{stats.totalRequests}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedRequests}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Completion</p>
              <p className="text-2xl font-bold">{stats.averageCompletion}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Requests */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-white">
            <div className="border-b p-6">
              <h3 className="text-lg font-semibold">Recent SEO Requests</h3>
              <p className="text-sm text-gray-600">Track your latest SEO tasks and their status</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(request.status)}
                      <div>
                        <h4 className="font-medium">{request.title}</h4>
                        <p className="text-sm text-gray-600">{request.type}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link href="/tasks">
                  <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800">
                    View all requests →
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="rounded-lg border bg-white">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold">Upcoming Tasks</h3>
            <p className="text-sm text-gray-600">Don't miss these deadlines</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {upcomingTasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-600">Due {task.dueDate}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
                    ${task.priority === 'high' ? 'bg-red-100 text-red-700' : 
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-green-100 text-green-700'}`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <button className="flex flex-col items-center space-y-2 p-4 rounded-lg border hover:bg-gray-50">
            <FileText className="h-8 w-8 text-blue-600" />
            <span className="text-sm font-medium">Create Blog Post</span>
          </button>
          <button className="flex flex-col items-center space-y-2 p-4 rounded-lg border hover:bg-gray-50">
            <BarChart3 className="h-8 w-8 text-green-600" />
            <span className="text-sm font-medium">View Analytics</span>
          </button>
          <button className="flex flex-col items-center space-y-2 p-4 rounded-lg border hover:bg-gray-50">
            <Users className="h-8 w-8 text-purple-600" />
            <span className="text-sm font-medium">Manage Clients</span>
          </button>
          <button className="flex flex-col items-center space-y-2 p-4 rounded-lg border hover:bg-gray-50">
            <MessageSquare className="h-8 w-8 text-orange-600" />
            <span className="text-sm font-medium">Support Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}