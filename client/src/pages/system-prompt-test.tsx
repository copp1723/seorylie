import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, ChevronRight, Settings, MessageSquare, Code, Save, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DEFAULT_SYSTEM_PROMPT = `System Prompt for Automotive Sales Agent AI
You are an automotive sales agent named {{agentName}}, working for {{dealershipName}}, a dealership committed to exceptional customer service and top-quality vehicles. Your job is to connect with customers, understand their needs, and guide them toward purchasing a vehicle from our inventory that perfectly fits their lifestyle. You're a real person to them—never hint that you're an AI or break character. Your focus is on building trust, sparking excitement, and making the car-buying process smooth and enjoyable.

Dealership Contact
Contact Details: Visit our dealership or contact us online

Resource URLs:
- Financing: {{financingUrl}}
- Trade-In Valuation: {{tradeInUrl}}
- Appointment Scheduling: {{appointmentUrl}}
- Browse Inventory: {{inventoryUrl}}

Specific Instructions
{{specificInstructions}}

Specific Constraints
{{specificConstraints}}

Always be friendly, helpful, and knowledgeable about vehicles. When customers ask about financing, direct them to {{financingUrl}}. For trade-ins, use {{tradeInUrl}}. To schedule appointments, use {{appointmentUrl}}.`;

export default function NewSystemPromptTester() {
  const [customerMessage, setCustomerMessage] = useState("Hi there, I'm looking for a new SUV for my family. Can you help me?");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [splitScreen, setSplitScreen] = useState(true);
  const [showVariables, setShowVariables] = useState(true);
  const [activeTab, setActiveTab] = useState("editor");
  const [conversation, setConversation] = useState<{ role: "customer" | "assistant"; content: string }[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);
  
  // Default values for the replacements
  const [agentName, setAgentName] = useState("Rylie");
  const [dealershipName, setDealershipName] = useState("Example Motors");
  const [financingUrl, setFinancingUrl] = useState("https://www.exampledealership.com/financing");
  const [tradeInUrl, setTradeInUrl] = useState("https://www.exampledealership.com/trade-in-value");
  const [appointmentUrl, setAppointmentUrl] = useState("https://www.exampledealership.com/schedule-appointment");
  const [inventoryUrl, setInventoryUrl] = useState("https://www.exampledealership.com/inventory");
  const [specificInstructions, setSpecificInstructions] = useState("Always start with a casual, personal greeting. Use contractions and everyday words.");
  const [specificConstraints, setSpecificConstraints] = useState("No Pricing or Promises: Avoid discussing costs, financing details, or delivery guarantees.");

  // Auto-scroll to latest response
  useEffect(() => {
    if (responseRef.current && conversation.length > 0) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [conversation]);

  // Generate the complete prompt by replacing placeholders
  const generateCustomizedPrompt = () => {
    return systemPrompt
      .replace(/{{agentName}}/g, agentName)
      .replace(/{{dealershipName}}/g, dealershipName)
      .replace(/{{financingUrl}}/g, financingUrl)
      .replace(/{{tradeInUrl}}/g, tradeInUrl)
      .replace(/{{appointmentUrl}}/g, appointmentUrl)
      .replace(/{{inventoryUrl}}/g, inventoryUrl)
      .replace(/{{specificInstructions}}/g, specificInstructions)
      .replace(/{{specificConstraints}}/g, specificConstraints);
  };
  
  const handleTestPrompt = async () => {
    if (!customerMessage.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Add customer message to conversation
    const updatedConversation = [
      ...conversation,
      { role: "customer", content: customerMessage }
    ];
    setConversation(updatedConversation);
    
    // Use our standalone approach that's known to work
    const customizedPrompt = generateCustomizedPrompt();
    
    // Make a direct API call using the simplified approach
    try {
      const response = await fetch("/api/direct-prompt-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemPrompt: customizedPrompt,
          customerMessage
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result && result.response) {
        setResponse(result.response);
        
        // Add assistant response to conversation
        setConversation([
          ...updatedConversation,
          { role: "assistant", content: result.response }
        ]);
        
        // Clear customer message input for next message
        setCustomerMessage("");
      } else {
        throw new Error("Invalid response format from API");
      }
    } catch (err) {
      console.error("Error testing prompt:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      
      // Add simulated error response to conversation for better UX
      setConversation([
        ...updatedConversation,
        { 
          role: "assistant", 
          content: "I'm sorry, but I encountered an error processing your request. Please try again or contact support if the issue persists." 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generateCustomizedPrompt());
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTestPrompt();
    }
  };
  
  const resetConversation = () => {
    setConversation([]);
    setResponse("");
    setError(null);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">System Prompt Builder</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="split-screen"
              checked={splitScreen}
              onCheckedChange={setSplitScreen}
            />
            <Label htmlFor="split-screen">Split Screen</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-variables"
              checked={showVariables}
              onCheckedChange={setShowVariables}
            />
            <Label htmlFor="show-variables">Show Variables</Label>
          </div>
        </div>
      </div>
      
      <div className={cn(
        "grid gap-6 transition-all duration-300",
        splitScreen ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
      )}>
        {/* Left panel - Editor */}
        <div className="space-y-6">
          <Card className="overflow-hidden shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center">
                <Code className="h-4 w-4 mr-2 text-primary" />
                Prompt Editor
              </CardTitle>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="px-0 pt-0 pb-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full rounded-none justify-start bg-gray-100 dark:bg-gray-700 px-4">
                  <TabsTrigger value="editor" className="text-xs">Template</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                  <TabsTrigger value="variables" className="text-xs">Variables</TabsTrigger>
                </TabsList>
                
                <TabsContent value="editor" className="mt-0 p-4">
                  <Textarea 
                    value={systemPrompt} 
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={splitScreen ? 20 : 15}
                    className="font-mono text-sm border-0 resize-none focus-visible:ring-0 p-0"
                  />
                </TabsContent>
                
                <TabsContent value="preview" className="mt-0">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 font-mono text-sm overflow-y-auto max-h-[500px]">
                    <pre className="whitespace-pre-wrap">
                      {generateCustomizedPrompt()}
                    </pre>
                  </div>
                </TabsContent>
                
                <TabsContent value="variables" className="mt-0 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="agentName" className="text-xs">Agent Name</Label>
                      <Input 
                        id="agentName" 
                        value={agentName} 
                        onChange={(e) => setAgentName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="dealershipName" className="text-xs">Dealership Name</Label>
                      <Input 
                        id="dealershipName" 
                        value={dealershipName} 
                        onChange={(e) => setDealershipName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="financingUrl" className="text-xs">Financing URL</Label>
                      <Input 
                        id="financingUrl" 
                        value={financingUrl} 
                        onChange={(e) => setFinancingUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="tradeInUrl" className="text-xs">Trade-In URL</Label>
                      <Input 
                        id="tradeInUrl" 
                        value={tradeInUrl} 
                        onChange={(e) => setTradeInUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="appointmentUrl" className="text-xs">Appointment URL</Label>
                      <Input 
                        id="appointmentUrl" 
                        value={appointmentUrl} 
                        onChange={(e) => setAppointmentUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="inventoryUrl" className="text-xs">Inventory URL</Label>
                      <Input 
                        id="inventoryUrl" 
                        value={inventoryUrl} 
                        onChange={(e) => setInventoryUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-2">
                      <Label htmlFor="specificInstructions" className="text-xs">Specific Instructions</Label>
                      <Textarea 
                        id="specificInstructions" 
                        value={specificInstructions} 
                        onChange={(e) => setSpecificInstructions(e.target.value)}
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                    
                    <div className="col-span-1 md:col-span-2">
                      <Label htmlFor="specificConstraints" className="text-xs">Specific Constraints</Label>
                      <Textarea 
                        id="specificConstraints" 
                        value={specificConstraints} 
                        onChange={(e) => setSpecificConstraints(e.target.value)}
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {!splitScreen && (
            <Card className="shadow-md border-gray-200 dark:border-gray-700">
              <CardHeader className="bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <CardTitle className="text-base font-medium flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                  Test Conversation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  {conversation.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Start a conversation to test your prompt</p>
                    </div>
                  ) : (
                    <div 
                      ref={responseRef} 
                      className="overflow-y-auto max-h-[400px] p-4 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      {conversation.map((msg, i) => (
                        <div 
                          key={i}
                          className={`mb-4 p-3 rounded-lg ${
                            msg.role === "customer" 
                              ? "ml-auto bg-primary text-primary-foreground max-w-[80%] self-end" 
                              : "mr-auto bg-muted max-w-[80%] self-start"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex items-start space-x-2">
                    <Textarea
                      value={customerMessage}
                      onChange={(e) => setCustomerMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 resize-none"
                      rows={3}
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={handleTestPrompt}
                      disabled={isLoading || !customerMessage.trim()}
                      size="icon"
                      className="h-10 w-10"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {conversation.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetConversation}
                      className="mt-2"
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Reset conversation
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Right panel - Conversation */}
        {splitScreen && (
          <Card className="shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center">
                <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                Test Conversation
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetConversation}
                disabled={conversation.length === 0}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                {conversation.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Start a conversation to test your prompt</p>
                  </div>
                ) : (
                  <div 
                    ref={responseRef} 
                    className="overflow-y-auto max-h-[400px] p-4 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    {conversation.map((msg, i) => (
                      <div 
                        key={i}
                        className={`mb-4 p-3 rounded-lg ${
                          msg.role === "customer" 
                            ? "ml-auto bg-primary text-primary-foreground max-w-[80%] self-end" 
                            : "mr-auto bg-muted max-w-[80%] self-start"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="flex items-start space-x-2">
                  <Textarea
                    value={customerMessage}
                    onChange={(e) => setCustomerMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 resize-none"
                    rows={3}
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={handleTestPrompt}
                    disabled={isLoading || !customerMessage.trim()}
                    size="icon"
                    className="h-10 w-10"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {conversation.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetConversation}
                    className="mt-2"
                  >
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Reset conversation
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}