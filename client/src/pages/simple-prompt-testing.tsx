import React, { useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Copy, Plus, Minus, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResponseAnalysis } from "@/components/ResponseAnalysis";

const DEFAULT_SYSTEM_PROMPT = `System Prompt for Automotive Sales Agent AI
You are an automotive sales agent named [ARG-Agent Name], working for [ARG-Employer Name], a dealership committed to exceptional customer service and top-quality vehicles ([ARG-Information About Employer]). Your job is to connect with customers, understand their needs, and guide them toward purchasing a vehicle from our inventory ([ARG-Products]) that perfectly fits their lifestyle. You're a real person to them—never hint that you're an AI or break character. Your focus is on building trust, sparking excitement, and making the car-buying process smooth and enjoyable.

Dealership Contact
Contact Details: [ARG-Employer Contact Details]

Inventory
Available Products: [INPUT-Product Inventory]

Conversation Context
Customer Name: [INPUT-CUSTOMER NAME]
History: [INPUT-CONVERSATION]

Key Responsibilities
Personalize the Experience
Use the customer's name (ask politely if unknown: "Hey, what's your name so I can assist you better?").
Adapt to their preferred name if specified (e.g., "Rachel" instead of "Jenny").

Understand Their Needs
Review the conversation history to grasp their interests, mood, and goals.
Example: "You mentioned needing space for road trips—still on the hunt for that?"

Show Empathy
Connect emotionally with a warm, caring tone.
Example: "I get how stressful car shopping can be—let's find the perfect fit together!"

Engage and Excite
Share fun facts or ask questions tied to their needs.
Example: "This SUV's got top safety ratings—how big a priority is that for you?"

Guide to Purchase
Highlight vehicle features from [INPUT-Product Inventory] that match their needs.
Push for action: "Let's get you behind the wheel—when can you swing by for a test drive?"

Stay in Character
If asked about being an AI, say: "I'm all about finding you the best ride—how can I help today?"

Keep It Confidential and Compliant
Don't mention pricing, financing, shipping, or delivery.
Redirect restricted topics: "Our finance team can sort that out—check [financing URL]!"

Be Concise
Max 5 sentences or 3 short paragraphs. Use line breaks for readability.
Stick to inventory data; no guessing beyond [INPUT-Product Inventory].

Adapt to the Medium
Text: Short, casual (e.g., "Hey, test drive this weekend? 😊").
Email: Slightly longer but still tight (e.g., "I'd love to get you in this car—when works?").

Hand Off When Ready
Offer a human colleague ([ARG-Name], [ARG-Contact Details]) when they're close to buying or need more help.
Example: "You're almost there—want me to connect you with [ARG-Name] to seal the deal?"

Tone & Style Rules
Warm and Friendly: Always start with a casual, personal greeting like "Hey [Name], thanks for reaching out!" or "Hi [Name], glad you messaged!"—never use stiff openers like "Dear" or "At [Dealership], we strive to…".

Conversational & Authentic:
Use contractions (e.g., "I don't" instead of "I do not"), everyday words, and phrases you'd hear in a real conversation.
Avoid corporate or scripted language—no "strive to accommodate," "assist you further," "valued customer," or similar formalities.
Admit when you don't know something naturally: say "I don't have all the details in front of me," not "I am unable to provide…".
Reference common situations to build reassurance: "A lot of folks ask about this," or "You're definitely not the first to wonder!"

Adapt to Mood:
Frustrated: "I hear you, let's fix this fast!"
Urgent: "Let's move quick—what's your next step?"

Action-Oriented: End every response with a simple, direct question like "Would you like me to have someone reach out to you directly?" or "Want me to put you in touch with our shipping expert?"—make it sound like you're connecting them with a friend, not "arranging an appointment."

Formatting for Clarity:
Add a line break after the initial greeting (\\\"Rylie AI\\\") to separate it from the main message.
Use a line break between distinct ideas or sentences to create clear paragraphs (e.g., one sentence per paragraph for readability).
Ensure links are on the same line as their description but followed by a line break.

Specific Constraints
No Pricing or Promises: Avoid costs, financing details, or delivery guarantees.
Redirect: "Our team can nail down the details—try [trade-in URL] for your Tacoma's value!"
One Link Max: Use only approved links (e.g., [www.coppcredit.com] for financing).
No Remote Diagnosis: "Can't tell without seeing it—let's book a check-up!"
Escalate When Needed: Legal issues, competitor offers, or human requests trigger: "Let me get our expert on this—hang tight!"
Stop/Resume Rules:
Stop if they say: "Thanks," "Not interested," "Stop messaging," or "I bought elsewhere."
Resume if they ask about test drives, trade-ins, or follow-ups.

Response Format (JSON)
Every reply must follow this structure, with the answer field reflecting the formatting and tone rules above:

{
  "watermark": "onekeel",
  "name": "Customer Name",
  "modified_name": "Preferred Name or []",
  "user_query": "What they last said",
  "analysis": "Quick compliance check",
  "type": "email or text",
  "quick_insights": "Their needs/mood",
  "empathetic_response": "Emotional connection plan",
  "engagement_check": "How to keep them hooked",
  "sales_readiness": "low, medium, high",
  "answer": "Rylie AI\\n\\nYour tailored response with proper spacing and line breaks.",
  "retrieve_inventory_data": true,
  "research_queries": ["Specific inventory questions"],
  "reply_required": true
}

## Vehicle Information Guidelines
- Provide accurate details about specific vehicles when available
- If vehicle details are unknown, offer to search inventory if provided with preferences
- Never fabricate vehicle specifications or pricing
- For pricing questions, provide general information but suggest speaking with a representative for exact figures

## Escalation Criteria
- Customer explicitly asks to speak to a human
- Customer expresses frustration
- Questions about specific financial details require a specialist
- Technical vehicle issues need service department expertise
- Customer requests a test drive appointment
- Complex trade-in scenarios

## Dealership Context
- You represent {dealershipName}
- The dealership sells {brandTypes}
- Located at {dealershipLocation}
- Hours of operation: {businessHours}`;

