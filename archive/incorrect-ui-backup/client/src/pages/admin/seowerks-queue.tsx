import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  Calendar,
  User,
  FileText,
  Globe,
  Wrench,
  Upload,
  Download,
  RefreshCw,
  Filter,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { useToast } from "../../components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface QueueTask {
  id: string;
  task_type: 'landing_page' | 'blog_post' | 'gbp_post' | 'maintenance';
  status: 'submitted' | 'in_progress' | 'review';
  parameters: any;
  priority: 'high' | 'medium' | 'low';
  due_date?: string;
  created_at: string;
  claimed_by?: string;
  claimed_at?: string;
  claimed_by_email?: string;
  claimed_by_name?: string;
  agency_name: string;
  agency_logo?: string;
  dealership_name: string;
  dealership_website: string;
  dealership_package: 'PLATINUM' | 'GOLD' | 'SILVER';
}

interface TaskDetailsModalProps {
  task: QueueTask | null;
  isOpen: boolean;
  onClose: () => void;
  onClaim: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  isClaiming: boolean;
  isCompleting: boolean;
  currentUserId?: string;
}

function TaskDetailsModal({ 
  task, 
  isOpen, 
  onClose, 
  onClaim, 
  onComplete, 
  isClaiming, 
  isCompleting,
  currentUserId 
}: TaskDetailsModalProps) {
  if (!task) return null;

  const isClaimedByMe = task.claimed_by === currentUserId;
  const canClaim = task.status === 'submitted' && !task.claimed_by;
  const canComplete = isClaimedByMe && task.status === 'in_progress';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTaskIcon(task.task_type)}
            {getTaskTypeLabel(task.task_type)} Task
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Status and Priority */}
          <div className="flex items-center gap-4">
            <Badge variant={getStatusVariant(task.status)}>
              {task.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge variant={getPriorityVariant(task.priority)}>
              {task.priority.toUpperCase()} Priority
            </Badge>
            {getPackageBadge(task.dealership_package)}
          </div>

          {/* Agency and Dealership Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-600">Agency</p>
              <p className="font-medium">{task.agency_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Dealership</p>
              <p className="font-medium">{task.dealership_name}</p>
              <a href={task.dealership_website} target="_blank" rel="noopener noreferrer" 
                className="text-sm text-blue-600 hover:underline">
                {task.dealership_website}
              </a>
            </div>
          </div>

          {/* Task Details */}
          <div>
            <h4 className="font-medium mb-2">Task Details</h4>
            <div className="p-4 bg-gray-50 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(task.parameters, null, 2)}
              </pre>
            </div>
          </div>

          {/* Timing Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Created</p>
              <p className="text-sm">
                {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}
                <span className="text-gray-500 ml-1">
                  ({formatDistanceToNow(new Date(task.created_at), { addSuffix: true })})
                </span>
              </p>
            </div>
            {task.due_date && (
              <div>
                <p className="text-sm font-medium text-gray-600">Due Date</p>
                <p className="text-sm">
                  {format(new Date(task.due_date), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>

          {/* Claimed By Information */}
          {task.claimed_by && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                Claimed by {task.claimed_by_name || task.claimed_by_email} 
                {task.claimed_at && (
                  <span className="text-gray-500">
                    {' '}on {format(new Date(task.claimed_at), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canClaim && (
            <Button onClick={() => onClaim(task.id)} disabled={isClaiming}>
              {isClaiming ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <User className="h-4 w-4 mr-2" />
                  Claim Task
                </>
              )}
            </Button>
          )}
          {canComplete && (
            <Button onClick={() => onComplete(task.id)} disabled={isCompleting}>
              {isCompleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Marking Complete...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getTaskIcon(type: string) {
  switch (type) {
    case 'landing_page':
      return <FileText className="h-5 w-5" />;
    case 'blog_post':
      return <FileText className="h-5 w-5" />;
    case 'gbp_post':
      return <Globe className="h-5 w-5" />;
    case 'maintenance':
      return <Wrench className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
}

function getTaskTypeLabel(type: string) {
  switch (type) {
    case 'landing_page':
      return 'Landing Page';
    case 'blog_post':
      return 'Blog Post';
    case 'gbp_post':
      return 'Google Business Profile Post';
    case 'maintenance':
      return 'Maintenance';
    default:
      return type.replace('_', ' ').toUpperCase();
  }
}

function getStatusVariant(status: string): any {
  switch (status) {
    case 'submitted':
      return 'outline';
    case 'in_progress':
      return 'default';
    case 'review':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getPriorityVariant(priority: string): any {
  switch (priority) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getPackageBadge(pkg: string) {
  const colors = {
    PLATINUM: 'bg-purple-100 text-purple-800',
    GOLD: 'bg-yellow-100 text-yellow-800',
    SILVER: 'bg-gray-100 text-gray-800'
  };
  
  return (
    <Badge className={colors[pkg as keyof typeof colors] || 'bg-gray-100'}>
      <Package className="h-3 w-3 mr-1" />
      {pkg}
    </Badge>
  );
}

export default function SEOWerksQueueDashboard() {
  const [selectedTask, setSelectedTask] = useState<QueueTask | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock current user ID - in production this would come from auth context
  const currentUserId = 'current-user-id';

  // Fetch queue tasks
  const { data: tasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['seowerks-queue', filterStatus, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterType !== 'all') params.append('type', filterType);
      
      const response = await fetch(`/api/admin/seowerks-queue?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch queue');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Claim task mutation
  const claimTask = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/admin/seowerks-queue/${taskId}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to claim task');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Task Claimed",
        description: "You have successfully claimed this task.",
      });
      queryClient.invalidateQueries({ queryKey: ['seowerks-queue'] });
      setDetailsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to claim task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Complete task mutation
  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/admin/seowerks-queue/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to complete task');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Task Completed",
        description: "Task has been marked as complete.",
      });
      queryClient.invalidateQueries({ queryKey: ['seowerks-queue'] });
      setDetailsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter tasks based on search
  const filteredTasks = tasks.filter((task: QueueTask) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      task.dealership_name.toLowerCase().includes(search) ||
      task.agency_name.toLowerCase().includes(search) ||
      JSON.stringify(task.parameters).toLowerCase().includes(search)
    );
  });

  // Group tasks by status
  const tasksByStatus = {
    submitted: filteredTasks.filter((t: QueueTask) => t.status === 'submitted'),
    in_progress: filteredTasks.filter((t: QueueTask) => t.status === 'in_progress'),
    review: filteredTasks.filter((t: QueueTask) => t.status === 'review'),
  };

  // Count my tasks
  const myTasks = tasks.filter((t: QueueTask) => t.claimed_by === currentUserId);

  const openTaskDetails = (task: QueueTask) => {
    setSelectedTask(task);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load queue. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEOWerks Work Queue</h1>
          <p className="text-muted-foreground">
            Claim and complete tasks for dealerships
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasksByStatus.submitted.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {tasksByStatus.in_progress.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {tasksByStatus.review.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{myTasks.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <Input
                placeholder="Search by dealership, agency..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Task Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="landing_page">Landing Pages</option>
                <option value="blog_post">Blog Posts</option>
                <option value="gbp_post">GBP Posts</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Queue */}
      <div className="space-y-4">
        {/* Available Tasks */}
        {tasksByStatus.submitted.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Tasks</CardTitle>
              <CardDescription>Click to view details and claim</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasksByStatus.submitted.map((task: QueueTask) => (
                  <TaskRow key={task.id} task={task} onClick={() => openTaskDetails(task)} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Tasks */}
        {myTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>My Tasks</CardTitle>
              <CardDescription>Tasks you've claimed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myTasks.map((task: QueueTask) => (
                  <TaskRow key={task.id} task={task} onClick={() => openTaskDetails(task)} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All In Progress */}
        {tasksByStatus.in_progress.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>In Progress</CardTitle>
              <CardDescription>Tasks being worked on</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasksByStatus.in_progress.map((task: QueueTask) => (
                  <TaskRow key={task.id} task={task} onClick={() => openTaskDetails(task)} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Task Details Modal */}
      <TaskDetailsModal
        task={selectedTask}
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onClaim={(taskId) => claimTask.mutate(taskId)}
        onComplete={(taskId) => completeTask.mutate(taskId)}
        isClaiming={claimTask.isPending}
        isCompleting={completeTask.isPending}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function TaskRow({ task, onClick }: { task: QueueTask; onClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {getTaskIcon(task.task_type)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{getTaskTypeLabel(task.task_type)}</span>
            {getPackageBadge(task.dealership_package)}
            <Badge variant={getPriorityVariant(task.priority)}>
              {task.priority}
            </Badge>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {task.dealership_name} • {task.agency_name}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            {task.due_date && (
              <span> • Due {format(new Date(task.due_date), 'MMM d')}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {task.claimed_by && (
          <div className="text-sm text-gray-600">
            <User className="h-4 w-4 inline mr-1" />
            {task.claimed_by_name || task.claimed_by_email}
          </div>
        )}
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </div>
  );
}