import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Paintbrush,
  RefreshCw,
  Upload,
  Check,
  MessageCircle,
  Image,
  Palette,
  Type,
  User,
  Bot,
  BellRing,
  Eye,
} from "lucide-react";
import { PersonaPreview } from "@/components/persona-preview";

// Define the dealership branding schema
const brandingSchema = z.object({
  // Visual branding
  logo_url: z
    .string()
    .url({ message: "Please enter a valid logo URL" })
    .optional()
    .or(z.literal("")),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
    message: "Please enter a valid hex color code (e.g., #000000)",
  }),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
    message: "Please enter a valid hex color code (e.g., #FFFFFF)",
  }),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, {
    message: "Please enter a valid hex color code (e.g., #4F46E5)",
  }),
  font_family: z.string(),

  // Persona settings
  persona_name: z.string().min(1, { message: "Persona name is required" }),
  persona_tone: z.enum(["friendly", "professional", "casual", "formal"]),
  persona_template: z.string().optional(),
  welcome_message: z.string().optional(),
});

// Define the interface for dealership branding settings
interface DealershipBranding {
  id: number;
  name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  persona_name: string;
  persona_tone: string;
  persona_template?: string;
  welcome_message?: string;
}

// Interface for form values
type BrandingFormValues = z.infer<typeof brandingSchema>;

const BrandingPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [previewMode, setPreviewMode] = useState(false);
  const [isTestingChat, setIsTestingChat] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Get current dealership ID (null for super admin if not focused on specific dealership)
  const dealershipId = user?.dealership_id;
  const isSuperAdmin = user?.role === "super_admin";

  // State to track selected dealership for super admin
  const [selectedDealershipId, setSelectedDealershipId] = useState<
    number | null
  >(null);

  // Get list of dealerships (for super admin)
  const { data: dealershipsData } = useQuery({
    queryKey: ["/api/admin/dealerships"],
    queryFn: () =>
      apiRequest<{ dealerships: { id: number; name: string }[] }>(
        "/api/admin/dealerships",
      ),
    enabled: isSuperAdmin,
  });

  // Determine which dealership ID to use for queries
  const effectiveDealershipId = isSuperAdmin
    ? selectedDealershipId
    : dealershipId;

  // Fetch dealership branding settings
  const {
    data: brandingData,
    isLoading,
    refetch: refetchBranding,
  } = useQuery({
    queryKey: ["/api/admin/dealerships", effectiveDealershipId, "branding"],
    queryFn: () =>
      apiRequest<{ dealership: DealershipBranding }>(
        `/api/admin/dealerships/${effectiveDealershipId}`,
      ),
    enabled: !!effectiveDealershipId,
  });

  // Update branding mutation
  const updateBranding = useMutation({
    mutationFn: (data: BrandingFormValues) =>
      apiRequest(`/api/admin/dealerships/${effectiveDealershipId}/branding`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      toast({
        title: "Branding Updated",
        description: "Your branding changes have been saved successfully",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/dealerships", effectiveDealershipId, "branding"],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update branding: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Test chat mutation
  const testChat = useMutation({
    mutationFn: (message: string) =>
      apiRequest(`/api/admin/dealerships/${effectiveDealershipId}/test-chat`, {
        method: "POST",
        body: { message },
      }),
    onSuccess: (data: { response: string }) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
      setTestMessage("");
      setIsTestingChat(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to get chat response: ${error.message}`,
        variant: "destructive",
      });
      setIsTestingChat(false);
    },
  });

  // Setup form with branding schema
  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      logo_url: "",
      primary_color: "#000000",
      secondary_color: "#FFFFFF",
      accent_color: "#4F46E5",
      font_family: "Inter, system-ui, sans-serif",
      persona_name: "Rylie",
      persona_tone: "friendly",
      persona_template: "",
      welcome_message: "",
    },
  });

  // Update form values when branding data is loaded
  useEffect(() => {
    if (brandingData?.dealership) {
      const data = brandingData.dealership;
      form.reset({
        logo_url: data.logo_url || "",
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        accent_color: data.accent_color,
        font_family: data.font_family,
        persona_name: data.persona_name,
        persona_tone: data.persona_tone as
          | "friendly"
          | "professional"
          | "casual"
          | "formal",
        persona_template: data.persona_template || "",
        welcome_message: data.welcome_message || "",
      });
    }
  }, [brandingData, form]);

  // Handle form submission
  const onSubmit = (data: BrandingFormValues) => {
    updateBranding.mutate(data);
  };

  // Handle test chat submission
  const handleTestChat = () => {
    if (!testMessage.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: testMessage },
    ]);

    setIsTestingChat(true);
    testChat.mutate(testMessage);
  };

  // Handle dealership selection change (for super admin)
  const handleDealershipChange = (dealershipId: string) => {
    setSelectedDealershipId(parseInt(dealershipId));
    setChatMessages([]);
  };

  // If not super admin and no dealership_id, show access denied
  if (!isSuperAdmin && !dealershipId) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to access this page. Please contact
              your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // If super admin but no dealership selected, show dealership selector
  if (isSuperAdmin && !selectedDealershipId) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Select Dealership</CardTitle>
            <CardDescription>
              Please select a dealership to customize its branding
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dealershipsData?.dealerships ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {dealershipsData.dealerships.map((dealership) => (
                    <Card
                      key={dealership.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() =>
                        handleDealershipChange(dealership.id.toString())
                      }
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">
                          {dealership.name}
                        </CardTitle>
                      </CardHeader>
                      <CardFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDealershipChange(dealership.id.toString())
                          }
                        >
                          Select
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Branding & Persona</h1>
          <p className="text-muted-foreground">
            Customize the appearance and voice of your dealership's AI assistant
          </p>
        </div>

        {isSuperAdmin && dealershipsData?.dealerships && (
          <Select
            value={selectedDealershipId?.toString()}
            onValueChange={handleDealershipChange}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select dealership" />
            </SelectTrigger>
            <SelectContent>
              {dealershipsData.dealerships.map((dealership) => (
                <SelectItem
                  key={dealership.id}
                  value={dealership.id.toString()}
                >
                  {dealership.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form section - 3 columns */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Customization</CardTitle>
              <CardDescription>
                Customize how your AI assistant looks, sounds, and interacts
                with customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <Tabs defaultValue="visual" className="w-full">
                      <TabsList className="mb-4">
                        <TabsTrigger
                          value="visual"
                          className="flex items-center gap-2"
                        >
                          <Palette className="h-4 w-4" />
                          Visual Branding
                        </TabsTrigger>
                        <TabsTrigger
                          value="persona"
                          className="flex items-center gap-2"
                        >
                          <User className="h-4 w-4" />
                          Persona
                        </TabsTrigger>
                        <TabsTrigger
                          value="messages"
                          className="flex items-center gap-2"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Messages
                        </TabsTrigger>
                      </TabsList>

                      {/* Visual Branding Tab */}
                      <TabsContent value="visual" className="space-y-4">
                        <FormField
                          control={form.control}
                          name="logo_url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Logo URL</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input
                                    placeholder="https://example.com/logo.png"
                                    {...field}
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                >
                                  <Upload className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormDescription>
                                Enter the URL of your dealership logo
                                (recommended size: 200x50px)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="primary_color"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Primary Color</FormLabel>
                                <div className="flex gap-2">
                                  <div
                                    className="w-10 h-10 rounded border"
                                    style={{ backgroundColor: field.value }}
                                  />
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </div>
                                <FormDescription>
                                  Main brand color (headers, buttons)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="secondary_color"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Secondary Color</FormLabel>
                                <div className="flex gap-2">
                                  <div
                                    className="w-10 h-10 rounded border"
                                    style={{ backgroundColor: field.value }}
                                  />
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </div>
                                <FormDescription>
                                  Secondary elements color
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="accent_color"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Accent Color</FormLabel>
                                <div className="flex gap-2">
                                  <div
                                    className="w-10 h-10 rounded border"
                                    style={{ backgroundColor: field.value }}
                                  />
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </div>
                                <FormDescription>
                                  Highlights and call-to-actions
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="font_family"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Font Family</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select font family" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Inter, system-ui, sans-serif">
                                    Inter (Modern)
                                  </SelectItem>
                                  <SelectItem value="Georgia, serif">
                                    Georgia (Classic)
                                  </SelectItem>
                                  <SelectItem value="Montserrat, sans-serif">
                                    Montserrat (Clean)
                                  </SelectItem>
                                  <SelectItem value="Roboto, sans-serif">
                                    Roboto (Balanced)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Primary font for all text in the interface
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      {/* Persona Tab */}
                      <TabsContent value="persona" className="space-y-4">
                        <FormField
                          control={form.control}
                          name="persona_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Persona Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Rylie" {...field} />
                              </FormControl>
                              <FormDescription>
                                The name of your AI assistant that customers
                                will see
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="persona_tone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Persona Tone</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select tone" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="friendly">
                                    Friendly and Conversational
                                  </SelectItem>
                                  <SelectItem value="professional">
                                    Professional and Polished
                                  </SelectItem>
                                  <SelectItem value="casual">
                                    Casual and Relaxed
                                  </SelectItem>
                                  <SelectItem value="formal">
                                    Formal and Respectful
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                How your AI assistant will sound when talking to
                                customers
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="persona_template"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Persona Description (Optional)
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Describe the personality, background, and expertise of your AI assistant..."
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Additional information about your AI assistant's
                                persona
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      {/* Messages Tab */}
                      <TabsContent value="messages" className="space-y-4">
                        <FormField
                          control={form.control}
                          name="welcome_message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Welcome Message</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Hello! I'm [Persona Name], your personal assistant at [Dealership]. How can I help you today?"
                                  className="min-h-[100px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                The first message customers will see when
                                starting a conversation
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                    </Tabs>

                    {/* Persona Preview Button */}
                    <div className="mt-6 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setPreviewMode(!previewMode)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {previewMode
                          ? "Hide Persona Preview"
                          : "Show Persona Preview"}
                      </Button>
                    </div>

                    {/* Persona Preview */}
                    {previewMode && (
                      <div className="mb-6">
                        <PersonaPreview
                          persona={{
                            name: form.watch("persona_name"),
                            tone: form.watch("persona_tone"),
                            template: form.watch("persona_template"),
                            welcomeMessage: form.watch("welcome_message"),
                          }}
                          primaryColor={form.watch("primary_color")}
                          secondaryColor={form.watch("secondary_color")}
                          accentColor={form.watch("accent_color")}
                          logoUrl={form.watch("logo_url")}
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button type="submit" disabled={updateBranding.isPending}>
                        {updateBranding.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview section - 2 columns */}
        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                See how your branding and persona will look to customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border rounded-lg p-4 overflow-hidden"
                style={{
                  fontFamily: form.watch("font_family"),
                  borderColor: form.watch("accent_color"),
                  maxHeight: "600px",
                  overflowY: "auto",
                }}
              >
                {/* Chat header */}
                <div
                  className="pb-3 mb-3 border-b flex items-center justify-between"
                  style={{ borderColor: form.watch("secondary_color") }}
                >
                  <div className="flex items-center gap-2">
                    {form.watch("logo_url") ? (
                      <img
                        src={form.watch("logo_url")}
                        alt="Dealership Logo"
                        className="h-8 max-w-[100px] object-contain"
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: form.watch("primary_color") }}
                      >
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        {form.watch("persona_name")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Online
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: form.watch("accent_color"),
                      color: "white",
                    }}
                  >
                    Available
                  </div>
                </div>

                {/* Chat messages */}
                <div className="space-y-4">
                  {/* Welcome message */}
                  {chatMessages.length === 0 && (
                    <div className="flex gap-2">
                      <div
                        className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                        style={{ backgroundColor: form.watch("primary_color") }}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div
                        className="bg-muted p-3 rounded-lg rounded-tl-none max-w-[80%]"
                        style={{
                          backgroundColor: form.watch("secondary_color"),
                          color: form.watch("primary_color"),
                        }}
                      >
                        {form.watch("welcome_message") ||
                          `Hello! I'm ${form.watch("persona_name")}, your personal assistant. How can I help you today?`}
                      </div>
                    </div>
                  )}

                  {/* Conversation messages */}
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 ${message.role === "user" ? "justify-end" : ""}`}
                    >
                      {message.role === "assistant" && (
                        <div
                          className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                          style={{
                            backgroundColor: form.watch("primary_color"),
                          }}
                        >
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-lg max-w-[80%] ${
                          message.role === "user"
                            ? "rounded-tr-none ml-auto"
                            : "rounded-tl-none"
                        }`}
                        style={
                          message.role === "user"
                            ? {
                                backgroundColor: form.watch("accent_color"),
                                color: "white",
                              }
                            : {
                                backgroundColor: form.watch("secondary_color"),
                                color: form.watch("primary_color"),
                              }
                        }
                      >
                        {message.content}
                      </div>
                      {message.role === "user" && (
                        <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white bg-gray-500">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator for chat */}
                  {isTestingChat && (
                    <div className="flex gap-2">
                      <div
                        className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                        style={{ backgroundColor: form.watch("primary_color") }}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div
                        className="bg-muted p-3 rounded-lg rounded-tl-none"
                        style={{
                          backgroundColor: form.watch("secondary_color"),
                          color: form.watch("primary_color"),
                        }}
                      >
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat input */}
                <div className="mt-4 flex gap-2">
                  <Input
                    placeholder="Type a message to test..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isTestingChat) {
                        handleTestChat();
                      }
                    }}
                    disabled={isTestingChat}
                    style={{ borderColor: form.watch("accent_color") }}
                  />
                  <Button
                    type="button"
                    onClick={handleTestChat}
                    disabled={isTestingChat || !testMessage.trim()}
                    style={{
                      backgroundColor: form.watch("accent_color"),
                      color: "white",
                    }}
                  >
                    {isTestingChat ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BrandingPage;
