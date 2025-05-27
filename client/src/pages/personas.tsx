import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { PlusIcon, Trash2Icon, EditIcon, LockIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

// Define the persona schema
const personaSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  isDefault: z.boolean().default(false),
  promptTemplate: z.string().min(50, "Prompt template must be at least 50 characters"),
  arguments: z.object({
    tone: z.string().optional(),
    priorityFeatures: z.array(z.string()).optional(),
    tradeInUrl: z.string().url("Must be a valid URL").optional().or(z.string().length(0)),
    financingUrl: z.string().url("Must be a valid URL").optional().or(z.string().length(0)),
    handoverEmail: z.string().email("Must be a valid email").optional().or(z.string().length(0)),
  }).optional(),
});

type PersonaFormValues = z.infer<typeof personaSchema>;

// Feature priority component
function FeaturePriorityInput({ 
  features, 
  onChange 
}: { 
  features: string[];
  onChange: (features: string[]) => void;
}) {
  const [newFeature, setNewFeature] = useState("");

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      const updatedFeatures = [...features, newFeature.trim()];
      onChange(updatedFeatures);
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    const updatedFeatures = features.filter((_, i) => i !== index);
    onChange(updatedFeatures);
  };

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <Input
          value={newFeature}
          onChange={(e) => setNewFeature(e.target.value)}
          placeholder="Add a priority feature"
          className="flex-grow"
        />
        <Button type="button" onClick={addFeature} size="sm">
          <PlusIcon className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-1 mt-2">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
            <span>{feature}</span>
            <Button variant="ghost" size="sm" onClick={() => removeFeature(index)}>
              <Trash2Icon className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Personas component
