import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { ChatMessage } from "../components/chat-message";

// Helper function to safely cast unknown to TestResult
function safelyParseTestResult(data: unknown): TestResult | null {
  if (data && 
      typeof data === 'object' && 
      'success' in data && 
      'processedPrompt' in data && 
      'aiResponse' in data &&
      'timestamp' in data) {
    return data as TestResult;
  }
  return null;
}

interface TestResult {
  success: boolean;
  processedPrompt: string;
  aiResponse: string;
  timestamp: string;
}

interface PromptTest {
  id: number;
  original_prompt: string;
  processed_prompt: string;
  ai_response: string;
  variables: Record<string, any>;
  created_at: string;
}

const PromptTestingPage: React.FC = () => {
  const [prompt, setPrompt] = useState('You are an automotive sales agent named {{Agent_Name}}, working for {{Dealership}}. Rewrite if off: Trim wordiness, boost empathy, fix compliance, or adjust tone to sound like a real salesperson (e.g., replace "We strive to assist" with "We\'ve got you covered!").');
  const [variables, setVariables] = useState<Record<string, string>>({
    Agent_Name: 'Sarah',
    Dealership: 'Premium Auto Sales'
  });
  const [newVariableKey, setNewVariableKey] = useState('');
  const [newVariableValue, setNewVariableValue] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [testHistory, setTestHistory] = useState<PromptTest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{[^}]+\}\}/g) || [];
    const uniqueVars = new Set<string>();
    matches.forEach(match => {
      uniqueVars.add(match.replace(/[{}]/g, '').trim());
    });
    return Array.from(uniqueVars);
  };

  const promptVariables = extractVariables(prompt);

  const handleTest = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/prompt-test/test', {
        method: 'POST',
        body: {
          prompt: prompt.trim(),
          variables: variables
        }
      });

      const result = safelyParseTestResult(response);
      if (result) {
        setTestResult(result);
      } else {
        setError('Invalid response format from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const addVariable = () => {
    if (!newVariableKey.trim()) return;

    setVariables(prev => ({
      ...prev,
      [newVariableKey]: newVariableValue
    }));

    setNewVariableKey('');
    setNewVariableValue('');
  };

  const removeVariable = (key: string) => {
    setVariables(prev => {
      const newVars = { ...prev };
      delete newVars[key];
      return newVars;
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Prompt Testing</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prompt Template</CardTitle>
            <CardDescription>Enter your prompt template with variables in {`{{variable_name}}`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Template</Label>
              <Textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[200px]"
                placeholder="Enter your prompt template..."
              />
            </div>

            <div>
              <Label>Variables</Label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Input
                  value={newVariableKey}
                  onChange={(e) => setNewVariableKey(e.target.value)}
                  placeholder="Variable name"
                />
                <Input
                  value={newVariableValue}
                  onChange={(e) => setNewVariableValue(e.target.value)}
                  placeholder="Value"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={addVariable}
                className="w-full"
              >
                Add Variable
              </Button>
            </div>

            <div className="space-y-2">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-muted rounded-md">
                  <div>
                    <span className="font-medium">{key}:</span> {value}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariable(key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleTest}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Testing...' : 'Test Prompt'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>View the processed prompt and AI response</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {testResult && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Processed Prompt:</h3>
                  <div className="bg-muted p-3 rounded-md whitespace-pre-wrap">
                    {testResult.processedPrompt}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">AI Response:</h3>
                  <div className="bg-muted p-3 rounded-md whitespace-pre-wrap">
                    {testResult.aiResponse}
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Test ID: {testResult.timestamp}</span>
                  <Badge variant="outline">
                    {testResult.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              </div>
            )}

            {!testResult && !error && (
              <div className="text-center py-8 text-muted-foreground">
                No test results yet. Try testing a prompt!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PromptTestingPage;