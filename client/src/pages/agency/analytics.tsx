import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Target,
  Search,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { useToast } from "../../components/ui/use-toast";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from "recharts";

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

interface AnalyticsData {
  summary: {
    sessions: number;
    users: number;
    pageviews: number;
    avgSessionDuration: number;
    bounceRate: number;
    conversions: number;
  };
  comparison: {
    sessions: number;
    users: number;
    pageviews: number;
    conversions: number;
  };
  dailyMetrics: Array<{
    date: string;
    sessions: number;
    users: number;
    pageviews: number;
    conversions: number;
  }>;
  topPages: Array<{
    pagePath: string;
    pageTitle: string;
    pageviews: number;
    avgTimeOnPage: number;
    bounceRate: number;
  }>;
  trafficSources: Array<{
    source: string;
    medium: string;
    sessions: number;
    users: number;
    conversions: number;
  }>;
  searchQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    position: number;
    ctr: number;
  }>;
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date()
  });
  const [selectedProperty, setSelectedProperty] = useState('320759942'); // Default to first property
  const { toast } = useToast();

  // Fetch analytics data
  const { data: analyticsData, isLoading, error, refetch } = useQuery({
    queryKey: ['analytics', selectedProperty, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: selectedProperty,
        startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
        endDate: format(dateRange.endDate, 'yyyy-MM-dd')
      });

      const response = await fetch(`/api/ga4/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      return response.json() as Promise<AnalyticsData>;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Calculate metric cards
  const getMetricCards = (): MetricCard[] => {
    if (!analyticsData) return [];

    const { summary, comparison } = analyticsData;
    
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return [
      {
        title: 'Total Sessions',
        value: summary.sessions.toLocaleString(),
        change: calculateChange(summary.sessions, comparison.sessions),
        changeLabel: 'vs previous period',
        icon: <Eye className="h-4 w-4" />,
        trend: summary.sessions > comparison.sessions ? 'up' : summary.sessions < comparison.sessions ? 'down' : 'neutral'
      },
      {
        title: 'Users',
        value: summary.users.toLocaleString(),
        change: calculateChange(summary.users, comparison.users),
        changeLabel: 'vs previous period',
        icon: <Users className="h-4 w-4" />,
        trend: summary.users > comparison.users ? 'up' : summary.users < comparison.users ? 'down' : 'neutral'
      },
      {
        title: 'Page Views',
        value: summary.pageviews.toLocaleString(),
        change: calculateChange(summary.pageviews, comparison.pageviews),
        changeLabel: 'vs previous period',
        icon: <BarChart3 className="h-4 w-4" />,
        trend: summary.pageviews > comparison.pageviews ? 'up' : summary.pageviews < comparison.pageviews ? 'down' : 'neutral'
      },
      {
        title: 'Conversions',
        value: summary.conversions.toLocaleString(),
        change: calculateChange(summary.conversions, comparison.conversions),
        changeLabel: 'vs previous period',
        icon: <Target className="h-4 w-4" />,
        trend: summary.conversions > comparison.conversions ? 'up' : summary.conversions < comparison.conversions ? 'down' : 'neutral'
      }
    ];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    toast({
      title: "Export Started",
      description: "Your analytics report is being generated.",
    });
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
          <AlertDescription>
            Failed to load analytics data. Please check your GA4 configuration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const metricCards = getMetricCards();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Performance metrics from Google Analytics 4
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

      {/* Property Selector and Date Range */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Property</label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="320759942">Property 1 (320759942)</option>
                  <option value="317592148">Property 2 (317592148)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date Range</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Last 30 Days
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                {metric.title}
                {metric.icon}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center text-sm mt-1">
                {metric.trend === 'up' ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                ) : metric.trend === 'down' ? (
                  <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                ) : (
                  <Minus className="h-4 w-4 text-gray-400 mr-1" />
                )}
                <span className={
                  metric.trend === 'up' ? 'text-green-600' : 
                  metric.trend === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }>
                  {Math.abs(metric.change).toFixed(1)}%
                </span>
                <span className="text-muted-foreground ml-1">{metric.changeLabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="traffic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="traffic">Traffic Overview</TabsTrigger>
          <TabsTrigger value="pages">Top Pages</TabsTrigger>
          <TabsTrigger value="sources">Traffic Sources</TabsTrigger>
          <TabsTrigger value="search">Search Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Trends</CardTitle>
              <CardDescription>Sessions and users over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData?.dailyMetrics || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="sessions" 
                      stroke="#4F46E5" 
                      fill="#4F46E5" 
                      fillOpacity={0.3}
                      name="Sessions"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.3}
                      name="Users"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most visited pages on your site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.topPages.map((page, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{page.pageTitle || page.pagePath}</p>
                      <p className="text-sm text-muted-foreground">{page.pagePath}</p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="font-medium">{page.pageviews.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Page Views</p>
                      </div>
                      <div>
                        <p className="font-medium">{formatDuration(page.avgTimeOnPage)}</p>
                        <p className="text-sm text-muted-foreground">Avg. Time</p>
                      </div>
                      <div>
                        <p className="font-medium">{page.bounceRate.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Bounce Rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
              <CardDescription>Where your visitors come from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData?.trafficSources || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sessions" fill="#4F46E5" name="Sessions" />
                    <Bar dataKey="conversions" fill="#10B981" name="Conversions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>Search Performance</CardTitle>
              <CardDescription>Keywords driving organic traffic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.searchQueries.map((query, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{query.query}</p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="font-medium">{query.impressions.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Impressions</p>
                      </div>
                      <div>
                        <p className="font-medium">{query.clicks.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Clicks</p>
                      </div>
                      <div>
                        <p className="font-medium">{query.position.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">Avg. Position</p>
                      </div>
                      <div>
                        <p className="font-medium">{(query.ctr * 100).toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">CTR</p>
                      </div>
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