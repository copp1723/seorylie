import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useToast } from '../hooks/use-toast';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { AgentDesigner } from '../components/agent-studio/AgentDesigner';
import { LiveConsole } from '../components/agent-studio/LiveConsole';
import { AgentCard } from '../components/agent-studio/AgentCard';
import PageHeading from '../components/page-heading';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, CheckCircle, Play, Save, Plus, RefreshCw, Settings, Wrench, Database, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import JsonView from '@uiw/react-json-view';

// Types for the Agent Studio page
interface Tool {
  id: number;
  name: string;
  service: string;
  description: string;
  category: string;
  is_active: boolean;
}

interface Sandbox {
  id: number;
  name: string;
  description?: string;
  token_limit_per_hour: number;
  token_limit_per_day: number;
  current_hourly_usage: number;
  current_daily_usage: number;
  is_active: boolean;
}

interface SandboxSession {
  sandboxId: number;
  sessionId: string;
  websocketChannel: string;
}

interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  tools: string[];
}

interface ConsoleMessage {
  type: string;
  content: string;
  timestamp: Date;
  data?: any;
}

interface InsightData {
  id?: string;
  title?: string;
  description?: string;
  metrics?: any;
  score?: number;
  visualization?: any;
}

// Main Agent Studio component
const AgentStudio: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [match, params] = useRoute('/agent-studio/:id');
  
  // State for agent configuration
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    name: 'New Agent',
    description: 'A helpful AI assistant',
    prompt: 'You are a helpful AI assistant designed to provide information and assistance.',
    tools: []
  });
  
  // State for available tools and sandboxes
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [selectedSandboxId, setSelectedSandboxId] = useState<number | null>(null);
  const [currentSession, setCurrentSession] = useState<SandboxSession | null>(null);
  
  // State for execution and display
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<InsightData | null>(null);
  
  // State for loading and errors
  const [isLoading, setIsLoading] = useState(true);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [sandboxesLoading, setSandboxesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Fetch available tools and sandboxes on component mount
  useEffect(() => {
    fetchTools();
    fetchSandboxes();
    
    // Cleanup WebSocket connection on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Initialize WebSocket connection when session is created
  useEffect(() => {
    if (currentSession) {
      initializeWebSocket(currentSession);
    }
  }, [currentSession]);
  
  // Fetch available tools from the API
  const fetchTools = async () => {
    try {
      setToolsLoading(true);
      const response = await fetch('/api/tools');
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }
      const data = await response.json();
      setAvailableTools(data.tools || []);
      
      // Default select the watchdog_analysis tool if available
      const watchdogTool = data.tools.find((tool: Tool) => tool.name === 'watchdog_analysis');
      if (watchdogTool) {
        setAgentConfig(prev => ({
          ...prev,
          tools: ['watchdog_analysis']
        }));
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setError('Failed to load available tools. Please try again later.');
      toast({
        title: 'Error',
        description: 'Failed to load available tools',
        variant: 'destructive'
      });
    } finally {
      setToolsLoading(false);
      setIsLoading(false);
    }
  };
  
  // Fetch user's sandboxes from the API
  const fetchSandboxes = async () => {
    try {
      setSandboxesLoading(true);
      const response = await fetch('/api/sandboxes');
      if (!response.ok) {
        throw new Error('Failed to fetch sandboxes');
      }
      const data = await response.json();
      setSandboxes(data.sandboxes || []);
      
      // Select the first sandbox by default if available
      if (data.sandboxes && data.sandboxes.length > 0) {
        setSelectedSandboxId(data.sandboxes[0].id);
      }
    } catch (error) {
      console.error('Error fetching sandboxes:', error);
      setError('Failed to load sandboxes. Please try again later.');
      toast({
        title: 'Error',
        description: 'Failed to load sandboxes',
        variant: 'destructive'
      });
    } finally {
      setSandboxesLoading(false);
      setIsLoading(false);
    }
  };
  
  // Create a new sandbox
  const createSandbox = async () => {
    try {
      const response = await fetch('/api/sandboxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${agentConfig.name} Sandbox`,
          description: `Sandbox for ${agentConfig.name} agent`,
          token_limit_per_hour: 10000, // Default hourly limit
          token_limit_per_day: 50000    // Default daily limit
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create sandbox');
      }
      
      const data = await response.json();
      setSandboxes(prev => [...prev, data.sandbox]);
      setSelectedSandboxId(data.sandbox.id);
      
      toast({
        title: 'Success',
        description: 'Sandbox created successfully',
        variant: 'default'
      });
      
      return data.sandbox;
    } catch (error) {
      console.error('Error creating sandbox:', error);
      toast({
        title: 'Error',
        description: 'Failed to create sandbox',
        variant: 'destructive'
      });
      throw error;
    }
  };
  
  // Create a sandbox session
  const createSandboxSession = async (sandboxId: number) => {
    try {
      const response = await fetch(`/api/sandboxes/${sandboxId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create sandbox session');
      }
      
      const data = await response.json();
      setCurrentSession(data.session);
      
      return data.session;
    } catch (error) {
      console.error('Error creating sandbox session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create sandbox session',
        variant: 'destructive'
      });
      throw error;
    }
  };
  
  // Initialize WebSocket connection for sandbox
  const initializeWebSocket = (session: SandboxSession) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Create new WebSocket connection to the sandbox channel
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${session.websocketChannel}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      addConsoleMessage('system', 'Connected to sandbox WebSocket channel');
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connect',
        sessionId: session.sessionId,
        sandboxId: session.sandboxId,
        metadata: {
          agentName: agentConfig.name,
          userId: user?.id
        }
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addConsoleMessage('error', 'WebSocket error occurred');
      toast({
        title: 'Connection Error',
        description: 'WebSocket connection error',
        variant: 'destructive'
      });
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      addConsoleMessage('system', 'Disconnected from sandbox WebSocket channel');
    };
    
    wsRef.current = ws;
  };
  
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    console.log('Received WebSocket message:', message);
    
    switch (message.type) {
      case 'connect':
        addConsoleMessage('system', 'Connected to agent sandbox');
        break;
        
      case 'agent_response':
        addConsoleMessage('agent', message.content || 'Agent response received');
        break;
        
      case 'tool_response':
        addConsoleMessage('tool', `Tool ${message.toolName} executed`);
        if (message.data) {
          handleToolResponse(message.toolName, message.data);
        }
        break;
        
      case 'tool_stream':
        handleToolStream(message);
        break;
        
      case 'error':
        addConsoleMessage('error', message.error?.message || 'An error occurred');
        toast({
          title: 'Error',
          description: message.error?.message || 'An error occurred',
          variant: 'destructive'
        });
        break;
        
      default:
        addConsoleMessage('system', `Received message of type: ${message.type}`);
    }
  };
  
  // Handle tool stream events
  const handleToolStream = (message: any) => {
    const streamEvent = message.streamEvent || message;
    
    switch (streamEvent.type) {
      case 'start':
        addConsoleMessage('tool', `Starting tool: ${message.toolName}`);
        break;
        
      case 'data':
        addConsoleMessage('tool', `Received data from tool: ${message.toolName}`);
        if (streamEvent.data) {
          handleToolResponse(message.toolName, streamEvent.data);
        }
        break;
        
      case 'error':
        addConsoleMessage('error', streamEvent.error?.message || 'Tool execution error');
        break;
        
      case 'end':
        addConsoleMessage('tool', `Completed tool: ${message.toolName}`);
        break;
    }
  };
  
  // Handle tool response data
  const handleToolResponse = (toolName: string, data: any) => {
    // Handle watchdog_analysis tool response
    if (toolName === 'watchdog_analysis') {
      if (data.insights && Array.isArray(data.insights)) {
        setInsights(data.insights);
        
        // Select the first insight by default
        if (data.insights.length > 0) {
          setSelectedInsight(data.insights[0]);
        }
        
        addConsoleMessage('system', `Received ${data.insights.length} insights from watchdog_analysis`);
      } else if (data.success === false) {
        addConsoleMessage('error', data.error?.message || 'Analytics query failed');
      }
    }
  };
  
  // Add a message to the console
  const addConsoleMessage = (type: string, content: string, data?: any) => {
    setConsoleMessages(prev => [
      ...prev,
      {
        type,
        content,
        timestamp: new Date(),
        data
      }
    ]);
  };
  
  // Handle tool selection toggle
  const handleToolToggle = (toolName: string, checked: boolean) => {
    setAgentConfig(prev => {
      const updatedTools = checked
        ? [...prev.tools, toolName]
        : prev.tools.filter(t => t !== toolName);
      
      return {
        ...prev,
        tools: updatedTools
      };
    });
  };
  
  // Execute the agent in the sandbox
  const executeAgent = async () => {
    try {
      setIsExecuting(true);
      setConsoleMessages([]);
      setInsights([]);
      setSelectedInsight(null);
      
      // Create a sandbox if none is selected
      let sandboxId = selectedSandboxId;
      if (!sandboxId) {
        const sandbox = await createSandbox();
        sandboxId = sandbox.id;
      }
      
      // Create a sandbox session
      const session = await createSandboxSession(sandboxId);
      
      // Wait for WebSocket connection to be established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send agent execution message
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'agent_message',
          content: agentConfig.prompt,
          tools: agentConfig.tools,
          metadata: {
            agentName: agentConfig.name,
            agentDescription: agentConfig.description
          }
        }));
        
        addConsoleMessage('system', 'Agent execution started');
        
        // If watchdog_analysis tool is enabled, send a test query
        if (agentConfig.tools.includes('watchdog_analysis')) {
          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'tool_request',
                toolName: 'watchdog_analysis',
                parameters: {
                  uploadId: 'demo-data-001', // Demo data ID
                  question: 'What are the key sales trends from last quarter?'
                },
                requestId: `req_${Date.now()}`,
                estimatedTokens: 1000
              }));
              
              addConsoleMessage('system', 'Sent analytics query to watchdog_analysis tool');
            }
          }, 2000);
        }
      } else {
        throw new Error('WebSocket connection not established');
      }
    } catch (error) {
      console.error('Error executing agent:', error);
      setError('Failed to execute agent. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to execute agent',
        variant: 'destructive'
      });
    } finally {
      setIsExecuting(false);
    }
  };
  
  // Save the agent configuration
  const saveAgent = async () => {
    try {
      // Implement agent saving functionality
      toast({
        title: 'Success',
        description: 'Agent saved successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to save agent',
        variant: 'destructive'
      });
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <PageHeading title="Agent Studio" description="Loading..." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <PageHeading title="Agent Studio" description="Design, test, and deploy AI agents" />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>Reload Page</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <PageHeading 
        title="Agent Studio" 
        description="Design, test, and deploy AI agents"
        actions={
          <div className="flex space-x-2">
            <Button variant="outline" onClick={saveAgent} disabled={isExecuting}>
              <Save className="mr-2 h-4 w-4" />
              Save Agent
            </Button>
            <Button onClick={executeAgent} disabled={isExecuting}>
              {isExecuting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Agent
                </>
              )}
            </Button>
          </div>
        }
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agent Designer Panel */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Agent Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="agentName">Agent Name</Label>
                <Input
                  id="agentName"
                  value={agentConfig.name}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter agent name"
                />
              </div>
              
              <div>
                <Label htmlFor="agentDescription">Description</Label>
                <Input
                  id="agentDescription"
                  value={agentConfig.description}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter agent description"
                />
              </div>
              
              <div>
                <Label htmlFor="agentPrompt">System Prompt</Label>
                <Textarea
                  id="agentPrompt"
                  value={agentConfig.prompt}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Enter system prompt for the agent"
                  className="min-h-[150px]"
                />
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Tools</h2>
            
            {toolsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {availableTools.length === 0 ? (
                  <p className="text-muted-foreground">No tools available</p>
                ) : (
                  availableTools.map((tool) => (
                    <div key={tool.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`tool-${tool.id}`}
                        checked={agentConfig.tools.includes(tool.name)}
                        onCheckedChange={(checked) => handleToolToggle(tool.name, checked === true)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label
                          htmlFor={`tool-${tool.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {tool.name}
                          <Badge variant="outline" className="ml-2">
                            {tool.service}
                          </Badge>
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
          
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Sandbox</h2>
            
            {sandboxesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {sandboxes.length === 0 ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">No sandboxes available</p>
                    <Button onClick={createSandbox}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Sandbox
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="sandboxSelect">Select Sandbox</Label>
                      <select
                        id="sandboxSelect"
                        value={selectedSandboxId || ''}
                        onChange={(e) => setSelectedSandboxId(Number(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select a sandbox</option>
                        {sandboxes.map((sandbox) => (
                          <option key={sandbox.id} value={sandbox.id}>
                            {sandbox.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <Button onClick={createSandbox} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Sandbox
                    </Button>
                    
                    {selectedSandboxId && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Hourly Token Usage:</span>
                          <span className="text-sm font-medium">
                            {sandboxes.find(s => s.id === selectedSandboxId)?.current_hourly_usage || 0} / 
                            {sandboxes.find(s => s.id === selectedSandboxId)?.token_limit_per_hour || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Daily Token Usage:</span>
                          <span className="text-sm font-medium">
                            {sandboxes.find(s => s.id === selectedSandboxId)?.current_daily_usage || 0} / 
                            {sandboxes.find(s => s.id === selectedSandboxId)?.token_limit_per_day || 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
        
        {/* Execution and Results Panel */}
        <div className="space-y-6">
          <Card className="p-6">
            <Tabs defaultValue="console">
              <TabsList className="mb-4">
                <TabsTrigger value="console">Console</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="console" className="space-y-4">
                <div className="bg-black rounded-md p-4 h-[400px] overflow-y-auto font-mono text-sm text-white">
                  {consoleMessages.length === 0 ? (
                    <div className="text-gray-400 text-center mt-8">
                      <p>No console output yet.</p>
                      <p className="mt-2">Click "Run Agent" to execute the agent and see results here.</p>
                    </div>
                  ) : (
                    consoleMessages.map((msg, index) => (
                      <div key={index} className="mb-2">
                        <span className="text-gray-400">[{msg.timestamp.toLocaleTimeString()}] </span>
                        <span className={`
                          ${msg.type === 'error' ? 'text-red-400' : ''}
                          ${msg.type === 'system' ? 'text-blue-400' : ''}
                          ${msg.type === 'agent' ? 'text-green-400' : ''}
                          ${msg.type === 'tool' ? 'text-yellow-400' : ''}
                        `}>
                          {msg.content}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setConsoleMessages([])}>
                    Clear Console
                  </Button>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-scroll" defaultChecked />
                    <Label htmlFor="auto-scroll">Auto-scroll</Label>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="insights" className="space-y-4">
                {insights.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-8 h-[400px] flex items-center justify-center">
                    <div className="text-center">
                      <Database className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-4 text-lg font-medium">No insights available</h3>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Run an agent with the watchdog_analysis tool enabled to see insights here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[400px] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1 border-r pr-4">
                        <h3 className="font-medium mb-2">Available Insights</h3>
                        <div className="space-y-2">
                          {insights.map((insight, index) => (
                            <div
                              key={index}
                              className={`p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                selectedInsight === insight ? 'bg-gray-100 dark:bg-gray-800' : ''
                              }`}
                              onClick={() => setSelectedInsight(insight)}
                            >
                              <p className="font-medium truncate">{insight.title || `Insight ${index + 1}`}</p>
                              {insight.score !== undefined && (
                                <div className="flex items-center mt-1">
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                                    <div
                                      className="bg-blue-600 h-1.5 rounded-full"
                                      style={{ width: `${Math.max(0, Math.min(100, insight.score * 100))}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs ml-2">{Math.round(insight.score * 100)}%</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="md:col-span-2">
                        {selectedInsight ? (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-medium">{selectedInsight.title}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {selectedInsight.description}
                              </p>
                            </div>
                            
                            <Separator />
                            
                            <div>
                              <h4 className="text-sm font-medium mb-2">Raw Data</h4>
                              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 overflow-auto max-h-[200px]">
                                <JsonView
                                  value={selectedInsight}
                                  collapsed={1}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500 dark:text-gray-400">Select an insight to view details</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
          
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-auto py-4 justify-start">
                <Wrench className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Add Custom Tool</div>
                  <div className="text-xs text-muted-foreground">Connect external tools and APIs</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 justify-start">
                <Settings className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Advanced Settings</div>
                  <div className="text-xs text-muted-foreground">Configure advanced agent parameters</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 justify-start">
                <Database className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Connect Data Source</div>
                  <div className="text-xs text-muted-foreground">Link to analytics data sources</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto py-4 justify-start">
                <Zap className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Deploy Agent</div>
                  <div className="text-xs text-muted-foreground">Publish agent to production</div>
                </div>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgentStudio;
