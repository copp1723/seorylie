import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "react-query";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, Clock, Info, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export default function SimplePromptTestingPage() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [customerContext, setCustomerContext] = useState("");
  const [vehicleContext, setVehicleContext] = useState("");
  const [dealershipContext, setDealershipContext] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [conversation, setConversation] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [handoverDossier, setHandoverDossier] = useState<any>(null);
  const [isGeneratingHandover, setIsGeneratingHandover] = useState(false);

  const { mutate: sendMessage, isLoading: isSending } = useMutation(
    (message: string) =>
      apiRequest("/api/prompt-test", {
        method: "POST",
        data: {
          message,
          systemPrompt,
          customerContext,
          vehicleContext,
          dealershipContext,
          conversation,
        },
      }),
    {
      onSuccess: (data) => {
        setConversation([
          ...conversation,
          { role: "user", content: prompt },
          { role: "assistant", content: data.response },
        ]);
        setPrompt("");
      },
    }
  );

  const { mutate: generateHandover, isLoading: isHandoverLoading } = useMutation(
    () =>
      apiRequest("/api/generate-handover", {
        method: "POST",
        data: {
          conversation,
          customerContext,
          vehicleContext,
          dealershipContext,
        },
      }),
    {
      onSuccess: (data) => {
        setHandoverDossier(data.handoverDossier);
        setIsGeneratingHandover(false);
      },
    }
  );

  const handleSendMessage = () => {
    if (!prompt.trim()) return;
    sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateHandover = () => {
    setIsGeneratingHandover(true);
    generateHandover();
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Simple Prompt Testing</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Context Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Set the system instructions for the AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="You are a helpful automotive sales assistant..."
                className="min-h-[100px]"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Context Settings</CardTitle>
              <CardDescription>
                Add relevant context for the conversation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer Context
                </label>
                <Textarea
                  placeholder="Customer details, preferences..."
                  className="min-h-[80px]"
                  value={customerContext}
                  onChange={(e) => setCustomerContext(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Vehicle Context
                </label>
                <Textarea
                  placeholder="Vehicle details, inventory..."
                  className="min-h-[80px]"
                  value={vehicleContext}
                  onChange={(e) => setVehicleContext(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Dealership Context
                </label>
                <Textarea
                  placeholder="Dealership information, policies..."
                  className="min-h-[80px]"
                  value={dealershipContext}
                  onChange={(e) => setDealershipContext(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Chat Interface */}
        <div className="lg:col-span-2">
          <Tabs
            defaultValue="chat"
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="mb-4">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="handover">Handover</TabsTrigger>
            </TabsList>

            <TabsContent
              value="chat"
              className="flex-1 flex flex-col h-[calc(100vh-250px)]"
            >
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle>Test Conversation</CardTitle>
                  <CardDescription>
                    Interact with the AI assistant
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="space-y-4 pb-4">
                      {conversation.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Start a conversation by sending a message below
                        </div>
                      ) : (
                        conversation.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              message.role === "assistant"
                                ? "justify-start"
                                : "justify-end"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                message.role === "assistant"
                                  ? "bg-primary/10 text-foreground"
                                  : "bg-primary text-primary-foreground"
                              }`}
                            >
                              <div className="whitespace-pre-wrap">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
                <CardFooter className="pt-0">
                  <div className="flex w-full items-center space-x-2">
                    <Textarea
                      placeholder="Type your message..."
                      className="flex-1"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!prompt.trim() || isSending}
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>
                  {conversation.length > 1 && (
                    <div className="w-full mt-4">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleGenerateHandover}
                        disabled={isGeneratingHandover}
                      >
                        {isGeneratingHandover ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating Handover...
                          </>
                        ) : (
                          <>Generate Handover Dossier</>
                        )}
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent
              value="handover"
              className="flex-1 h-[calc(100vh-250px)]"
            >
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>Handover Dossier</CardTitle>
                  <CardDescription>
                    AI-generated handover information for sales team
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  {!handoverDossier ? (
                    <div className="h-full flex items-center justify-center text-center">
                      {isHandoverLoading ? (
                        <div className="space-y-4">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                          <p>Generating handover dossier...</p>
                        </div>
                      ) : (
                        <div className="space-y-4 max-w-md">
                          <Info className="h-12 w-12 mx-auto text-muted-foreground" />
                          <h3 className="text-xl font-medium">
                            No Handover Generated
                          </h3>
                          <p className="text-muted-foreground">
                            Have a conversation with the AI assistant first, then
                            generate a handover dossier to see customer insights
                            and next steps.
                          </p>
                          {conversation.length > 0 && (
                            <Button
                              onClick={handleGenerateHandover}
                              className="mt-2"
                            >
                              Generate Handover
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[calc(100vh-350px)]">
                      <div className="space-y-6">
                        {/* Customer Details */}
                        <div>
                          <h3 className="text-xl font-semibold mb-4">
                            Customer Details
                          </h3>
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="flex items-start gap-4">
                              <Avatar className="h-16 w-16 border">
                                <div className="font-semibold text-xl">
                                  {handoverDossier.customerName
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")}
                                </div>
                              </Avatar>
                              <div>
                                <h4 className="text-lg font-medium">
                                  {handoverDossier.customerName}
                                </h4>
                                <p className="text-muted-foreground">
                                  {handoverDossier.customerEmail}
                                </p>
                                <p className="text-muted-foreground">
                                  {handoverDossier.customerPhone}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge variant="outline">
                                    {handoverDossier.leadStatus}
                                  </Badge>
                                  <Badge variant="outline">
                                    {handoverDossier.leadSource}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Conversation Summary */}
                        <div>
                          <h3 className="text-xl font-semibold mb-4">
                            Conversation Summary
                          </h3>
                          <Card>
                            <CardContent className="pt-6">
                              <p>{handoverDossier.conversationSummary}</p>
                              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                  {formatDistanceToNow(
                                    new Date(handoverDossier.timestamp),
                                    { addSuffix: true }
                                  )}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Customer Insights */}
                        <div>
                          <h3 className="text-xl font-semibold mb-4">
                            Customer Insights
                          </h3>
                          <div className="space-y-4">
                            {handoverDossier.customerInsights && (
                              <div className="mt-4">
                                <p className="font-semibold text-lg mb-2">
                                  Customer Insights:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                                  {handoverDossier.customerInsights.map(
                                    (insight: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700"
                                      >
                                        <div className="flex items-start gap-2">
                                          <div className="mt-0.5 text-blue-500 dark:text-blue-400">
                                            <Info className="h-4 w-4" />
                                          </div>
                                          <div>
                                            <p className="text-gray-800 dark:text-gray-200">
                                              {insight.value}
                                            </p>
                                            {insight.confidence && (
                                              <div className="mt-1">
                                                <Badge
                                                  variant={
                                                    insight.confidence > 0.7
                                                      ? "default"
                                                      : "outline"
                                                  }
                                                  className="text-xs"
                                                >
                                                  {Math.round(
                                                    insight.confidence * 100
                                                  )}
                                                  % confidence
                                                </Badge>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {handoverDossier.vehicleInterests && (
                              <div className="mt-6">
                                <p className="font-semibold text-lg mb-2">
                                  Vehicle Interests:
                                </p>
                                <div className="space-y-3 mt-2">
                                  {handoverDossier.vehicleInterests.map(
                                    (vehicle: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 p-3"
                                      >
                                        {vehicle.year &&
                                          vehicle.make &&
                                          vehicle.model && (
                                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                              {vehicle.year} {vehicle.make}{" "}
                                              {vehicle.model}{" "}
                                              {vehicle.trim && vehicle.trim}
                                            </h4>
                                          )}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {vehicle.bodyStyle && (
                                            <Badge variant="outline">
                                              {vehicle.bodyStyle}
                                            </Badge>
                                          )}
                                          {vehicle.priceRange && (
                                            <Badge variant="outline">
                                              {vehicle.priceRange}
                                            </Badge>
                                          )}
                                          {vehicle.interestLevel && (
                                            <Badge
                                              variant={
                                                vehicle.interestLevel ===
                                                "High"
                                                  ? "default"
                                                  : "outline"
                                              }
                                            >
                                              {vehicle.interestLevel} interest
                                            </Badge>
                                          )}
                                        </div>
                                        {vehicle.notes && (
                                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                            {vehicle.notes}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Next Steps */}
                        <div>
                          <h3 className="text-xl font-semibold mb-4">
                            Recommended Next Steps
                          </h3>
                          <div className="space-y-4">
                            {handoverDossier.nextSteps && (
                              <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                  Action Items:
                                </h4>
                                <ul className="space-y-2">
                                  {handoverDossier.nextSteps.map(
                                    (item: any, idx: number) => (
                                      <li
                                        key={`next-${idx}`}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="mt-0.5 text-green-500">
                                          <Check className="h-4 w-4" />
                                        </div>
                                        <span>{item}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            {handoverDossier.actionItems && (
                              <div className="mt-3 bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                  Additional Action Items:
                                </h4>
                                <ul className="space-y-2">
                                  {handoverDossier.actionItems.map(
                                    (item: any, idx: number) => (
                                      <li
                                        key={`action-${idx}`}
                                        className="flex items-start gap-2"
                                      >
                                        <div className="mt-0.5 text-green-500">
                                          <ChevronRight className="h-4 w-4" />
                                        </div>
                                        <span>{item}</span>
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
