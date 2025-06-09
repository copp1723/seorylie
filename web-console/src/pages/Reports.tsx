import { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Download, 
  Calendar,
  Eye,
  MousePointer,
  Search,
  Globe,
  Users,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { useBranding } from "../contexts/BrandingContext";

interface MetricData {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
}

interface RankingData {
  keyword: string;
  position: number;
  previousPosition: number;
  searchVolume: number;
  url: string;
}

export default function Reports() {
  const [dateRange, setDateRange] = useState('30d');
  const { branding } = useBranding();

  // Mock data - replace with real API calls
  const metrics: MetricData[] = [
    {
      label: 'Organic Traffic',
      value: '12,847',
      change: 12.5,
      trend: 'up',
      icon: Users
    },
    {
      label: 'Keyword Rankings',
      value: '284',
      change: 8.2,
      trend: 'up',
      icon: Search
    },
    {
      label: 'Page Views',
      value: '45,892',
      change: -2.1,
      trend: 'down',
      icon: Eye
    },
    {
      label: 'Click-through Rate',
      value: '3.2%',
      change: 0.8,
      trend: 'up',
      icon: MousePointer
    },
    {
      label: 'Average Position',
      value: '8.7',
      change: -1.3,
      trend: 'up',
      icon: TrendingUp
    },
    {
      label: 'Indexed Pages',
      value: '1,247',
      change: 0,
      trend: 'stable',
      icon: Globe
    }
  ];

  const topKeywords: RankingData[] = [
    {
      keyword: 'digital marketing services',
      position: 3,
      previousPosition: 5,
      searchVolume: 8900,
      url: '/services/digital-marketing'
    },
    {
      keyword: 'SEO optimization',
      position: 7,
      previousPosition: 12,
      searchVolume: 12400,
      url: '/services/seo'
    },
    {
      keyword: 'content marketing agency',
      position: 12,
      previousPosition: 8,
      searchVolume: 3200,
      url: '/services/content'
    },
    {
      keyword: 'local SEO services',
      position: 4,
      previousPosition: 4,
      searchVolume: 5600,
      url: '/services/local-seo'
    },
    {
      keyword: 'website optimization',
      position: 15,
      previousPosition: 18,
      searchVolume: 7800,
      url: '/services/optimization'
    }
  ];

  const topPages = [
    {
      url: '/services/digital-marketing',
      pageViews: 8420,
      change: 15.2,
      avgPosition: 4.3
    },
    {
      url: '/blog/seo-trends-2025',
      pageViews: 6180,
      change: 8.7,
      avgPosition: 6.1
    },
    {
      url: '/services/local-seo',
      pageViews: 4950,
      change: -3.2,
      avgPosition: 5.8
    },
    {
      url: '/case-studies/ecommerce-seo',
      pageViews: 3720,
      change: 22.4,
      avgPosition: 7.2
    }
  ];

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'stable') return <Minus className="h-4 w-4 text-gray-500" />;
    if (trend === 'up') return <ArrowUp className="h-4 w-4 text-green-500" />;
    return <ArrowDown className="h-4 w-4 text-red-500" />;
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'stable') return 'text-gray-600';
    if (trend === 'up') return 'text-green-600';
    return 'text-red-600';
  };

  const getPositionChange = (current: number, previous: number) => {
    const change = previous - current;
    if (change > 0) return { value: change, trend: 'up', text: `+${change}` };
    if (change < 0) return { value: Math.abs(change), trend: 'down', text: `-${Math.abs(change)}` };
    return { value: 0, trend: 'stable', text: '—' };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">SEO Reports</h2>
          <p className="text-muted-foreground">
            Track your website's search engine performance
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </Select>
          </div>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className={`flex items-center text-xs ${getTrendColor(metric.trend)}`}>
                  {getTrendIcon(metric.trend, metric.change)}
                  <span className="ml-1">
                    {metric.change !== 0 && `${metric.change > 0 ? '+' : ''}${metric.change}%`}
                    {metric.change === 0 && 'No change'}
                  </span>
                  <span className="ml-1 text-muted-foreground">vs last period</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Organic Traffic Trend</CardTitle>
            <CardDescription>
              Daily organic search traffic over the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Chart visualization would appear here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Integration with your analytics platform
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rankings Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Keyword Performance</CardTitle>
            <CardDescription>
              Average keyword positions over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Rankings chart would appear here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Connected to rank tracking tools
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Keywords */}
        <Card>
          <CardHeader>
            <CardTitle>Top Keywords</CardTitle>
            <CardDescription>
              Your best performing search terms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topKeywords.map((keyword, index) => {
                const positionChange = getPositionChange(keyword.position, keyword.previousPosition);
                return (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {keyword.keyword}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {keyword.searchVolume.toLocaleString()} searches/month
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">#{keyword.position}</p>
                        <div className={`flex items-center text-xs ${
                          positionChange.trend === 'up' ? 'text-green-600' : 
                          positionChange.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {positionChange.trend === 'up' && <ArrowUp className="h-3 w-3" />}
                          {positionChange.trend === 'down' && <ArrowDown className="h-3 w-3" />}
                          {positionChange.trend === 'stable' && <Minus className="h-3 w-3" />}
                          <span className="ml-1">{positionChange.text}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>
              Most visited pages from organic search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPages.map((page, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {page.url}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Avg. position: {page.avgPosition}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {page.pageViews.toLocaleString()}
                    </p>
                    <div className={`flex items-center text-xs ${
                      page.change > 0 ? 'text-green-600' : 
                      page.change < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {page.change > 0 && <ArrowUp className="h-3 w-3" />}
                      {page.change < 0 && <ArrowDown className="h-3 w-3" />}
                      {page.change === 0 && <Minus className="h-3 w-3" />}
                      <span className="ml-1">
                        {page.change !== 0 ? `${page.change > 0 ? '+' : ''}${page.change}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
          <CardDescription>
            Key insights from your SEO performance this period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">🎯 Key Wins</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• 5 keywords moved to page 1</li>
                <li>• Organic traffic increased 12.5%</li>
                <li>• 23 new keywords ranking</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">⚠️ Areas to Improve</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Page load speed optimization needed</li>
                <li>• 3 high-value keywords dropped</li>
                <li>• Mobile usability issues detected</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">📈 Next Actions</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Optimize content for top opportunities</li>
                <li>• Fix technical SEO issues</li>
                <li>• Expand content on winning topics</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}