import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  Target,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

interface AIMetrics {
  totalInteractions: number;
  successfulResponses: number;
  escalationRate: number;
  avgResponseTime: number;
  avgConversationLength: number;
  customerSatisfaction: number;
  inventoryContextUsage: number;
  personalizedResponses: number;
}

interface DailyStats {
  date: string;
  interactions: number;
  responses: number;
  escalations: number;
  avgResponseTime: number;
}

interface TopIntents {
  intent: string;
  count: number;
  successRate: number;
}

interface PersonaPerformance {
  personaName: string;
  interactions: number;
  successRate: number;
  avgSatisfaction: number;
  escalationRate: number;
}

export function AIAnalyticsDashboard() {
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topIntents, setTopIntents] = useState<TopIntents[]>([]);
  const [personaPerformance, setPersonaPerformance] = useState<
    PersonaPerformance[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7"); // days
  const [selectedPersona, setSelectedPersona] = useState<string>("all");

  // Mock dealership ID - in real app this would come from user context
  const dealershipId = 1;

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Mock data - in real app these would be API calls
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API delay

      // Generate mock daily stats
      const days = parseInt(timeRange);
      const mockDailyStats: DailyStats[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        mockDailyStats.push({
          date,
          interactions: Math.floor(Math.random() * 50) + 20,
          responses: Math.floor(Math.random() * 45) + 18,
          escalations: Math.floor(Math.random() * 5) + 1,
          avgResponseTime: Math.floor(Math.random() * 3000) + 1000, // ms
        });
      }

      const totalInteractions = mockDailyStats.reduce(
        (sum, day) => sum + day.interactions,
        0,
      );
      const totalResponses = mockDailyStats.reduce(
        (sum, day) => sum + day.responses,
        0,
      );
      const totalEscalations = mockDailyStats.reduce(
        (sum, day) => sum + day.escalations,
        0,
      );

      const mockMetrics: AIMetrics = {
        totalInteractions,
        successfulResponses: totalResponses,
        escalationRate: (totalEscalations / totalInteractions) * 100,
        avgResponseTime:
          mockDailyStats.reduce((sum, day) => sum + day.avgResponseTime, 0) /
          mockDailyStats.length,
        avgConversationLength: 4.2,
        customerSatisfaction: 4.6,
        inventoryContextUsage: 65,
        personalizedResponses: 78,
      };

      const mockTopIntents: TopIntents[] = [
        { intent: "Vehicle Inquiry", count: 156, successRate: 92 },
        { intent: "Pricing Information", count: 134, successRate: 88 },
        { intent: "Financing Options", count: 89, successRate: 85 },
        { intent: "Test Drive Request", count: 67, successRate: 95 },
        { intent: "Trade-in Valuation", count: 45, successRate: 82 },
      ];

      const mockPersonaPerformance: PersonaPerformance[] = [
        {
          personaName: "Rylie (Default)",
          interactions: 234,
          successRate: 89,
          avgSatisfaction: 4.6,
          escalationRate: 8.1,
        },
        {
          personaName: "Professional Assistant",
          interactions: 123,
          successRate: 91,
          avgSatisfaction: 4.4,
          escalationRate: 6.5,
        },
        {
          personaName: "Friendly Helper",
          interactions: 89,
          successRate: 87,
          avgSatisfaction: 4.7,
          escalationRate: 9.2,
        },
        {
          personaName: "Expert Advisor",
          interactions: 67,
          successRate: 93,
          avgSatisfaction: 4.5,
          escalationRate: 5.8,
        },
      ];

      setMetrics(mockMetrics);
      setDailyStats(mockDailyStats);
      setTopIntents(mockTopIntents);
      setPersonaPerformance(mockPersonaPerformance);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getMetricTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change >= 0 ? "up" : "down",
      isPositive: change >= 0,
    };
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Performance Analytics</h1>
          <p className="text-muted-foreground">
            Monitor and analyze AI conversation metrics and performance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Interactions
              </CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(metrics.totalInteractions)}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +12.3% from last period
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  (metrics.successfulResponses / metrics.totalInteractions) *
                  100
                ).toFixed(1)}
                %
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +2.1% from last period
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Escalation Rate
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.escalationRate.toFixed(1)}%
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                -1.4% from last period
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Response Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatTime(metrics.avgResponseTime)}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                -340ms from last period
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="intents">Top Intents</TabsTrigger>
          <TabsTrigger value="personas">Persona Performance</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Context</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Interactions Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Interactions</CardTitle>
                <CardDescription>AI interactions over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(new Date(date), "MM/dd")}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) =>
                        format(new Date(date), "MMM dd, yyyy")
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="interactions"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Interactions"
                    />
                    <Line
                      type="monotone"
                      dataKey="responses"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Successful Responses"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key quality indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      Customer Satisfaction
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.customerSatisfaction.toFixed(1)}/5.0
                    </span>
                  </div>
                  <Progress
                    value={(metrics?.customerSatisfaction || 0) * 20}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      Inventory Context Usage
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.inventoryContextUsage}%
                    </span>
                  </div>
                  <Progress
                    value={metrics?.inventoryContextUsage || 0}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      Personalized Responses
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.personalizedResponses}%
                    </span>
                  </div>
                  <Progress
                    value={metrics?.personalizedResponses || 0}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      Avg Conversation Length
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metrics?.avgConversationLength.toFixed(1)} messages
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="intents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Customer Intents</CardTitle>
                <CardDescription>
                  Most common conversation topics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topIntents.map((intent, index) => (
                    <div
                      key={intent.intent}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{intent.intent}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatNumber(intent.count)} interactions
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            intent.successRate >= 90 ? "default" : "secondary"
                          }
                        >
                          {intent.successRate}% success
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Intent Distribution</CardTitle>
                <CardDescription>Conversation topic breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <RechartsPieChart
                      data={topIntents}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="count"
                    >
                      {topIntents.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </RechartsPieChart>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="personas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Persona Performance Comparison</CardTitle>
              <CardDescription>
                How different AI personas are performing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {personaPerformance.map((persona) => (
                  <div
                    key={persona.personaName}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{persona.personaName}</h4>
                      <Badge variant="outline">
                        {formatNumber(persona.interactions)} interactions
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Success Rate
                        </div>
                        <div className="text-lg font-semibold text-green-600">
                          {persona.successRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Satisfaction
                        </div>
                        <div className="text-lg font-semibold">
                          {persona.avgSatisfaction.toFixed(1)}/5.0
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Escalation Rate
                        </div>
                        <div className="text-lg font-semibold text-orange-600">
                          {persona.escalationRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Context Usage</CardTitle>
                <CardDescription>
                  How often AI uses inventory data in responses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {metrics?.inventoryContextUsage}%
                    </div>
                    <p className="text-muted-foreground">
                      of relevant conversations include inventory context
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">
                        Vehicle-specific inquiries
                      </span>
                      <span className="text-sm font-medium">89%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pricing questions</span>
                      <span className="text-sm font-medium">76%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Availability checks</span>
                      <span className="text-sm font-medium">94%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Feature comparisons</span>
                      <span className="text-sm font-medium">68%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Context Effectiveness</CardTitle>
                <CardDescription>
                  Impact of inventory context on conversation success
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        94%
                      </div>
                      <div className="text-xs text-green-700">With Context</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600">
                        78%
                      </div>
                      <div className="text-xs text-gray-700">
                        Without Context
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    <span className="font-medium text-green-600">+16%</span>{" "}
                    higher success rate when inventory context is used
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Top benefits:
                    </div>
                    <ul className="text-sm space-y-1">
                      <li>• More specific vehicle recommendations</li>
                      <li>• Accurate pricing information</li>
                      <li>• Real-time availability updates</li>
                      <li>• Reduced need for escalation</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
