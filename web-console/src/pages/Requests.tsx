import { useState } from "react";
import { 
  Plus, 
  FileText, 
  Edit3, 
  Globe, 
  Wrench, 
  MapPin,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { useBranding } from "../contexts/BrandingContext";

type RequestType = 'page' | 'blog' | 'gbp' | 'maintenance' | '';

interface SeoRequest {
  id: string;
  type: RequestType;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  createdAt: string;
  updatedAt: string;
  priority: 'low' | 'medium' | 'high';
}

export default function Requests() {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('list');
  const [requestType, setRequestType] = useState<RequestType>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { branding } = useBranding();

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    targetKeywords: '',
    additionalNotes: ''
  });

  // Mock data - replace with API calls
  const [requests, setRequests] = useState<SeoRequest[]>([
    {
      id: 'req_001',
      type: 'blog',
      title: 'SEO Best Practices for 2025',
      description: 'Comprehensive guide covering latest SEO trends and techniques',
      status: 'completed',
      createdAt: '2025-06-07T10:00:00Z',
      updatedAt: '2025-06-08T15:30:00Z',
      priority: 'high'
    },
    {
      id: 'req_002',
      type: 'page',
      title: 'New Service Landing Page',
      description: 'Create an optimized landing page for our new digital marketing service',
      status: 'in_progress',
      createdAt: '2025-06-08T09:15:00Z',
      updatedAt: '2025-06-08T11:20:00Z',
      priority: 'medium'
    },
    {
      id: 'req_003',
      type: 'maintenance',
      title: 'Site Speed Optimization',
      description: 'Improve page load times and Core Web Vitals scores',
      status: 'pending',
      createdAt: '2025-06-08T14:20:00Z',
      updatedAt: '2025-06-08T14:20:00Z',
      priority: 'high'
    }
  ]);

  const requestTypes = [
    { value: 'page', label: 'New Page', icon: Globe, description: 'Create a new optimized page' },
    { value: 'blog', label: 'Blog Post', icon: Edit3, description: 'Write SEO-optimized content' },
    { value: 'gbp', label: 'Google Business', icon: MapPin, description: 'Update Google Business Profile' },
    { value: 'maintenance', label: 'Technical SEO', icon: Wrench, description: 'Fix technical issues' }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'on_hold':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
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
      case 'on_hold':
        return 'text-red-700 bg-red-50 ring-red-600/20';
      default:
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-700 bg-red-50 ring-red-600/20';
      case 'medium':
        return 'text-yellow-700 bg-yellow-50 ring-yellow-600/20';
      case 'low':
        return 'text-green-700 bg-green-50 ring-green-600/20';
      default:
        return 'text-gray-700 bg-gray-50 ring-gray-600/20';
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestType || !formData.title || !formData.description) return;

    const newRequest: SeoRequest = {
      id: `req_${Date.now()}`,
      type: requestType,
      title: formData.title,
      description: formData.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: formData.priority as 'low' | 'medium' | 'high'
    };

    setRequests(prev => [newRequest, ...prev]);
    
    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      targetKeywords: '',
      additionalNotes: ''
    });
    setRequestType('');
    setActiveTab('list');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">SEO Requests</h2>
          <p className="text-muted-foreground">
            Manage your SEO projects and submissions
          </p>
        </div>
        <div className="flex space-x-3">
          <Button 
            onClick={() => setActiveTab('create')}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Request</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'list'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            All Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'create'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            Create New
          </button>
        </nav>
      </div>

      {activeTab === 'list' ? (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </Select>
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(request.status)}
                          <h3 className="text-lg font-semibold text-foreground">
                            {request.title}
                          </h3>
                        </div>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </div>
                      
                      <p className="text-muted-foreground mb-3">
                        {request.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <FileText className="h-4 w-4" />
                          <span className="capitalize">{request.type}</span>
                        </span>
                        <span>Created {new Date(request.createdAt).toLocaleDateString()}</span>
                        <span>Updated {new Date(request.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredRequests.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No requests found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filters' 
                      : 'Get started by creating your first SEO request'}
                  </p>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button onClick={() => setActiveTab('create')}>
                      Create Your First Request
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Request Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Choose Request Type</CardTitle>
              <CardDescription>
                Select the type of SEO work you need
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {requestTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setRequestType(type.value as RequestType)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        requestType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className={`h-6 w-6 mb-2 ${
                        requestType === type.value ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <h3 className="font-medium text-foreground">{type.label}</h3>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Request Form */}
          {requestType && (
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
                <CardDescription>
                  Provide details for your {requestTypes.find(t => t.value === requestType)?.label.toLowerCase()} request
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitRequest} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Title *
                      </label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Brief title for your request"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Priority
                      </label>
                      <Select
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Description *
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed description of what you need"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Target Keywords
                    </label>
                    <Input
                      value={formData.targetKeywords}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetKeywords: e.target.value }))}
                      placeholder="Keywords to target (comma-separated)"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Additional Notes
                    </label>
                    <Textarea
                      value={formData.additionalNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      placeholder="Any additional information or requirements"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setActiveTab('list');
                        setRequestType('');
                        setFormData({
                          title: '',
                          description: '',
                          priority: 'medium',
                          targetKeywords: '',
                          additionalNotes: ''
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      Submit Request
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}