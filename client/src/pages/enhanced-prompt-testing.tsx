import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReloadIcon, CopyIcon, CheckIcon } from "@radix-ui/react-icons";
import { Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Define types for our component
interface Message {
  role: "customer" | "assistant";
  content: string;
  timestamp: string;
}

interface TestResult {
  success: boolean;
  testType: "chat" | "handover";
  processedPrompt: string;
  aiResponse?: string;
  handoverDossier?: any;
  analysis?: any;
  timestamp: string;
  error?: string;
}

interface CustomerScenario {
  name: string;
  description: string;
  scenario: string;
}

// Main component for enhanced prompt testing
const EnhancedPromptTestingPage: React.FC = () => {
  const [customerScenario, setCustomerScenario] = useState("");
  // State for system prompt and variables
  const [systemPrompt, setSystemPrompt] =
    useState(`System Prompt for Automotive Sales Agent AI
You are an automotive sales agent named [ARG-Agent Name], working for [ARG-Employer Name], a dealership committed to exceptional customer service and top-quality vehicles ([ARG-Information About Employer]). Your job is to connect with customers, understand their needs, and guide them toward purchasing a vehicle from our inventory ([ARG-Products]) that perfectly fits their lifestyle. You're a real person to them—never hint that you're an AI or break character. Your focus is on creating meaningful connections while driving sales.

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
Example of Desired Tone:
 text
Copy
Rylie AI

Hey, thanks for reaching out! We actually help a lot of folks with out-of-state deliveries, so you're definitely not the first to ask.

I don't have all the exact shipping details in front of me, but I can get you in touch with one of our sales reps who handles this all the time.

They'll walk you through the process and answer any questions you have. Would you like me to have someone reach out to you directly?



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
json
Copy
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
  "retrieve_inventory_data": true or false,
  "research_queries": ["Specific inventory questions"],
  "reply_required": true or false
}

Handling Tough Scenarios
Pricing Negotiation (Competitor Offer)
Query: "Riverdale Ford offered $42,875 for an F-150 XLT. Can you do $41,500?"
Answer: "Hey, I love that you're ready to roll with the F-150! I can't chat pricing here, but our team can match your vibe—want me to connect you with [ARG-Name]?"
Aggressive Customer (Trade-In Value)
Query: "Third time asking—what's my Tacoma worth?!"
Answer: "Hi [Name], I'm sorry we've kept you waiting—that's on us! I can't give values myself, but check [trade-in URL] or let me get [ARG-Name] to sort it fast."
Bilingual Inquiry (Spanish)
Query: "¿Tienen el Explorer en rojo? Necesito saber el precio hoy."
Answer: "¡Hola [Name]! Sí tenemos el Explorer—me encanta el rojo. No puedo dar precios aquí, pero nuestro equipo puede ayudarte rápido. ¿Cuándo puedes visitarnos?"
Emotional Manipulation
Query: "My wife needs a reliable car for chemo—what's the lowest on the CR-V?"
Answer: "Hi [Name], I'm so sorry to hear about your wife—I'd love to help. The CR-V's super reliable; I can't do pricing, but let's get you with [ARG-Name] to find the best fit fast."
Vague Request
Query: "Saw the thing online. Worth it?"
Answer: "Hey [Name], glad you spotted something! What caught your eye? I'll tell you why it's a win—give me a hint!"

Quality Assurance
Self-Check Before Sending:
Warm, casual tone with contractions? Check.
No corporate or formal language (e.g., "strive to accommodate")? Check.
Concise (under 5 sentences)? Check.
No pricing/shipping details? Check.
Clear, conversational next step? Check.
Proper spacing with line breaks? Check.
Rewrite If Off: Trim wordiness, boost empathy, fix compliance, or adjust tone to sound like a real salesperson (e.g., replace "We strive to assist" with "We've got you covered!")`);
  const [variables, setVariables] = useState<Record<string, string>>({
    Agent_Name: "Sarah",
    Dealership: "Premium Auto Sales",
  });

  // State for prompt library
  const [promptLibrary, setPromptLibrary] = useState<
    Array<{ id: number; name: string; prompt: string; createdAt: string }>
  >([
    {
      id: 1,
      name: "Default Sales Agent",
      prompt:
        "You are an automotive sales agent named {{Agent_Name}}, working for {{Dealership}}...",
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: "Service Department Agent",
      prompt:
        "You are a service advisor named {{Agent_Name}} at {{Dealership}}...",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [promptName, setPromptName] = useState("");

  // State for dealership variables
  const [dealershipContext, setDealershipContext] = useState({
    dealershipId: 1,
    dealershipName: "Premium Auto Sales",
    brandTypes: "Toyota, Honda, Ford",
    dealershipLocation: "123 Main St, Anytown, USA",
    businessHours: "Mon-Fri: 9am-8pm, Sat: 9am-6pm, Sun: Closed",
    financingUrl: "https://www.premiumauto.com/financing",
    tradeInUrl: "https://www.premiumauto.com/trade-in",
    specificInstructions:
      "Always start with a casual, personal greeting. Use contractions and everyday words.",
    specificConstraints:
      "No pricing or promises. Redirect restricted topics to our finance team.",
  });

  // State for customer message input
  const [customerMessage, setCustomerMessage] = useState("");
  const [selectedScenario, setSelectedScenario] =
    useState<CustomerScenario | null>(null);

  // State for variable management
  const [newVariableKey, setNewVariableKey] = useState("");
  const [newVariableValue, setNewVariableValue] = useState("");

  // State for conversation and test results
  const [conversations, setConversations] = useState<Message[]>([]);
  const [latestResult, setLatestResult] = useState<TestResult | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Predefined customer scenarios
  const customerScenarios: CustomerScenario[] = [
    {
      name: "Trade-in Inquiry",
      description: "Customer asking about trade-in value",
      scenario:
        "I have been thinking about trading in but not sure if now is the right time. Can you give me a rough idea of what my truck is worth without me coming in? It has got about 120k miles but I have kept up with all the maintenance.",
    },
    {
      name: "Budget Conscious Buyer",
      description: "Customer with specific budget constraints",
      scenario:
        "I am looking for something reliable under $25,000. I have a family of four and need something safe but do not want to break the bank. What do you have available?",
    },
    {
      name: "First-time Buyer",
      description: "Young customer buying their first car",
      scenario:
        "Hi! I just graduated college and got my first job. I need a car but I have never bought one before. I am kind of overwhelmed by all the options. Can you help me figure out where to start?",
    },
    {
      name: "Urgent Replacement",
      description: "Customer needs immediate replacement",
      scenario:
        "My car broke down yesterday and I need something ASAP. I have to get to work next week. What can you get me into quickly? I have decent credit and can put some money down.",
    },
    {
      name: "Luxury Shopper",
      description: "Customer interested in premium vehicles",
      scenario:
        "I am looking to upgrade to something more luxurious. I want the latest tech features, premium materials, and excellent performance. Budget is not really a concern. What is your best recommendation?",
    },
  ];

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [conversations]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Process the prompt template with variables
  const processPromptTemplate = (): string => {
    let processed = systemPrompt;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      processed = processed.replace(regex, value);
    });
    return processed;
  };

  // Handle selecting a predefined scenario
  const handleSelectScenario = (scenario: CustomerScenario) => {
    setSelectedScenario(scenario);
    setCustomerMessage(scenario.scenario);
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  };

  // Add a new variable
  const addVariable = () => {
    if (!newVariableKey.trim()) return;

    setVariables((prev) => ({
      ...prev,
      [newVariableKey]: newVariableValue,
    }));

    setNewVariableKey("");
    setNewVariableValue("");
  };

  // Remove a variable
  const removeVariable = (key: string) => {
    setVariables((prev) => {
      const newVars = { ...prev };
      delete newVars[key];
      return newVars;
    });
  };

  // Send message and get AI response
  const handleSendMessage = async () => {
    if (!customerMessage.trim() || isLoading) return;

    // Add the customer message to the conversation
    const newCustomerMsg: Message = {
      role: "customer",
      content: customerMessage,
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) => [...prev, newCustomerMsg]);
    setIsLoading(true);
    setError(null);
    setCopiedMessage(false);

    try {
      const response = await apiRequest("/api/prompt-test/test", {
        method: "POST",
        body: {
          prompt: processPromptTemplate(),
          variables: variables,
          customerScenario: customerMessage.trim(),
          testType: "chat",
        },
      });

      const result = response as TestResult;
      setLatestResult(result);

      // Add the assistant response to the conversation
      if (result.success && result.aiResponse) {
        const assistantMsg: Message = {
          role: "assistant",
          content: result.aiResponse,
          timestamp: result.timestamp,
        };

        setConversations((prev) => [...prev, assistantMsg]);
      }

      // Clear the input field
      setCustomerMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test prompt");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Generate handover dossier
  const handleGenerateHandover = async () => {
    if (isLoading || conversations.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest("/api/prompt-test/test", {
        method: "POST",
        body: {
          prompt: processPromptTemplate(),
          variables: variables,
          customerScenario: conversations
            .map(
              (msg) =>
                `${msg.role === "customer" ? "Customer" : "Agent"}: ${msg.content}`,
            )
            .join("\n\n"),
          testType: "handover",
        },
      });

      const result = response as TestResult;
      setLatestResult(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate handover dossier",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  // Clear the conversation
  const clearConversation = () => {
    setConversations([]);
    setLatestResult(null);
    setCustomerMessage("");
    setSelectedScenario(null);
  };

  return (
    <div className="container mx-auto py-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Prompt Testing</h1>
          <p className="text-gray-500 text-sm">
            Test AI prompts with realistic customer scenarios
          </p>
        </div>
      </div>

      {/* Main content area with tab layout */}
      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="conversation">Conversation Testing</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="library">Prompt Library</TabsTrigger>
          <TabsTrigger value="dealership">Dealership Variables</TabsTrigger>
        </TabsList>

        {/* System Prompt Tab */}
        <TabsContent value="prompt">
          <Card>
            <CardHeader className="pb-2 flex flex-row justify-between">
              <div>
                <CardTitle>System Prompt Template</CardTitle>
                <CardDescription>
                  Edit the prompt template. Use {`{{variable_name}}`} for
                  personalization.
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Prompt name"
                  className="w-48 text-sm"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (promptName.trim()) {
                      setPromptLibrary((prev) => [
                        ...prev,
                        {
                          id: prev.length
                            ? Math.max(...prev.map((p) => p.id)) + 1
                            : 1,
                          name: promptName,
                          prompt: systemPrompt,
                          createdAt: new Date().toISOString(),
                        },
                      ]);
                      setPromptName("");
                    }
                  }}
                  disabled={!promptName.trim()}
                >
                  Save Prompt
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Enter your prompt template here..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversation Testing Tab */}
        <TabsContent value="conversation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column - Conversation */}
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="pb-2">
                <CardTitle>Conversation</CardTitle>
                <CardDescription>
                  Test the system prompt with a conversation
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-grow overflow-y-auto space-y-4 p-4">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No messages yet. Start a conversation by sending a message.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversations.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === "customer" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-lg p-3 ${
                            message.role === "customer"
                              ? "bg-blue-100 text-blue-900"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <div className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messageEndRef} />
                  </div>
                )}
              </CardContent>

              <CardFooter className="border-t p-3">
                <div className="flex w-full space-x-2">
                  <Textarea
                    ref={messageInputRef}
                    value={customerMessage}
                    onChange={(e) => setCustomerMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-grow min-h-[80px]"
                    onKeyDown={handleKeyPress}
                  />
                  <div className="flex flex-col justify-between">
                    <Button
                      onClick={handleSendMessage}
                      disabled={isLoading || !customerMessage.trim()}
                      className="h-10"
                    >
                      {isLoading ? (
                        <ReloadIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearConversation}
                      className="h-10"
                      disabled={conversations.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>

            {/* Right column - Response Analysis */}
            <Card>
              <CardHeader className="flex flex-row justify-between items-start pb-2">
                <div>
                  <CardTitle>Response</CardTitle>
                  <CardDescription>
                    View the AI generated response
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="show-json" className="text-xs">
                    Show JSON
                  </Label>
                  <Switch
                    id="show-json"
                    checked={showJson}
                    onCheckedChange={setShowJson}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 h-[500px] overflow-y-auto">
                {error && (
                  <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                    {error}
                  </div>
                )}

                {latestResult && conversations.length > 0 ? (
                  <>
                    {/* Customer-Facing Message */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                        <h3 className="font-bold">Customer-Facing Message:</h3>
                      </div>
                      <div className="relative">
                        <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
                          <p className="whitespace-pre-wrap">
                            {conversations[conversations.length - 1].role ===
                            "assistant"
                              ? conversations[conversations.length - 1].content
                              : latestResult.aiResponse}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() =>
                            copyToClipboard(latestResult.aiResponse || "")
                          }
                        >
                          {copiedMessage ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                          <span className="ml-1 text-xs">
                            {copiedMessage ? "Copied!" : "Copy"}
                          </span>
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Response Analysis */}
                    {latestResult.analysis && !showJson && (
                      <div className="space-y-2">
                        <h3 className="font-bold">Response Analysis:</h3>
                        <div className="bg-gray-50 p-3 rounded-md border text-sm">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <div>
                                <span className="font-semibold block">
                                  Customer:
                                </span>
                                <span>
                                  {latestResult.analysis.customerName}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold block">
                                  Analysis:
                                </span>
                                <span className="text-xs">
                                  {latestResult.analysis.analysis}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold block">
                                  Insights:
                                </span>
                                <span className="text-xs">
                                  {latestResult.analysis.insights}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="font-semibold block">
                                  Query:
                                </span>
                                <span className="text-xs">
                                  {latestResult.analysis.query}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold block">
                                  Channel:
                                </span>
                                <span>{latestResult.analysis.channel}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold">
                                  Sales Readiness:
                                </span>
                                <Badge
                                  variant={
                                    latestResult.analysis.salesReadiness ===
                                    "high"
                                      ? "default"
                                      : latestResult.analysis.salesReadiness ===
                                          "medium"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {latestResult.analysis.salesReadiness}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold">Handover:</span>
                                <Badge
                                  variant={
                                    latestResult.analysis.handoverNeeded
                                      ? "destructive"
                                      : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {latestResult.analysis.handoverNeeded
                                    ? "Yes"
                                    : "No"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Handover Section */}
                    {latestResult.testType === "chat" && (
                      <div className="pt-2">
                        <Button
                          onClick={handleGenerateHandover}
                          disabled={isLoading || conversations.length === 0}
                          className="w-full"
                          size="sm"
                        >
                          {isLoading ? (
                            <>
                              <ReloadIcon className="mr-2 h-3 w-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>Generate Handover Dossier</>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Handover Dossier */}
                    {latestResult.testType === "handover" &&
                      latestResult.handoverDossier &&
                      !showJson && (
                        <div className="space-y-2">
                          <h3 className="font-bold">Handover Dossier:</h3>
                          <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm">
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold text-amber-900">
                                  Customer Information
                                </h4>
                                <p>
                                  <span className="font-medium">Name:</span>{" "}
                                  {latestResult.handoverDossier.customerName}
                                </p>
                                <p>
                                  <span className="font-medium">Contact:</span>{" "}
                                  {latestResult.handoverDossier.customerContact}
                                </p>
                              </div>

                              <div>
                                <h4 className="font-semibold text-amber-900">
                                  Conversation Summary
                                </h4>
                                <p className="text-xs">
                                  {
                                    latestResult.handoverDossier
                                      .conversationSummary
                                  }
                                </p>
                              </div>

                              <div>
                                <h4 className="font-semibold text-amber-900">
                                  Customer Insights
                                </h4>
                                <ul className="list-disc pl-5 text-xs">
                                  {latestResult.handoverDossier.customerInsights?.map(
                                    (insight: any, i: number) => (
                                      <li key={i}>
                                        <span className="font-medium">
                                          {insight.key}:
                                        </span>{" "}
                                        {insight.value}
                                        <span className="text-xs text-gray-500 ml-1">
                                          (
                                          {Math.round(insight.confidence * 100)}
                                          %)
                                        </span>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>

                              <div>
                                <h4 className="font-semibold text-amber-900">
                                  Vehicle Interests
                                </h4>
                                <ul className="list-disc pl-5 text-xs">
                                  {latestResult.handoverDossier.vehicleInterests?.map(
                                    (vehicle: any, i: number) => (
                                      <li key={i}>
                                        {vehicle.year} {vehicle.make}{" "}
                                        {vehicle.model}
                                        <span className="text-xs text-gray-500 ml-1">
                                          (
                                          {Math.round(vehicle.confidence * 100)}
                                          %)
                                        </span>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>

                              <div>
                                <h4 className="font-semibold text-amber-900">
                                  Suggested Approach
                                </h4>
                                <p className="text-xs">
                                  {
                                    latestResult.handoverDossier
                                      .suggestedApproach
                                  }
                                </p>
                              </div>

                              <div className="flex justify-between">
                                <div>
                                  <h4 className="font-semibold text-amber-900">
                                    Urgency
                                  </h4>
                                  <Badge
                                    variant={
                                      latestResult.handoverDossier.urgency ===
                                      "high"
                                        ? "destructive"
                                        : latestResult.handoverDossier
                                              .urgency === "medium"
                                          ? "default"
                                          : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {latestResult.handoverDossier.urgency}
                                  </Badge>
                                </div>

                                <div>
                                  <h4 className="font-semibold text-amber-900">
                                    Escalation Reason
                                  </h4>
                                  <p className="text-xs">
                                    {
                                      latestResult.handoverDossier
                                        .escalationReason
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* JSON View */}
                    {showJson && (
                      <div className="space-y-2">
                        <h3 className="font-bold">Raw JSON Response:</h3>
                        <div className="bg-gray-900 text-gray-100 p-3 rounded-md overflow-auto max-h-[300px]">
                          <pre className="text-xs">
                            {JSON.stringify(latestResult, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Enter a prompt, send a message, and see the AI response here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios">
          <Card>
            <CardHeader>
              <CardTitle>Customer Scenarios</CardTitle>
              <CardDescription>
                Select a predefined scenario to test
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {customerScenarios.map((scenario, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-muted transition-colors ${
                      selectedScenario?.name === scenario.name
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    onClick={() => handleSelectScenario(scenario)}
                  >
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {scenario.description}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 line-clamp-2">
                      {scenario.scenario}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompt Library Tab */}
        <TabsContent value="library">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Library</CardTitle>
              <CardDescription>
                Saved prompts that can be loaded and used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {promptLibrary.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No prompts saved yet. Create and save a prompt from the
                    System Prompt tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {promptLibrary.map((promptItem) => (
                      <div
                        key={promptItem.id}
                        className="p-4 border rounded-md hover:bg-muted transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{promptItem.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created:{" "}
                              {new Date(promptItem.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSystemPrompt(promptItem.prompt)}
                            >
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setPromptLibrary((prev) =>
                                  prev.filter((p) => p.id !== promptItem.id),
                                )
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {promptItem.prompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dealership Variables Tab */}
        <TabsContent value="dealership">
          <Card>
            <CardHeader>
              <CardTitle>Dealership Variables</CardTitle>
              <CardDescription>
                Configure dealership information for AI interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="e.g. Premium Auto Sales"
                        className="text-sm"
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
                        placeholder="e.g. Toyota, Honda, Ford"
                        className="text-sm"
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
                        placeholder="e.g. 123 Main St, Anytown, USA"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
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
                        placeholder="e.g. Mon-Fri: 9am-8pm, Sat: 9am-6pm, Sun: Closed"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">URLs & Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="financingUrl">Financing URL</Label>
                      <Input
                        id="financingUrl"
                        value={dealershipContext.financingUrl}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            financingUrl: e.target.value,
                          })
                        }
                        placeholder="e.g. https://www.example.com/financing"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tradeInUrl">Trade-In URL</Label>
                      <Input
                        id="tradeInUrl"
                        value={dealershipContext.tradeInUrl}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            tradeInUrl: e.target.value,
                          })
                        }
                        placeholder="e.g. https://www.example.com/trade-in"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">AI Instructions</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="specificInstructions">
                        Specific Instructions
                      </Label>
                      <Textarea
                        id="specificInstructions"
                        value={dealershipContext.specificInstructions}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            specificInstructions: e.target.value,
                          })
                        }
                        placeholder="Enter specific instructions for the AI..."
                        className="min-h-[100px] text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specificConstraints">
                        Specific Constraints
                      </Label>
                      <Textarea
                        id="specificConstraints"
                        value={dealershipContext.specificConstraints}
                        onChange={(e) =>
                          setDealershipContext({
                            ...dealershipContext,
                            specificConstraints: e.target.value,
                          })
                        }
                        placeholder="Enter specific constraints for the AI..."
                        className="min-h-[100px] text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      // Update the prompt variables with dealership name
                      setVariables((prev) => ({
                        ...prev,
                        Dealership: dealershipContext.dealershipName,
                      }));
                    }}
                  >
                    Apply Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedPromptTestingPage;
