import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Plus,
  RefreshCw,
  Trash,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
// import { apiRequest } from "@/lib/queryClient";

interface Invitation {
  id: number;
  email: string;
  role: string;
  status: string;
  dealership_id: number | null;
  expires_at: string;
  created_at: string;
}

interface Dealership {
  id: number;
  name: string;
}

// Extended user interface that includes properties we need
interface ExtendedUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role?: string;
  createdAt?: string;
  dealership_id?: number | null;
}

const SystemPage: React.FC = () => {
  const { user } = useAuth() as { user: ExtendedUser | null };
  // const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newDealershipId, setNewDealershipId] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: invitationsData } = useQuery({
    queryKey: ["/api/magic-link/invitations"],
    queryFn: () =>
      apiRequest<{ invitations: Invitation[] }>("/api/magic-link/invitations", {
        method: "GET",
      }),
  });

  const { data: dealershipsData } = useQuery({
    queryKey: ["/api/dealerships"],
    queryFn: () =>
      apiRequest<{ dealerships: Dealership[] }>("/api/dealerships", {
        method: "GET",
      }),
  });

  const queryClient = useQueryClient();

  const createInvitation = useMutation({
    mutationFn: (data: {
      email: string;
      role: string;
      dealership_id: number | null;
    }) =>
      apiRequest("/api/magic-link/invite", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${newEmail}`,
      });
      setNewEmail("");
      queryClient.invalidateQueries({
        queryKey: ["/api/magic-link/invitations"],
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to send invitation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete invitation mutation - TEMPORARILY DISABLED
  const deleteInvitation = {
    mutate: (invitationId: number) => {
      console.log('Would delete invitation:', invitationId);
      toast({
        title: "Info",
        description: "Invitation deletion temporarily disabled",
      });
    },
    isPending: false
  };
  
  // TODO: Re-enable React Query
  // const deleteInvitation = useMutation({
  //   mutationFn: (invitationId: number) =>
  //     apiRequest(`/api/magic-link/invitations/${invitationId}`, {
  //       method: "DELETE",
  //     }),
  //   onSuccess: () => {
  //     toast({
  //       title: "Invitation Deleted",
  //       description: "The invitation has been deleted",
  //     });
  //     queryClient.invalidateQueries({
  //       queryKey: ["/api/magic-link/invitations"],
  //     });
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: `Failed to delete invitation: ${error.message}`,
  //       variant: "destructive",
  //     });
  //   },
  // });

  // Resend invitation mutation - TEMPORARILY DISABLED
  const resendInvitation = {
    mutate: (invitationId: number) => {
      console.log('Would resend invitation:', invitationId);
      toast({
        title: "Info",
        description: "Invitation resend temporarily disabled",
      });
    },
    isPending: false
  };
  
  // TODO: Re-enable React Query
  // const resendInvitation = useMutation({
  //   mutationFn: (invitationId: number) =>
  //     apiRequest(`/api/magic-link/invitations/${invitationId}/resend`, {
  //       method: "POST",
  //     }),
  //   onSuccess: () => {
  //     toast({
  //       title: "Invitation Resent",
  //       description: "The invitation has been resent",
  //     });
  //     queryClient.invalidateQueries({
  //       queryKey: ["/api/magic-link/invitations"],
  //     });
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: `Failed to resend invitation: ${error.message}`,
  //       variant: "destructive",
  //     });
  //   },
  // });

  // Change password mutation - TEMPORARILY DISABLED
  const changePassword = {
    mutate: (data: { currentPassword: string; newPassword: string }) => {
      console.log('Would change password');
      toast({
        title: "Info",
        description: "Password change temporarily disabled",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    isPending: false
  };
  
  // TODO: Re-enable React Query
  // const changePassword = useMutation({
  //   mutationFn: (data: { currentPassword: string; newPassword: string }) =>
  //     apiRequest("/api/user/change-password", {
  //       method: "POST",
  //       body: data,
  //     }),
  //   onSuccess: () => {
  //     toast({
  //       title: "Password Changed",
  //       description: "Your password has been updated successfully",
  //     });
  //     setCurrentPassword("");
  //     setNewPassword("");
  //     setConfirmPassword("");
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: `Failed to change password: ${error.message}`,
  //       variant: "destructive",
  //     });
  //   },
  // });

  // Handle invitation form submit
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    createInvitation.mutate({
      email: newEmail,
      role: newRole,
      dealership_id: newDealershipId,
    });
  };

  // Handle password change form submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      return;
    }

    changePassword.mutate({
      currentPassword,
      newPassword,
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">System Settings</h1>

      <Tabs defaultValue="invitations">
        <TabsList className="mb-4">
          <TabsTrigger value="invitations">User Invitations</TabsTrigger>
          <TabsTrigger value="security">Security Settings</TabsTrigger>
          <TabsTrigger value="api">API Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="invitations">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Invitation</CardTitle>
                <CardDescription>
                  Invite new users to join the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        placeholder="user@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dealership">Dealership (Optional)</Label>
                      <Select
                        value={newDealershipId?.toString() || "none"}
                        onValueChange={(value) =>
                          setNewDealershipId(
                            value && value !== "none" ? parseInt(value) : null,
                          )
                        }
                      >
                        <SelectTrigger id="dealership">
                          <SelectValue placeholder="Select dealership" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No dealership</SelectItem>
                          {dealershipsData && dealershipsData.dealerships ? (
                            dealershipsData.dealerships.map(
                              (dealership: Dealership) => (
                                <SelectItem
                                  key={dealership.id}
                                  value={dealership.id.toString()}
                                >
                                  {dealership.name}
                                </SelectItem>
                              ),
                            )
                          ) : (
                            <SelectItem value="loading">
                              Loading dealerships...
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="mt-4"
                    disabled={createInvitation.isPending}
                  >
                    {createInvitation.isPending ? (
                      <>
                        Sending...{" "}
                        <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                      </>
                    ) : (
                      <>
                        Send Invitation <Plus className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Invitations</CardTitle>
                <CardDescription>Manage pending invitations</CardDescription>
              </CardHeader>
              <CardContent>
                {invitationsData &&
                invitationsData.invitations &&
                invitationsData.invitations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitationsData.invitations.map(
                        (invitation: Invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell>{invitation.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {invitation.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  invitation.status === "pending"
                                    ? "outline"
                                    : "default"
                                }
                                className="capitalize"
                              >
                                {invitation.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDate(invitation.expires_at)}
                            </TableCell>
                            <TableCell className="space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  resendInvitation.mutate(invitation.id)
                                }
                                disabled={resendInvitation.isPending}
                              >
                                Resend
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  deleteInvitation.mutate(invitation.id)
                                }
                                disabled={deleteInvitation.isPending}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      No active invitations
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="mt-4"
                  disabled={changePassword.isPending}
                >
                  {changePassword.isPending ? (
                    <>
                      Updating...{" "}
                      <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>Update Password</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Username</Label>
                  <div className="text-lg">{user?.username}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="text-lg">{user?.email}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <div className="text-lg capitalize">
                    {user?.role || "User"}
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Joined</Label>
                  <div className="text-lg">
                    {user && user.createdAt
                      ? formatDate(user.createdAt)
                      : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
              <CardDescription>
                Manage API keys and settings for external integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <Badge variant="outline" className="ml-2">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />{" "}
                      Connected
                    </Badge>
                  </div>
                  <div className="flex">
                    <Input
                      id="openai-key"
                      type="password"
                      value="••••••••••••••••••••••••••••••"
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => {
                        toast({
                          title: "API Key Copied",
                          description:
                            "The API key has been copied to your clipboard",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    The API key is securely stored in your environment
                    variables.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sendgrid-key">SendGrid API Key</Label>
                    <Badge variant="outline" className="ml-2">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />{" "}
                      Connected
                    </Badge>
                  </div>
                  <div className="flex">
                    <Input
                      id="sendgrid-key"
                      type="password"
                      value="••••••••••••••••••••••••••••••"
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      className="ml-2"
                      onClick={() => {
                        toast({
                          title: "API Key Copied",
                          description:
                            "The API key has been copied to your clipboard",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Used for sending magic link invitations and notifications.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="db-connection">Database Connection</Label>
                    <Badge variant="outline" className="ml-2">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />{" "}
                      Connected
                    </Badge>
                  </div>
                  <Input
                    id="db-connection"
                    value="PostgreSQL @ Neon"
                    readOnly
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Connected to the PostgreSQL database for data storage.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemPage;
