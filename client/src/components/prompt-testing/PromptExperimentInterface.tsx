import React, { useState, useEffect } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client"; // Changed from @/lib/queryClient to @/lib/api-client for clarity if they are different
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PromptExperiment,
  PromptVariant,
  ExperimentVariant, // Assuming this is used or defined elsewhere if needed by PromptExperiment
  Vehicle,
  CustomerInsight,
  ResponseSuggestion,
  dealerships, // Assuming this is for type reference if needed
  promptExperiments, // For type reference
  promptVariants, // For type reference
} from "@shared";

// Sample dealership data (replace with actual data from your API)
const DEFAULT_DEALERSHIP_ID = 1;

interface CustomerInfo {
  name: string;
  conversationId?: number;
  phone?: string;
  email?: string;
}

interface ChatMessage {
  role: "customer" | "assistant";
  content: string;
  timestamp?: Date;
}

interface TestResult {
  response: string;
  responseJson?: any;
  responseTime?: number;
  customerInsights?: CustomerInsight[];
  vehicleRecommendations?: Vehicle[]; // Assuming Vehicle type from schema
  responseSuggestions?: ResponseSuggestion[]; // Assuming ResponseSuggestion type from schema
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
  // Simplified variant info for experiment display
  variants: {
    variantId: number;
    name: string;
    promptTemplate: string; // Changed from content to promptTemplate for consistency with PromptVariant
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
  "answer": "Rylie AI\\\\n\\\\nYour tailored response with proper spacing and line breaks.",
  "retrieve_inventory_data": true or false,
  "research_queries": [\"Specific inventory questions\"],
  "reply_required": true or false
}`;

export default function PromptExperimentInterface() {
  // const queryClient = useQueryClient();
  const { toast } = useToast();
  const dealershipId = DEFAULT_DEALERSHIP_ID; // Used for context, not directly on PromptVariant

  // State for tab management
  const [activeTab, setActiveTab] = useState("testing");
  const [activeSubTab, setActiveSubTab] = useState("single");

  // State for experiment management
  const [experiments, setExperiments] = useState<PromptExperimentData[]>([]); // Using PromptExperimentData for fetched experiments
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(
    null,
  );

  // State for variant management
  const [variants, setVariants] = useState<PromptVariant[]>([]); // Full PromptVariant for variant list
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [editingVariant, setEditingVariant] = useState<PromptVariant | null>(
    null,
  );
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantContent, setNewVariantContent] = useState(
    DEFAULT_SYSTEM_PROMPT,
  );
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
    email: "john.smith@example.com",
  });

  // Communication channel
  const [channel, setChannel] = useState<string>("sms");

  // Dealership context
  const [dealershipContext, setDealershipContext] = useState({
    dealershipId: DEFAULT_DEALERSHIP_ID,
    dealershipName: "OnekeeL Automotive",
    brandTypes: "new and used vehicles from various manufacturers",
    dealershipLocation: "123 Auto Drive, Springfield, IL",
    businessHours: "Monday-Friday 9am-8pm, Saturday 9am-6pm, Sunday Closed",
  });

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>(
    [],
  );
  const [includeHistory, setIncludeHistory] = useState(false);

  // Vehicle inventory
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    // Initial sample vehicle, ensure it matches the Vehicle schema
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
      extColor: "Crystal Black Pearl", // Changed from exteriorColor
      intColor: "Black Leather", // Changed from interiorColor
      mileage: 5000,
      engine: "1.5L Turbo I4",
      transmission: "CVT",
      drivetrain: "FWD",
      fuelType: "Gasoline",
      fuelEconomyCity: 29, // Example value
      fuelEconomyHighway: 37, // Example value
      msrp: 31000,
      salePrice: 28995,
      price: 28995, // Assuming price is the final sale price
      condition: "Used", // Matched schema: 'new' | 'used' | 'cpo'
      status: "Available", // Matched schema: 'available' | 'sold' | 'pending'
      certified: false,
      description:
        "Well-maintained Honda Accord Sport with low mileage. Features Bluetooth, Backup Camera, Lane Departure Warning, Heated Seats.",
      features: [
        "Bluetooth",
        "Backup Camera",
        "Lane Departure Warning",
        "Heated Seats",
      ],
      categoryTags: ["Sedan", "Family Car", "Fuel Efficient"],
      images: [
        { url: "https://example.com/honda-accord-1.jpg", isPrimary: true },
      ],
      videoUrl: "https://example.com/vehicles/honda-accord-2023-video",
      isActive: true,
      lastSeen: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
  const [includeVehicles, setIncludeVehicles] = useState(true);

  // Comparison testing
  const [comparisonResults, setComparisonResults] = useState<
    {
      variantId: number;
      variantName: string;
      response: string;
      responseJson?: any;
      responseTime?: number;
    }[]
  >([]);

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
    detectCustomerInsights: true,
  });

  // Fetch experiments - TEMPORARILY DISABLED
  const [fetchedExperimentsData, setFetchedExperimentsData] = useState<
    PromptExperimentData[] | undefined
  >(undefined);
  const [isExperimentsLoading, setIsExperimentsLoading] = useState(false);

  // TODO: Re-enable React Query
  // const { data: fetchedExperimentsData, isLoading: isExperimentsLoading } = useQuery<PromptExperimentData[]>({
  //   queryKey: ["prompt-experiments", dealershipId],
  //   queryFn: () => apiRequest(`/api/prompt-experiments?dealershipId=${dealershipId}`),
  //   enabled: activeTab === "experiments",
  // });

  // Fetch variants - TEMPORARILY DISABLED
  const [fetchedVariantsData, setFetchedVariantsData] = useState<
    PromptVariant[] | undefined
  >(undefined);
  const [isVariantsLoading, setIsVariantsLoading] = useState(false);

  // TODO: Re-enable React Query
  // const { data: fetchedVariantsData, isLoading: isVariantsLoading } = useQuery<PromptVariant[]>({
  //   queryKey: ["prompt-variants", dealershipId],
  //   queryFn: () => apiRequest(`/api/prompt-variants?dealershipId=${dealershipId}`),
  //   enabled: activeTab === "variants",
  // });

  useEffect(() => {
    if (fetchedExperimentsData) {
      setExperiments(fetchedExperimentsData);
    }
  }, [fetchedExperimentsData]);

  useEffect(() => {
    if (fetchedVariantsData) {
      setVariants(fetchedVariantsData);
    }
  }, [fetchedVariantsData]);

  // Save variant mutation - TEMPORARILY DISABLED
  const saveVariantMutation = {
    mutate: (variantInput: any) => {
      console.log("Would save variant:", variantInput);
      toast({
        title: "Info",
        description: "Variant save temporarily disabled",
      });
      resetVariantEditor();
    },
    isPending: false,
  };

  // TODO: Re-enable React Query
  // const saveVariantMutation = useMutation<
  //   PromptVariant,
  //   Error,
  //   Partial<Omit<PromptVariant, 'dealershipId'>>
  // >({
  //   mutationFn: async (variantInput) => {
  //     const apiPath = variantInput.id
  //       ? `/api/prompt-variants/${variantInput.id}`
  //       : "/api/prompt-variants";
  //     const method = variantInput.id ? "PATCH" : "POST";
  //     return apiRequest(apiPath, { method, body: variantInput });
  //   },
  //   onSuccess: (savedVariant) => {
  //     queryClient.invalidateQueries({ queryKey: ["prompt-variants", dealershipId] });
  //     toast({
  //       title: "Success",
  //       description: editingVariant?.id
  //         ? `Prompt variant "${savedVariant.name}" updated successfully`
  //         : `New prompt variant "${savedVariant.name}" created`,
  //     });
  //     resetVariantEditor();
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: `Failed to save prompt variant: ${error.message}`,
  //       variant: "destructive",
  //     });
  //     console.error("Error saving variant:", error);
  //   },
  // });

  // Create experiment mutation - TEMPORARILY DISABLED
  const createExperimentMutation = {
    mutate: (experimentInput: any) => {
      console.log("Would create experiment:", experimentInput);
      toast({
        title: "Info",
        description: "Experiment creation temporarily disabled",
      });
    },
    isPending: false,
  };

  // TODO: Re-enable React Query
  // const createExperimentMutation = useMutation<
  //   PromptExperiment,
  //   Error,
  //   Partial<PromptExperiment>
  // >({
  //   mutationFn: async (experimentInput) => {
  //     const payload = { ...experimentInput, dealershipId };
  //     return apiRequest("/api/prompt-experiments", { method: "POST", body: payload });
  //   },
  //   onSuccess: (newExperiment) => {
  //     queryClient.invalidateQueries({ queryKey: ["prompt-experiments", dealershipId] });
  //     toast({
  //       title: "Success",
  //       description: `New experiment "${newExperiment.name}" created successfully`,
  //     });
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: `Failed to create experiment: ${error.message}`,
  //       variant: "destructive",
  //     });
  //     console.error("Error creating experiment:", error);
  //   },
  // });

  // Conversation history management
  const addHistoryItem = () => {
    setConversationHistory([
      ...conversationHistory,
      { role: "customer", content: "", timestamp: new Date() }, // Added timestamp
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
    const currentItem = updatedHistory[index];
    if (
      fieldName === "role" &&
      (value === "customer" || value === "assistant")
    ) {
      updatedHistory[index] = {
        ...currentItem,
        role: value,
      };
    } else if (fieldName === "content") {
      updatedHistory[index] = {
        ...currentItem,
        content: value,
      };
    }
    setConversationHistory(updatedHistory);
  };

  // Vehicle inventory management
  const addVehicle = () => {
    const newVehicle: Vehicle = {
      id: vehicles.length + Date.now(), // More unique ID for client-side
      dealershipId: dealershipId,
      vin: "",
      stockNumber: `STK${Date.now().toString().slice(-6)}`, // Auto-generate a unique stock number
      make: "",
      model: "",
      year: new Date().getFullYear(),
      trim: "",
      bodyStyle: "Sedan", // Default
      extColor: "",
      intColor: "",
      mileage: 0,
      engine: "",
      transmission: "Automatic", // Default
      drivetrain: "FWD", // Default
      fuelType: "Gasoline", // Default
      fuelEconomyCity: null,
      fuelEconomyHighway: null,
      msrp: null,
      salePrice: null,
      price: 0, // Default or null
      condition: "New",
      status: "Available",
      certified: false,
      description: "",
      features: [],
      categoryTags: [],
      images: [],
      videoUrl: null,
      isActive: true,
      lastSeen: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    setVehicles([...vehicles, newVehicle]);
  };

  const removeVehicle = (index: number) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  const updateVehicle = (index: number, field: keyof Vehicle, value: any) => {
    const updatedVehicles = [...vehicles];
    const vehicleToUpdate = { ...updatedVehicles[index] };

    if (field === "features" && typeof value === "string") {
      (vehicleToUpdate[field] as string[]) = value
        .split(",")
        .map((f) => f.trim());
    } else if (field === "categoryTags" && typeof value === "string") {
      (vehicleToUpdate[field] as string[]) = value
        .split(",")
        .map((f) => f.trim());
    } else if (field === "images" && typeof value === "string") {
      // Basic handling for comma-separated image URLs
      (vehicleToUpdate[field] as { url: string; isPrimary?: boolean }[]) = value
        .split(",")
        .map((url, i) => ({ url: url.trim(), isPrimary: i === 0 }));
    } else if (
      typeof vehicleToUpdate[field] === "number" &&
      (field === "year" ||
        field === "mileage" ||
        field === "price" ||
        field === "msrp" ||
        field === "salePrice" ||
        field === "fuelEconomyCity" ||
        field === "fuelEconomyHighway")
    ) {
      (vehicleToUpdate[field] as number | null) =
        value === "" ? null : parseInt(value, 10);
    } else if (
      typeof vehicleToUpdate[field] === "boolean" &&
      (field === "certified" || field === "isActive")
    ) {
      (vehicleToUpdate[field] as boolean) = Boolean(value);
    } else {
      (vehicleToUpdate[field] as any) = value;
    }
    updatedVehicles[index] = vehicleToUpdate;
    setVehicles(updatedVehicles);
  };

  // Variant editor management
  const openVariantEditor = (variant?: PromptVariant) => {
    if (variant) {
      setEditingVariant(variant);
      setNewVariantName(variant.name);
      setNewVariantContent(variant.promptTemplate); // Use promptTemplate from schema
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
        variant: "destructive",
      });
      return;
    }

    const variantPayload: Partial<Omit<PromptVariant, "dealershipId">> = {
      ...(editingVariant?.id ? { id: editingVariant.id } : {}),
      name: newVariantName.trim(),
      promptTemplate: newVariantContent, // Use promptTemplate for saving
      isActive:
        editingVariant?.isActive !== undefined ? editingVariant.isActive : true, // Preserve isActive or default to true
      isControl: editingVariant?.isControl || false,
      // dealershipId is not part of PromptVariant schema, removed from here
    };

    saveVariantMutation.mutate(variantPayload);
  };

  // Test a single prompt variant
  const testPromptVariant = async (variantId?: number) => {
    setIsLoading(true);
    setError("");

    const payload = {
      customerMessage,
      variantId,
      systemPrompt: !variantId ? newVariantContent : undefined,
      channel,
      customerInfo,
      dealershipContext,
      conversationHistory: includeHistory
        ? conversationHistory.map((msg) => ({
            // Ensure correct mapping if backend expects user/assistant
            role: msg.role === "customer" ? "user" : "assistant",
            content: msg.content,
          }))
        : [],
      relevantVehicles: includeVehicles ? vehicles : [],
      formatOptions,
    };

    try {
      // Using apiRequest for consistency
      const data: TestResult = await apiRequest("/api/prompt-test/test", {
        method: "POST",
        body: payload,
      });

      setTestResponse({
        ...data,
        variantId: variantId, // Ensure variantId is part of the TestResult
      });

      const newCustomerMessage: ChatMessage = {
        role: "customer",
        content: customerMessage,
        timestamp: new Date(),
      };

      const newAssistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response, // Assuming data.response is the main text response
        timestamp: new Date(),
      };

      setConversationHistory([
        ...conversationHistory,
        newCustomerMessage,
        newAssistantMessage,
      ]);
      setCustomerMessage("");
    } catch (err) {
      console.error("Error testing prompt:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Test Error",
        description: errorMessage,
        variant: "destructive",
      });
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
        variant: "destructive",
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
      conversationHistory: includeHistory
        ? conversationHistory.map((msg) => ({
            role: msg.role === "customer" ? "user" : "assistant",
            content: msg.content,
          }))
        : [],
      relevantVehicles: includeVehicles ? vehicles : [],
      formatOptions,
    };

    try {
      const resultsPromises = selectedVariants.map(async (variantId) => {
        const variant = variants.find((v) => v.id === variantId);
        if (!variant) return null;

        const payload = { ...basePayload, variantId };
        const data: TestResult = await apiRequest("/api/prompt-test/test", {
          method: "POST",
          body: payload,
        });
        return {
          variantId,
          variantName: variant.name,
          response: data.response,
          responseJson: data.responseJson,
          responseTime: data.responseTime,
        };
      });

      const settledResults = await Promise.allSettled(resultsPromises);
      const successfulResults = settledResults
        .filter((r) => r.status === "fulfilled" && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<any>).value);

      const failedResults = settledResults.filter(
        (r) => r.status === "rejected",
      );
      if (failedResults.length > 0) {
        console.error("Some variants failed to test:", failedResults);
        toast({
          title: "Comparison Error",
          description: `${failedResults.length} variant(s) failed to test. Check console.`,
          variant: "warning",
        });
      }

      setComparisonResults(successfulResults);
      setCustomerMessage("");
    } catch (err) {
      console.error("Error comparing prompts:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Comparison Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard",
    });
  };

  // Create a new A/B test experiment
  const createNewExperiment = () => {
    if (selectedVariants.length < 2) {
      toast({
        title: "Selection Error",
        description: "Please select at least two variants for the experiment",
        variant: "destructive",
      });
      return;
    }
    setAlertMessage({
      title: "Create New A/B Test Experiment",
      message: "Please enter a name and details for the new experiment.",
    });
    setIsAlertOpen(true);
  };

  const handleCreateExperiment = (name: string, description: string) => {
    const trafficPerVariant = parseFloat(
      (100 / selectedVariants.length).toFixed(2),
    );
    let accumulatedTraffic = 0;

    const controlVariantId = selectedVariants[0]; // First selected is control by default

    const newExperimentPayload: Partial<PromptExperiment> = {
      name,
      description: description || null,
      dealershipId, // dealershipId is part of PromptExperiment schema
      isActive: true,
      startDate: new Date(), // Date object as expected by schema
      endDate: undefined, // Use undefined instead of null for optional Date field
      // experimentVariants should be an array of objects linking to PromptVariant by ID
      // The actual structure depends on how the backend expects this.
      // Assuming backend expects an array of ExperimentVariant-like structures or variant IDs with allocations
      experimentVariants: selectedVariants.map((variantId, index) => {
        let allocation = trafficPerVariant;
        if (index === selectedVariants.length - 1) {
          // Adjust last to sum to 100
          allocation = parseFloat((100 - accumulatedTraffic).toFixed(2));
        } else {
          accumulatedTraffic += allocation;
        }
        return {
          variantId, // ID of the PromptVariant
          trafficAllocation: allocation,
          isControl: variantId === controlVariantId,
          // name is not part of ExperimentVariant schema, it's on PromptVariant
        };
      }) as unknown as ExperimentVariant[], // Cast if backend expects full ExperimentVariant structure
    };
    createExperimentMutation.mutate(newExperimentPayload);
    setIsAlertOpen(false); // Close dialog after attempting creation
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">
        Rylie AI Prompt Experiment Lab
      </h1>
      <p className="text-muted-foreground mb-6">
        Test, compare, and optimize your AI prompt variants to improve customer
        engagement and conversion
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
                            // Use a string for value as SelectItem values are strings
                            value={testResponse?.variantId?.toString() ?? ""}
                            onValueChange={(val) => {
                              // If "Custom Prompt" is selected (empty string), variantId should be undefined
                              const variantId = val ? parseInt(val) : undefined;
                              // Update testResponse or a dedicated state for selected variant for test
                              setTestResponse((prev) =>
                                prev
                                  ? { ...prev, variantId }
                                  : { response: "", variantId },
                              );
                              // No need to call testPromptVariant here, it's called on button click
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a variant to test" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">
                                Custom Prompt (uses editor content)
                              </SelectItem>
                              {variants.map((variant) => (
                                <SelectItem
                                  key={variant.id}
                                  value={variant.id.toString()}
                                >
                                  {variant.name}{" "}
                                  {variant.isControl ? "(Control)" : ""}
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
                          onClick={
                            () => testPromptVariant(testResponse?.variantId) // Pass the currently selected variantId
                          }
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
                              // When opening editor
                              setNewVariantContent(DEFAULT_SYSTEM_PROMPT); // Reset to default or selected variant's content
                              setNewVariantName(""); // Clear name for new custom prompt
                              setTestResponse((prev) =>
                                prev
                                  ? { ...prev, variantId: undefined }
                                  : { response: "", variantId: undefined },
                              ); // Deselect variant
                            }
                          }}
                        >
                          {isVariantEditor
                            ? "Hide Editor"
                            : "Edit Custom Prompt"}
                        </Button>
                      </div>

                      {error && (
                        <div className="text-destructive text-sm">{error}</div>
                      )}
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
                          onClick={() =>
                            copyToClipboard(
                              showJson && testResponse.responseJson
                                ? JSON.stringify(
                                    testResponse.responseJson,
                                    null,
                                    2,
                                  )
                                : testResponse.response,
                            )
                          }
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
                            {JSON.stringify(
                              testResponse.responseJson ??
                                testResponse.response,
                              null,
                              2,
                            )}
                          </pre>
                        )}

                        {showAnalytics && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <h3 className="text-sm font-medium mb-2">
                                Response Time
                              </h3>
                              <div className="text-sm">
                                {testResponse.responseTime?.toFixed(2)}ms
                              </div>
                            </div>

                            {testResponse.customerInsights &&
                              testResponse.customerInsights.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-medium mb-2">
                                    Customer Insights
                                  </h3>
                                  <div className="space-y-1">
                                    {testResponse.customerInsights.map(
                                      (insight, idx) => (
                                        <div
                                          key={idx}
                                          className="flex justify-between text-sm"
                                        >
                                          <span>
                                            {insight.insightType}:{" "}
                                            {insight.value}{" "}
                                            {/* Changed insight.key to insight.insightType */}
                                          </span>
                                          <Badge
                                            variant={
                                              insight.confidence > 0.8
                                                ? "default"
                                                : "outline"
                                            }
                                          >
                                            {Math.round(
                                              insight.confidence * 100,
                                            )}
                                            %
                                          </Badge>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                            {testResponse.handoverRecommended && (
                              <div>
                                <h3 className="text-sm font-medium mb-2">
                                  Handover Recommendation
                                </h3>
                                <Badge variant="destructive">
                                  Handover Recommended
                                </Badge>
                                {testResponse.handoverDossier && (
                                  <Accordion
                                    type="single"
                                    collapsible
                                    className="mt-2"
                                  >
                                    <AccordionItem value="dossier">
                                      <AccordionTrigger>
                                        View Handover Dossier
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <pre className="bg-muted rounded-md p-2 text-xs overflow-auto max-h-[300px]">
                                          {JSON.stringify(
                                            testResponse.handoverDossier,
                                            null,
                                            2,
                                          )}
                                        </pre>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                )}
                              </div>
                            )}

                            {testResponse.responseSuggestions &&
                              testResponse.responseSuggestions.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-medium mb-2">
                                    Response Suggestions
                                  </h3>
                                  <div className="space-y-1">
                                    {testResponse.responseSuggestions.map(
                                      (suggestion, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-muted rounded-md p-2 text-sm"
                                        >
                                          <div className="flex justify-between mb-1">
                                            <Badge>
                                              {suggestion.suggestionType}
                                            </Badge>{" "}
                                            {/* Changed suggestion.category to suggestion.suggestionType */}
                                            <Badge variant="outline">
                                              Priority:{" "}
                                              {suggestion.priority ?? "N/A"}
                                            </Badge>
                                          </div>
                                          <p>{suggestion.content}</p>{" "}
                                          {/* Changed suggestion.text to suggestion.content */}
                                        </div>
                                      ),
                                    )}
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
                      Edit your system prompt template. This will be used if
                      "Custom Prompt" is selected.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Prompt Name (for saving as new variant)</Label>
                        <Input
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          placeholder="Enter a name if saving as new variant"
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
                        <Button
                          onClick={handleSaveVariant}
                          disabled={!newVariantName.trim()}
                        >
                          Save as New Variant
                        </Button>
                        <Button variant="outline" onClick={resetVariantEditor}>
                          Cancel Editing
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
                    Test the same customer message across multiple prompt
                    variants
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
                      <Label>
                        Select Variants to Compare (must select at least 2)
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 max-h-60 overflow-y-auto border p-2 rounded-md">
                        {variants.map((variant) => (
                          <div
                            key={variant.id}
                            className={`border rounded-md p-2 cursor-pointer transition-colors ${
                              selectedVariants.includes(variant.id)
                                ? "bg-primary/20 border-primary ring-2 ring-primary"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => {
                              setSelectedVariants((prevSelected) =>
                                prevSelected.includes(variant.id)
                                  ? prevSelected.filter(
                                      (id) => id !== variant.id,
                                    )
                                  : [...prevSelected, variant.id],
                              );
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {variant.name}
                              </span>
                              {variant.isControl && <Badge>Control</Badge>}
                            </div>
                          </div>
                        ))}
                        {variants.length === 0 && (
                          <p className="text-muted-foreground col-span-full text-center py-4">
                            No variants available. Create variants in the
                            "Prompt Variants" tab.
                          </p>
                        )}
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
                        disabled={
                          isLoading ||
                          !customerMessage ||
                          selectedVariants.length < 2
                        }
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
                        Create A/B Test from Selected
                      </Button>
                    </div>

