import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Building2,
  Users,
  Car,
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Check,
  X,
  Globe,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Define the dealership schema for form validation
const dealershipFormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Dealership name must be at least 2 characters." }),
  subdomain: z
    .string()
    .min(2, { message: "Subdomain must be at least 2 characters." })
    .regex(/^[a-z0-9-]+$/, {
      message:
        "Subdomain can only contain lowercase letters, numbers, and hyphens.",
    }),
  contact_email: z
    .string()
    .email({ message: "Please enter a valid email address." }),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  website: z
    .string()
    .url({ message: "Please enter a valid website URL." })
    .optional()
    .or(z.literal("")),
  description: z.string().optional(),
  logo_url: z
    .string()
    .url({ message: "Please enter a valid logo URL." })
    .optional()
    .or(z.literal("")),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, {
      message: "Please enter a valid hex color code (e.g., #000000).",
    })
    .optional(),
  secondary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, {
      message: "Please enter a valid hex color code (e.g., #FFFFFF).",
    })
    .optional(),
});

// Define interfaces
interface Dealership {
  id: number;
  name: string;
  subdomain: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface DealershipFormValues extends z.infer<typeof dealershipFormSchema> {}

const AdminDealershipsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDealership, setSelectedDealership] =
    useState<Dealership | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Check if user is super admin
  const isSuperAdmin = user?.role === "super_admin";

  if (!isSuperAdmin) {
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

  // Fetch dealerships
  const { data: dealershipsData, isLoading: isLoadingDealerships } = useQuery({
    queryKey: ["/api/admin/dealerships"],
    queryFn: () =>
      apiRequest<{ dealerships: Dealership[] }>("/api/admin/dealerships"),
  });

  // Create dealership mutation
  const createDealership = useMutation({
    mutationFn: (data: DealershipFormValues) =>
      apiRequest("/api/admin/dealerships", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dealership created successfully",
      });
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dealerships"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create dealership: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update dealership mutation
  const updateDealership = useMutation({
    mutationFn: (data: DealershipFormValues & { id: number }) =>
      apiRequest(`/api/admin/dealerships/${data.id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dealership updated successfully",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dealerships"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update dealership: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete dealership mutation
  const deleteDealership = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/dealerships/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dealership deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedDealership(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dealerships"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete dealership: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Toggle dealership active status
  const toggleDealershipStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiRequest(`/api/admin/dealerships/${id}/status`, {
        method: "PATCH",
        body: { active },
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Dealership status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dealerships"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update dealership status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Create form
  const createForm = useForm<DealershipFormValues>({
    resolver: zodResolver(dealershipFormSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      website: "",
      description: "",
      logo_url: "",
      primary_color: "#000000",
      secondary_color: "#FFFFFF",
    },
  });

  // Edit form
  const editForm = useForm<DealershipFormValues>({
    resolver: zodResolver(dealershipFormSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      contact_email: "",
      contact_phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      website: "",
      description: "",
      logo_url: "",
      primary_color: "#000000",
      secondary_color: "#FFFFFF",
    },
  });

  // Set edit form values when a dealership is selected
  React.useEffect(() => {
    if (selectedDealership && isEditDialogOpen) {
      editForm.reset({
        name: selectedDealership.name,
        subdomain: selectedDealership.subdomain,
        contact_email: selectedDealership.contact_email,
        contact_phone: selectedDealership.contact_phone || "",
        address: selectedDealership.address || "",
        city: selectedDealership.city || "",
        state: selectedDealership.state || "",
        zip: selectedDealership.zip || "",
        website: selectedDealership.website || "",
        description: selectedDealership.description || "",
        logo_url: selectedDealership.logo_url || "",
        primary_color: selectedDealership.primary_color || "#000000",
        secondary_color: selectedDealership.secondary_color || "#FFFFFF",
      });
    }
  }, [selectedDealership, isEditDialogOpen, editForm]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Handle create form submission
  const onCreateSubmit = (data: DealershipFormValues) => {
    createDealership.mutate(data);
  };

  // Handle edit form submission
  const onEditSubmit = (data: DealershipFormValues) => {
    if (selectedDealership) {
      updateDealership.mutate({ ...data, id: selectedDealership.id });
    }
  };

  // Handle delete confirmation
  const onDeleteConfirm = () => {
    if (selectedDealership) {
      deleteDealership.mutate(selectedDealership.id);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dealership Management</h1>
          <p className="text-muted-foreground">
            Manage all dealerships in the system
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Dealership
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Dealership</DialogTitle>
              <DialogDescription>
                Add a new dealership to the system. All fields with * are
                required.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit(onCreateSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dealership Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Luxury Motors" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="subdomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subdomain*</FormLabel>
                        <FormControl>
                          <Input placeholder="luxurymotors" {...field} />
                        </FormControl>
                        <FormDescription>
                          Will be used as: {field.value || "subdomain"}
                          .rylieai.com
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email*</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="info@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the dealership"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={createForm.control}
                    name="logo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/logo.png"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createDealership.isPending}>
                    {createDealership.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Dealership"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dealerships</CardTitle>
          <CardDescription>
            View and manage all dealerships in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDealerships ? (
            <div className="flex justify-center items-center h-40">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : dealershipsData?.dealerships &&
            dealershipsData.dealerships.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealershipsData.dealerships.map((dealership) => (
                  <TableRow key={dealership.id}>
                    <TableCell className="font-medium">
                      {dealership.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>{dealership.subdomain}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{dealership.contact_email}</div>
                        {dealership.contact_phone && (
                          <div className="text-muted-foreground">
                            {dealership.contact_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(dealership.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={dealership.active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() =>
                          toggleDealershipStatus.mutate({
                            id: dealership.id,
                            active: !dealership.active,
                          })
                        }
                      >
                        {dealership.active ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <X className="mr-1 h-3 w-3" />
                        )}
                        {dealership.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedDealership(dealership);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedDealership(dealership);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">
                No Dealerships Found
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by adding your first dealership.
              </p>
              <Button
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Dealership
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dealership Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Dealership</DialogTitle>
            <DialogDescription>
              Update dealership information. All fields with * are required.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealership Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Luxury Motors" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdomain*</FormLabel>
                      <FormControl>
                        <Input placeholder="luxurymotors" {...field} />
                      </FormControl>
                      <FormDescription>
                        Will be used as: {field.value || "subdomain"}
                        .rylieai.com
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email*</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="info@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the dealership"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={editForm.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/logo.png"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateDealership.isPending}>
                  {updateDealership.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Dealership"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the dealership "
              {selectedDealership?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 p-4 rounded-md mt-2">
            <p className="text-sm font-medium">Warning:</p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside text-muted-foreground">
              <li>
                All users associated with this dealership will lose access
              </li>
              <li>All prompts, variables, and inventory will be deleted</li>
              <li>All conversation history will be permanently lost</li>
            </ul>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDeleteConfirm}
              disabled={deleteDealership.isPending}
            >
              {deleteDealership.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Dealership"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDealershipsPage;
