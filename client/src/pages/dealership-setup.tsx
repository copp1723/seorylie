import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function DealershipSetup() {
  const [activeTab, setActiveTab] = useState("dealership");
  const [setupProgress, setSetupProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // State for form fields
  const [dealershipName, setDealershipName] = useState("Example Motors");
  const [aiName, setAiName] = useState("Rylie");
  const [specificInstructions, setSpecificInstructions] = useState(
    "Always start with a casual, personal greeting like 'Hey [Name], thanks for reaching out!' or 'Hi [Name], glad you messaged!'—never use stiff openers like 'Dear' or 'At [Dealership], we strive to…'.\n\nUse contractions (e.g., 'I don't' instead of 'I do not'), everyday words, and phrases you'd hear in a real conversation.\n\nAvoid corporate or scripted language—no 'strive to accommodate,' 'assist you further,' 'valued customer,' or similar formalities.",
  );
  const [specificConstraints, setSpecificConstraints] = useState(
    "No Pricing or Promises: Avoid discussing costs, financing details, or delivery guarantees.\n\nOne Link Max: Use only approved links for financing or other resources.\n\nNo Remote Diagnosis: For vehicle issues, always recommend an in-person evaluation.\n\nStop if they say: 'Thanks,' 'Not interested,' 'Stop messaging,' or 'I bought elsewhere.'\n\nResume if they ask about test drives, trade-ins, or follow-ups.",
  );
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

  // Generate system prompt preview
  const generateSystemPrompt = () => {
    return `System Prompt for Automotive Sales Agent AI
You are an automotive sales agent named ${aiName}, working for ${dealershipName}, a dealership committed to exceptional customer service and top-quality vehicles. Your job is to connect with customers, understand their needs, and guide them toward purchasing a vehicle from our inventory that perfectly fits their lifestyle. You're a real person to them—never hint that you're an AI or break character. Your focus is on building trust, sparking excitement, and making the car-buying process smooth and enjoyable.

Dealership Contact
Contact Details: Visit our dealership at our main location or contact us online

Resource URLs:
- Financing: ${financingUrl}
- Trade-In Valuation: ${tradeInUrl}
- Appointment Scheduling: ${appointmentUrl}
- Browse Inventory: ${inventoryUrl}

Inventory
Available Products: [INPUT-Product Inventory]

Conversation Context
Customer Name: [INPUT-CUSTOMER NAME]
History: [INPUT-CONVERSATION]

Key Responsibilities
Personalize the Experience
Use the customer's name (ask politely if unknown: "Hey, what's your name so I can assist you better?").
Adapt to their preferred name if specified.

Understand Their Needs
Review the conversation history to grasp their interests, mood, and goals.

Show Empathy
Connect emotionally with a warm, caring tone.

Engage and Excite
Share fun facts or ask questions tied to their needs.

Guide to Purchase
Highlight vehicle features from our inventory that match their needs.
Push for action: "Let's get you behind the wheel—when can you swing by for a test drive?"

Specific Instructions
${specificInstructions}

Specific Constraints
${specificConstraints}

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
  "answer": "${aiName}\\n\\nYour tailored response with proper spacing and line breaks.",
  "retrieve_inventory_data": true,
  "research_queries": ["Specific inventory questions"],
  "reply_required": true
}`;
  };

  // Mock function to simulate saving settings
  const handleSave = () => {
    // Simulate saving settings
    setSetupProgress((prev) => Math.min(100, prev + 33));
  };

  return (
    <>
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <h1 className="text-2xl font-medium">Dealership Setup</h1>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-muted-foreground">Setup Progress:</div>
          <Progress value={setupProgress} className="w-32 h-2" />
          <div className="text-sm font-medium">{setupProgress}%</div>
        </div>
      </div>

      <Tabs
        defaultValue="dealership"
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="bg-white shadow mb-6 p-1 rounded-lg">
          <TabsTrigger value="dealership" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">store</span>
            Dealership Info
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">directions_car</span>
            Inventory Setup
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">smart_toy</span>
            AI Configuration
          </TabsTrigger>
        </TabsList>

        {/* Dealership Info Tab */}
        <TabsContent value="dealership">
          <Card>
            <CardHeader>
              <CardTitle>Dealership Information</CardTitle>
              <CardDescription>
                Set up your dealership's basic information for AI interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dealershipName">Dealership Name</Label>
                  <Input id="dealershipName" placeholder="e.g. ABC Motors" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g. 123 Main St, City, State"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Dealership Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your dealership in a few sentences..."
                  className="min-h-[100px]"
                />
                <p className="text-sm text-muted-foreground">
                  This description will be used by the AI to understand your
                  dealership's brand and values.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" placeholder="e.g. (555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" placeholder="e.g. sales@abcmotors.com" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  placeholder="e.g. https://www.abcmotors.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialties">Dealership Specialties</Label>
                <Input
                  id="specialties"
                  placeholder="e.g. Luxury Cars, SUVs, Electric Vehicles"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the types of vehicles or services your dealership
                  specializes in, separated by commas.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button onClick={handleSave}>Save Dealership Info</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Inventory Setup Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Configuration</CardTitle>
              <CardDescription>
                Configure how your inventory is synchronized with the AI system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoSync" className="font-medium">
                      Automatic Inventory Sync
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync inventory changes with the AI system
                    </p>
                  </div>
                  <Switch id="autoSync" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inventorySource">Inventory Data Source</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <Card className="border-2 border-primary cursor-pointer">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base flex items-center">
                          <span className="material-icons mr-2 text-primary">
                            verified
                          </span>
                          CSV/TSV Upload
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border border-dashed cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base text-muted-foreground">
                          API Connection
                        </CardTitle>
                      </CardHeader>
                    </Card>
                    <Card className="border border-dashed cursor-pointer hover:border-primary transition-colors">
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base text-muted-foreground">
                          Manual Entry
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Upload Inventory File</Label>
                  <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed p-6 cursor-pointer hover:border-primary">
                    <div className="text-center">
                      <span className="material-icons text-muted-foreground text-3xl mb-2">
                        upload_file
                      </span>
                      <p className="text-sm font-medium">
                        Drag and drop your inventory file, or{" "}
                        <span className="text-primary">browse</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supported formats: CSV, TSV, Excel
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="syncFrequency">Sync Frequency</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="justify-start">
                      Hourly
                    </Button>
                    <Button variant="default" className="justify-start">
                      Daily
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Weekly
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button onClick={handleSave}>Save Inventory Setup</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* AI Configuration Tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>
                Configure how the AI interacts with your customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="aiName">AI Assistant Name</Label>
                  <Input
                    id="aiName"
                    placeholder="e.g. Rylie"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    This is the name that customers will see when interacting
                    with your AI assistant.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aiTone">Conversation Tone</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Button variant="outline" className="justify-start">
                      Professional
                    </Button>
                    <Button variant="default" className="justify-start">
                      Friendly
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Casual
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Formal
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Enthusiastic
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Luxury
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aiWelcomeMessage">Welcome Message</Label>
                  <Textarea
                    id="aiWelcomeMessage"
                    placeholder="Enter the message that will greet customers..."
                    className="min-h-[100px]"
                    defaultValue="Hi there! I'm Rylie, your automotive assistant. How can I help you today?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specificInstructions">
                    Specific Instructions
                  </Label>
                  <Textarea
                    id="specificInstructions"
                    placeholder="Enter any specific instructions for the AI assistant..."
                    className="min-h-[150px]"
                    value={specificInstructions}
                    onChange={(e) => setSpecificInstructions(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    These specific instructions will guide how the AI
                    communicates with customers.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specificConstraints">
                    Specific Constraints
                  </Label>
                  <Textarea
                    id="specificConstraints"
                    placeholder="Enter any constraints for the AI assistant..."
                    className="min-h-[150px]"
                    value={specificConstraints}
                    onChange={(e) => setSpecificConstraints(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    These constraints define limits on what the AI can discuss
                    or promise.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-md font-medium">
                    Dealership Resource URLs
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    These URLs will be used when customers ask about specific
                    services.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="financingUrl">Financing URL</Label>
                    <Input
                      id="financingUrl"
                      placeholder="e.g. https://www.dealership.com/financing"
                      value={financingUrl}
                      onChange={(e) => setFinancingUrl(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      This link will be provided when customers ask about
                      financing options.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tradeInUrl">Trade-In URL</Label>
                    <Input
                      id="tradeInUrl"
                      placeholder="e.g. https://www.dealership.com/trade-in"
                      value={tradeInUrl}
                      onChange={(e) => setTradeInUrl(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      This link will be provided when customers ask about
                      trading in their current vehicle.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appointmentUrl">
                      Appointment Scheduling URL
                    </Label>
                    <Input
                      id="appointmentUrl"
                      placeholder="e.g. https://www.dealership.com/schedule"
                      value={appointmentUrl}
                      onChange={(e) => setAppointmentUrl(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      This link will be provided when customers want to schedule
                      a test drive or service appointment.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inventoryUrl">Inventory Browsing URL</Label>
                    <Input
                      id="inventoryUrl"
                      placeholder="e.g. https://www.dealership.com/inventory"
                      value={inventoryUrl}
                      onChange={(e) => setInventoryUrl(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      This link will be provided when customers want to browse
                      the full vehicle inventory.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Handover Settings</Label>
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Automatic Handover</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically hand over to a human agent when certain
                          triggers are detected
                        </p>
                      </div>
                      <Switch id="autoHandover" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          Collect Customer Information
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Collect customer contact information before handover
                        </p>
                      </div>
                      <Switch id="collectInfo" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Generate Handover Summary</p>
                        <p className="text-sm text-muted-foreground">
                          Create a summary of the conversation for the human
                          agent
                        </p>
                      </div>
                      <Switch id="generateSummary" defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="mr-2">
                    Preview System Prompt
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>System Prompt Preview</DialogTitle>
                    <DialogDescription>
                      This is how the system prompt will look with your current
                      customizations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="bg-muted p-4 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm">
                      {generateSystemPrompt()}
                    </pre>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowPreview(false)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={handleSave}>Save AI Configuration</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
