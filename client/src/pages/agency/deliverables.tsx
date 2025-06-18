import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Download,
  Calendar,
  Building2,
  Filter,
  Search,
  FileType,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { useToast } from "../../components/ui/use-toast";
import { format } from "date-fns";
import { useAuth } from "../../hooks/useAuth";

interface Deliverable {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  processing_completed_at?: string;
  tasks: {
    id: string;
    type: string;
    status: string;
    dealerships: {
      id: string;
      name: string;
    };
  };
}

export default function AgencyDeliverables() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDealership, setFilterDealership] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();

  // For now, use a placeholder agency ID - in production this would come from user context
  const agencyId = user?.agency_id || "placeholder-agency-id";

  // Fetch deliverables
  const { data: deliverables = [], isLoading, error } = useQuery({
    queryKey: ['agency-deliverables', agencyId],
    queryFn: async () => {
      const response = await fetch(`/api/deliverables/agency/${agencyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch deliverables');
      const result = await response.json();
      return result.deliverables;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Download deliverable
  const handleDownload = async (deliverableId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/deliverables/${deliverableId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const result = await response.json();
      
      // Open download URL in new tab
      window.open(result.downloadUrl, '_blank');
      
      toast({
        title: "Download Started",
        description: `Downloading ${fileName}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download file. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter deliverables
  const filteredDeliverables = deliverables.filter((deliverable: Deliverable) => {
    const matchesSearch = !searchTerm || 
      deliverable.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deliverable.tasks.dealerships.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "all" || deliverable.file_type === filterType;
    
    const matchesDealership = filterDealership === "all" || 
      deliverable.tasks.dealerships.id === filterDealership;
    
    return matchesSearch && matchesType && matchesDealership;
  });

  // Get unique dealerships for filter
  const dealerships = Array.from(new Set(
    deliverables.map((d: Deliverable) => JSON.stringify({
      id: d.tasks.dealerships.id,
      name: d.tasks.dealerships.name
    }))
  )).map(d => JSON.parse(d));

  // Get unique file types
  const fileTypes = Array.from(new Set(deliverables.map((d: Deliverable) => d.file_type)));

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get file type icon
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'html':
      case 'htm':
        return <FileType className="h-5 w-5 text-blue-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load deliverables. Please try again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deliverables</h1>
        <p className="text-muted-foreground">
          Download completed SEO deliverables for your dealerships
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliverables.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready to Download
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {deliverables.filter((d: Deliverable) => d.processing_status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {deliverables.filter((d: Deliverable) => d.processing_status === 'processing').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dealerships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealerships.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files or dealerships..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">File Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                {fileTypes.map(type => (
                  <option key={type} value={type}>{type.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Dealership</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={filterDealership}
                onChange={(e) => setFilterDealership(e.target.value)}
              >
                <option value="all">All Dealerships</option>
                {dealerships.map((dealership: any) => (
                  <option key={dealership.id} value={dealership.id}>
                    {dealership.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliverables List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Deliverables</CardTitle>
          <CardDescription>
            {filteredDeliverables.length} deliverable{filteredDeliverables.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredDeliverables.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No deliverables found matching your filters
              </div>
            ) : (
              filteredDeliverables.map((deliverable: Deliverable) => (
                <div
                  key={deliverable.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getFileIcon(deliverable.file_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{deliverable.file_name}</span>
                        {getStatusBadge(deliverable.processing_status)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <Building2 className="h-3 w-3 inline mr-1" />
                        {deliverable.tasks.dealerships.name}
                        <span className="mx-2">•</span>
                        {formatFileSize(deliverable.file_size)}
                        <span className="mx-2">•</span>
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {format(new Date(deliverable.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deliverable.processing_status === 'completed' ? (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(deliverable.id, deliverable.file_name)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    ) : (
                      <Button size="sm" disabled variant="outline">
                        {deliverable.processing_status === 'processing' ? 'Processing...' : 'Unavailable'}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}