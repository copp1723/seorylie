import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  GitBranch,
  GitMerge,
  TestTube,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  RefreshCw,
  FileText,
  Users,
  Target,
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
  PieChart,
  Cell,
} from "recharts";
import { format, subDays } from "date-fns";

interface IntegrationMetrics {
  totalBranches: number;
  integratedBranches: number;
  pendingBranches: number;
  conflictingBranches: number;
  testsPassingRate: number;
  avgIntegrationTime: number;
  velocityScore: number;
  riskScore: number;
}

interface BranchStatus {
  name: string;
  type: "C" | "H" | "I" | "U" | "T";
  status: "pending" | "in-progress" | "integrated" | "failed" | "conflicted";
  conflicts: number;
  testStatus: "passing" | "failing" | "pending";
  lastUpdated: string;
  riskLevel: "low" | "medium" | "high";
  effort: number;
  dependencies: string[];
}

interface ConflictHeatMap {
  source: string;
  target: string;
  intensity: number;
  conflictType: "merge" | "semantic" | "style" | "dependency";
}

interface VelocityData {
  date: string;
  branchesIntegrated: number;
  testsRun: number;
  conflictsResolved: number;
  avgTime: number;
}

interface KnownIssue {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedBranches: string[];
  status: "open" | "investigating" | "resolved";
  assignee: string;
  createdAt: string;
}

