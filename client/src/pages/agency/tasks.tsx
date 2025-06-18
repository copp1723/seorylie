import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  ListTodo,
  Plus,
  Search,
  Filter,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  MoreVertical,
  Calendar,
  User,
  Building2,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../components/ui/use-toast';
import { format } from 'date-fns';
import { useCDN } from '../../hooks/useCDN';

interface Task {
  id: string;
  task_type: 'landing_page' | 'blog_post' | 'gbp_post' | 'maintenance';
  title: string;
  description: string;
  status: 'requested' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dealership_id: string;
  dealership_name: string;
  dealership_package: 'PLATINUM' | 'GOLD' | 'SILVER';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  deliverables: Array<{
    id: string;
    file_url: string;
    file_type: string;
    created_at: string;
  }>;
  metadata?: {
    target_keywords?: string[];
    word_count?: number;
    target_url?: string;
  };
}

export default function TasksPage() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getDeliverableUrl } = useCDN();

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['agency-tasks', searchQuery, filterStatus, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('type', filterType);

      const response = await fetch(`/api/agency/tasks?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    placeholderData: [
      {
        id: '1',
        task_type: 'landing_page',
        title: 'Service Department Landing Page',
        description: 'Create optimized landing page for service department specials',
        status: 'in_progress',
        priority: 'high',
        dealership_id: '123',
        dealership_name: 'AutoMax Dallas',
        dealership_package: 'PLATINUM',
        assigned_to: 'SEOWerks Team A',
        created_at: '2024-03-18T10:00:00Z',
        updated_at: '2024-03-19T14:30:00Z',
        deliverables: [],
        metadata: {
          target_keywords: ['auto service', 'oil change', 'brake repair'],
          target_url: '/service'
        }
      },
      {
        id: '2',
        task_type: 'blog_post',
        title: 'Spring Maintenance Tips Blog Post',
        description: '1500-word blog post about spring car maintenance',
        status: 'review',
        priority: 'medium',
        dealership_id: '124',
        dealership_name: 'Premier Motors',
        dealership_package: 'GOLD',
        assigned_to: 'SEOWerks Team B',
        created_at: '2024-03-17T09:00:00Z',
        updated_at: '2024-03-19T16:00:00Z',
        deliverables: [
          {
            id: 'd1',
            file_url: '/deliverables/blog-spring-maintenance.docx',
            file_type: 'document',
            created_at: '2024-03-19T16:00:00Z'
          }
        ],
        metadata: {
          word_count: 1547,
          target_keywords: ['spring car care', 'vehicle maintenance', 'auto tips']
        }
      }
    ]
  });

  // Update task status mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      const response = await fetch(`/api/agency/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-tasks'] });
      toast({
        title: 'Task Updated',
        description: 'The task has been updated successfully.',
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'review': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'requested': return <FileText className="h-4 w-4 text-purple-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'requested': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'landing_page': return 'Landing Page';
      case 'blog_post': return 'Blog Post';
      case 'gbp_post': return 'GBP Post';
      case 'maintenance': return 'Maintenance';
      default: return type;
    }
  };

  const handleExportTasks = () => {
    toast({
      title: 'Exporting Tasks',
      description: 'Your task list is being exported to CSV.',
    });
  };

  const groupedTasks = {
    requested: tasks.filter(t => t.status === 'requested'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    review: tasks.filter(t => t.status === 'review'),
    completed: tasks.filter(t => t.status === 'completed')
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground">
            Manage SEO tasks across all your dealerships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportTasks}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setLocation('/seoworks-chat')}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks by title or dealership..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="requested">Requested</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Under Review</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Types</option>
              <option value="landing_page">Landing Pages</option>
              <option value="blog_post">Blog Posts</option>
              <option value="gbp_post">GBP Posts</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Task Views */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Tasks ({tasks.length})</CardTitle>
              <CardDescription>
                Click on a task to view details and deliverables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <p className="text-center py-8">Loading tasks...</p>
                ) : tasks.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No tasks found</p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(task.status)}
                            <h3 className="font-medium">{task.title}</h3>
                            <Badge className={getStatusColor(task.status)}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            <Badge variant="outline">
                              {getTaskTypeLabel(task.task_type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {task.dealership_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.created_at), 'MMM d, yyyy')}
                            </span>
                            {task.assigned_to && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.assigned_to}
                              </span>
                            )}
                            {task.deliverables.length > 0 && (
                              <span className="flex items-center gap-1 text-green-600">
                                <FileText className="h-3 w-3" />
                                {task.deliverables.length} deliverable(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                              View Details
                            </DropdownMenuItem>
                            {task.status === 'requested' && (
                              <DropdownMenuItem onClick={() => {
                                updateTaskMutation.mutate({
                                  taskId: task.id,
                                  updates: { status: 'in_progress' }
                                });
                              }}>
                                Start Task
                              </DropdownMenuItem>
                            )}
                            {task.status === 'review' && (
                              <DropdownMenuItem onClick={() => {
                                updateTaskMutation.mutate({
                                  taskId: task.id,
                                  updates: { status: 'completed' }
                                });
                              }}>
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kanban View */}
        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(groupedTasks).map(([status, statusTasks]) => (
              <Card key={status}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {status.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                    <Badge variant="secondary">{statusTasks.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 border rounded-lg hover:shadow-sm cursor-pointer bg-white"
                        onClick={() => setSelectedTask(task)}
                      >
                        <h4 className="font-medium text-sm mb-1">{task.title}</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getPriorityColor(task.priority)} variant="secondary">
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getTaskTypeLabel(task.task_type)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {task.dealership_name}
                        </p>
                        {task.deliverables.length > 0 && (
                          <div className="mt-2 text-xs text-green-600">
                            <FileText className="h-3 w-3 inline mr-1" />
                            {task.deliverables.length} deliverable(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{selectedTask.title}</CardTitle>
                  <CardDescription>{selectedTask.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTask(null)}
                >
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Status</p>
                  <Badge className={getStatusColor(selectedTask.status)}>
                    {selectedTask.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Priority</p>
                  <Badge className={getPriorityColor(selectedTask.priority)}>
                    {selectedTask.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Type</p>
                  <p className="text-sm">{getTaskTypeLabel(selectedTask.task_type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Dealership</p>
                  <p className="text-sm">{selectedTask.dealership_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Created</p>
                  <p className="text-sm">
                    {format(new Date(selectedTask.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Last Updated</p>
                  <p className="text-sm">
                    {format(new Date(selectedTask.updated_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {selectedTask.metadata && (
                <div>
                  <p className="text-sm font-medium mb-2">Additional Details</p>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    {selectedTask.metadata.target_keywords && (
                      <p className="mb-1">
                        <strong>Target Keywords:</strong> {selectedTask.metadata.target_keywords.join(', ')}
                      </p>
                    )}
                    {selectedTask.metadata.word_count && (
                      <p className="mb-1">
                        <strong>Word Count:</strong> {selectedTask.metadata.word_count}
                      </p>
                    )}
                    {selectedTask.metadata.target_url && (
                      <p>
                        <strong>Target URL:</strong> {selectedTask.metadata.target_url}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedTask.deliverables.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Deliverables</p>
                  <div className="space-y-2">
                    {selectedTask.deliverables.map((deliverable) => (
                      <div key={deliverable.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{deliverable.file_type}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(deliverable.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(getDeliverableUrl(deliverable), '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
                {selectedTask.status === 'requested' && (
                  <Button onClick={() => {
                    updateTaskMutation.mutate({
                      taskId: selectedTask.id,
                      updates: { status: 'in_progress' }
                    });
                    setSelectedTask(null);
                  }}>
                    Start Task
                  </Button>
                )}
                {selectedTask.status === 'in_progress' && (
                  <Button onClick={() => {
                    updateTaskMutation.mutate({
                      taskId: selectedTask.id,
                      updates: { status: 'review' }
                    });
                    setSelectedTask(null);
                  }}>
                    Submit for Review
                  </Button>
                )}
                {selectedTask.status === 'review' && (
                  <Button onClick={() => {
                    updateTaskMutation.mutate({
                      taskId: selectedTask.id,
                      updates: { status: 'completed' }
                    });
                    setSelectedTask(null);
                  }}>
                    Mark Complete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}