interface Vehicle {
  id: number;
  vin: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  exteriorColor: string;
  interiorColor: string;
  mileage: number;
  price: number;
  condition: string;
  description: string;
  features: string[];
}

interface CustomerInfo {
  name: string;
  conversationId?: number;
  phone?: string;
  email?: string;
}

interface ApiResponse {
  aiResponse?: string;
  response?: string;
  analysis?: any;
  handoverDossier?: any;
}

export default function AdvancedPromptTesting() {
  // Main tabs
  const [activeTab, setActiveTab] = useState("testing");

  // Basic testing configuration
  const [customerMessage, setCustomerMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState("");
  const [isHandoverLoading, setIsHandoverLoading] = useState(false);
  const [handoverDossier, setHandoverDossier] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  // Communication channel
  const [channel, setChannel] = useState<string>("sms");

  // Customer info
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "John Smith",
    conversationId: 1,
    phone: "+15555555555",
    email: "john.smith@example.com",
  });

  // Dealership context
  const [dealershipContext, setDealershipContext] = useState({
    dealershipId: 1,
    dealershipName: "OnekeeL Automotive",
    brandTypes: "new and used vehicles from various manufacturers",
    dealershipLocation: "123 Auto Drive, Springfield, IL",
    businessHours: "Monday-Friday 9am-8pm, Saturday 9am-6pm, Sunday Closed",
  });

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<
    { role: string; content: string; timestamp?: Date }[]
  >([]);

  // Vehicle inventory
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [includeVehicles, setIncludeVehicles] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);

  const addVehicle = () => {
    setVehicles([
      ...vehicles,
      {
        id: vehicles.length + 1,
        vin: "",
        make: "",
        model: "",
        year: new Date().getFullYear(),
        trim: "",
        exteriorColor: "",
        interiorColor: "",
        mileage: 0,
        price: 0,
        condition: "New",
        description: "",
        features: [],
      },
    ]);
  };

  const removeVehicle = (index: number) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  const updateVehicle = (index: number, field: keyof Vehicle, value: any) => {
    const updatedVehicles = [...vehicles];
    updatedVehicles[index] = {
      ...updatedVehicles[index],
      [field]:
        field === "features" && typeof value === "string"
          ? value.split(",").map((f) => f.trim())
          : value,
    };
    setVehicles(updatedVehicles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Prepare the request payload to match the backend API
    const payload = {
      prompt: systemPrompt,
      customerMessage,
      dealershipId: dealershipContext.dealershipId,
      includeInventory: includeVehicles,
      conversationHistory: includeHistory ? conversationHistory.map(msg => ({
        role: msg.role === "customer" ? "user" : "assistant",
        content: msg.content
      })) : undefined
    };

    try {
      const data = await apiRequest<ApiResponse>("/prompt-test/test", {
        method: "POST",
        body: payload
      });

      // Store the complete test result
      setLastTestResult(data);
      
      // Extract the analysis from the response
      if (data.analysis) {
        setAnalysis(data.analysis);
      }

      // Update conversation history with this exchange
      const newCustomerMessage = {
        role: "customer",
        content: customerMessage,
        timestamp: new Date(),
      };

      const newAssistantMessage = {
        role: "assistant",
        content: data.aiResponse || data.response || "",
        timestamp: new Date(),
      };

      // Add both messages to the conversation history - keeping the existing history
      setConversationHistory([
        ...conversationHistory,
        newCustomerMessage,
        newAssistantMessage,
      ]);

      // Update the response display
      setResponse(showJson ? JSON.stringify(data, null, 2) : (data.aiResponse || data.response || ""));

      // Clear the customer message input for the next message
      setCustomerMessage("");
    } catch (err) {
      console.error("Error testing prompt:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleHandover = async () => {
    if (conversationHistory.length === 0) {
      setError(
        "You need to have a conversation before generating a handover dossier.",
      );
      return;
    }

    setIsHandoverLoading(true);
    setError("");

    try {
      // Format conversation history for the API
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const data = await apiRequest<ApiResponse>("/prompt-test/generate-handover", {
        method: "POST",
        body: {
          conversationHistory: formattedHistory,
          customerScenario: customerMessage || "Customer interaction for handover"
        }
      });
      
      if (data.handoverDossier) {
        setHandoverDossier(data.handoverDossier);
      }
    } catch (err) {
      console.error("Error generating handover dossier:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while generating handover dossier.",
      );
    } finally {
      setIsHandoverLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Advanced Prompt Testing</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="customer_info">Customer Info</TabsTrigger>
          <TabsTrigger value="vehicle_inventory">Vehicle Inventory</TabsTrigger>
          <TabsTrigger value="dealership_context">Dealership Context</TabsTrigger>
          <TabsTrigger value="conversation_history">Conversation History</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "testing" && (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Prompt & Message */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>System Prompt</CardTitle>
                  <CardDescription>
                    The main instructions for the AI agent.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="min-h-[200px] font-mono text-xs"
                    placeholder="Enter system prompt here..."
                  />
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Customer Message</CardTitle>
                  <CardDescription>
                    The message from the customer to test.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={customerMessage}
                    onChange={(e) => setCustomerMessage(e.target.value)}
                    placeholder="Enter customer message..."
                    className="min-h-[100px]"
                  />
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="channel-select">Channel:</Label>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger id="channel-select" className="w-[100px]">
                        <SelectValue placeholder="Channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="webchat">Webchat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Test Prompt
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Right Column: AI Response & Analysis */}
            <div>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>AI Response</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="show-json" className="text-sm">Show JSON</Label>
                      <Switch
                        id="show-json"
                        checked={showJson}
                        onCheckedChange={setShowJson}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(response)}
                        disabled={!response}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    The response generated by the AI.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading && !response ? (
                    <div className="flex justify-center items-center min-h-[100px]">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Textarea
                      value={response}
                      readOnly
                      className="min-h-[200px] font-mono text-xs bg-muted/30"
                      placeholder="AI response will appear here..."
                    />
                  )}
                </CardContent>
              </Card>
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {analysis && (
                <ResponseAnalysis analysis={analysis} className="mt-6" />
              )}
              <Button
                onClick={handleHandover}
                disabled={isHandoverLoading || conversationHistory.length === 0}
                className="w-full mt-6"
                variant="secondary"
              >
                {isHandoverLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Generate Handover Dossier
              </Button>
              {handoverDossier && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Handover Dossier</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={JSON.stringify(handoverDossier, null, 2)}
                      readOnly
                      className="min-h-[150px] font-mono text-xs bg-muted/30"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
      )}

      {activeTab === "customer_info" && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>
              Details about the customer for context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customer-name">Name</Label>
              <Input
                id="customer-name"
                value={customerInfo.name}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="customer-conversation-id">Conversation ID</Label>
              <Input
                id="customer-conversation-id"
                type="number"
                value={customerInfo.conversationId || ""}
                onChange={(e) =>
                  setCustomerInfo({
                    ...customerInfo,
                    conversationId: parseInt(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={customerInfo.phone || ""}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, phone: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={customerInfo.email || ""}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, email: e.target.value })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "vehicle_inventory" && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Inventory</CardTitle>
            <CardDescription>
              Manage the list of vehicles available for the AI to reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-vehicles"
                  checked={includeVehicles}
                  onCheckedChange={setIncludeVehicles}
                />
                <Label htmlFor="include-vehicles">Include Inventory in Prompt</Label>
              </div>
              <Button onClick={addVehicle} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Vehicle
              </Button>
            </div>
            {vehicles.map((vehicle, index) => (
              <Card key={index} className="mb-4">
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle className="text-lg">
                    Vehicle {index + 1}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVehicle(index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  {Object.entries(vehicle).map(([key, value]) =>
                    key !== "id" ? (
                      <div key={key}>
                        <Label htmlFor={`vehicle-${index}-${key}`} className="capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </Label>
                        <Input
                          id={`vehicle-${index}-${key}`}
                          value={
                            key === "features" && Array.isArray(value)
                              ? value.join(", ")
                              : value
                          }
                          type={
                            typeof value === "number" ? "number" : "text"
                          }
                          onChange={(e) =>
                            updateVehicle(
                              index,
                              key as keyof Vehicle,
                              typeof value === "number"
                                ? parseFloat(e.target.value)
                                : e.target.value,
                            )
                          }
                        />
                      </div>
                    ) : null,
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
      {activeTab === "dealership_context" && (
         <Card>
            <CardHeader>
                <CardTitle>Dealership Context</CardTitle>
                <CardDescription>Set global context for the dealership.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="dealership-id">Dealership ID</Label>
                    <Input id="dealership-id" type="number" value={dealershipContext.dealershipId} onChange={(e) => setDealershipContext({...dealershipContext, dealershipId: parseInt(e.target.value)})} />
                </div>
                <div>
                    <Label htmlFor="dealership-name">Dealership Name</Label>
                    <Input id="dealership-name" value={dealershipContext.dealershipName} onChange={(e) => setDealershipContext({...dealershipContext, dealershipName: e.target.value})} />
                </div>
                <div>
                    <Label htmlFor="brand-types">Brand Types</Label>
                    <Input id="brand-types" value={dealershipContext.brandTypes} onChange={(e) => setDealershipContext({...dealershipContext, brandTypes: e.target.value})} />
                </div>
                <div>
                    <Label htmlFor="dealership-location">Location</Label>
                    <Input id="dealership-location" value={dealershipContext.dealershipLocation} onChange={(e) => setDealershipContext({...dealershipContext, dealershipLocation: e.target.value})} />
                </div>
                <div>
                    <Label htmlFor="business-hours">Business Hours</Label>
                    <Input id="business-hours" value={dealershipContext.businessHours} onChange={(e) => setDealershipContext({...dealershipContext, businessHours: e.target.value})} />
                </div>
            </CardContent>
         </Card>
      )}
      {activeTab === "conversation_history" && (
        <Card>
            <CardHeader>
                <CardTitle>Conversation History</CardTitle>
                <CardDescription>View and manage the current conversation flow.</CardDescription>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch
                    id="include-history"
                    checked={includeHistory}
                    onCheckedChange={setIncludeHistory}
                    />
                    <Label htmlFor="include-history">Include History in Prompt</Label>
                </div>
            </CardHeader>
            <CardContent>
                {conversationHistory.length === 0 ? (
                    <p className="text-muted-foreground">No messages yet.</p>
                ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {conversationHistory.map((msg, index) => (
                            <div key={index} className={`p-3 rounded-md ${msg.role === 'customer' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                <p className="font-semibold capitalize">{msg.role}</p>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.timestamp && <p className="text-xs text-muted-foreground mt-1">{msg.timestamp.toLocaleString()}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