export function IntegrationDashboard() {
  const [metrics, setMetrics] = useState<IntegrationMetrics | null>(null);
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [conflicts, setConflicts] = useState<ConflictHeatMap[]>([]);
  const [velocity, setVelocity] = useState<VelocityData[]>([]);
  const [knownIssues, setKnownIssues] = useState<KnownIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7");

  const fetchIntegrationData = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock integration metrics
      const mockMetrics: IntegrationMetrics = {
        totalBranches: 12,
        integratedBranches: 8,
        pendingBranches: 3,
        conflictingBranches: 1,
        testsPassingRate: 87.5,
        avgIntegrationTime: 4.2, // hours
        velocityScore: 92,
        riskScore: 23,
      };

      // Mock branch statuses
      const mockBranches: BranchStatus[] = [
        {
          name: "C1-jwt-refresh-rotation",
          type: "C",
          status: "integrated",
          conflicts: 0,
          testStatus: "passing",
          lastUpdated: "2025-05-28T10:30:00Z",
          riskLevel: "low",
          effort: 2,
          dependencies: [],
        },
        {
          name: "C5-global-error-handling",
          type: "C",
          status: "in-progress",
          conflicts: 2,
          testStatus: "failing",
          lastUpdated: "2025-05-29T09:15:00Z",
          riskLevel: "medium",
          effort: 3,
          dependencies: ["C1-jwt-refresh-rotation"],
        },
        {
          name: "H2-sandbox-pause-resume",
          type: "H",
          status: "pending",
          conflicts: 0,
          testStatus: "pending",
          lastUpdated: "2025-05-28T16:45:00Z",
          riskLevel: "low",
          effort: 2,
          dependencies: [],
        },
        {
          name: "H4-redis-websocket-scaling",
          type: "H",
          status: "conflicted",
          conflicts: 5,
          testStatus: "failing",
          lastUpdated: "2025-05-29T08:20:00Z",
          riskLevel: "high",
          effort: 4,
          dependencies: ["H2-sandbox-pause-resume"],
        },
        {
          name: "I1-event-schema-validation",
          type: "I",
          status: "integrated",
          conflicts: 0,
          testStatus: "passing",
          lastUpdated: "2025-05-28T14:10:00Z",
          riskLevel: "low",
          effort: 1,
          dependencies: [],
        },
        {
          name: "I2-mindsdb-service-hook",
          type: "I",
          status: "pending",
          conflicts: 1,
          testStatus: "pending",
          lastUpdated: "2025-05-29T07:30:00Z",
          riskLevel: "medium",
          effort: 3,
          dependencies: ["I1-event-schema-validation"],
        },
        {
          name: "U1-loading-progress-ui",
          type: "U",
          status: "integrated",
          conflicts: 0,
          testStatus: "passing",
          lastUpdated: "2025-05-28T12:20:00Z",
          riskLevel: "low",
          effort: 1,
          dependencies: [],
        },
        {
          name: "T1-ts-strict-mode",
          type: "T",
          status: "integrated",
          conflicts: 0,
          testStatus: "passing",
          lastUpdated: "2025-05-28T11:45:00Z",
          riskLevel: "low",
          effort: 2,
          dependencies: [],
        },
      ];

      // Mock conflict heat map
      const mockConflicts: ConflictHeatMap[] = [
        {
          source: "H4-redis-websocket-scaling",
          target: "C5-global-error-handling",
          intensity: 8,
          conflictType: "dependency",
        },
        {
          source: "I2-mindsdb-service-hook",
          target: "C1-jwt-refresh-rotation",
          intensity: 3,
          conflictType: "semantic",
        },
        {
          source: "H4-redis-websocket-scaling",
          target: "integration/production-readiness-phase1",
          intensity: 6,
          conflictType: "merge",
        },
      ];

      // Mock velocity data
      const days = parseInt(timeRange);
      const mockVelocity: VelocityData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        mockVelocity.push({
          date,
          branchesIntegrated: Math.floor(Math.random() * 3) + 1,
          testsRun: Math.floor(Math.random() * 20) + 15,
          conflictsResolved: Math.floor(Math.random() * 4),
          avgTime: Math.random() * 2 + 2, // 2-4 hours
        });
      }

      // Mock known issues
      const mockIssues: KnownIssue[] = [
        {
          id: "ISS-001",
          title: "Redis connection pool conflicts in H4 branch",
          severity: "high",
          affectedBranches: ["H4-redis-websocket-scaling"],
          status: "investigating",
          assignee: "dev-team-lead",
          createdAt: "2025-05-29T06:00:00Z",
        },
        {
          id: "ISS-002",
          title: "Type conflicts after strict mode enablement",
          severity: "medium",
          affectedBranches: ["T1-ts-strict-mode", "C5-global-error-handling"],
          status: "resolved",
          assignee: "typescript-expert",
          createdAt: "2025-05-28T10:00:00Z",
        },
        {
          id: "ISS-003",
          title: "Schema validation breaking UI components",
          severity: "critical",
          affectedBranches: [
            "I1-event-schema-validation",
            "U1-loading-progress-ui",
          ],
          status: "resolved",
          assignee: "frontend-team",
          createdAt: "2025-05-28T08:30:00Z",
        },
      ];

      setMetrics(mockMetrics);
      setBranches(mockBranches);
      setConflicts(mockConflicts);
      setVelocity(mockVelocity);
      setKnownIssues(mockIssues);
    } catch (error) {
      console.error("Error fetching integration data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrationData();
  }, [timeRange]);

  const getStatusColor = (status: BranchStatus["status"]) => {
    switch (status) {
      case "integrated":
        return "text-green-600";
      case "in-progress":
        return "text-blue-600";
      case "pending":
        return "text-yellow-600";
      case "failed":
        return "text-red-600";
      case "conflicted":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: BranchStatus["status"]) => {
    switch (status) {
      case "integrated":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in-progress":
        return <Activity className="h-4 w-4 text-blue-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "conflicted":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "low":
        return "default";
      case "medium":
        return "secondary";
      case "high":
        return "destructive";
      default:
        return "default";
    }
  };

  const HEAT_COLORS = ["#00ff00", "#ffff00", "#ff8000", "#ff0000"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading integration dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎯 Integration Dashboard</h1>
          <p className="text-muted-foreground">
            Platform Integration & Consolidation - Sprint 4: Stabilization &
            Cleanup
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
            </SelectContent>
          </Select>
          <Button onClick={fetchIntegrationData} variant="outline">
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
                Integration Progress
              </CardTitle>
              <GitMerge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.integratedBranches}/{metrics.totalBranches}
              </div>
              <Progress
                value={
                  (metrics.integratedBranches / metrics.totalBranches) * 100
                }
                className="w-full mt-2"
              />
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                {(
                  (metrics.integratedBranches / metrics.totalBranches) *
                  100
                ).toFixed(1)}
                % complete
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Test Pass Rate
              </CardTitle>
              <TestTube className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.testsPassingRate.toFixed(1)}%
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                +2.3% from last period
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Integration Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.avgIntegrationTime.toFixed(1)}h
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                -0.8h from target
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.riskScore}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Badge
                  variant={
                    metrics.riskScore < 30
                      ? "default"
                      : metrics.riskScore < 60
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {metrics.riskScore < 30
                    ? "🟢 Low"
                    : metrics.riskScore < 60
                      ? "🟡 Medium"
                      : "🔴 High"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="branches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branches">Branch Status</TabsTrigger>
          <TabsTrigger value="conflicts">Conflict Heat Map</TabsTrigger>
          <TabsTrigger value="velocity">Integration Velocity</TabsTrigger>
          <TabsTrigger value="issues">Known Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Branch Integration Status</CardTitle>
              <CardDescription>
                Track progress of all feature branches in the integration
                pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {branches.map((branch) => (
                  <div key={branch.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(branch.status)}
                        <div>
                          <h4 className="font-medium">{branch.name}</h4>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Badge variant="outline">
                              {branch.type} Branch
                            </Badge>
                            <span>•</span>
                            <span>{branch.effort}h effort</span>
                            {branch.dependencies.length > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  {branch.dependencies.length} dependencies
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getRiskBadgeVariant(branch.riskLevel)}>
                          {branch.riskLevel} risk
                        </Badge>
                        <Badge
                          variant={
                            branch.testStatus === "passing"
                              ? "default"
                              : branch.testStatus === "failing"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {branch.testStatus}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div
                          className={`font-medium ${getStatusColor(branch.status)}`}
                        >
                          {branch.status.replace("-", " ")}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Conflicts:
                        </span>
                        <div
                          className={`font-medium ${branch.conflicts > 0 ? "text-orange-600" : "text-green-600"}`}
                        >
                          {branch.conflicts}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Test Status:
                        </span>
                        <div className="font-medium">{branch.testStatus}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Last Updated:
                        </span>
                        <div className="font-medium">
                          {format(
                            new Date(branch.lastUpdated),
                            "MMM dd, HH:mm",
                          )}
                        </div>
                      </div>
                    </div>

                    {branch.dependencies.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <span className="text-sm text-muted-foreground">
                          Dependencies:{" "}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {branch.dependencies.map((dep) => (
                            <Badge
                              key={dep}
                              variant="outline"
                              className="text-xs"
                            >
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conflict Heat Map</CardTitle>
                <CardDescription>
                  Visual representation of integration conflicts by intensity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conflicts.map((conflict, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">
                          {conflict.source} → {conflict.target}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{
                              backgroundColor:
                                HEAT_COLORS[
                                  Math.min(
                                    Math.floor(conflict.intensity / 3),
                                    3,
                                  )
                                ],
                            }}
                          />
                          <span className="text-sm font-medium">
                            {conflict.intensity}/10
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline">{conflict.conflictType}</Badge>
                        <span>
                          {conflict.intensity < 3
                            ? "Low"
                            : conflict.intensity < 6
                              ? "Medium"
                              : conflict.intensity < 8
                                ? "High"
                                : "Critical"}{" "}
                          priority
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conflict Resolution Guide</CardTitle>
                <CardDescription>
                  Recommended actions for conflict types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">
                      🔴 High Priority Conflicts
                    </h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• Review H4-redis-websocket-scaling dependencies</li>
                      <li>• Coordinate with infrastructure team</li>
                      <li>• Consider feature flag approach</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      🟡 Medium Priority
                    </h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Semantic conflicts require code review</li>
                      <li>• Schedule integration meeting</li>
                      <li>• Update integration order</li>
                    </ul>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">
                      🟢 Monitoring
                    </h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Automated conflict detection active</li>
                      <li>• Daily progress notifications enabled</li>
                      <li>• Integration velocity tracking live</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="velocity" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Integration Velocity</CardTitle>
                <CardDescription>Branches integrated per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={velocity}>
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
                    <Bar
                      dataKey="branchesIntegrated"
                      fill="#8884d8"
                      name="Branches Integrated"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Metrics Trend</CardTitle>
                <CardDescription>Tests and conflicts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={velocity}>
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
                      dataKey="testsRun"
                      stroke="#82ca9d"
                      name="Tests Run"
                    />
                    <Line
                      type="monotone"
                      dataKey="conflictsResolved"
                      stroke="#ffc658"
                      name="Conflicts Resolved"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Integration Performance Summary</CardTitle>
              <CardDescription>
                Key velocity and efficiency metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {velocity.reduce(
                      (sum, day) => sum + day.branchesIntegrated,
                      0,
                    )}
                  </div>
                  <div className="text-sm text-blue-700">
                    Total Branches Integrated
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {velocity.reduce((sum, day) => sum + day.testsRun, 0)}
                  </div>
                  <div className="text-sm text-green-700">
                    Total Tests Executed
                  </div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {velocity.reduce(
                      (sum, day) => sum + day.conflictsResolved,
                      0,
                    )}
                  </div>
                  <div className="text-sm text-orange-700">
                    Conflicts Resolved
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Known Issues Tracker</CardTitle>
              <CardDescription>
                Track and manage integration-blocking issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {knownIssues.map((issue) => (
                  <div key={issue.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{issue.title}</h4>
                          <Badge
                            variant={
                              issue.severity === "critical"
                                ? "destructive"
                                : issue.severity === "high"
                                  ? "destructive"
                                  : issue.severity === "medium"
                                    ? "secondary"
                                    : "default"
                            }
                          >
                            {issue.severity}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {issue.id} • Assigned to {issue.assignee}
                        </div>
                      </div>
                      <Badge
                        variant={
                          issue.status === "resolved"
                            ? "default"
                            : issue.status === "investigating"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {issue.status}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-muted-foreground">
                          Affected Branches:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {issue.affectedBranches.map((branch) => (
                            <Badge
                              key={branch}
                              variant="outline"
                              className="text-xs"
                            >
                              {branch}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created{" "}
                        {format(
                          new Date(issue.createdAt),
                          "MMM dd, yyyy 'at' HH:mm",
                        )}
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
