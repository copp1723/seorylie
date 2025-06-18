import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Send,
  Calendar,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  Filter,
  Eye,
  Mail,
  Printer,
  Clock,
  CheckCircle,
  AlertCircle,
  Building2,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../components/ui/use-toast';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';

interface Report {
  id: string;
  type: 'monthly_performance' | 'client_report' | 'task_summary' | 'deliverable_report';
  title: string;
  description: string;
  dealership_id?: string;
  dealership_name?: string;
  date_range: {
    start: string;
    end: string;
  };
  status: 'generating' | 'ready' | 'sent';
  created_at: string;
  file_url?: string;
  metrics?: {
    tasks_completed?: number;
    content_created?: number;
    traffic_increase?: string;
    conversion_rate?: string;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  fields: string[];
}

export default function ReportsPage() {
  const [selectedDealership, setSelectedDealership] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['agency-reports', selectedDealership, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDealership !== 'all') params.append('dealership_id', selectedDealership);
      params.append('start_date', dateRange.start);
      params.append('end_date', dateRange.end);

      const response = await fetch(`/api/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    },
    placeholderData: [
      {
        id: 'r1',
        type: 'monthly_performance',
        title: 'March 2024 Performance Report',
        description: 'Monthly SEO performance summary for all dealerships',
        date_range: { start: '2024-03-01', end: '2024-03-31' },
        status: 'ready',
        created_at: '2024-04-01T09:00:00Z',
        file_url: '/reports/march-2024-performance.pdf',
        metrics: {
          tasks_completed: 47,
          content_created: 23,
          traffic_increase: '+18.5%',
          conversion_rate: '3.2%'
        }
      },
      {
        id: 'r2',
        type: 'client_report',
        title: 'AutoMax Dallas - Q1 2024 Report',
        description: 'Quarterly SEO performance report',
        dealership_id: '123',
        dealership_name: 'AutoMax Dallas',
        date_range: { start: '2024-01-01', end: '2024-03-31' },
        status: 'sent',
        created_at: '2024-04-02T10:30:00Z',
        file_url: '/reports/automax-q1-2024.pdf'
      }
    ]
  });

  // Fetch dealerships for filter
  const { data: dealerships = [] } = useQuery({
    queryKey: ['dealerships'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dealerships', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch dealerships');
      return response.json();
    },
    placeholderData: [
      { id: '123', name: 'AutoMax Dallas' },
      { id: '124', name: 'Premier Motors' },
      { id: '125', name: 'City Auto Group' }
    ]
  });

  // Report templates
  const reportTemplates: ReportTemplate[] = [
    {
      id: 'monthly_performance',
      name: 'Monthly Performance Report',
      description: 'Comprehensive monthly SEO performance metrics',
      type: 'monthly_performance',
      fields: ['traffic', 'conversions', 'content', 'rankings']
    },
    {
      id: 'client_report',
      name: 'Client Report',
      description: 'Detailed report for individual dealerships',
      type: 'client_report',
      fields: ['tasks', 'deliverables', 'performance', 'recommendations']
    },
    {
      id: 'task_summary',
      name: 'Task Summary Report',
      description: 'Summary of all tasks completed in period',
      type: 'task_summary',
      fields: ['task_list', 'completion_times', 'deliverables']
    },
    {
      id: 'deliverable_report',
      name: 'Deliverable Report',
      description: 'List of all content created and delivered',
      type: 'deliverable_report',
      fields: ['content_type', 'word_count', 'keywords', 'performance']
    }
  ];

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async ({ templateId, dealershipId }: { templateId: string; dealershipId?: string }) => {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          template_id: templateId,
          dealership_id: dealershipId,
          date_range: dateRange
        }),
      });

      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Report Generated',
        description: 'Your report has been generated successfully.',
      });
      setGeneratingReport(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate report. Please try again.',
        variant: 'destructive',
      });
      setGeneratingReport(null);
    },
  });

  // Send report mutation
  const sendReportMutation = useMutation({
    mutationFn: async ({ reportId, recipients }: { reportId: string; recipients: string[] }) => {
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ recipients }),
      });

      if (!response.ok) throw new Error('Failed to send report');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Report Sent',
        description: 'The report has been sent successfully.',
      });
    },
  });

  const handleGenerateReport = (templateId: string) => {
    setGeneratingReport(templateId);
    generateReportMutation.mutate({
      templateId,
      dealershipId: selectedDealership !== 'all' ? selectedDealership : undefined
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'generating': return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'sent': return <Mail className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  const recentReports = reports.slice(0, 5);
  const totalReports = reports.length;
  const sentReports = reports.filter(r => r.status === 'sent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and manage SEO performance reports
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate New Report</DialogTitle>
              <DialogDescription>
                Choose a report template and configure options
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {reportTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:border-primary"
                    onClick={() => handleGenerateReport(template.id)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {template.fields.map((field) => (
                          <Badge key={field} variant="secondary" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                      {generatingReport === template.id && (
                        <p className="text-sm text-blue-600 mt-2">
                          <Clock className="h-3 w-3 inline animate-spin mr-1" />
                          Generating...
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reports Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentReports}</div>
            <p className="text-xs text-muted-foreground mt-1">
              To clients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+24.3%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Traffic increase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">April 1</div>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly reports
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={selectedDealership} onValueChange={setSelectedDealership}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealerships</SelectItem>
                {dealerships.map((dealer) => (
                  <SelectItem key={dealer.id} value={dealer.id}>
                    {dealer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label htmlFor="start-date" className="text-sm">From:</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="end-date" className="text-sm">To:</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* All Reports */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>
                View and manage all generated reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportsLoading ? (
                  <p className="text-center py-8">Loading reports...</p>
                ) : reports.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No reports found for the selected criteria
                  </p>
                ) : (
                  reports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(report.status)}
                            <h3 className="font-medium">{report.title}</h3>
                            <Badge variant="outline">
                              {report.type.replace('_', ' ')}
                            </Badge>
                            {report.dealership_name && (
                              <Badge variant="secondary">
                                <Building2 className="h-3 w-3 mr-1" />
                                {report.dealership_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {report.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(report.date_range.start), 'MMM d')} - {format(new Date(report.date_range.end), 'MMM d, yyyy')}
                            </span>
                            <span>
                              Generated {format(new Date(report.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {report.metrics && (
                            <div className="flex gap-4 mt-3">
                              {report.metrics.tasks_completed && (
                                <div className="text-sm">
                                  <span className="font-medium">{report.metrics.tasks_completed}</span>
                                  <span className="text-muted-foreground"> tasks</span>
                                </div>
                              )}
                              {report.metrics.content_created && (
                                <div className="text-sm">
                                  <span className="font-medium">{report.metrics.content_created}</span>
                                  <span className="text-muted-foreground"> content pieces</span>
                                </div>
                              )}
                              {report.metrics.traffic_increase && (
                                <div className="text-sm">
                                  <span className="font-medium text-green-600">{report.metrics.traffic_increase}</span>
                                  <span className="text-muted-foreground"> traffic</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          {report.status === 'ready' && (
                            <>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button size="sm" variant="outline">
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm">
                                    <Send className="h-4 w-4 mr-1" />
                                    Send
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Send Report</DialogTitle>
                                    <DialogDescription>
                                      Enter email addresses to send this report
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                      <Label>Recipients</Label>
                                      <Textarea
                                        placeholder="email1@example.com, email2@example.com"
                                        rows={3}
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline">Cancel</Button>
                                      <Button onClick={() => {
                                        sendReportMutation.mutate({
                                          reportId: report.id,
                                          recipients: ['client@example.com']
                                        });
                                      }}>
                                        Send Report
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                          {report.status === 'sent' && (
                            <Button size="sm" variant="outline">
                              <Mail className="h-4 w-4 mr-1" />
                              Resend
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports */}
        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>
                Manage automated report generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Monthly Performance Report</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatically generated on the 1st of each month
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Weekly Task Summary</h3>
                      <p className="text-sm text-muted-foreground">
                        Sent every Monday at 9:00 AM
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Quarterly Client Reports</h3>
                      <p className="text-sm text-muted-foreground">
                        Generated at the end of each quarter
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Templates */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Report Templates</CardTitle>
              <CardDescription>
                Customize report templates and formats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {template.description}
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Include Metrics</span>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Include Charts</span>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Include Recommendations</span>
                          <Switch defaultChecked />
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline">Edit Template</Button>
                        <Button size="sm" variant="outline">Preview</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';