import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReloadIcon } from "@radix-ui/react-icons";

export default function PromptLibraryPage() {
  const [prompt, setPrompt] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("test");

  // Query for system prompts - TEMPORARILY DISABLED
  const [systemPromptsData, setSystemPromptsData] = useState<any>(undefined);
  const [systemPromptsLoading, setSystemPromptsLoading] = useState(false);


  // Query for test history - TEMPORARILY DISABLED
  const [testHistoryData, setTestHistoryData] = useState<any>(undefined);
  const [testHistoryLoading, setTestHistoryLoading] = useState(false);


  // Mutation for testing prompts - TEMPORARILY DISABLED
  const testPromptMutation = {
    mutate: (data: { prompt: string; variables?: Record<string, string> }) => {
      console.log("Would test prompt:", data);
      // Simulate response for testing
      const mockResponse = {
        processedPrompt: data.prompt,
        aiResponse: "This is a mock response for testing purposes",
        timestamp: new Date().toISOString(),
      };
      setTestPromptMutation((prev) => ({ ...prev, data: mockResponse }));
    },
    isPending: false,
    isError: false,
    error: null,
    data: null,
  };

  const [testPromptMutationState, setTestPromptMutation] =
    useState(testPromptMutation);


  // Handle prompt selection from library
  const handleSelectPrompt = (template: string, promptVariables: string[]) => {
    setPrompt(template);

    // Initialize variables object with empty strings
    const newVariables: Record<string, string> = {};
    promptVariables.forEach((variable) => {
      newVariables[variable] = "";
    });
    setVariables(newVariables);
  };

  // Handle testing a prompt
  const handleTestPrompt = () => {
    if (!prompt.trim()) return;

    // Only include variables if there are any
    const variablesToSubmit =
      Object.keys(variables).length > 0 ? variables : undefined;

    testPromptMutationState.mutate({
      prompt,
      variables: variablesToSubmit,
    });
  };

  // Extract variables from prompt text (anything like {{variable_name}})
  const extractVariables = (promptText: string) => {
    const regex = /{{(\w+)}}/g;
    let match;
    const extractedVars: string[] = [];

    // Use regex.exec instead of matchAll for better compatibility
    while ((match = regex.exec(promptText)) !== null) {
      if (match[1]) {
        extractedVars.push(match[1]);
      }
    }

    // Update variables state with any new variables
    const newVariables = { ...variables };
    extractedVars.forEach((variable) => {
      if (!newVariables[variable]) {
        newVariables[variable] = "";
      }
    });

    setVariables(newVariables);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Prompt Library</h1>

      <Tabs defaultValue="test" onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="test">Test Prompts</TabsTrigger>
          <TabsTrigger value="library">System Prompts</TabsTrigger>
          <TabsTrigger value="history">Test History</TabsTrigger>
        </TabsList>

        {/* Test Prompts Tab */}
        <TabsContent value="test">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Prompt Template</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="h-64 mb-4"
                  placeholder="Enter your prompt template here. Use {{variable_name}} for variables."
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    extractVariables(e.target.value);
                  }}
                />

                {Object.keys(variables).length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Variables</h3>
                    {Object.keys(variables).map((variable) => (
                      <div key={variable} className="mb-2">
                        <Label htmlFor={`var-${variable}`}>{variable}</Label>
                        <Input
                          id={`var-${variable}`}
                          value={variables[variable]}
                          onChange={(e) =>
                            setVariables({
                              ...variables,
                              [variable]: e.target.value,
                            })
                          }
                          placeholder={`Value for ${variable}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={handleTestPrompt}
                  disabled={testPromptMutationState.isPending || !prompt.trim()}
                  className="w-full"
                >
                  {testPromptMutationState.isPending && (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Test Prompt
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                {testPromptMutationState.isError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>
                      {testPromptMutationState.error instanceof Error
                        ? testPromptMutationState.error.message
                        : "An error occurred while testing the prompt."}
                    </AlertDescription>
                  </Alert>
                )}

                {testPromptMutationState.data && (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-2">
                        Processed Prompt
                      </h3>
                      <div className="p-3 bg-muted rounded-md whitespace-pre-wrap">
                        {testPromptMutationState.data.processedPrompt}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-lg font-medium mb-2">AI Response</h3>
                      <div className="p-3 bg-muted rounded-md whitespace-pre-wrap">
                        {testPromptMutationState.data.aiResponse}
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Tested at:{" "}
                      {new Date(
                        testPromptMutationState.data.timestamp,
                      ).toLocaleString()}
                    </div>
                  </div>
                )}

                {!testPromptMutationState.data &&
                  !testPromptMutationState.isError && (
                    <div className="text-center py-12 text-muted-foreground">
                      Test a prompt to see results
                    </div>
                  )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Prompts Tab */}
        <TabsContent value="library">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {systemPromptsLoading ? (
              <div className="col-span-full text-center py-12">
                <ReloadIcon className="h-8 w-8 mx-auto animate-spin" />
                <p className="mt-2 text-muted-foreground">
                  Loading system prompts...
                </p>
              </div>
            ) : systemPromptsData?.prompts &&
              systemPromptsData.prompts.length > 0 ? (
              systemPromptsData.prompts.map((promptItem) => (
                <Card key={promptItem.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle>{promptItem.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-3">
                      {promptItem.description}
                    </p>
                    <div className="h-32 overflow-y-auto mb-3 p-2 bg-muted rounded-md text-sm">
                      {promptItem.template}
                    </div>

                    {promptItem.variables.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-1">Variables:</p>
                        <div className="flex flex-wrap gap-2">
                          {promptItem.variables.map((variable: string) => (
                            <span
                              key={variable}
                              className="px-2 py-1 bg-primary/10 rounded-md text-xs"
                            >
                              {variable}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        handleSelectPrompt(
                          promptItem.template,
                          Array.isArray(promptItem.variables)
                            ? promptItem.variables
                            : JSON.parse(
                                promptItem.variables as unknown as string,
                              ),
                        );
                        setActiveTab("test");
                      }}
                    >
                      Use This Template
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">No system prompts found</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Test History Tab */}
        <TabsContent value="history">
          <div className="space-y-6">
            {testHistoryLoading ? (
              <div className="text-center py-12">
                <ReloadIcon className="h-8 w-8 mx-auto animate-spin" />
                <p className="mt-2 text-muted-foreground">
                  Loading test history...
                </p>
              </div>
            ) : testHistoryData?.tests && testHistoryData.tests.length > 0 ? (
              testHistoryData.tests.map((test) => (
                <Card key={test.id}>
                  <CardHeader>
                    <CardTitle className="flex justify-between">
                      <span>Test #{test.id}</span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {new Date(test.created_at).toLocaleString()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium mb-2">
                          Original Prompt
                        </h3>
                        <div className="p-3 bg-muted rounded-md whitespace-pre-wrap">
                          {test.original_prompt}
                        </div>
                      </div>

                      {Object.keys(test.variables).length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-2">
                            Variables
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(test.variables).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="p-2 bg-muted rounded-md"
                                >
                                  <span className="font-medium">{key}:</span>{" "}
                                  {value as string}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      <Separator />

                      <div>
                        <h3 className="text-lg font-medium mb-2">
                          AI Response
                        </h3>
                        <div className="p-3 bg-muted rounded-md whitespace-pre-wrap">
                          {test.ai_response}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPrompt(test.original_prompt);
                            setVariables(test.variables);
                            setActiveTab("test");
                          }}
                        >
                          Use This Template
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No test history found</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
