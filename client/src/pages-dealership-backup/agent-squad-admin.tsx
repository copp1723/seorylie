import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  AlertCircle,
  Zap,
  Brain,
  Database,
  TrendingUp,
} from "lucide-react";

interface AgentSquadStatus {
  ready: boolean;
  health: {
    originalAI: boolean;
    agentSquad: boolean;
    hybrid: boolean;
  };
  config: {
    useAgentSquad: boolean;
    fallbackToOriginal: boolean;
  };
}

interface TestResult {
  response: string;
  selectedAgent: string;
  usedAgentSquad: boolean;
  confidence: number;
  fallbackReason?: string;
}

export default function AgentSquadAdmin() {
  const [status, setStatus] = useState<AgentSquadStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/agent-squad/status");
      const data = await response.json();

      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to fetch Agent Squad status:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeAgentSquad = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/agent-squad/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealershipId: 1, // Get from context in real app
          enabled: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchStatus();
      } else {
        alert("Failed to initialize Agent Squad: " + data.error);
      }
    } catch (error) {
      console.error("Failed to initialize Agent Squad:", error);
      alert("Failed to initialize Agent Squad");
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<AgentSquadStatus["config"]>) => {
    try {
      const response = await fetch("/api/agent-squad/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                config: { ...prev.config, ...updates },
              }
            : null,
        );
      } else {
        alert("Failed to update configuration: " + data.error);
      }
    } catch (error) {
      console.error("Failed to update config:", error);
      alert("Failed to update configuration");
    }
  };

  const testAgentSquad = async () => {
    if (!testMessage.trim()) return;

    try {
      setTestLoading(true);
      const response = await fetch("/api/agent-squad/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: testMessage,
          dealershipId: 1, // Get from context in real app
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult(data.result);
      } else {
        alert("Test failed: " + data.error);
      }
    } catch (error) {
      console.error("Test failed:", error);
      alert("Test failed");
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Squad Management</h1>
          <p className="text-muted-foreground">
            Manage enhanced AI routing and specialized automotive agents
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant={status?.ready ? "default" : "destructive"}>
            {status?.ready ? "Ready" : "Not Ready"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
              <CardDescription>
                Current health and availability of AI systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Original AI</p>
                    <p className="text-sm text-muted-foreground">
                      Rylie base system
                    </p>
                  </div>
                  <Badge
                    variant={
                      status?.health.originalAI ? "default" : "destructive"
                    }
                  >
                    {status?.health.originalAI ? "Online" : "Offline"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Agent Squad</p>
                    <p className="text-sm text-muted-foreground">
                      Enhanced routing
                    </p>
                  </div>
                  <Badge
                    variant={
                      status?.health.agentSquad ? "default" : "destructive"
                    }
                  >
                    {status?.health.agentSquad ? "Online" : "Offline"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Hybrid System</p>
                    <p className="text-sm text-muted-foreground">
                      Combined routing
                    </p>
                  </div>
                  <Badge
                    variant={status?.health.hybrid ? "default" : "destructive"}
                  >
                    {status?.health.hybrid ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span>Enhanced Capabilities</span>
              </CardTitle>
              <CardDescription>
                Advanced features enabled by Agent Squad integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Zap className="h-5 w-5 mt-0.5 text-blue-500" />
                    <div>
                      <p className="font-medium">Intelligent Routing</p>
                      <p className="text-sm text-muted-foreground">
                        Sentiment analysis and context-aware agent selection
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Database className="h-5 w-5 mt-0.5 text-green-500" />
                    <div>
                      <p className="font-medium">Real-time Inventory</p>
                      <p className="text-sm text-muted-foreground">
                        Live vehicle search and details integration
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <TrendingUp className="h-5 w-5 mt-0.5 text-purple-500" />
                    <div>
                      <p className="font-medium">Performance Analytics</p>
                      <p className="text-sm text-muted-foreground">
                        Comprehensive tracking and optimization
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 mt-0.5 text-orange-500" />
                    <div>
                      <p className="font-medium">Smart Escalation</p>
                      <p className="text-sm text-muted-foreground">
                        Automatic detection of frustrated customers
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!status?.ready && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Agent Squad is not initialized. Click the button below to
                activate enhanced AI capabilities.
                <div className="mt-2">
                  <Button onClick={initializeAgentSquad} disabled={loading}>
                    Initialize Agent Squad
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Squad Configuration</CardTitle>
              <CardDescription>
                Control how Agent Squad integrates with your existing AI system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="use-agent-squad" className="font-medium">
                    Use Agent Squad
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable enhanced AI routing with specialized agents
                  </p>
                </div>
                <Switch
                  id="use-agent-squad"
                  checked={status?.config.useAgentSquad || false}
                  onCheckedChange={(checked) =>
                    updateConfig({ useAgentSquad: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fallback-enabled" className="font-medium">
                    Enable Fallback
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Fall back to original AI if Agent Squad fails
                  </p>
                </div>
                <Switch
                  id="fallback-enabled"
                  checked={status?.config.fallbackToOriginal || false}
                  onCheckedChange={(checked) =>
                    updateConfig({ fallbackToOriginal: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Agent Squad</CardTitle>
              <CardDescription>
                Send test messages to see how Agent Squad routes and responds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test-message">Test Message</Label>
                <Textarea
                  id="test-message"
                  placeholder="Enter a customer message to test agent routing..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={testAgentSquad}
                disabled={testLoading || !testMessage.trim() || !status?.ready}
                className="w-full"
              >
                {testLoading ? "Testing..." : "Test Agent Squad"}
              </Button>

              {testResult && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Test Result</h4>
                    <div className="flex space-x-2">
                      <Badge
                        variant={
                          testResult.usedAgentSquad ? "default" : "secondary"
                        }
                      >
                        {testResult.usedAgentSquad
                          ? "Agent Squad"
                          : "Original AI"}
                      </Badge>
                      {testResult.selectedAgent && (
                        <Badge variant="outline">
                          {testResult.selectedAgent}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Response:</p>
                    <p className="text-sm bg-background p-3 rounded border">
                      {testResult.response}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Confidence:</p>
                      <p>{(testResult.confidence * 100).toFixed(1)}%</p>
                    </div>
                    {testResult.fallbackReason && (
                      <div>
                        <p className="font-medium">Fallback Reason:</p>
                        <p>{testResult.fallbackReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Track agent performance and customer satisfaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Analytics dashboard coming soon...</p>
                <p className="text-sm">
                  Agent performance metrics and customer satisfaction tracking
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
