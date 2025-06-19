import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import ChatInterface from "@/components/chat-interface";
import ChatModeSettings from "@/components/chat/ChatModeSettings";

interface DealershipSettings {
  id: number;
  name: string;
  mode: "rylie_ai" | "direct_agent";
  workingHours: any;
  fallbackToAi: boolean;
  aiSettings: {
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
}

const ChatDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState("demo");
  const [chatMode, setChatMode] = useState<"rylie_ai" | "direct_agent">(
    "rylie_ai",
  );

  // Mock user data for demo purposes
  const mockUser = {
    id: 1001,
    name: "Demo User",
    email: "demo@example.com",
    role: "admin",
  };

  // Mock dealership data for demo purposes
  const mockDealership = {
    id: 101,
    name: "AutoTech Motors",
  };

  const handleSettingsChanged = (settings: DealershipSettings) => {
    setChatMode(settings.mode);
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">Chat System Demo</h1>
      <p className="text-lg text-muted-foreground mb-6">
        Test our configurable chat system with dual operation modes
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList>
          <TabsTrigger value="demo">Chat Demo</TabsTrigger>
          <TabsTrigger value="settings">Chat Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Rylie AI Mode</CardTitle>
                <CardDescription>
                  Automated AI responses using PureCars integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChatInterface
                  dealershipId={mockDealership.id}
                  userId={mockUser.id}
                  userName={mockUser.name}
                  mode="rylie_ai"
                  agentName="Rylie AI Assistant"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Direct Agent Mode</CardTitle>
                <CardDescription>
                  Human agent handling during configured working hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChatInterface
                  dealershipId={mockDealership.id}
                  userId={mockUser.id}
                  userName={mockUser.name}
                  mode="direct_agent"
                  agentName="Sarah, Support Agent"
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 p-6 bg-muted rounded-lg">
            <h3 className="text-xl font-semibold mb-4">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-medium mb-2">Rylie AI Mode</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Uses OpenAI GPT-4o integration through PureCars API</li>
                  <li>Customizable system prompt and AI parameters</li>
                  <li>Available 24/7 for immediate customer support</li>
                  <li>Perfect for after-hours inquiries and initial contact</li>
                  <li>
                    Handles common questions about inventory, services, and more
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-2">Direct Agent Mode</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Routes messages to human agents during working hours</li>
                  <li>Configurable working hours for each day of the week</li>
                  <li>Optional AI fallback for after-hours support</li>
                  <li>Real-time agent typing indicators</li>
                  <li>Ideal for complex inquiries and sales conversations</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <ChatModeSettings
            dealershipId={mockDealership.id}
            onSettingsChanged={handleSettingsChanged}
          />

          <div className="mt-8 p-6 bg-muted rounded-lg">
            <h3 className="text-xl font-semibold mb-4">
              Current Configuration
            </h3>
            <p className="mb-4">
              Your dealership is currently using:{" "}
              <strong>
                {chatMode === "rylie_ai"
                  ? "Rylie AI Mode"
                  : "Direct Agent Mode"}
              </strong>
            </p>
            <p>
              Change your settings above to switch between modes. In a real
              implementation, this would affect how customer chat requests are
              handled across your website.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatDemo;
