import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Inbox,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Calendar,
  Building2,
  TrendingUp,
  Filter,
  ArrowRight,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../components/ui/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface Request {
  id: string;
  type: 'landing_page' | 'blog_post' | 'gbp_post' | 'maintenance';
  title: string;
  description: string;
  dealership_id: string;
  dealership_name: string;
  dealership_package: 'PLATINUM' | 'GOLD' | 'SILVER';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  requested_by: string;
  metadata?: {
    urgency?: string;
    target_keywords?: string[];
    reference_url?: string;
  };
}

export default function RequestsPage() {
  const [location, setLocation] = useLocation();
  const [filterPackage, setFilterPackage] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch requests (using tasks with status 'requested' as requests)
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['agency-requests', filterPackage],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: 'requested'
      });
      if (filterPackage !== 'all') {
        params.append('package', filterPackage);
      }

      const response = await fetch(`/api/agency/tasks?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch requests');
      
      // Transform tasks into requests format
      const tasks = await response.json();
      return tasks.map((task: any) => ({
        id: task.id,
        type: task.task_type,
        title: task.title,
        description: task.description,
        dealership_id: task.dealership_id,
        dealership_name: task.dealership_name,
        dealership_package: task.dealership_package,
        priority: task.priority,
        status: 'pending',
        requested_at: task.created_at,
        requested_by: task.created_by || 'Chat Assistant',
        metadata: task.metadata
      }));
    },
    placeholderData: [
      {
        id: 'r1',
        type: 'landing_page',
        title: 'New Service Specials Landing Page',
        description: 'Need a landing page for our spring service specials campaign',
        dealership_id: '123',
        dealership_name: 'AutoMax Dallas',
        dealership_package: 'PLATINUM',
        priority: 'high',
        status: 'pending',
        requested_at: new Date().toISOString(),
        requested_by: 'John Smith',
        metadata: {
          urgency: 'Need by end of week',
          target_keywords: ['auto service specials', 'oil change deals'],
          reference_url: 'https://competitor.com/service-specials'
        }
      },
      {
        id: 'r2',
        type: 'blog_post',
        title: 'Electric Vehicle Maintenance Guide',
        description: 'Educational blog post about maintaining electric vehicles',
        dealership_id: '124',
        dealership_name: 'Premier Motors',
        dealership_package: 'GOLD',
        priority: 'medium',
        status: 'pending',
        requested_at: new Date(Date.now() - 86400000).toISOString(),
        requested_by: 'Sarah Johnson',
        metadata: {
          target_keywords: ['EV maintenance', 'electric car service']
        }
      }
    ]
  });

  // Accept request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/agency/requests/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to accept request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-requests'] });
      toast({
        title: 'Request Accepted',
        description: 'The task has been created and assigned.',
      });
    },
  });

  // Reject request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await fetch(`/api/agency/requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Failed to reject request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-requests'] });
      toast({
        title: 'Request Rejected',
        description: 'The request has been declined.',
      });
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'landing_page': return <FileText className="h-4 w-4" />;
      case 'blog_post': return <MessageSquare className="h-4 w-4" />;
      case 'gbp_post': return <Building2 className="h-4 w-4" />;
      case 'maintenance': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getPackageColor = (pkg: string) => {
    switch (pkg) {
      case 'PLATINUM': return 'bg-purple-100 text-purple-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const urgentRequests = pendingRequests.filter(r => r.priority === 'high');

  // Analytics
  const requestsByType = requests.reduce((acc, req) => {
    acc[req.type] = (acc[req.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const requestsByPackage = requests.reduce((acc, req) => {
    acc[req.dealership_package] = (acc[req.dealership_package] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEO Requests</h1>
          <p className="text-muted-foreground">
            Review and manage incoming work requests from dealerships
          </p>
        </div>
        <Button onClick={() => setLocation('/seoworks-chat')}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Chat Assistant
        </Button>
      </div>

      {/* Urgent Requests Alert */}
      {urgentRequests.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {urgentRequests.length} high-priority request{urgentRequests.length > 1 ? 's' : ''} waiting for approval
          </AlertDescription>
        </Alert>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Urgent Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              High priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium">Filter by package:</span>
            <select
              value={filterPackage}
              onChange={(e) => setFilterPackage(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Packages</option>
              <option value="PLATINUM">Platinum</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Pending Requests */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>
                Review and approve incoming SEO work requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <p className="text-center py-8">Loading requests...</p>
                ) : pendingRequests.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No pending requests
                  </p>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getTypeIcon(request.type)}
                            <h3 className="font-medium">{request.title}</h3>
                            <Badge className={getPackageColor(request.dealership_package)}>
                              {request.dealership_package}
                            </Badge>
                            {request.priority === 'high' && (
                              <Badge variant="destructive">Urgent</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {request.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {request.dealership_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                            </span>
                            <span>Requested by {request.requested_by}</span>
                          </div>
                          {request.metadata && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                              {request.metadata.urgency && (
                                <p className="text-red-600 font-medium mb-1">
                                  ⚡ {request.metadata.urgency}
                                </p>
                              )}
                              {request.metadata.target_keywords && (
                                <p className="text-gray-600">
                                  <strong>Keywords:</strong> {request.metadata.target_keywords.join(', ')}
                                </p>
                              )}
                              {request.metadata.reference_url && (
                                <p className="text-gray-600">
                                  <strong>Reference:</strong>{' '}
                                  <a href={request.metadata.reference_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    View example
                                  </a>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = prompt('Reason for rejection:');
                              if (reason) {
                                rejectRequestMutation.mutate({ requestId: request.id, reason });
                              }
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              acceptRequestMutation.mutate(request.id);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Requests by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(requestsByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(type)}
                        <span className="text-sm capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{count}</span>
                        <span className="text-sm text-muted-foreground">requests</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Requests by Package</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(requestsByPackage).map(([pkg, count]) => (
                    <div key={pkg} className="flex items-center justify-between">
                      <Badge className={getPackageColor(pkg)} variant="secondary">
                        {pkg}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{count}</span>
                        <span className="text-sm text-muted-foreground">requests</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Trends</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-32">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <span className="ml-2 text-2xl font-bold text-green-500">+23%</span>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Request volume is increasing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full justify-between" variant="outline">
                  View All Tasks
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button className="w-full justify-between" variant="outline">
                  Performance Report
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button className="w-full justify-between" variant="outline">
                  Team Workload
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}