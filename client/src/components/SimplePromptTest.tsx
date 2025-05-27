import React, { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

interface TestResult {
  success: boolean;
  processedPrompt?: string;
  aiResponse?: string;
  timestamp?: string;
  error?: string;
}

export default function SimplePromptTest() {
  const [prompt, setPrompt] =
    useState<string>(`You are an automotive sales agent named Rylie working for OneKeel Motors. 
You are known for being knowledgeable, friendly, and professional.
Your goal is to assist customers with their vehicle purchasing needs.
  
Guidelines:
- Be conversational and personable
- Focus on the customer's needs and preferences
- Provide accurate information about vehicles
- Guide customers towards making a decision
- Offer to schedule test drives or follow-up appointments`);

  const [customerMessage, setCustomerMessage] = useState<string>(
    "Hi, I'm interested in buying a new SUV. What do you have available?",
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setResult(null);

      const response = await fetch("/api/simple-prompt-test/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          customerMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to test prompt");
      }

      setResult(data);
      console.log("Prompt test completed successfully");
    } catch (error) {
      console.error("Prompt test error:", error);
      setResult({
        success: false,
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Simple Prompt Testing Tool</CardTitle>
          <CardDescription>
            Test your automotive sales agent prompts without authentication
            requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prompt">System Prompt</TabsTrigger>
              <TabsTrigger value="message">Customer Message</TabsTrigger>
            </TabsList>
            <TabsContent value="prompt" className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  System Prompt (Instructions for the AI)
                </label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>
            <TabsContent value="message" className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="customerMessage"
                  className="text-sm font-medium"
                >
                  Customer Message
                </label>
                <Textarea
                  id="customerMessage"
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              // Display a confirmation message
              console.log("Results cleared");
            }}
          >
            Clear Results
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Prompt"
            )}
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <Card className="w-full max-w-4xl mx-auto mt-6">
          <CardHeader>
            <CardTitle>{result.success ? "Test Results" : "Error"}</CardTitle>
            {result.timestamp && (
              <CardDescription>
                Processed at {new Date(result.timestamp).toLocaleString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {result.error ? (
              <div className="p-4 border border-red-200 rounded-md bg-red-50 text-red-800">
                <p className="font-medium">Error:</p>
                <p>{result.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 border rounded-md bg-muted">
                  <p className="font-medium mb-2">AI Response:</p>
                  <div className="whitespace-pre-wrap">{result.aiResponse}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
