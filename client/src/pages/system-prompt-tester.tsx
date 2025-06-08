import React, { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Copy,
  ChevronRight,
  Settings,
  MessageSquare,
  Code,
  Save,
  RefreshCw,
  BookmarkIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
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

type ConversationEntry = {
  role: "customer" | "assistant";
  content: string;
};

export default function SystemPromptTester() {
  const { toast } = useToast();
  const [customerMessage, setCustomerMessage] = useState(
    "Hi there, I'm looking for a new SUV for my family. Can you help me?",
  );
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isLoading, setIsLoading] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [splitScreen, setSplitScreen] = useState(true);
  const [showVariables, setShowVariables] = useState(true);
  const [activeTab, setActiveTab] = useState("editor");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  // State for the saved prompt form
  const [promptName, setPromptName] = useState("");
  const [promptDescription, setPromptDescription] = useState("");
  const [promptTags, setPromptTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Default values for the replacements
  const [agentName, setAgentName] = useState("Rylie");
  const [dealershipName, setDealershipName] = useState("Example Motors");
  const [financingUrl, setFinancingUrl] = useState(
    "https://www.exampledealership.com/financing",
  );
  const [tradeInUrl, setTradeInUrl] = useState(
    "https://www.exampledealership.com/trade-in-value",
  );
  const [appointmentUrl, setAppointmentUrl] = useState(
    "https://www.exampledealership.com/schedule-appointment",
  );
  const [inventoryUrl, setInventoryUrl] = useState(
    "https://www.exampledealership.com/inventory",
  );
  const [specificInstructions, setSpecificInstructions] = useState(
    "Always start with a casual, personal greeting. Use contractions and everyday words.",
  );
  const [specificConstraints, setSpecificConstraints] = useState(
    "No Pricing or Promises: Avoid discussing costs, financing details, or delivery guarantees.",
  );

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
    setError("");

    const newCustomerMessageEntry: ConversationEntry = {
      role: "customer",
      content: customerMessage,
    };
    // Add customer message to conversation immediately for UI update
    setConversation((prevConversation) => [
      ...prevConversation,
      newCustomerMessageEntry,
    ]);

    try {
      const customizedPrompt = generateCustomizedPrompt();

      const apiResponse = await fetch("/api/test-system-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: customizedPrompt,
          customerMessage,
          // Send the conversation history *before* adding the current customer message,
          // or adjust backend to handle it if it expects the current message too.
          // For this example, sending history up to the point before current user message.
          conversation: conversation,
        }),
      });

      const responseText = await apiResponse.text();

      if (!apiResponse.ok) {
        throw new Error(`Error ${apiResponse.status}: ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        throw new Error(
          `Invalid JSON response: ${responseText.substring(0, 100)}...`,
        );
      }

      if (!data || !data.response) {
        throw new Error("Received invalid response format");
      }

      setResponse(data.response);

      const newAssistantMessageEntry: ConversationEntry = {
        role: "assistant",
        content: data.response,
      };
      // Update conversation: remove the temp customer message if it was added, then add both confirmed customer and assistant message
      // This ensures no duplicate customer messages if the request fails or if state updates are tricky.
      // A more robust way might be to only add to conversation on success.
      setConversation((prevConversation) => {
        // Filter out the optimistic customer message if it's the last one and matches
        const currentHistory = prevConversation.filter(
          (msg, index) =>
            !(
              index === prevConversation.length - 1 &&
              msg.role === "customer" &&
              msg.content === newCustomerMessageEntry.content
            ),
        );
        return [
          ...currentHistory,
          newCustomerMessageEntry,
          newAssistantMessageEntry,
        ];
      });

      setCustomerMessage("");
    } catch (err) {
      console.error("Error testing prompt:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);

      // If an error occurs, add an error message from the assistant
      const errorAssistantMessage: ConversationEntry = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}`,
      };
      setConversation((prevConversation) => {
        const currentHistory = prevConversation.filter(
          (msg, index) =>
            !(
              index === prevConversation.length - 1 &&
              msg.role === "customer" &&
              msg.content === newCustomerMessageEntry.content
            ),
        );
        return [
          ...currentHistory,
          newCustomerMessageEntry,
          errorAssistantMessage,
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generateCustomizedPrompt());
  };

  const handleSavePrompt = async () => {
    if (!promptName.trim()) {
      toast({
        title: "Error",
        description: "Prompt name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const args = {
        agentName,
        dealershipName,
        financingUrl,
        tradeInUrl,
        appointmentUrl,
        inventoryUrl,
        specificInstructions,
        specificConstraints,
      };

      const tags = promptTags
        ? promptTags.split(",").map((tag) => tag.trim())
        : [];

      const response = await fetch("/api/prompt-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: promptName,
          description: promptDescription || null,
          promptTemplate: systemPrompt,
          arguments: args,
          isPublic,
          tags: tags.length > 0 ? tags : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save prompt");
      }

      toast({
        title: "Success",
        description: "Prompt saved to library!",
        variant: "default",
      });

      setPromptName("");
      setPromptDescription("");
      setPromptTags("");
      setIsPublic(false);
      setSaveDialogOpen(false);

      queryClient.invalidateQueries({ queryKey: ["/api/prompt-library"] });
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save prompt",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTestPrompt();
    }
  };

  const resetConversation = () => {
    setConversation([]);
    setResponse("");
    setError("");
  };

  const ChatBubble = ({
    content,
    isUser,
  }: {
    content: string;
    isUser: boolean;
  }) => (
    <div
      className={cn(
        "max-w-3/4 mb-4 p-3 rounded-lg",
        isUser
          ? "ml-auto bg-primary text-white"
          : "mr-auto bg-gray-100 dark:bg-gray-800",
      )}
    >
      <p className="whitespace-pre-wrap">{content}</p>
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          System Prompt Builder
        </h1>
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

      <div
        className={cn(
          "grid gap-6 transition-all duration-300",
          splitScreen ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
        )}
      >
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                >
                  <BookmarkIcon className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="px-0 pt-0 pb-0">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="w-full rounded-none justify-start bg-gray-100 dark:bg-gray-700 px-4">
                  <TabsTrigger value="editor" className="text-xs">
                    Template
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="variables" className="text-xs">
                    Variables
                  </TabsTrigger>
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
                      <Label htmlFor="agentName" className="text-xs">
                        Agent Name
                      </Label>
                      <Input
                        id="agentName"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="dealershipName" className="text-xs">
                        Dealership Name
                      </Label>
                      <Input
                        id="dealershipName"
                        value={dealershipName}
                        onChange={(e) => setDealershipName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="financingUrl" className="text-xs">
                        Financing URL
                      </Label>
                      <Input
                        id="financingUrl"
                        value={financingUrl}
                        onChange={(e) => setFinancingUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="tradeInUrl" className="text-xs">
                        Trade-In URL
                      </Label>
                      <Input
                        id="tradeInUrl"
                        value={tradeInUrl}
                        onChange={(e) => setTradeInUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="appointmentUrl" className="text-xs">
                        Appointment URL
                      </Label>
                      <Input
                        id="appointmentUrl"
                        value={appointmentUrl}
                        onChange={(e) => setAppointmentUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="inventoryUrl" className="text-xs">
                        Inventory URL
                      </Label>
                      <Input
                        id="inventoryUrl"
                        value={inventoryUrl}
                        onChange={(e) => setInventoryUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <Label htmlFor="specificInstructions" className="text-xs">
                        Specific Instructions
                      </Label>
                      <Textarea
                        id="specificInstructions"
                        value={specificInstructions}
                        onChange={(e) =>
                          setSpecificInstructions(e.target.value)
                        }
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <Label htmlFor="specificConstraints" className="text-xs">
                        Specific Constraints
                      </Label>
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
                <TestConversation
                  conversation={conversation}
                  customerMessage={customerMessage}
                  setCustomerMessage={setCustomerMessage}
                  isLoading={isLoading}
                  error={error}
                  handleKeyDown={handleKeyDown}
                  handleTestPrompt={handleTestPrompt}
                  resetConversation={resetConversation}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Save Prompt Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Save System Prompt to Library</DialogTitle>
              <DialogDescription>
                Save your system prompt template and arguments for future use
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="promptName" className="text-right">
                  Name
                </Label>
                <Input
                  id="promptName"
                  placeholder="Descriptive name for this prompt"
                  className="col-span-3"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="promptDescription" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="promptDescription"
                  placeholder="What does this prompt do? When should it be used?"
                  className="col-span-3"
                  value={promptDescription}
                  onChange={(e) => setPromptDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="promptTags" className="text-right">
                  Tags
                </Label>
                <Input
                  id="promptTags"
                  placeholder="sales, marketing, vip (comma separated)"
                  className="col-span-3"
                  value={promptTags}
                  onChange={(e) => setPromptTags(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isPublic" className="text-right">
                  Public
                </Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  <Label
                    htmlFor="isPublic"
                    className="text-sm text-muted-foreground"
                  >
                    Make this prompt visible to all users
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePrompt}
                disabled={isSaving || !promptName.trim()}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save to Library
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <TestConversation
                conversation={conversation}
                customerMessage={customerMessage}
                setCustomerMessage={setCustomerMessage}
                isLoading={isLoading}
                error={error}
                handleKeyDown={handleKeyDown}
                handleTestPrompt={handleTestPrompt}
                resetConversation={resetConversation}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Floating Action Button for Mobile View */}
      <div className="lg:hidden">
        <button
          className="floating-action-btn"
          onClick={() =>
            setActiveTab(activeTab === "editor" ? "variables" : "editor")
          }
        >
          {activeTab === "editor" ? (
            <Settings className="h-6 w-6" />
          ) : (
            <Code className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}

interface TestConversationProps {
  conversation: ConversationEntry[];
  customerMessage: string;
  setCustomerMessage: (message: string) => void;
  isLoading: boolean;
  error: string;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleTestPrompt: () => void;
  resetConversation: () => void;
}

function TestConversation({
  conversation,
  customerMessage,
  setCustomerMessage,
  isLoading,
  error,
  handleKeyDown,
  handleTestPrompt,
}: TestConversationProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  return (
    <>
      <div
        ref={chatContainerRef}
        className={cn(
          "flex flex-col overflow-y-auto p-4 rounded-md bg-gray-50 dark:bg-gray-900",
          conversation.length > 0
            ? "min-h-[300px] max-h-[300px]"
            : "min-h-[200px]",
        )}
      >
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-70 space-y-2">
            <MessageSquare className="h-10 w-10 opacity-20" />
            <p className="text-sm">Your conversation will appear here.</p>
            <p className="text-xs">Send a message to test your prompt.</p>
          </div>
        ) : (
          conversation.map((message, index) => (
            <div
              key={index}
              className={cn(
                "max-w-[80%] mb-3 rounded-lg p-3",
                message.role === "customer"
                  ? "self-end bg-primary text-white"
                  : "self-start bg-white dark:bg-gray-800 shadow-sm",
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          ))
        )}

        {isLoading &&
          conversation.length > 0 &&
          conversation[conversation.length - 1].role === "customer" && (
            <div className="self-start bg-white dark:bg-gray-800 shadow-sm max-w-[80%] mb-3 rounded-lg p-3 flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Typing response...</span>
            </div>
          )}
      </div>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex space-x-2">
        <Textarea
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          placeholder="Type your message here..."
          onKeyDown={handleKeyDown}
          className="resize-none h-20 text-sm"
        />
        <Button
          onClick={handleTestPrompt}
          disabled={isLoading || !customerMessage.trim()}
          className="self-end"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </>
  );
}
