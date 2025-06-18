import { useState } from "react";
import { 
  MessageSquare, 
  TrendingUp, 
  Package,
  Calendar,
  Target,
  Globe,
  BarChart3,
  FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import SEOWorksChat from "../components/seoworks-chat";

// Mock data - in production this would come from your API
const mockData = {
  package: 'GOLD',
  monthlyContent: {
    pages: 5,
    blogs: 6,
    gbpPosts: 12,
    improvements: 10,
  },
  recentWork: [
    { type: 'page', title: 'New Ford F-150 for Sale in Austin', date: '2025-01-15' },
    { type: 'blog', title: 'Top 5 Features of the 2025 Ford Mustang', date: '2025-01-14' },
    { type: 'gbp', title: 'Special Financing Available This Month', date: '2025-01-13' },
    { type: 'improvement', title: 'Updated meta descriptions for 15 VDP pages', date: '2025-01-12' },
  ],
  performance: {
    organicTraffic: 12500,
    trafficChange: 11.2,
    avgPosition: 8.2,
    positionChange: -1.5,
    impressions: 45600,
    impressionChange: 18.7,
  },
};

export default function SEOWorksChatPage() {
  const [activeTab, setActiveTab] = useState("chat");

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'page':
        return <FileText className="h-4 w-4" />;
      case 'blog':
        return <FileText className="h-4 w-4" />;
      case 'gbp':
        return <Globe className="h-4 w-4" />;
      case 'improvement':
        return <Target className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      page: 'bg-blue-100 text-blue-800',
      blog: 'bg-green-100 text-green-800',
      gbp: 'bg-purple-100 text-purple-800',
      improvement: 'bg-orange-100 text-orange-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">SEOWerks Assistant</h1>
        <p className="text-muted-foreground">
          Get instant answers about your SEO package, performance, and strategy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <SEOWorksChat />
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Package Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your Package
                <Badge className="bg-yellow-100 text-yellow-800">
                  <Package className="h-3 w-3 mr-1" />
                  {mockData.package}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">{mockData.monthlyContent.pages}</p>
                  <p className="text-muted-foreground">Pages/month</p>
                </div>
                <div>
                  <p className="font-medium">{mockData.monthlyContent.blogs}</p>
                  <p className="text-muted-foreground">Blogs/month</p>
                </div>
                <div>
                  <p className="font-medium">{mockData.monthlyContent.gbpPosts}</p>
                  <p className="text-muted-foreground">GBP Posts/month</p>
                </div>
                <div>
                  <p className="font-medium">{mockData.monthlyContent.improvements}</p>
                  <p className="text-muted-foreground">SEO Changes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Organic Traffic</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{mockData.performance.organicTraffic.toLocaleString()}</p>
                  <p className={`text-xs ${mockData.performance.trafficChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mockData.performance.trafficChange > 0 ? '+' : ''}{mockData.performance.trafficChange}%
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Avg Position</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{mockData.performance.avgPosition}</p>
                  <p className={`text-xs ${mockData.performance.positionChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mockData.performance.positionChange > 0 ? '+' : ''}{mockData.performance.positionChange}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Impressions</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{mockData.performance.impressions.toLocaleString()}</p>
                  <p className={`text-xs ${mockData.performance.impressionChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mockData.performance.impressionChange > 0 ? '+' : ''}{mockData.performance.impressionChange}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Work */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent SEO Work</CardTitle>
              <CardDescription>Latest updates to your site</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockData.recentWork.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className={getTypeBadge(item.type)}>
                      {getTypeIcon(item.type)}
                    </Badge>
                    <div className="flex-1">
                      <p className="line-clamp-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask about your package details, performance metrics, or SEO strategy. 
              Our AI assistant is trained on automotive SEO best practices.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get instant answers 24/7. For complex requests or custom work, 
              our team typically responds within 24 business hours.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Detailed performance reports are sent monthly. Ask the assistant 
              to explain any metrics or trends you see in your reports.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}