                    {error && (
                      <div className="text-destructive text-sm">{error}</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {comparisonResults.length > 0 && (
                <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2">
                  {" "}
                  {/* Layout for comparison */}
                  {comparisonResults.map((result, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Variant: {result.variantName}</CardTitle>
                          <Badge variant="outline">
                            {result.responseTime?.toFixed(2)}ms
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="whitespace-pre-wrap bg-muted rounded-md p-4 max-h-96 overflow-y-auto">
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
          ) : variants.length === 0 && !isVariantEditor ? ( // Hide if editor is open for creation
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Prompt Variants</h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  Create your first prompt variant to start experimenting with
                  different approaches
                </p>
                <Button onClick={() => openVariantEditor()}>
                  Create Your First Variant
                </Button>
              </CardContent>
            </Card>
          ) : (
            !isVariantEditor &&
            variants.length > 0 && ( // Only show list if editor is not open for creation
              <div className="grid grid-cols-1 gap-4">
                {variants.map((variant) => (
                  <Card key={variant.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle>{variant.name}</CardTitle>
                        <div className="flex gap-1">
                          {variant.isControl && <Badge>Control</Badge>}
                          {!variant.isActive && (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible>
                        <AccordionItem value="content">
                          <AccordionTrigger>
                            View Prompt Content
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="bg-muted rounded-md p-3 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
                              {variant.promptTemplate}{" "}
                              {/* Use promptTemplate here */}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                    <CardFooter className="flex justify-between flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openVariantEditor(variant)}
                      >
                        Edit Variant
                      </Button>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTestResponse({
                              response: "",
                              variantId: variant.id,
                            }); // Set for single test
                            setActiveTab("testing");
                            setActiveSubTab("single");
                          }}
                        >
                          Test Variant
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedVariants((prev) =>
                              prev.includes(variant.id)
                                ? prev.filter((id) => id !== variant.id)
                                : [...prev, variant.id],
                            );
                            // Optionally switch to compare tab if not already there
                            // setActiveTab("testing");
                            // setActiveSubTab("compare");
                          }}
                        >
                          {selectedVariants.includes(variant.id)
                            ? "Remove from Compare"
                            : "Add to Compare"}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )
          )}

          {isVariantEditor && ( // Variant editor form
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>
                  {editingVariant ? "Edit Variant" : "Create New Variant"}
                </CardTitle>
                <CardDescription>
                  {editingVariant
                    ? `Modify the prompt variant "${editingVariant.name}"`
                    : "Define a new prompt variant for testing"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="variant-name-editor">Variant Name</Label>
                    <Input
                      id="variant-name-editor"
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      placeholder="Enter a descriptive name for this variant"
                    />
                  </div>

                  <div>
                    <Label htmlFor="variant-content-editor">
                      Prompt Content (Template)
                    </Label>
                    <Textarea
                      id="variant-content-editor"
                      value={newVariantContent}
                      onChange={(e) => setNewVariantContent(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </div>
                  {editingVariant && ( // Allow toggling isControl and isActive only when editing
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="variant-isControl"
                          checked={editingVariant.isControl}
                          onCheckedChange={(checked) =>
                            setEditingVariant((v) =>
                              v ? { ...v, isControl: checked } : null,
                            )
                          }
                        />
                        <Label htmlFor="variant-isControl">Is Control</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="variant-isActive"
                          checked={editingVariant.isActive}
                          onCheckedChange={(checked) =>
                            setEditingVariant((v) =>
                              v ? { ...v, isActive: checked } : null,
                            )
                          }
                        />
                        <Label htmlFor="variant-isActive">Is Active</Label>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveVariant}
                      disabled={
                        saveVariantMutation.isPending || !newVariantName.trim()
                      }
                    >
                      {saveVariantMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : editingVariant ? (
                        "Update Variant"
                      ) : (
                        "Save New Variant"
                      )}
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
              title={
                selectedVariants.length < 2
                  ? "Select at least 2 variants from 'Prompt Variants' tab to create an experiment"
                  : ""
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              New Experiment from Selected
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
                <h3 className="text-lg font-medium mb-2">
                  No A/B Test Experiments
                </h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  Create your first experiment to start comparing prompt
                  variants. Select variants from the "Prompt Variants" tab
                  first.
                </p>
                <Button
                  onClick={() => {
                    setActiveTab("variants");
                  }}
                >
                  Go to Prompt Variants
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {experiments.map((experiment) => (
                <Card key={experiment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle>{experiment.name}</CardTitle>
                      <div className="flex gap-1">
                        {experiment.isActive && (
                          <Badge
                            variant="default"
                            className="bg-green-500 text-white"
                          >
                            Active
                          </Badge>
                        )}
                        {!experiment.isActive && (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      {experiment.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible>
                      <AccordionItem value={`exp-variants-${experiment.id}`}>
                        <AccordionTrigger>
                          Variants ({experiment.variants?.length || 0})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {experiment.variants?.map((expVariantLink) => {
                              // Find the full variant details from the main variants list
                              const fullVariant = variants.find(
                                (v) => v.id === expVariantLink.variantId,
                              );
                              return (
                                <div
                                  key={expVariantLink.variantId}
                                  className="flex justify-between items-center bg-muted p-2 rounded-md"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {fullVariant?.name ||
                                        `Variant ID: ${expVariantLink.variantId}`}
                                    </span>
                                    {expVariantLink.isControl && (
                                      <Badge variant="secondary">Control</Badge>
                                    )}
                                  </div>
                                  <Badge variant="outline">
                                    {expVariantLink.trafficAllocation}% Traffic
                                  </Badge>
                                </div>
                              );
                            })}
                            {(!experiment.variants ||
                              experiment.variants.length === 0) && (
                              <p className="text-sm text-muted-foreground">
                                No variants linked to this experiment.
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>
                          Start:{" "}
                          {experiment.startDate
                            ? new Date(
                                experiment.startDate + "T00:00:00", // Ensure parsing as local date
                              ).toLocaleDateString()
                            : "Not started"}
                        </span>
                        <span>
                          End:{" "}
                          {experiment.endDate
                            ? new Date(
                                experiment.endDate + "T00:00:00",
                              ).toLocaleDateString()
                            : "Ongoing"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" disabled>
                      {" "}
                      {/* Placeholder */}
                      View Results
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      {" "}
                      {/* Placeholder */}
                      {experiment.isActive
                        ? "Stop Experiment"
                        : "Resume Experiment"}
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
                  <div className="grid grid-cols-1 gap-4">
                    {" "}
                    {/* Simplified to single column for better readability */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-history" className="flex-grow">
                        Include Conversation History
                      </Label>
                      <Switch
                        id="include-history"
                        checked={includeHistory}
                        onCheckedChange={setIncludeHistory}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-vehicles" className="flex-grow">
                        Include Vehicle Inventory
                      </Label>
                      <Switch
                        id="include-vehicles"
                        checked={includeVehicles}
                        onCheckedChange={setIncludeVehicles}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="json-response" className="flex-grow">
                        Enable JSON Response in Test Output
                      </Label>
                      <Switch
                        id="json-response"
                        checked={formatOptions.enableJsonResponse}
                        onCheckedChange={(checked) =>
                          setFormatOptions({
                            ...formatOptions,
                            enableJsonResponse: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="vehicle-recommendations"
                        className="flex-grow"
                      >
                        Include Vehicle Recommendations in AI Response
                      </Label>
                      <Switch
                        id="vehicle-recommendations"
                        checked={formatOptions.includeVehicleRecommendations}
                        onCheckedChange={(checked) =>
                          setFormatOptions({
                            ...formatOptions,
                            includeVehicleRecommendations: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="consider-handover" className="flex-grow">
                        Enable Handover Detection Logic
                      </Label>
                      <Switch
                        id="consider-handover"
                        checked={formatOptions.considerHandover}
                        onCheckedChange={(checked) =>
                          setFormatOptions({
                            ...formatOptions,
                            considerHandover: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="generate-dossier" className="flex-grow">
                        Generate Handover Dossier if Handover Detected
                      </Label>
                      <Switch
                        id="generate-dossier"
                        checked={formatOptions.generateHandoverDossier}
                        onCheckedChange={(checked) =>
                          setFormatOptions({
                            ...formatOptions,
                            generateHandoverDossier: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="detect-insights" className="flex-grow">
                        Detect Customer Insights from Message
                      </Label>
                      <Switch
                        id="detect-insights"
                        checked={formatOptions.detectCustomerInsights}
                        onCheckedChange={(checked) =>
                          setFormatOptions({
                            ...formatOptions,
                            detectCustomerInsights: checked,
                          })
                        }
                      />
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
                    <Label htmlFor="cfg-customerName">Customer Name</Label>
                    <Input
                      id="cfg-customerName"
                      value={customerInfo.name}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          name: e.target.value,
                        })
                      }
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cfg-conversationId">
                      Conversation ID (Optional)
                    </Label>
                    <Input
                      id="cfg-conversationId"
                      type="number"
                      value={customerInfo.conversationId ?? ""}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          conversationId: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      placeholder="Enter conversation ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cfg-customerPhone">
                      Phone Number (Optional)
                    </Label>
                    <Input
                      id="cfg-customerPhone"
                      value={customerInfo.phone ?? ""}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          phone: e.target.value,
                        })
                      }
                      placeholder="Enter customer phone"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cfg-customerEmail">Email (Optional)</Label>
                    <Input
                      id="cfg-customerEmail"
                      type="email"
                      value={customerInfo.email ?? ""}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          email: e.target.value,
                        })
                      }
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
                    <Label htmlFor="cfg-dealershipName">Dealership Name</Label>
                    <Input
                      id="cfg-dealershipName"
                      value={dealershipContext.dealershipName}
                      onChange={(e) =>
                        setDealershipContext({
                          ...dealershipContext,
                          dealershipName: e.target.value,
                        })
                      }
                      placeholder="Enter dealership name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cfg-brandTypes">Brand Types</Label>
                    <Input
                      id="cfg-brandTypes"
                      value={dealershipContext.brandTypes}
                      onChange={(e) =>
                        setDealershipContext({
                          ...dealershipContext,
                          brandTypes: e.target.value,
                        })
                      }
                      placeholder="e.g., Honda, Toyota, Ford"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cfg-dealershipLocation">Location</Label>
                    <Input
                      id="cfg-dealershipLocation"
                      value={dealershipContext.dealershipLocation}
                      onChange={(e) =>
                        setDealershipContext({
                          ...dealershipContext,
                          dealershipLocation: e.target.value,
                        })
                      }
                      placeholder="Enter dealership location"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cfg-businessHours">Business Hours</Label>
                    <Input
                      id="cfg-businessHours"
                      value={dealershipContext.businessHours}
                      onChange={(e) =>
                        setDealershipContext({
                          ...dealershipContext,
                          businessHours: e.target.value,
                        })
                      }
                      placeholder="e.g., Mon-Fri 9am-8pm"
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
                    Add historical messages for context. Most recent messages
                    have more impact.
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
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {conversationHistory.map((message, index) => (
                        <div
                          key={index}
                          className="flex gap-4 items-start p-3 border rounded-md"
                        >
                          <div className="w-32 flex-shrink-0">
                            <Select
                              value={message.role}
                              onValueChange={(value) =>
                                updateHistoryItem(index, value, "role")
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="customer">
                                  Customer
                                </SelectItem>
                                <SelectItem value="assistant">
                                  Assistant
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex-1">
                            <Textarea
                              value={message.content}
                              onChange={(e) =>
                                updateHistoryItem(
                                  index,
                                  e.target.value,
                                  "content",
                                )
                              }
                              placeholder="Message content..."
                              className="min-h-[80px]"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Timestamp:{" "}
                              {message.timestamp
                                ? message.timestamp.toLocaleString()
                                : "Not set"}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHistoryItem(index)}
                            className="flex-shrink-0"
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
                    <Button variant="outline" size="sm" onClick={addVehicle}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Vehicle
                    </Button>
                  </div>
                  <CardDescription>
                    Configure vehicle inventory for testing. Provide a few
                    relevant examples.
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
                    <div className="space-y-6 max-h-[800px] overflow-y-auto">
                      {" "}
                      {/* Added max-height and overflow */}
                      {vehicles.map((vehicle, index) => (
                        <div
                          key={vehicle.id || index}
                          className="p-4 border rounded-lg"
                        >
                          {" "}
                          {/* Use vehicle.id if available */}
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium text-lg">
                              {vehicle.year || "N/A"} {vehicle.make || "N/A"}{" "}
                              {vehicle.model || "N/A"} {vehicle.trim}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeVehicle(index)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                          <Accordion
                            type="single"
                            collapsible
                            className="w-full"
                          >
                            <AccordionItem value={`vehicle-details-${index}`}>
                              <AccordionTrigger>
                                Vehicle Details
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {(
                                    Object.keys(vehicle) as Array<keyof Vehicle>
                                  )
                                    .filter(
                                      (key) =>
                                        ![
                                          "id",
                                          "dealershipId",
                                          "created_at",
                                          "updated_at",
                                          "lastSeen",
                                          "images",
                                          "features",
                                          "categoryTags",
                                        ].includes(key),
                                    ) // Exclude complex or managed fields from direct edit here
                                    .map((key) => (
                                      <div key={key}>
                                        <Label
                                          htmlFor={`vehicle-${index}-${String(key)}`}
                                          className="capitalize"
                                        >
                                          {String(key).replace(
                                            /([A-Z])/g,
                                            " $1",
                                          )}
                                        </Label>
                                        <Input
                                          id={`vehicle-${index}-${String(key)}`}
                                          type={
                                            typeof vehicle[key] === "number"
                                              ? "number"
                                              : "text"
                                          }
                                          value={
                                            vehicle[key] === null ||
                                            vehicle[key] === undefined
                                              ? ""
                                              : String(vehicle[key])
                                          }
                                          onChange={(e) =>
                                            updateVehicle(
                                              index,
                                              key,
                                              e.target.value,
                                            )
                                          }
                                          placeholder={`Enter ${String(key)}`}
                                        />
                                      </div>
                                    ))}
                                  <div>
                                    <Label
                                      htmlFor={`vehicle-${index}-features`}
                                    >
                                      Features (comma-separated)
                                    </Label>
                                    <Textarea
                                      id={`vehicle-${index}-features`}
                                      value={
                                        Array.isArray(vehicle.features)
                                          ? vehicle.features.join(", ")
                                          : ""
                                      }
                                      onChange={(e) =>
                                        updateVehicle(
                                          index,
                                          "features",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="e.g., Sunroof, Navigation"
                                    />
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor={`vehicle-${index}-categoryTags`}
                                    >
                                      Category Tags (comma-separated)
                                    </Label>
                                    <Textarea
                                      id={`vehicle-${index}-categoryTags`}
                                      value={
                                        Array.isArray(vehicle.categoryTags)
                                          ? vehicle.categoryTags.join(", ")
                                          : ""
                                      }
                                      onChange={(e) =>
                                        updateVehicle(
                                          index,
                                          "categoryTags",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="e.g., SUV, Family, Off-road"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`vehicle-${index}-images`}>
                                      Image URLs (comma-separated)
                                    </Label>
                                    <Textarea
                                      id={`vehicle-${index}-images`}
                                      value={
                                        Array.isArray(vehicle.images)
                                          ? vehicle.images
                                              .map((img) => img.url)
                                              .join(", ")
                                          : ""
                                      }
                                      onChange={(e) =>
                                        updateVehicle(
                                          index,
                                          "images",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="e.g., https://example.com/img1.jpg, ..."
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
            <AlertDialogDescription>
              {alertMessage.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="experiment-name-dialog">Experiment Name</Label>
              <Input
                id="experiment-name-dialog"
                placeholder="Enter experiment name (e.g., Q3 Welcome Message Test)"
              />
            </div>
            <div>
              <Label htmlFor="experiment-description-dialog">
                Description (optional)
              </Label>
              <Textarea
                id="experiment-description-dialog"
                placeholder="Briefly describe the goal of this experiment"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const nameInput = document.getElementById(
                  "experiment-name-dialog",
                ) as HTMLInputElement | null;
                const descInput = document.getElementById(
                  "experiment-description-dialog",
                ) as HTMLTextAreaElement | null;

                if (nameInput?.value.trim()) {
                  handleCreateExperiment(
                    nameInput.value.trim(),
                    descInput?.value.trim() || "",
                  );
                } else {
                  toast({
                    title: "Validation Error",
                    description: "Experiment name is required.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Create Experiment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
