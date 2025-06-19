import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface WorkingHours {
  monday: { start: string; end: string; enabled: boolean };
  tuesday: { start: string; end: string; enabled: boolean };
  wednesday: { start: string; end: string; enabled: boolean };
  thursday: { start: string; end: string; enabled: boolean };
  friday: { start: string; end: string; enabled: boolean };
  saturday: { start: string; end: string; enabled: boolean };
  sunday: { start: string; end: string; enabled: boolean };
}

interface DealershipSettings {
  id: number;
  name: string;
  mode: "rylie_ai" | "direct_agent";
  workingHours: WorkingHours;
  fallbackToAi: boolean;
  aiSettings: {
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
  };
}

interface ChatModeSettingsProps {
  dealershipId: number;
  onSettingsChanged?: (settings: DealershipSettings) => void;
}

const defaultWorkingHours: WorkingHours = {
  monday: { start: "09:00", end: "17:00", enabled: true },
  tuesday: { start: "09:00", end: "17:00", enabled: true },
  wednesday: { start: "09:00", end: "17:00", enabled: true },
  thursday: { start: "09:00", end: "17:00", enabled: true },
  friday: { start: "09:00", end: "17:00", enabled: true },
  saturday: { start: "10:00", end: "15:00", enabled: false },
  sunday: { start: "10:00", end: "15:00", enabled: false },
};

const defaultAiSettings = {
  systemPrompt:
    "You are Rylie, a helpful automotive dealership assistant. Provide friendly, accurate information about our vehicles and services.",
  temperature: 0.7,
  maxTokens: 500,
};

const ChatModeSettings: React.FC<ChatModeSettingsProps> = ({
  dealershipId,
  onSettingsChanged,
}) => {
  const [settings, setSettings] = useState<DealershipSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/dealerships/${dealershipId}/settings`,
        );

        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          // If settings don't exist yet, create default settings
          setSettings({
            id: dealershipId,
            name: "Your Dealership",
            mode: "rylie_ai", // Default to AI mode
            workingHours: defaultWorkingHours,
            fallbackToAi: true,
            aiSettings: defaultAiSettings,
          });
        }
      } catch (error) {
        console.error("Error fetching dealership settings:", error);
        toast({
          title: "Error",
          description: "Failed to load settings. Using defaults.",
          variant: "destructive",
        });

        // Set default settings on error
        setSettings({
          id: dealershipId,
          name: "Your Dealership",
          mode: "rylie_ai",
          workingHours: defaultWorkingHours,
          fallbackToAi: true,
          aiSettings: defaultAiSettings,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [dealershipId, toast]);

  const handleModeChange = (mode: "rylie_ai" | "direct_agent") => {
    if (!settings) return;

    setSettings({
      ...settings,
      mode,
    });
  };

  const handleWorkingHoursChange = (
    day: keyof WorkingHours,
    field: "start" | "end" | "enabled",
    value: string | boolean,
  ) => {
    if (!settings) return;

    setSettings({
      ...settings,
      workingHours: {
        ...settings.workingHours,
        [day]: {
          ...settings.workingHours[day],
          [field]: value,
        },
      },
    });
  };

  const handleAiSettingsChange = (
    field: keyof typeof defaultAiSettings,
    value: string | number,
  ) => {
    if (!settings) return;

    setSettings({
      ...settings,
      aiSettings: {
        ...settings.aiSettings,
        [field]:
          field === "temperature" || field === "maxTokens"
            ? parseFloat(value as string)
            : value,
      },
    });
  };

  const handleFallbackToggle = (fallbackEnabled: boolean) => {
    if (!settings) return;

    setSettings({
      ...settings,
      fallbackToAi: fallbackEnabled,
    });
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);

      const response = await fetch(
        `/api/dealerships/${dealershipId}/settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        },
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: "Chat mode settings saved successfully.",
        });

        if (onSettingsChanged) {
          onSettingsChanged(settings);
        }
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-[300px]">
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Chat System Configuration</CardTitle>
        <CardDescription>
          Configure how your dealership handles customer chat interactions
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs
          defaultValue={settings.mode}
          onValueChange={(value) =>
            handleModeChange(value as "rylie_ai" | "direct_agent")
          }
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="rylie_ai">Rylie AI Mode</TabsTrigger>
            <TabsTrigger value="direct_agent">Direct Agent Mode</TabsTrigger>
          </TabsList>

          <TabsContent value="rylie_ai" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">
                AI Assistant Settings
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure how the Rylie AI assistant will interact with
                customers.
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <textarea
                    id="systemPrompt"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1.5 min-h-[100px]"
                    value={settings.aiSettings.systemPrompt}
                    onChange={(e) =>
                      handleAiSettingsChange("systemPrompt", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This is the base instruction that guides how the AI responds
                    to customers.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.aiSettings.temperature}
                      onChange={(e) =>
                        handleAiSettingsChange("temperature", e.target.value)
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher values (0.7-1.0) make responses more creative,
                      lower values (0.2-0.5) make them more precise.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="maxTokens">Max Response Length</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="100"
                      max="2000"
                      step="50"
                      value={settings.aiSettings.maxTokens}
                      onChange={(e) =>
                        handleAiSettingsChange("maxTokens", e.target.value)
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum length of AI responses (in tokens). 500 is
                      typically 350-400 words.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="direct_agent" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Working Hours</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set when your human agents are available to handle customer
                chats.
              </p>

              <div className="space-y-3">
                {Object.entries(settings.workingHours).map(([day, hours]) => (
                  <div
                    key={day}
                    className="grid grid-cols-[100px_1fr_1fr_100px] gap-4 items-center"
                  >
                    <div className="capitalize">{day}</div>
                    <div>
                      <Label htmlFor={`${day}-start`} className="sr-only">
                        Start Time
                      </Label>
                      <Input
                        id={`${day}-start`}
                        type="time"
                        value={hours.start}
                        onChange={(e) =>
                          handleWorkingHoursChange(
                            day as keyof WorkingHours,
                            "start",
                            e.target.value,
                          )
                        }
                        disabled={!hours.enabled}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${day}-end`} className="sr-only">
                        End Time
                      </Label>
                      <Input
                        id={`${day}-end`}
                        type="time"
                        value={hours.end}
                        onChange={(e) =>
                          handleWorkingHoursChange(
                            day as keyof WorkingHours,
                            "end",
                            e.target.value,
                          )
                        }
                        disabled={!hours.enabled}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`${day}-enabled`}
                        checked={hours.enabled}
                        onChange={(e) =>
                          handleWorkingHoursChange(
                            day as keyof WorkingHours,
                            "enabled",
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor={`${day}-enabled`} className="text-sm">
                        Enabled
                      </Label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="fallbackToAi"
                    checked={settings.fallbackToAi}
                    onChange={(e) => handleFallbackToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="fallbackToAi">
                    Fall back to Rylie AI when agents are unavailable
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  If enabled, Rylie AI will handle chats outside of working
                  hours or when all agents are busy.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ChatModeSettings;
