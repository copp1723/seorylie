import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays, format } from "date-fns";
import { RefreshCw, Download, Calendar, Eye, Users, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { useToast } from "../../components/ui/use-toast";
import { RealTimeTraffic } from "../../components/dashboard/RealTimeTraffic";
import { MetricCardWithSparkline } from "../../components/dashboard/MetricCardWithSparkline";
import { GeographicTraffic } from "../../components/dashboard/GeographicTraffic";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell
} from "recharts";

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
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function EnhancedAnalyticsPage() {
  const [dateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date()
  });
  const [selectedProperty, setSelectedProperty] = useState('493777160'); // Updated property ID
  const { toast } = useToast();

  // Fetch analytics data
  const { data: analyticsData, isPending, error, refetch } = useQuery({
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

  // Calculate sparkline data from daily metrics
  const getSparklineData = (metric: 'sessions' | 'users' | 'pageviews' | 'conversions') => {
    if (!analyticsData?.dailyMetrics) return [];
    return analyticsData.dailyMetrics
      .slice(-7) // Last 7 days
      .map(day => ({ value: day[metric] as number }));
  };

  // Calculate metric change
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Get trend based on change
  const getTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  // Calculate conversion rate
  const getConversionRate = () => {
    if (!analyticsData || analyticsData.summary.sessions === 0) return 0;
    return (analyticsData.summary.conversions / analyticsData.summary.sessions) * 100;
  };

  // Get traffic source distribution for pie chart
  const getTrafficSourceDistribution = () => {
    if (!analyticsData?.trafficSources) return [];
    
    const totalSessions = analyticsData.trafficSources.reduce((sum, source) => sum + source.sessions, 0);
    
    return analyticsData.trafficSources.map((source) => ({
      name: `${source.source} / ${source.medium}`,
      value: source.sessions,
      percentage: ((source.sessions / totalSessions) * 100).toFixed(1)
    }));
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        propertyId: selectedProperty,
        startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
        endDate: format(dateRange.endDate, 'yyyy-MM-dd'),
        format: 'csv'
      });

      const response = await fetch(`/api/ga4/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${format(dateRange.startDate, 'yyyy-MM-dd')}-${format(dateRange.endDate, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Your analytics report has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data.",
        variant: "destructive"
      });
    }
  };

  if (isPending) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enhanced Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
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
                  <option value="493777160">Jay Hatfield Chevrolet (493777160)</option>
                  <option value="320759942">Property 2 (320759942)</option>
                  <option value="317592148">Property 3 (317592148)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date Range</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(dateRange.startDate, 'MMM d')} - {format(dateRange.endDate, 'MMM d, yyyy')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Metrics and Real-time */}
        <div className="space-y-6">
          {/* Enhanced Metric Cards */}
          <div className="space-y-4">
            <MetricCardWithSparkline
              title="Total Sessions"
              value={analyticsData?.summary.sessions || 0}
              change={calculateChange(
                analyticsData?.summary.sessions || 0,
                analyticsData?.comparison.sessions || 0
              )}
              changeLabel="vs previous period"
              icon={<Eye className="h-4 w-4" />}
              trend={getTrend(
                analyticsData?.summary.sessions || 0,
                analyticsData?.comparison.sessions || 0
              )}
              sparklineData={getSparklineData('sessions')}
            />
            
            <MetricCardWithSparkline
              title="Unique Users"
              value={analyticsData?.summary.users || 0}
              change={calculateChange(
                analyticsData?.summary.users || 0,
                analyticsData?.comparison.users || 0
              )}
              changeLabel="vs previous period"
              icon={<Users className="h-4 w-4" />}
              trend={getTrend(
                analyticsData?.summary.users || 0,
                analyticsData?.comparison.users || 0
              )}
              sparklineData={getSparklineData('users')}
            />

            <MetricCardWithSparkline
              title="Conversion Rate"
              value={getConversionRate()}
              format="percentage"
              change={calculateChange(
                analyticsData?.summary.conversions || 0,
                analyticsData?.comparison.conversions || 0
              )}
              changeLabel="vs previous period"
              icon={<Target className="h-4 w-4" />}
              trend={getTrend(
                analyticsData?.summary.conversions || 0,
                analyticsData?.comparison.conversions || 0
              )}
              sparklineData={getSparklineData('conversions')}
            />

            <MetricCardWithSparkline
              title="Avg. Session Duration"
              value={analyticsData?.summary.avgSessionDuration || 0}
              format="duration"
              icon={<TrendingUp className="h-4 w-4" />}
              trend="neutral"
            />
          </div>

          {/* Real-time Traffic Widget */}
          <RealTimeTraffic propertyId={selectedProperty} />
        </div>

        {/* Right Column - Charts and Geographic */}
        <div className="lg:col-span-2 space-y-6">
          {/* Traffic Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic & Conversion Trends</CardTitle>
              <CardDescription>Sessions, users, and conversions over time</CardDescription>
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
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                    />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="sessions" 
                      stroke="#4F46E5" 
                      fill="#4F46E5" 
                      fillOpacity={0.3}
                      name="Sessions"
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="users" 
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.3}
                      name="Users"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="conversions" 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      name="Conversions"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Geographic Distribution */}
          <GeographicTraffic 
            propertyId={selectedProperty} 
            dateRange={dateRange} 
          />

          {/* Traffic Sources Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic Source Distribution</CardTitle>
              <CardDescription>Where your visitors come from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getTrafficSourceDistribution()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getTrafficSourceDistribution().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Pages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Pages</CardTitle>
          <CardDescription>Pages with the highest engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Page</th>
                  <th className="text-right py-3 px-4">Page Views</th>
                  <th className="text-right py-3 px-4">Avg. Time</th>
                  <th className="text-right py-3 px-4">Bounce Rate</th>
                  <th className="text-right py-3 px-4">Trend</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData?.topPages.slice(0, 10).map((page, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{page.pageTitle || page.pagePath}</p>
                        <p className="text-sm text-muted-foreground">{page.pagePath}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">{page.pageviews.toLocaleString()}</td>
                    <td className="text-right py-3 px-4">
                      {Math.floor(page.avgTimeOnPage / 60)}m {page.avgTimeOnPage % 60}s
                    </td>
                    <td className="text-right py-3 px-4">{page.bounceRate.toFixed(1)}%</td>
                    <td className="text-right py-3 px-4">
                      <div className="inline-flex items-center">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}