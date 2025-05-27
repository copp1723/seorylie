import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Copy,
  Plus,
  Minus,
  Trash,
  Save,
  RefreshCw,
  FileText,
  ChevronRight,
  ChevronDown,
  BarChart,
  MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  PromptExperiment,
  PromptVariant,
  ExperimentVariant,
  Vehicle,
  CustomerInsight,
  ResponseSuggestion
} from "@shared/schema";

// Sample dealership data (replace with actual data from your API)
const DEFAULT_DEALERSHIP_ID = 1;

interface CustomerInfo {
  name: string;
  conversationId?: number;
  phone?: string;
  email?: string;
}

interface ChatMessage {
  role: 'customer' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface TestResult {
  response: string;
  responseJson?: any;
  responseTime?: number;
  customerInsights?: CustomerInsight[];
  vehicleRecommendations?: Vehicle[];
  responseSuggestions?: ResponseSuggestion[];
  handoverRecommended?: boolean;
  handoverDossier?: any;
  variantId?: number;
}

interface PromptExperimentData {
  id: number;
  name: string;
  description: string | null;
  dealershipId: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  variants: {
    variantId: number;
    name: string;
    content: string; // Frontend uses content, but backend uses promptTemplate
    isControl: boolean;
    trafficAllocation: number;
  }[];
}

// Default system prompt template
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
  "retrieve_inventory_data": true or false,
  "research_queries": ["Specific inventory questions"],
  "reply_required": true or false
}`;

export default function PromptExperimentInterface() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dealershipId = DEFAULT_DEALERSHIP_ID;

  // State for tab management
  const [activeTab, setActiveTab] = useState("testing");
  const [activeSubTab, setActiveSubTab] = useState("single");

  // State for experiment management
  const [experiments, setExperiments] = useState<PromptExperimentData[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(null);

  // State for variant management
  const [variants, setVariants] = useState<PromptVariant[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [editingVariant, setEditingVariant] = useState<PromptVariant | null>(null);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantContent, setNewVariantContent] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isVariantEditor, setIsVariantEditor] = useState(false);

  // State for testing
  const [customerMessage, setCustomerMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testResponse, setTestResponse] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  // Customer info
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "John Smith",
    conversationId: 1,
    phone: "+15555555555",
    email: "john.smith@example.com"
  });

  // Communication channel
  const [channel, setChannel] = useState<string>("sms");

  // Dealership context
  const [dealershipContext, setDealershipContext] = useState({
    dealershipId: 1,
    dealershipName: "OnekeeL Automotive",
    brandTypes: "new and used vehicles from various manufacturers",
    dealershipLocation: "123 Auto Drive, Springfield, IL",
    businessHours: "Monday-Friday 9am-8pm, Saturday 9am-6pm, Sunday Closed",
  });

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [includeHistory, setIncludeHistory] = useState(false);

  // Vehicle inventory
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 1,
      dealershipId: DEFAULT_DEALERSHIP_ID,
      vin: "1HGCM82633A123456",
      stockNumber: "ACCORD2023-001",
      make: "Honda",
      model: "Accord",
      year: 2023,
      trim: "Sport",
      bodyStyle: "Sedan",
      extColor: "Crystal Black Pearl",
      intColor: "Black Leather",
      mileage: 5000,
      engine: "1.5L Turbo",
      transmission: "CVT",
      drivetrain: "FWD",
      fuelType: "Gasoline",
      fuelEconomy: 32,
      msrp: 31000,
      salePrice: 28995,
      price: 28995,
      condition: "used",
      exteriorColor: "Crystal Black Pearl",
      interiorColor: "Black Leather",
      status: "Available",
      certified: false,
      description: "Well-maintained Honda Accord Sport with low mileage",
      features: ["Bluetooth", "Backup Camera", "Lane Departure Warning", "Heated Seats"],
      categoryTags: ["Sedan", "Family Car"],
      images: [],
      videoUrl: "https://example.com/vehicles/honda-accord-2023",
      isActive: true,
      lastSeen: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }
  ]);
  const [includeVehicles, setIncludeVehicles] = useState(true);

  // Comparison testing
  const [comparisonResults, setComparisonResults] = useState<{
    variantId: number;
    variantName: string;
    response: string;
    responseJson?: any;
    responseTime?: number;
  }[]>([]);

  // Alert dialog state
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: "", message: "" });

  // Show response options
  const [showJson, setShowJson] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Output format & options
  const [formatOptions, setFormatOptions] = useState({
    enableJsonResponse: true,
    includeVehicleRecommendations: true,
    considerHandover: true,
    generateHandoverDossier: false,
    detectCustomerInsights: true
  });

  // Fetch experiments
  const { data: experimentsData, isLoading: isExperimentsLoading } = useQuery({
    queryKey: ['/api/prompt-experiments', dealershipId],
    enabled: activeTab === 'experiments',
  });

  // Fetch variants
  const { data: variantsData, isLoading: isVariantsLoading } = useQuery({
    queryKey: ['/api/prompt-variants', dealershipId],
    enabled: activeTab === 'variants',
  });

  useEffect(() => {
    if (experimentsData) {
      setExperiments(experimentsData);
    }
  }, [experimentsData]);

  useEffect(() => {
    if (variantsData) {
      setVariants(variantsData);
    }
  }, [variantsData]);

  // Save variant mutation
  const saveVariantMutation = useMutation({
    mutationFn: async (variant: Partial<PromptVariant>) => {
      return apiRequest(
        variant.id
          ? `/api/prompt-variants/${variant.id}`
          : '/api/prompt-variants',
        variant.id ? 'PATCH' : 'POST',
        variant
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-variants'] });
      toast({
        title: "Success",
        description: editingVariant?.id
          ? "Prompt variant updated successfully"
          : "New prompt variant created"
      });
      resetVariantEditor();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save prompt variant",
        variant: "destructive"
      });
      console.error("Error saving variant:", error);
    }
  });

  // Create experiment mutation
  const createExperimentMutation = useMutation({
    mutationFn: async (experiment: Partial<PromptExperiment>) => {
      return apiRequest('/api/prompt-experiments', 'POST', experiment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-experiments'] });
      toast({
        title: "Success",
        description: "New experiment created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create experiment",
        variant: "destructive"
      });
      console.error("Error creating experiment:", error);
    }
  });

  // Conversation history management
  const addHistoryItem = () => {
    setConversationHistory([
      ...conversationHistory,
      { role: "customer", content: "" }
    ]);
  };

  const removeHistoryItem = (index: number) => {
    setConversationHistory(
      conversationHistory.filter((_, i) => i !== index)
    );
  };

  const updateHistoryItem = (index: number, value: string, fieldName: 'role' | 'content') => {
    const updatedHistory = [...conversationHistory];
    if (fieldName === 'role' && (value === 'customer' || value === 'assistant')) {
      updatedHistory[index] = {
        ...updatedHistory[index],
        role: value
      };
    } else if (fieldName === 'content') {
      updatedHistory[index] = {
        ...updatedHistory[index],
        content: value
      };
    }
    setConversationHistory(updatedHistory);
  };

  // Vehicle inventory management
  const addVehicle = () => {
    const newVehicle: Vehicle = {
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
      dealershipId: dealershipId,
      created_at: new Date(),
      updated_at: new Date(),
      categoryTags: [],
      status: "available",
      images: [],
      videoUrl: ""
    };
    setVehicles([...vehicles, newVehicle]);
  };

  const removeVehicle = (index: number) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  const updateVehicle = (index: number, field: keyof Vehicle, value: any) => {
    const updatedVehicles = [...vehicles];
    if (field === 'features' && typeof value === 'string') {
      updatedVehicles[index] = {
        ...updatedVehicles[index],
        features: value.split(',').map(f => f.trim())
      };
    } else if (field === 'categoryTags' && typeof value === 'string') {
      updatedVehicles[index] = {
        ...updatedVehicles[index],
        categoryTags: value.split(',').map(f => f.trim())
      };
    } else {
      updatedVehicles[index] = {
        ...updatedVehicles[index],
        [field]: value
      };
    }
    setVehicles(updatedVehicles);
  };

  // Variant editor management
  const openVariantEditor = (variant?: PromptVariant) => {
    if (variant) {
      setEditingVariant(variant);
      setNewVariantName(variant.name);
      setNewVariantContent(variant.promptTemplate);
    } else {
      setEditingVariant(null);
      setNewVariantName("");
      setNewVariantContent(DEFAULT_SYSTEM_PROMPT);
    }
    setIsVariantEditor(true);
  };

  const resetVariantEditor = () => {
    setEditingVariant(null);
    setNewVariantName("");
    setNewVariantContent(DEFAULT_SYSTEM_PROMPT);
    setIsVariantEditor(false);
  };

  const handleSaveVariant = () => {
    if (!newVariantName.trim()) {
      toast({
        title: "Validation Error",
        description: "Variant name is required",
        variant: "destructive"
      });
      return;
    }

    const variant: Partial<PromptVariant> = {
      ...(editingVariant?.id ? { id: editingVariant.id } : {}),
      dealershipId,
      name: newVariantName.trim(),
      promptTemplate: newVariantContent,
      isActive: true,
      isControl: editingVariant?.isControl || false
    };

    saveVariantMutation.mutate(variant);
  };

  // Test a single prompt variant
  const testPromptVariant = async (variantId?: number) => {
    setIsLoading(true);
    setError("");

    // Prepare the request payload
    const payload = {
      customerMessage,
      variantId, // Optional - if not provided, will use the system prompt
      systemPrompt: !variantId ? newVariantContent : undefined, // Only used if variantId is not provided
      channel,
      customerInfo,
      dealershipContext,
      conversationHistory: includeHistory ? conversationHistory : [],
      relevantVehicles: includeVehicles ? vehicles : [],
      formatOptions
    };

    try {
      const result = await fetch('/api/prompt-test/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        throw new Error(`Error: ${result.status}`);
      }

      const data = await result.json();

      // Update the response display
      setTestResponse({
        response: data.response,
        responseJson: data.responseJson,
        responseTime: data.responseTime,
        customerInsights: data.customerInsights,
        vehicleRecommendations: data.vehicleRecommendations,
        responseSuggestions: data.responseSuggestions,
        handoverRecommended: data.handoverRecommended,
        handoverDossier: data.handoverDossier,
        variantId: variantId
      });

      // Update conversation history with this exchange
      const newCustomerMessage: ChatMessage = {
        role: 'customer',
        content: customerMessage,
        timestamp: new Date()
      };

      const newAssistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setConversationHistory([...conversationHistory, newCustomerMessage, newAssistantMessage]);

      // Clear the customer message input for the next message
      setCustomerMessage('');
    } catch (error) {
      console.error('Error testing prompt:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Test multiple prompt variants for comparison
  const comparePromptVariants = async () => {
    if (selectedVariants.length < 2) {
      toast({
        title: "Selection Error",
        description: "Please select at least two variants to compare",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError("");
    setComparisonResults([]);

    const basePayload = {
      customerMessage,
      channel,
      customerInfo,
      dealershipContext,
      conversationHistory: includeHistory ? conversationHistory : [],
      relevantVehicles: includeVehicles ? vehicles : [],
      formatOptions
    };

    try {
      const results = [];

      // Test each selected variant sequentially
      for (const variantId of selectedVariants) {
        const variant = variants.find(v => v.id === variantId);
        if (!variant) continue;

        const payload = {
          ...basePayload,
          variantId
        };

        const result = await fetch('/api/prompt-test/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!result.ok) {
          throw new Error(`Error with variant ${variant.name}: ${result.status}`);
        }

        const data = await result.json();

        results.push({
          variantId,
          variantName: variant.name,
          response: data.response,
          responseJson: data.responseJson,
          responseTime: data.responseTime
        });
      }

      setComparisonResults(results);

      // Clear the customer message input for the next message
      setCustomerMessage('');
    } catch (error) {
      console.error('Error comparing prompts:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard"
    });
  };

  // Create a new A/B test experiment
  const createNewExperiment = () => {
    if (selectedVariants.length < 2) {
      toast({
        title: "Selection Error",
        description: "Please select at least two variants for the experiment",
        variant: "destructive"
      });
      return;
    }

    // Open a modal to collect experiment name and details
    setAlertMessage({
      title: "Create New A/B Test Experiment",
      message: "Please enter a name and details for the new experiment."
    });
    setIsAlertOpen(true);
  };

  // Initialize a new experiment with the selected variants
  const handleCreateExperiment = (name: string, description: string) => {
    // Allocate equal traffic to all variants
    const trafficPerVariant = 100 / selectedVariants.length;

    // For simplicity, make the first selected variant the control
    const controlVariantId = selectedVariants[0];

    const newExperiment: Partial<PromptExperiment> = {
      name,
      description,
      dealershipId,
      isActive: true,
      startDate: new Date().toISOString(),
      // Include variant allocations
      experimentVariants: selectedVariants.map(variantId => ({
        variantId,
        trafficAllocation: trafficPerVariant,
        isControl: variantId === controlVariantId
      }))
    };

    createExperimentMutation.mutate(newExperiment);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Rylie AI Prompt Experiment Lab</h1>
      <p className="text-muted-foreground mb-6">
        Test, compare, and optimize your AI prompt variants to improve customer engagement and conversion
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="variants">Prompt Variants</TabsTrigger>
          <TabsTrigger value="experiments">A/B Experiments</TabsTrigger>
          <TabsTrigger value="configuration">Test Configuration</TabsTrigger>
        </TabsList>

        {/* ===== PROMPT TESTING TAB ===== */}
        <TabsContent value="testing" className="space-y-4">
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList>
              <TabsTrigger value="single">Single Variant Test</TabsTrigger>
              <TabsTrigger value="compare">Compare Variants</TabsTrigger>
            </TabsList>

            {/* Single variant testing */}
            <TabsContent value="single" className="pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Message</CardTitle>
                    <CardDescription>
                      Enter a customer message to test your prompt
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Communication Channel</Label>
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

                      {!isVariantEditor && (
                        <div>
                          <Label>Prompt Variant</Label>
                          <Select
                            value={testResponse?.variantId?.toString() || ''}
                            onValueChange={(val) => testPromptVariant(val ? parseInt(val) : undefined)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a variant to test" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Custom Prompt</SelectItem>
                              {variants.map(variant => (
                                <SelectItem key={variant.id} value={variant.id.toString()}>
                                  {variant.name} {variant.isControl ? "(Control)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label>Customer Message</Label>
                        <Textarea
                          value={customerMessage}
                          onChange={(e) => setCustomerMessage(e.target.value)}
                          className="min-h-[150px]"
                          placeholder="Enter a customer message to test..."
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => testPromptVariant(testResponse?.variantId)}
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
                          variant="outline"
                          onClick={() => {
                            setIsVariantEditor(!isVariantEditor);
                            if (!isVariantEditor) {
                              setNewVariantContent(DEFAULT_SYSTEM_PROMPT);
                            }
                          }}
                        >
                          {isVariantEditor ? "Hide Editor" : "Edit Custom Prompt"}
                        </Button>
                      </div>

                      {error && <div className="text-destructive text-sm">{error}</div>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Response</CardTitle>
                      <CardDescription>
                        AI response based on your prompt and settings
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowJson(!showJson)}
                      >
                        {showJson ? "Show Text" : "Show JSON"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAnalytics(!showAnalytics)}
                      >
                        {showAnalytics ? "Hide Analytics" : "Show Analytics"}
                      </Button>
                      {testResponse && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(showJson ? JSON.stringify(testResponse.responseJson, null, 2) : testResponse.response)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {testResponse ? (
                      <div>
                        {!showJson ? (
                          <div className="whitespace-pre-wrap bg-muted rounded-md p-4">
                            {testResponse.response}
                          </div>
                        ) : (
                          <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-[600px]">
                            {JSON.stringify(testResponse.responseJson, null, 2)}
                          </pre>
                        )}

                        {showAnalytics && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <h3 className="text-sm font-medium mb-2">Response Time</h3>
                              <div className="text-sm">{testResponse.responseTime?.toFixed(2)}ms</div>
                            </div>

                            {testResponse.customerInsights && testResponse.customerInsights.length > 0 && (
                              <div>
                                <h3 className="text-sm font-medium mb-2">Customer Insights</h3>
                                <div className="space-y-1">
                                  {testResponse.customerInsights.map((insight, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span>{insight.key}: {insight.value}</span>
                                      <Badge variant={insight.confidence > 0.8 ? "default" : "outline"}>
                                        {Math.round(insight.confidence * 100)}%
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {testResponse.handoverRecommended && (
                              <div>
                                <h3 className="text-sm font-medium mb-2">Handover Recommendation</h3>
                                <Badge variant="destructive">Handover Recommended</Badge>
                                {testResponse.handoverDossier && (
                                  <Accordion type="single" collapsible className="mt-2">
                                    <AccordionItem value="dossier">
                                      <AccordionTrigger>View Handover Dossier</AccordionTrigger>
                                      <AccordionContent>
                                        <pre className="bg-muted rounded-md p-2 text-xs overflow-auto max-h-[300px]">
                                          {JSON.stringify(testResponse.handoverDossier, null, 2)}
                                        </pre>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                )}
                              </div>
                            )}

                            {testResponse.responseSuggestions && testResponse.responseSuggestions.length > 0 && (
                              <div>
                                <h3 className="text-sm font-medium mb-2">Response Suggestions</h3>
                                <div className="space-y-1">
                                  {testResponse.responseSuggestions.map((suggestion, idx) => (
                                    <div key={idx} className="bg-muted rounded-md p-2 text-sm">
                                      <div className="flex justify-between mb-1">
                                        <Badge>{suggestion.category}</Badge>
                                        <Badge variant="outline">Priority: {suggestion.priority}</Badge>
                                      </div>
                                      <p>{suggestion.text}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-muted rounded-md p-4 min-h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <MessageSquare className="mx-auto h-12 w-12 mb-2 opacity-50" />
                          <p>Test a prompt to see the response here</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {isVariantEditor && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Custom Prompt Editor</CardTitle>
                    <CardDescription>
                      Edit your system prompt template
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Prompt Name</Label>
                        <Input
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          placeholder="Enter a name for this prompt variant"
                        />
                      </div>

                      <div>
                        <Label>Prompt Content</Label>
                        <Textarea
                          value={newVariantContent}
                          onChange={(e) => setNewVariantContent(e.target.value)}
                          className="min-h-[400px] font-mono text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleSaveVariant}>
                          Save as New Variant
                        </Button>
                        <Button variant="outline" onClick={resetVariantEditor}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Compare variants testing */}
            <TabsContent value="compare" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Compare Prompt Variants</CardTitle>
                  <CardDescription>
                    Test the same customer message across multiple prompt variants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Communication Channel</Label>
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
                      <Label>Select Variants to Compare</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                        {variants.map(variant => (
                          <div
                            key={variant.id}
                            className={`border rounded-md p-2 cursor-pointer ${
                              selectedVariants.includes(variant.id) ? 'bg-primary/10 border-primary' : ''
                            }`}
                            onClick={() => {
                              if (selectedVariants.includes(variant.id)) {
                                setSelectedVariants(selectedVariants.filter(id => id !== variant.id));
                              } else {
                                setSelectedVariants([...selectedVariants, variant.id]);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{variant.name}</span>
                              {variant.isControl && <Badge>Control</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Customer Message</Label>
                      <Textarea
                        value={customerMessage}
                        onChange={(e) => setCustomerMessage(e.target.value)}
                        className="min-h-[150px]"
                        placeholder="Enter a customer message to test across multiple variants..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={comparePromptVariants}
                        disabled={isLoading || !customerMessage || selectedVariants.length < 2}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Compare Variants"
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={createNewExperiment}
                        disabled={selectedVariants.length < 2}
                      >
                        Create A/B Test
                      </Button>
                    </div>

                    {error && <div className="text-destructive text-sm">{error}</div>}
                  </div>
                </CardContent>
              </Card>

              {comparisonResults.length > 0 && (
                <div className="grid grid-cols-1 gap-6 mt-6">
                  {comparisonResults.map((result, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Variant: {result.variantName}</CardTitle>
                          <Badge variant="outline">{result.responseTime?.toFixed(2)}ms</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="whitespace-pre-wrap bg-muted rounded-md p-4">
                          {result.response}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(result.response)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Response
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== PROMPT VARIANTS TAB ===== */}
        <TabsContent value="variants" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Prompt Variants</h2>
            <Button onClick={() => openVariantEditor()}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Variant
            </Button>
          </div>

          {isVariantsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : variants.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Prompt Variants</h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  Create your first prompt variant to start experimenting with different approaches
                </p>
                <Button onClick={() => openVariantEditor()}>
                  Create Your First Variant
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {variants.map(variant => (
                <Card key={variant.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle>{variant.name}</CardTitle>
                      <div className="flex gap-1">
                        {variant.isControl && <Badge>Control</Badge>}
                        {!variant.isActive && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="content">
                        <AccordionTrigger>View Prompt Content</AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-muted rounded-md p-3 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
                            {variant.content}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="ghost" size="sm" onClick={() => openVariantEditor(variant)}>
                      Edit Variant
                    </Button>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testPromptVariant(variant.id)}
                      >
                        Test Variant
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedVariants.includes(variant.id)) {
                            setSelectedVariants(selectedVariants.filter(id => id !== variant.id));
                          } else {
                            setSelectedVariants([...selectedVariants, variant.id]);
                          }
                          setActiveTab("testing");
                          setActiveSubTab("compare");
                        }}
                      >
                        {selectedVariants.includes(variant.id) ?
                          "Remove from Compare" :
                          "Add to Compare"
                        }
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {isVariantEditor && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{editingVariant ? "Edit Variant" : "Create New Variant"}</CardTitle>
                <CardDescription>
                  {editingVariant ? "Modify this prompt variant" : "Define a new prompt variant for testing"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Variant Name</Label>
                    <Input
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      placeholder="Enter a descriptive name for this variant"
                    />
                  </div>

                  <div>
                    <Label>Prompt Content</Label>
                    <Textarea
                      value={newVariantContent}
                      onChange={(e) => setNewVariantContent(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveVariant}>
                      {editingVariant ? "Update Variant" : "Save New Variant"}
                    </Button>
                    <Button variant="outline" onClick={resetVariantEditor}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== A/B EXPERIMENTS TAB ===== */}
        <TabsContent value="experiments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">A/B Test Experiments</h2>
            <Button
              onClick={createNewExperiment}
              disabled={selectedVariants.length < 2}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </Button>
          </div>

          {isExperimentsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : experiments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No A/B Test Experiments</h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  Create your first experiment to start comparing prompt variants with real customers
                </p>
                <Button
                  onClick={() => {
                    setActiveTab("variants");
                  }}
                >
                  Select Variants to Compare
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {experiments.map(experiment => (
                <Card key={experiment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle>{experiment.name}</CardTitle>
                      <div className="flex gap-1">
                        {experiment.isActive && <Badge variant="outline">Active</Badge>}
                        {!experiment.isActive && <Badge variant="outline" className="bg-muted">Inactive</Badge>}
                      </div>
                    </div>
                    <CardDescription>{experiment.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="variants">
                        <AccordionTrigger>Variants ({experiment.variants?.length || 0})</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {experiment.variants?.map(variant => (
                              <div
                                key={variant.variantId}
                                className="flex justify-between items-center bg-muted p-2 rounded-md"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{variant.name}</span>
                                  {variant.isControl && <Badge variant="secondary">Control</Badge>}
                                </div>
                                <Badge variant="outline">{variant.trafficAllocation}% Traffic</Badge>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Start: {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : 'Not started'}</span>
                        <span>End: {experiment.endDate ? new Date(experiment.endDate).toLocaleDateString() : 'Ongoing'}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm">
                      View Results
                    </Button>
                    <Button variant="ghost" size="sm">
                      {experiment.isActive ? "Stop Experiment" : "Resume Experiment"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== CONFIGURATION TAB ===== */}
        <TabsContent value="configuration" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Configuration</CardTitle>
                <CardDescription>
                  Configure options for your prompt tests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include-history"
                        checked={includeHistory}
                        onCheckedChange={setIncludeHistory}
                      />
                      <Label htmlFor="include-history">Include Conversation History</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include-vehicles"
                        checked={includeVehicles}
                        onCheckedChange={setIncludeVehicles}
                      />
                      <Label htmlFor="include-vehicles">Include Vehicle Inventory</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="json-response"
                        checked={formatOptions.enableJsonResponse}
                        onCheckedChange={(checked) =>
                          setFormatOptions({...formatOptions, enableJsonResponse: checked})
                        }
                      />
                      <Label htmlFor="json-response">Enable JSON Response</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="vehicle-recommendations"
                        checked={formatOptions.includeVehicleRecommendations}
                        onCheckedChange={(checked) =>
                          setFormatOptions({...formatOptions, includeVehicleRecommendations: checked})
                        }
                      />
                      <Label htmlFor="vehicle-recommendations">Vehicle Recommendations</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="consider-handover"
                        checked={formatOptions.considerHandover}
                        onCheckedChange={(checked) =>
                          setFormatOptions({...formatOptions, considerHandover: checked})
                        }
                      />
                      <Label htmlFor="consider-handover">Consider Handover</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="generate-dossier"
                        checked={formatOptions.generateHandoverDossier}
                        onCheckedChange={(checked) =>
                          setFormatOptions({...formatOptions, generateHandoverDossier: checked})
                        }
                      />
                      <Label htmlFor="generate-dossier">Generate Handover Dossier</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="detect-insights"
                        checked={formatOptions.detectCustomerInsights}
                        onCheckedChange={(checked) =>
                          setFormatOptions({...formatOptions, detectCustomerInsights: checked})
                        }
                      />
                      <Label htmlFor="detect-insights">Detect Customer Insights</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>
                  Set customer details for testing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Input
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                      placeholder="Enter customer phone"
                    />
                  </div>

                  <div>
                    <Label>Email</Label>
                    <Input
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                      placeholder="Enter customer email"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Dealership Context</CardTitle>
                <CardDescription>
                  Configure dealership information used in prompts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Dealership Name</Label>
                    <Input
                      value={dealershipContext.dealershipName}
                      onChange={(e) => setDealershipContext({
                        ...dealershipContext,
                        dealershipName: e.target.value
                      })}
                      placeholder="Enter dealership name"
                    />
                  </div>

                  <div>
                    <Label>Brand Types</Label>
                    <Input
                      value={dealershipContext.brandTypes}
                      onChange={(e) => setDealershipContext({
                        ...dealershipContext,
                        brandTypes: e.target.value
                      })}
                      placeholder="Enter brand types"
                    />
                  </div>

                  <div>
                    <Label>Location</Label>
                    <Input
                      value={dealershipContext.dealershipLocation}
                      onChange={(e) => setDealershipContext({
                        ...dealershipContext,
                        dealershipLocation: e.target.value
                      })}
                      placeholder="Enter dealership location"
                    />
                  </div>

                  <div>
                    <Label>Business Hours</Label>
                    <Input
                      value={dealershipContext.businessHours}
                      onChange={(e) => setDealershipContext({
                        ...dealershipContext,
                        businessHours: e.target.value
                      })}
                      placeholder="Enter business hours"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {includeHistory && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Conversation History</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addHistoryItem}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Message
                    </Button>
                  </div>
                  <CardDescription>
                    Add historical messages for context
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {conversationHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No conversation history added yet.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addHistoryItem}
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Message
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversationHistory.map((message, index) => (
                        <div key={index} className="flex gap-4 items-start">
                          <div className="w-28">
                            <Select
                              value={message.role}
                              onValueChange={(value) =>
                                updateHistoryItem(index, value, 'role')
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="customer">Customer</SelectItem>
                                <SelectItem value="assistant">Assistant</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex-1">
                            <Textarea
                              value={message.content}
                              onChange={(e) =>
                                updateHistoryItem(index, e.target.value, 'content')
                              }
                              placeholder="Message content..."
                              className="min-h-[80px]"
                            />
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHistoryItem(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {includeVehicles && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Vehicle Inventory</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addVehicle}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Vehicle
                    </Button>
                  </div>
                  <CardDescription>
                    Configure vehicle inventory for testing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {vehicles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No vehicles added yet.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addVehicle}
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Vehicle
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {vehicles.map((vehicle, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium">
                              {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeVehicle(index)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>

                          <Accordion type="single" collapsible>
                            <AccordionItem value="details">
                              <AccordionTrigger>Vehicle Details</AccordionTrigger>
                              <AccordionContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Make</Label>
                                    <Input
                                      value={vehicle.make}
                                      onChange={(e) => updateVehicle(index, 'make', e.target.value)}
                                      placeholder="Enter make"
                                    />
                                  </div>

                                  <div>
                                    <Label>Model</Label>
                                    <Input
                                      value={vehicle.model}
                                      onChange={(e) => updateVehicle(index, 'model', e.target.value)}
                                      placeholder="Enter model"
                                    />
                                  </div>

                                  <div>
                                    <Label>Year</Label>
                                    <Input
                                      type="number"
                                      value={vehicle.year}
                                      onChange={(e) => updateVehicle(index, 'year', parseInt(e.target.value))}
                                      placeholder="Enter year"
                                    />
                                  </div>

                                  <div>
                                    <Label>Trim</Label>
                                    <Input
                                      value={vehicle.trim || ""}
                                      onChange={(e) => updateVehicle(index, 'trim', e.target.value)}
                                      placeholder="Enter trim"
                                    />
                                  </div>

                                  <div>
                                    <Label>VIN</Label>
                                    <Input
                                      value={vehicle.vin}
                                      onChange={(e) => updateVehicle(index, 'vin', e.target.value)}
                                      placeholder="Enter VIN"
                                    />
                                  </div>

                                  <div>
                                    <Label>Condition</Label>
                                    <Select
                                      value={vehicle.condition || ""}
                                      onValueChange={(value) => updateVehicle(index, 'condition', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select condition" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="New">New</SelectItem>
                                        <SelectItem value="Used">Used</SelectItem>
                                        <SelectItem value="Certified Pre-Owned">Certified Pre-Owned</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>Price</Label>
                                    <Input
                                      type="number"
                                      value={vehicle.price || ""}
                                      onChange={(e) => updateVehicle(index, 'price', parseInt(e.target.value))}
                                      placeholder="Enter price"
                                    />
                                  </div>

                                  <div>
                                    <Label>Mileage</Label>
                                    <Input
                                      type="number"
                                      value={vehicle.mileage || ""}
                                      onChange={(e) => updateVehicle(index, 'mileage', parseInt(e.target.value))}
                                      placeholder="Enter mileage"
                                    />
                                  </div>

                                  <div>
                                    <Label>Exterior Color</Label>
                                    <Input
                                      value={vehicle.exteriorColor || ""}
                                      onChange={(e) => updateVehicle(index, 'exteriorColor', e.target.value)}
                                      placeholder="Enter exterior color"
                                    />
                                  </div>

                                  <div>
                                    <Label>Interior Color</Label>
                                    <Input
                                      value={vehicle.interiorColor || ""}
                                      onChange={(e) => updateVehicle(index, 'interiorColor', e.target.value)}
                                      placeholder="Enter interior color"
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <Label>Description</Label>
                                    <Textarea
                                      value={vehicle.description || ""}
                                      onChange={(e) => updateVehicle(index, 'description', e.target.value)}
                                      placeholder="Enter vehicle description"
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <Label>Features (comma-separated)</Label>
                                    <Textarea
                                      value={vehicle.features?.join(', ') || ""}
                                      onChange={(e) => updateVehicle(index, 'features', e.target.value)}
                                      placeholder="Enter features separated by commas"
                                    />
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Alert Dialog for creating experiments */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertMessage.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="experiment-name">Experiment Name</Label>
              <Input id="experiment-name" placeholder="Enter experiment name" />
            </div>
            <div>
              <Label htmlFor="experiment-description">Description (optional)</Label>
              <Textarea id="experiment-description" placeholder="Enter experiment description" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const nameInput = document.getElementById('experiment-name') as HTMLInputElement;
              const descInput = document.getElementById('experiment-description') as HTMLTextAreaElement;
              handleCreateExperiment(
                nameInput.value || "Unnamed Experiment",
                descInput.value || ""
              );
            }}>Create Experiment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}