import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  RefreshCw,
  Filter,
  Search,
  Package
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { useToast } from "../../hooks/use-toast";
import { format } from "date-fns";

interface OnboardingSubmission {
  id: string;
  business_name: string;
  website_url: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  contact_name: string;
  contact_title: string;
  billing_email: string;
  package: 'PLATINUM' | 'GOLD' | 'SILVER';
  main_brand: string;
  other_brand?: string;
  target_vehicle_models: string[];
  target_cities: string[];
  target_dealers: string[];
  site_access_notes: string;
  google_business_profile_access: boolean;
  google_analytics_access: boolean;
  submission_status: 'pending' | 'submitted' | 'failed' | 'processed';
  seoworks_submission_id?: string;
  seoworks_submission_date?: string;
  seoworks_error?: string;
  created_at: string;
  updated_at: string;
  ip_address?: string;
  user_agent?: string;
  admin_notes?: string;
  processed_by?: string;
  processed_at?: string;
}

export default function SEOWerksOnboardingAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<OnboardingSubmission | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  // Fetch onboarding submissions
  const { data: submissions, isLoading, error, refetch } = useQuery({
    queryKey: ['seoworks-onboarding-submissions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/seoworks-onboarding', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch submissions');
      return response.json();
    },
  });

  // Filter submissions based on search and filters
  const filteredSubmissions = submissions?.filter((submission: OnboardingSubmission) => {
    const matchesSearch = searchTerm === "" || 
      submission.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.contact_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || submission.submission_status === statusFilter;
    const matchesPackage = packageFilter === "all" || submission.package === packageFilter;
    
    return matchesSearch && matchesStatus && matchesPackage;
  });

  // Count submissions by status
  const statusCounts = {
    total: submissions?.length || 0,
    pending: submissions?.filter((s: OnboardingSubmission) => s.submission_status === 'pending').length || 0,
    submitted: submissions?.filter((s: OnboardingSubmission) => s.submission_status === 'submitted').length || 0,
    failed: submissions?.filter((s: OnboardingSubmission) => s.submission_status === 'failed').length || 0,
    processed: submissions?.filter((s: OnboardingSubmission) => s.submission_status === 'processed').length || 0,
  };

  const handleRetrySubmission = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/seoworks-onboarding/${id}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to retry submission');
      
      toast({
        title: "Submission Retried",
        description: "The submission has been queued for retry.",
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retry submission",
        variant: "destructive",
      });
    }
  };

  const handleMarkProcessed = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/seoworks-onboarding/${id}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to mark as processed');
      
      toast({
        title: "Marked as Processed",
        description: "The submission has been marked as processed.",
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update submission",
        variant: "destructive",
      });
    }
  };

  const exportSubmissions = () => {
    const csv = [
      ['Business Name', 'Package', 'Email', 'Phone', 'Status', 'Created At'],
      ...filteredSubmissions.map((s: OnboardingSubmission) => [
        s.business_name,
        s.package,
        s.email,
        s.phone,
        s.submission_status,
        format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seoworks-onboarding-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'submitted':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'processed':
        return <Badge className="bg-blue-600"><CheckCircle className="h-3 w-3 mr-1" />Processed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPackageBadge = (pkg: string) => {
    switch (pkg) {
      case 'PLATINUM':
        return <Badge className="bg-purple-600"><Package className="h-3 w-3 mr-1" />{pkg}</Badge>;
      case 'GOLD':
        return <Badge className="bg-yellow-600"><Package className="h-3 w-3 mr-1" />{pkg}</Badge>;
      case 'SILVER':
        return <Badge className="bg-gray-600"><Package className="h-3 w-3 mr-1" />{pkg}</Badge>;
      default:
        return <Badge>{pkg}</Badge>;
    }
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
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load onboarding submissions</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEOWerks Onboarding</h1>
          <p className="text-muted-foreground">Manage dealership onboarding submissions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportSubmissions}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statusCounts.processed}</div>
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by business name, email, or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="failed">Failed</option>
                <option value="processed">Processed</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Package</label>
              <select 
                value={packageFilter} 
                onChange={(e) => setPackageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Packages</option>
                <option value="PLATINUM">Platinum</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>
            {filteredSubmissions?.length || 0} submissions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Business</th>
                  <th className="text-left p-2">Contact</th>
                  <th className="text-left p-2">Package</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Submitted</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions?.map((submission: OnboardingSubmission) => (
                  <tr key={submission.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{submission.business_name}</div>
                        <div className="text-sm text-muted-foreground">{submission.website_url}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div>
                        <div className="text-sm">{submission.contact_name}</div>
                        <div className="text-sm text-muted-foreground">{submission.email}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      {getPackageBadge(submission.package)}
                    </td>
                    <td className="p-2">
                      {getStatusBadge(submission.submission_status)}
                    </td>
                    <td className="p-2">
                      <div className="text-sm">
                        {format(new Date(submission.created_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(submission.created_at), 'h:mm a')}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSubmission(submission);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {submission.submission_status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetrySubmission(submission.id)}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                        {submission.submission_status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkProcessed(submission.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboarding Submission Details</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Business Information</h3>
                  <dl className="space-y-1 text-sm">
                    <div>
                      <dt className="font-medium text-muted-foreground">Business Name</dt>
                      <dd>{selectedSubmission.business_name}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-muted-foreground">Website</dt>
                      <dd><a href={selectedSubmission.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{selectedSubmission.website_url}</a></dd>
                    </div>
                    <div>
                      <dt className="font-medium text-muted-foreground">Address</dt>
                      <dd>{selectedSubmission.address}<br />{selectedSubmission.city}, {selectedSubmission.state} {selectedSubmission.zip_code}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Contact Information</h3>
                  <dl className="space-y-1 text-sm">
                    <div>
                      <dt className="font-medium text-muted-foreground">Contact Name</dt>
                      <dd>{selectedSubmission.contact_name} ({selectedSubmission.contact_title})</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-muted-foreground">Email</dt>
                      <dd><a href={`mailto:${selectedSubmission.email}`} className="text-blue-600 hover:underline">{selectedSubmission.email}</a></dd>
                    </div>
                    <div>
                      <dt className="font-medium text-muted-foreground">Phone</dt>
                      <dd>{selectedSubmission.phone}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-muted-foreground">Billing Email</dt>
                      <dd>{selectedSubmission.billing_email}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">SEO Package & Targets</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-muted-foreground">Package</dt>
                    <dd>{getPackageBadge(selectedSubmission.package)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Main Brand</dt>
                    <dd>{selectedSubmission.main_brand} {selectedSubmission.other_brand && `(${selectedSubmission.other_brand})`}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Target Vehicle Models</dt>
                    <dd>{selectedSubmission.target_vehicle_models.join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Target Cities</dt>
                    <dd>{selectedSubmission.target_cities.join(', ')}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Target Dealers</dt>
                    <dd>{selectedSubmission.target_dealers.join(', ')}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Submission Status</h3>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="font-medium text-muted-foreground">Status</dt>
                    <dd>{getStatusBadge(selectedSubmission.submission_status)}</dd>
                  </div>
                  {selectedSubmission.seoworks_submission_date && (
                    <div>
                      <dt className="font-medium text-muted-foreground">SEOWerks Submission Date</dt>
                      <dd>{format(new Date(selectedSubmission.seoworks_submission_date), 'PPpp')}</dd>
                    </div>
                  )}
                  {selectedSubmission.seoworks_error && (
                    <div>
                      <dt className="font-medium text-muted-foreground">Error</dt>
                      <dd className="text-red-600">{selectedSubmission.seoworks_error}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {selectedSubmission.site_access_notes && (
                <div>
                  <h3 className="font-semibold mb-2">Site Access Notes</h3>
                  <p className="text-sm">{selectedSubmission.site_access_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}