export default function Personas() {
  const [editingPersona, setEditingPersona] = useState<PersonaFormValues | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  // Fetch personas for the current dealership
  const { data: personas = [], isLoading: personasLoading, isError } = useQuery({
    queryKey: ['/api/personas'],
    queryFn: async () => {
      const response = await fetch('/api/personas');
      if (!response.ok) throw new Error('Failed to fetch personas');
      return response.json();
    },
    // Only fetch if user is authenticated
    enabled: isAuthenticated,
  });

  // Form for creating/editing personas
  const form = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    defaultValues: {
      name: '',
      description: '',
      isDefault: false,
      promptTemplate: '',
      arguments: {
        tone: 'professional',
        priorityFeatures: [],
        tradeInUrl: '',
        financingUrl: '',
        handoverEmail: '',
      },
    },
  });

  // Create persona mutation
  const createPersonaMutation = useMutation({
    mutationFn: (data: PersonaFormValues) => apiRequest('/api/personas', {
      method: 'POST',
      data: data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/personas'] });
      toast({
        title: "Success",
        description: "Persona created successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create persona: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Update persona mutation
  const updatePersonaMutation = useMutation({
    mutationFn: (data: PersonaFormValues) => {
      if (!data.id) throw new Error("Cannot update without ID");
      return apiRequest(`/api/personas/${data.id}`, {
        method: 'PATCH',
        data: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/personas'] });
      toast({
        title: "Success",
        description: "Persona updated successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update persona: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/personas/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/personas'] });
      toast({
        title: "Success",
        description: "Persona deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete persona: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: PersonaFormValues) => {
    if (editingPersona?.id) {
      updatePersonaMutation.mutate({ ...data, id: editingPersona.id });
    } else {
      createPersonaMutation.mutate(data);
    }
  };

  // Set up form for editing
  const handleEditPersona = (persona: PersonaFormValues) => {
    setEditingPersona(persona);
    form.reset({
      ...persona,
      arguments: {
        ...persona.arguments,
        priorityFeatures: persona.arguments?.priorityFeatures || [],
      },
    });
    setIsDialogOpen(true);
  };

  // Set up form for creating
  const handleCreatePersona = () => {
    setEditingPersona(null);
    form.reset({
      name: '',
      description: '',
      isDefault: false,
      promptTemplate: '',
      arguments: {
        tone: 'professional',
        priorityFeatures: [],
        tradeInUrl: '',
        financingUrl: '',
        handoverEmail: '',
      },
    });
    setIsDialogOpen(true);
  };

  // Loading state
  if (authLoading || personasLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-6 flex flex-col items-center justify-center h-96 space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 rounded-full bg-muted">
            <LockIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Authentication Required</h1>
          <p className="text-muted-foreground max-w-md">
            You need to log in to access the persona management system.
          </p>
        </div>
        <Button 
          size="lg" 
          onClick={() => window.location.href = '/api/login'}
          className="mt-4"
        >
          Log In to Continue
        </Button>
      </div>
    );
  }

  // Error state
  if (isError) {
    return <div className="flex items-center justify-center h-96 text-red-500">Error loading personas.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personas</h1>
          <p className="text-muted-foreground">
            Manage AI personas for your dealership
          </p>
        </div>
        <Button onClick={handleCreatePersona}>
          <PlusIcon className="h-4 w-4 mr-2" /> Create Persona
        </Button>
      </div>

      <Separator />

      {/* Persona List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No personas found. Create your first persona to get started.</p>
          </div>
        ) : (
          personas.map((persona: PersonaFormValues) => (
            <Card key={persona.id} className={persona.isDefault ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{persona.name}</CardTitle>
                    <CardDescription>{persona.description}</CardDescription>
                  </div>
                  {persona.isDefault && (
                    <div className="bg-primary text-primary-foreground text-xs font-medium py-1 px-2 rounded">
                      Default
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Tone:</span> {persona.arguments?.tone || "Not specified"}
                  </div>
                  {persona.arguments?.priorityFeatures && persona.arguments.priorityFeatures.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium">Priority Features:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {persona.arguments.priorityFeatures.map((feature, i) => (
                          <span 
                            key={i} 
                            className="bg-muted text-xs px-2 py-1 rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => handleEditPersona(persona)}
                >
                  <EditIcon className="h-4 w-4 mr-2" /> Edit
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => persona.id && deletePersonaMutation.mutate(persona.id)}
                  disabled={persona.isDefault}
                >
                  <Trash2Icon className="h-4 w-4 mr-2" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Persona Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPersona ? 'Edit Persona' : 'Create New Persona'}</DialogTitle>
            <DialogDescription>
              Configure how Rylie AI interacts with your customers
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="prompt">Prompt Template</TabsTrigger>
                  <TabsTrigger value="arguments">Configuration</TabsTrigger>
                </TabsList>

                {/* Basic Info Tab */}
                <TabsContent value="basic" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Friendly Sales Assistant" {...field} />
                        </FormControl>
                        <FormDescription>
                          A descriptive name for this persona
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="A helpful assistant that guides customers through vehicle selection" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Briefly describe this persona's purpose
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Default Persona</FormLabel>
                          <FormDescription>
                            Make this the default persona for your dealership
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Prompt Template Tab */}
                <TabsContent value="prompt" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="promptTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prompt Template</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="You are Rylie, an AI assistant for {{dealershipName}}..." 
                            {...field} 
                            className="min-h-[300px] font-mono text-sm"
                          />
                        </FormControl>
                        <FormDescription>
                          The system prompt that defines how Rylie behaves for this persona.
                          Use variables like {"{{dealershipName}}"} that will be replaced at runtime.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Configuration Tab */}
                <TabsContent value="arguments" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="arguments.tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a tone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                            <SelectItem value="luxury">Luxury</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How Rylie should sound when speaking to customers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="arguments.priorityFeatures"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority Features</FormLabel>
                        <FormControl>
                          <FeaturePriorityInput 
                            features={field.value || []} 
                            onChange={field.onChange} 
                          />
                        </FormControl>
                        <FormDescription>
                          Vehicle features that should be emphasized in conversations
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="arguments.tradeInUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trade-In URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/trade-in" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL for customers interested in trading in their vehicle
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="arguments.financingUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Financing URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/financing" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL for customers interested in financing options
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="arguments.handoverEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Handover Email</FormLabel>
                        <FormControl>
                          <Input placeholder="sales@example.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          Email address where lead handover dossiers will be sent
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPersonaMutation.isPending || updatePersonaMutation.isPending}
                >
                  {createPersonaMutation.isPending || updatePersonaMutation.isPending ? (
                    "Saving..."
                  ) : (
                    editingPersona ? "Update Persona" : "Create Persona"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}