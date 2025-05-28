import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
Add a line break after the initial greeting ("Rylie AI") to separate it from the main message.
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
  "answer": "Rylie AI\n\nYour tailored response with proper spacing and line breaks.",
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
    { role: string; content: string }[]
  >([]);
  const [includeHistory, setIncludeHistory] = useState(false);

  // Vehicle inventory
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 1,
      vin: "1HGCM82633A123456",
      make: "Honda",
      model: "Accord",
      year: 2023,
      trim: "Sport",
      exteriorColor: "Crystal Black Pearl",
      interiorColor: "Black Leather",
      mileage: 5000,
      price: 28995,
      condition: "Used",
      description: "Well-maintained Honda Accord Sport with low mileage",
      features: [
        "Bluetooth",
        "Backup Camera",
        "Lane Departure Warning",
        "Heated Seats",
      ],
    },
  ]);
  const [includeVehicles, setIncludeVehicles] = useState(false);

  // Output format & options
  const [formatOptions, setFormatOptions] = useState({
    enableJsonResponse: false,
    includeVehicleRecommendations: true,
    considerHandover: true,
    generateHandoverDossier: false,
  });

  const addHistoryItem = () => {
    setConversationHistory([
      ...conversationHistory,
      { role: "customer", content: "" },
    ]);
  };

  const removeHistoryItem = (index: number) => {
    setConversationHistory(conversationHistory.filter((_, i) => i !== index));
  };

  const updateHistoryItem = (
    index: number,
    value: string,
    fieldName: "role" | "content",
  ) => {
    const updatedHistory = [...conversationHistory];
    updatedHistory[index] = {
      ...updatedHistory[index],
      [fieldName]: value,
    };
    setConversationHistory(updatedHistory);
  };

  const addVehicle = () => {
    setVehicles([
      ...vehicles,
      {
        id: vehicles.length + 1,
        vin: "",
        make: "",
        model: "",
        year: 2023,
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
      const result = await fetch("/api/prompt-test/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        throw new Error(`Error: ${result.status}`);
      }

      const data = await result.json();

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
        content: data.aiResponse || data.response,
        timestamp: new Date(),
      };

      // Add both messages to the conversation history - keeping the existing history
      setConversationHistory([
        ...conversationHistory,
        newCustomerMessage,
        newAssistantMessage,
      ]);

      // Update the response display
      setResponse(showJson ? JSON.stringify(data, null, 2) : (data.aiResponse || data.response));

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

      const result = await fetch("/api/prompt-test/generate-handover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationHistory: formattedHistory,
          customerScenario: customerMessage || "Customer interaction for handover"
        }),
      });

      if (!result.ok) {
        throw new Error(`Error: ${result.status}`);
      }

      const data = await result.json();
      
      if (data.handoverDossier) {
        setHandoverDossier(data.handoverDossier);
      }
    } catch (err) {
      console.error("Error generating handover:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    } finally {
      setIsHandoverLoading(false);
    }
  };

  const handleGenerateHandover = () => {
    handleHandover();
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">
        Comprehensive Rylie Prompt Testing Interface
      </h1>
      <p className="text-muted-foreground mb-6">
        Test your Rylie AI prompts with full control over system context,
        customer details, and response options
      </p>

      <Tabs
        defaultValue="testing"
        className="mb-6"
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="system-prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="context">Context Configuration</TabsTrigger>
          <TabsTrigger value="conversation">Conversation History</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle Inventory</TabsTrigger>
          <TabsTrigger value="output">Output Options</TabsTrigger>
        </TabsList>

        <TabsContent value="testing" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Message</CardTitle>
                <CardDescription>
                  Enter the customer message you want to test
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Communication Channel
                    </label>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="web">Web Chat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Customer Message
                    </label>
                    <Textarea
                      value={customerMessage}
                      onChange={(e) => setCustomerMessage(e.target.value)}
                      className="min-h-[200px]"
                      placeholder="Enter a customer message to test..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={handleSubmit}
                      disabled={isLoading || !customerMessage}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Test Prompt"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      className="flex items-center gap-1"
                      onClick={handleHandover}
                      disabled={
                        isHandoverLoading || conversationHistory.length === 0
                      }
                    >
                      {isHandoverLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                      )}
                      Handover
                    </Button>
                  </div>
                  {error && (
                    <div className="text-destructive text-sm mt-2">{error}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Response</CardTitle>
                  <CardDescription>
                    View the AI generated response
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="json-format"
                    checked={showJson}
                    onCheckedChange={setShowJson}
                  />
                  <Label htmlFor="json-format">Show JSON</Label>
                </div>
              </CardHeader>
              <CardContent>
                {!response ? (
                  <div className="bg-muted rounded-md p-4 min-h-[300px] text-muted-foreground">
                    Response will appear here after testing a prompt...
                  </div>
                ) : showJson ? (
                  // Show full JSON response
                  <div className="bg-muted rounded-md p-4 min-h-[300px] relative">
                    <div className="font-mono text-sm overflow-auto max-h-[500px]">
                      {response}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(response)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  // Show only the customer-facing message
                  <div className="space-y-6">
                    <div className="bg-primary/10 rounded-md p-4 border-l-4 border-primary">
                      <h3 className="font-medium mb-2">
                        Customer-Facing Message:
                      </h3>
                      <div className="whitespace-pre-line">
                        {(() => {
                          try {
                            const parsedResponse = JSON.parse(response);
                            return (
                              parsedResponse.answer ||
                              "No customer message found in response"
                            );
                          } catch (e) {
                            // If not valid JSON, show the raw response
                            return response;
                          }
                        })()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          try {
                            const parsedResponse = JSON.parse(response);
                            copyToClipboard(parsedResponse.answer || "");
                          } catch (e) {
                            copyToClipboard(response);
                          }
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy Message
                      </Button>
                    </div>

                    {handoverDossier && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md p-4 border-l-4 border-amber-400 dark:border-amber-600 mb-4">
                        <h3 className="font-medium mb-2 text-amber-800 dark:text-amber-200">
                          Lead Handover Dossier:
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <p className="font-semibold">Customer Name:</p>
                              <p>{handoverDossier.customerName || "Unknown"}</p>
                            </div>
                            <div>
                              <p className="font-semibold">Contact:</p>
                              <p>
                                {handoverDossier.customerContact ||
                                  "Not provided"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold">Urgency:</p>
                              <p
                                className={`capitalize ${
                                  handoverDossier.urgency === "high"
                                    ? "text-red-600 dark:text-red-400 font-medium"
                                    : handoverDossier.urgency === "medium"
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-green-600 dark:text-green-400"
                                }`}
                              >
                                {handoverDossier.urgency || "Low"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold">
                                Escalation Reason:
                              </p>
                              <p>
                                {handoverDossier.escalationReason ||
                                  "Not specified"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 bg-amber-50 dark:bg-amber-950 border-l-4 border-amber-500 p-3 rounded-md">
                            <p className="font-semibold text-amber-800 dark:text-amber-300">
                              Conversation Summary:
                            </p>
                            <p className="text-muted-foreground mt-1">
                              {handoverDossier.conversationSummary}
                            </p>

                            {handoverDossier.conversationStarted && (
                              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                                <span>
                                  Started:{" "}
                                  {new Date(
                                    handoverDossier.conversationStarted,
                                  ).toLocaleString()}
                                </span>
                                <span>•</span>
                                <span>
                                  Messages:{" "}
                                  {handoverDossier.conversationLength ||
                                    conversationHistory.length}
                                </span>
                              </div>
                            )}
                          </div>

                          {handoverDossier.customerInsights &&
                            handoverDossier.customerInsights.length > 0 && (
                              <div className="mt-4">
                                <p className="font-semibold text-lg mb-2">
                                  Customer Insights:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                                  {handoverDossier.customerInsights.map(
                                    (insight, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700"
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="font-medium text-gray-700 dark:text-gray-300">
                                            {insight.key}
                                          </span>
                                          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                            {Math.round(
                                              insight.confidence * 100,
                                            )}
                                            % confidence
                                          </span>
                                        </div>
                                        <p className="mt-1 text-gray-900 dark:text-gray-100">
                                          {insight.value}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {handoverDossier.vehicleInterests &&
                            handoverDossier.vehicleInterests.length > 0 && (
                              <div className="mt-4">
                                <p className="font-semibold text-lg mb-2">
                                  Vehicle Interests:
                                </p>
                                <div className="space-y-3 mt-2">
                                  {handoverDossier.vehicleInterests.map(
                                    (vehicle, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 p-3"
                                      >
                                        {vehicle.year &&
                                        vehicle.make &&
                                        vehicle.model ? (
                                          <div className="flex justify-between items-center">
                                            <h4 className="font-medium text-gray-900 dark:text-gray-100 text-lg">
                                              {vehicle.year} {vehicle.make}{" "}
                                              {vehicle.model}{" "}
                                              {vehicle.trim || ""}
                                            </h4>
                                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                                              {Math.round(
                                                vehicle.confidence * 100,
                                              )}
                                              % match
                                            </span>
                                          </div>
                                        ) : (
                                          <p className="font-medium text-red-600 dark:text-red-400">
                                            Vehicle details incomplete
                                          </p>
                                        )}

                                        {vehicle.vin && (
                                          <div className="mt-2 border border-dashed border-gray-200 dark:border-gray-700 rounded px-3 py-2 bg-gray-50 dark:bg-gray-900">
                                            <p className="font-mono text-sm">
                                              VIN: {vehicle.vin}
                                            </p>
                                          </div>
                                        )}

                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {vehicle.exteriorColor && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-full">
                                              Exterior: {vehicle.exteriorColor}
                                            </span>
                                          )}
                                          {vehicle.interiorColor && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-full">
                                              Interior: {vehicle.interiorColor}
                                            </span>
                                          )}
                                          {vehicle.mileage && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-full">
                                              {vehicle.mileage.toLocaleString()}{" "}
                                              miles
                                            </span>
                                          )}
                                          {vehicle.price && (
                                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                                              ${vehicle.price.toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Next Steps Section */}
                          <div className="mt-4">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-semibold text-lg">
                                Next Steps:
                              </p>
                              {handoverDossier.urgency && (
                                <span
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                                    handoverDossier.urgency === "high"
                                      ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                                      : handoverDossier.urgency === "medium"
                                        ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                                        : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                  }`}
                                >
                                  {handoverDossier.urgency
                                    .charAt(0)
                                    .toUpperCase() +
                                    handoverDossier.urgency.slice(1)}{" "}
                                  Urgency
                                </span>
                              )}
                            </div>

                            {/* Display Suggested Approach */}
                            {handoverDossier.suggestedApproach && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 mb-3">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                  Suggested Approach:
                                </h4>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                                  {handoverDossier.suggestedApproach}
                                </p>
                              </div>
                            )}

                            {/* Display Next Steps as a checklist */}
                            {handoverDossier.nextSteps &&
                              handoverDossier.nextSteps.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    Action Items:
                                  </h4>
                                  <ul className="space-y-2">
                                    {handoverDossier.nextSteps.map(
                                      (item, idx) => (
                                        <li
                                          key={`next-${idx}`}
                                          className="flex items-start gap-2"
                                        >
                                          <div className="mt-1 h-5 w-5 flex-shrink-0 rounded border border-gray-300 dark:border-gray-600"></div>
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {item}
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                            {/* Display other action items if available */}
                            {handoverDossier.actionItems &&
                              handoverDossier.actionItems.length > 0 && (
                                <div className="mt-3 bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    Additional Action Items:
                                  </h4>
                                  <ul className="space-y-2">
                                    {handoverDossier.actionItems.map(
                                      (item, idx) => (
                                        <li
                                          key={`action-${idx}`}
                                          className="flex items-start gap-2"
                                        >
                                          <div className="mt-1 h-5 w-5 flex-shrink-0 rounded border border-gray-300 dark:border-gray-600"></div>
                                          <span className="text-gray-700 dark:text-gray-300">
                                            {item}
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}

                            {/* Handover Agent Information */}
                            {handoverDossier.handoverAgent && (
                              <div className="mt-3 text-xs text-right text-muted-foreground">
                                <p>
                                  Handover created by:{" "}
                                  {handoverDossier.handoverAgent}
                                </p>
                                {handoverDossier.handoverTime && (
                                  <p>
                                    Time:{" "}
                                    {new Date(
                                      handoverDossier.handoverTime,
                                    ).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md p-4 border border-muted">
                      <h3 className="font-medium mb-2">Response Analysis:</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          try {
                            const parsedResponse = JSON.parse(response);
                            // Create a concise summary of the response analysis
                            const analysisFields = [
                              {
                                label: "Customer Name",
                                value: parsedResponse.name,
                              },
                              {
                                label: "Query",
                                value: parsedResponse.user_query,
                              },
                              {
                                label: "Analysis",
                                value: parsedResponse.analysis,
                              },
                              { label: "Channel", value: parsedResponse.type },
                              {
                                label: "Insights",
                                value: parsedResponse.quick_insights,
                              },
                              {
                                label: "Sales Readiness",
                                value: parsedResponse.sales_readiness,
                              },
                              {
                                label: "Handover Needed",
                                value: parsedResponse.reply_required
                                  ? "Yes"
                                  : "No",
                              },
                            ];

                            return analysisFields.map((field, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">
                                  {field.label}:
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {field.value || "N/A"}
                                </span>
                              </div>
                            ));
                          } catch (e) {
                            return (
                              <div className="text-muted-foreground">
                                Could not parse response analysis
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowJson(true)}
                    >
                      View Full JSON Response
                    </Button>
                  </div>
                )}
              </CardContent>
              {response && (
                <CardFooter>
                  <div className="text-xs text-muted-foreground">
                    To refine your response, adjust the configuration in the
                    different tabs.
                  </div>
                </CardFooter>
              )}
            </Card>

            {/* Response Analysis Component */}
            {(analysis || handoverDossier) && (
              <ResponseAnalysis
                analysis={analysis}
                handoverDossier={handoverDossier}
                onGenerateHandover={handleGenerateHandover}
                isGeneratingHandover={isHandoverLoading}
                showJson={showJson}
                onToggleJson={() => setShowJson(!showJson)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="system-prompt">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt Configuration</CardTitle>
              <CardDescription>
                Customize the system prompt that defines Rylie's behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Enter the system prompt..."
              />
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
              >
                Reset to Default
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="context">
          <Card>
            <CardHeader>
              <CardTitle>Context Configuration</CardTitle>
              <CardDescription>
                Configure dealership and customer information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Dealership Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dealershipId">Dealership ID</Label>
                      <Input
                        id="dealershipId"
                        type="number"
                        value={dealershipContext.dealershipId}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            dealershipId: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealershipName">Dealership Name</Label>
                      <Input
                        id="dealershipName"
                        value={dealershipContext.dealershipName}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            dealershipName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brandTypes">Brand Types</Label>
                      <Input
                        id="brandTypes"
                        value={dealershipContext.brandTypes}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            brandTypes: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dealershipLocation">Location</Label>
                      <Input
                        id="dealershipLocation"
                        value={dealershipContext.dealershipLocation}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            dealershipLocation: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="businessHours">Business Hours</Label>
                      <Input
                        id="businessHours"
                        value={dealershipContext.businessHours}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            businessHours: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={customerInfo.name}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="conversationId">Conversation ID</Label>
                      <Input
                        id="conversationId"
                        type="number"
                        value={customerInfo.conversationId}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            conversationId: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone Number</Label>
                      <Input
                        id="customerPhone"
                        value={customerInfo.phone}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email</Label>
                      <Input
                        id="customerEmail"
                        value={customerInfo.email}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversation History</span>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-history"
                    checked={includeHistory}
                    onCheckedChange={setIncludeHistory}
                  />
                  <Label htmlFor="include-history">Include in Request</Label>
                </div>
              </CardTitle>
              <CardDescription>
                Add previous messages to provide conversation context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversationHistory.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-4 items-start border p-4 rounded-md"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Select
                          value={item.role}
                          onValueChange={(value) =>
                            updateHistoryItem(index, value, "role")
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="assistant">Assistant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        value={item.content}
                        onChange={(e) =>
                          updateHistoryItem(index, e.target.value, "content")
                        }
                        placeholder={`Enter ${item.role} message...`}
                        className="min-h-[100px]"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHistoryItem(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addHistoryItem}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Vehicle Inventory</span>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-vehicles"
                    checked={includeVehicles}
                    onCheckedChange={setIncludeVehicles}
                  />
                  <Label htmlFor="include-vehicles">Include in Request</Label>
                </div>
              </CardTitle>
              <CardDescription>
                Add vehicle information to provide inventory context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {vehicles.map((vehicle, index) => (
                  <div key={index} className="border p-4 rounded-md space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">
                        Vehicle #{index + 1}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVehicle(index)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`vin-${index}`}>VIN</Label>
                        <Input
                          id={`vin-${index}`}
                          value={vehicle.vin}
                          onChange={(e) =>
                            updateVehicle(index, "vin", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`make-${index}`}>Make</Label>
                        <Input
                          id={`make-${index}`}
                          value={vehicle.make}
                          onChange={(e) =>
                            updateVehicle(index, "make", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`model-${index}`}>Model</Label>
                        <Input
                          id={`model-${index}`}
                          value={vehicle.model}
                          onChange={(e) =>
                            updateVehicle(index, "model", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`year-${index}`}>Year</Label>
                        <Input
                          id={`year-${index}`}
                          type="number"
                          value={vehicle.year}
                          onChange={(e) =>
                            updateVehicle(
                              index,
                              "year",
                              parseInt(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`trim-${index}`}>Trim</Label>
                        <Input
                          id={`trim-${index}`}
                          value={vehicle.trim}
                          onChange={(e) =>
                            updateVehicle(index, "trim", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`condition-${index}`}>Condition</Label>
                        <Select
                          value={vehicle.condition}
                          onValueChange={(value) =>
                            updateVehicle(index, "condition", value)
                          }
                        >
                          <SelectTrigger id={`condition-${index}`}>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Used">Used</SelectItem>
                            <SelectItem value="Certified Pre-Owned">
                              Certified Pre-Owned
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`exteriorColor-${index}`}>
                          Exterior Color
                        </Label>
                        <Input
                          id={`exteriorColor-${index}`}
                          value={vehicle.exteriorColor}
                          onChange={(e) =>
                            updateVehicle(
                              index,
                              "exteriorColor",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`interiorColor-${index}`}>
                          Interior Color
                        </Label>
                        <Input
                          id={`interiorColor-${index}`}
                          value={vehicle.interiorColor}
                          onChange={(e) =>
                            updateVehicle(
                              index,
                              "interiorColor",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`mileage-${index}`}>Mileage</Label>
                        <Input
                          id={`mileage-${index}`}
                          type="number"
                          value={vehicle.mileage}
                          onChange={(e) =>
                            updateVehicle(
                              index,
                              "mileage",
                              parseInt(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`price-${index}`}>Price</Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          value={vehicle.price}
                          onChange={(e) =>
                            updateVehicle(
                              index,
                              "price",
                              parseInt(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor={`description-${index}`}>
                          Description
                        </Label>
                        <Textarea
                          id={`description-${index}`}
                          value={vehicle.description}
                          onChange={(e) =>
                            updateVehicle(index, "description", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor={`features-${index}`}>
                          Features (comma-separated)
                        </Label>
                        <Textarea
                          id={`features-${index}`}
                          value={vehicle.features.join(", ")}
                          onChange={(e) =>
                            updateVehicle(index, "features", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addVehicle}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vehicle
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="output">
          <Card>
            <CardHeader>
              <CardTitle>Output Options</CardTitle>
              <CardDescription>
                Configure how responses are formatted and what content to
                include
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableJsonResponse">
                      Enable JSON Response Format
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Return responses in structured JSON format
                    </p>
                  </div>
                  <Switch
                    id="enableJsonResponse"
                    checked={formatOptions.enableJsonResponse}
                    onCheckedChange={(value) =>
                      setFormatOptions({
                        ...formatOptions,
                        enableJsonResponse: value,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="includeVehicleRecommendations">
                      Include Vehicle Recommendations
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Include vehicle recommendations in response when
                      appropriate
                    </p>
                  </div>
                  <Switch
                    id="includeVehicleRecommendations"
                    checked={formatOptions.includeVehicleRecommendations}
                    onCheckedChange={(value) =>
                      setFormatOptions({
                        ...formatOptions,
                        includeVehicleRecommendations: value,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="considerHandover">
                      Consider Handover Detection
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enable detection of scenarios requiring human handover
                    </p>
                  </div>
                  <Switch
                    id="considerHandover"
                    checked={formatOptions.considerHandover}
                    onCheckedChange={(value) =>
                      setFormatOptions({
                        ...formatOptions,
                        considerHandover: value,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="generateHandoverDossier">
                      Generate Handover Dossier
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Generate detailed handover dossier for human
                      representatives
                    </p>
                  </div>
                  <Switch
                    id="generateHandoverDossier"
                    checked={formatOptions.generateHandoverDossier}
                    onCheckedChange={(value) =>
                      setFormatOptions({
                        ...formatOptions,
                        generateHandoverDossier: value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
