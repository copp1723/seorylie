import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Plus, Mail } from "lucide-react";
import PageHeading from "@/components/page-heading";

interface Invitation {
  id: number;
  email: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  role: string;
  dealershipId?: number;
  invitedBy?: string;
  createdAt: string;
}

interface Dealership {
  id: number;
  name: string;
}

interface InvitationsApiResponse {
  invitations: Invitation[];
  dealerships: Dealership[];
  // Add any other properties expected from the API response
}

export default function InvitationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch invitations - TEMPORARILY DISABLED
  const [data, setData] = useState<InvitationsApiResponse | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const refetch = () => {
    console.log("Refetch temporarily disabled");
  };


  // Mutation for resending an invitation - TEMPORARILY DISABLED
  const resendMutation = {
    mutateAsync: async (invitationId: number) => {
      console.log("Would resend invitation:", invitationId);
      toast({
        title: "Info",
        description: "Invitation resend temporarily disabled",
      });
    },
    isPending: false,
  };


  const handleResend = async (invitationId: number) => {
    try {
      await resendMutation.mutateAsync(invitationId);
    } catch (error) {
      console.error("Failed to resend invitation:", error);
    }
  };

  // Format date string to local date and time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Filter invitations based on search query
  const filteredInvitations = (data?.invitations ?? []).filter(
    (invitation: Invitation) => {
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return (
        invitation.email.toLowerCase().includes(query) ||
        invitation.role.toLowerCase().includes(query)
      );
    },
  );

  // Check if invitation is expired
  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  // Get dealership name by ID
  const getDealershipName = (dealershipId?: number) => {
    if (!dealershipId) return "N/A";

    const dealership = (data?.dealerships ?? []).find(
      (d: Dealership) => d.id === dealershipId,
    );

    return dealership ? dealership.name : `Dealership #${dealershipId}`;
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <PageHeading
          title="Magic Link Invitations"
          description="Manage email invitations for platform access"
        />
        <div className="flex justify-center items-center mt-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2">Loading invitations...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div className="container mx-auto py-8">
        <PageHeading
          title="Magic Link Invitations"
          description="Manage email invitations for platform access"
        />
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-destructive">
              Error Loading Invitations
            </CardTitle>
            <CardDescription>
              An error occurred while loading the invitations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error instanceof Error
                ? error.message
                : "Unknown error occurred"}
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render main content
  return (
    <div className="container mx-auto py-8">
      <PageHeading
        title="Magic Link Invitations"
        description="Manage email invitations for platform access"
      />

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 mt-8 space-y-4 sm:space-y-0">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or role"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <Button
            onClick={() => refetch()}
            variant="outline"
            disabled={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setLocation("/magic-link")}>
            <Plus className="mr-2 h-4 w-4" />
            New Invitation
          </Button>
        </div>
      </div>

      {/* Table of invitations */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableCaption>
              {filteredInvitations?.length
                ? `Showing ${filteredInvitations.length} invitation${filteredInvitations.length === 1 ? "" : "s"}`
                : "No invitations found"}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Dealership</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvitations?.length > 0 ? (
                filteredInvitations.map((inv: Invitation) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.role === "admin" ? "destructive" : "outline"
                        }
                      >
                        {inv.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{getDealershipName(inv.dealershipId)}</TableCell>
                    <TableCell>
                      {inv.used ? (
                        <Badge variant="success">Used</Badge>
                      ) : isExpired(inv.expiresAt) ? (
                        <Badge variant="secondary">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(inv.createdAt)}</TableCell>
                    <TableCell>{formatDate(inv.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResend(inv.id)}
                        disabled={inv.used || resendMutation.isPending}
                        title={
                          inv.used
                            ? "Invitation already used"
                            : "Resend invitation"
                        }
                      >
                        {resendMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Resend</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-24 text-muted-foreground"
                  >
                    {searchQuery
                      ? "No invitations match your search"
                      : "No invitations found. Create your first invitation!"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
