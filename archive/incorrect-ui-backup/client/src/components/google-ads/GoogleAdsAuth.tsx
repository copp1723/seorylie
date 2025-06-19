import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import {
  InfoIcon,
  LinkIcon,
  UnlinkIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { useToast } from "../ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

// Types for Google Ads accounts
interface GoogleAdsAccount {
  id: number;
  cid: string;
  name: string | null;
  currencyCode: string | null;
  timezone: string | null;
  isManagerAccount: boolean;
  sandboxId: number | null;
  dealershipId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Sandbox {
  id: number;
  name: string;
}

interface GoogleAdsAuthProps {
  userId: number;
  dealershipId?: number;
  sandboxId?: number;
  sandboxes?: Sandbox[];
  onAccountsChange?: (accounts: GoogleAdsAccount[]) => void;
  className?: string;
}

/**
 * GoogleAdsAuth Component
 *
 * Provides a professional interface for linking Google Ads accounts via OAuth,
 * displaying account information, and managing connections.
 */
const GoogleAdsAuth: React.FC<GoogleAdsAuthProps> = ({
  userId,
  dealershipId,
  sandboxId,
  sandboxes = [],
  onAccountsChange,
  className,
}) => {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [unlinkingAccount, setUnlinkingAccount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSandbox, setSelectedSandbox] = useState<number | null>(
    sandboxId || null,
  );
  const [showSandboxDialog, setShowSandboxDialog] = useState(false);
  const [accountForSandbox, setAccountForSandbox] =
    useState<GoogleAdsAccount | null>(null);
  const [refreshing, setRefreshing] = useState<number | null>(null);

  const { toast } = useToast();

  // Fetch accounts on component mount
  useEffect(() => {
    fetchAccounts();
  }, [userId, dealershipId]);

  // Fetch Google Ads accounts
  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ads/accounts?userId=${userId}${dealershipId ? `&dealershipId=${dealershipId}` : ""}`,
      );

      if (!response.ok) {
        throw new Error(`Error fetching accounts: ${response.statusText}`);
      }

      const data = await response.json();
      setAccounts(data.accounts || []);

      if (onAccountsChange) {
        onAccountsChange(data.accounts || []);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Google Ads accounts",
      );
      toast({
        title: "Error",
        description: "Failed to load Google Ads accounts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Initiate OAuth flow
  const initiateOAuth = async () => {
    setLinkingAccount(true);
    setError(null);

    try {
      const response = await fetch("/api/ads/auth/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          dealershipId,
          sandboxId: selectedSandbox,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error initiating OAuth: ${response.statusText}`);
      }

      const { url } = await response.json();

      // Open OAuth URL in a new window
      const authWindow = window.open(
        url,
        "GoogleAdsAuth",
        "width=600,height=700",
      );

      // Poll for window close
      const checkWindow = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkWindow);
          setLinkingAccount(false);
          fetchAccounts(); // Refresh accounts after OAuth flow
        }
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initiate Google Ads authentication",
      );
      setLinkingAccount(false);
      toast({
        title: "Authentication Error",
        description:
          "Failed to start Google Ads authentication. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Unlink account
  const unlinkAccount = async (accountId: number) => {
    setUnlinkingAccount(accountId);

    try {
      const response = await fetch(`/api/ads/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Error unlinking account: ${response.statusText}`);
      }

      // Remove account from state
      setAccounts(accounts.filter((account) => account.id !== accountId));

      if (onAccountsChange) {
        onAccountsChange(
          accounts.filter((account) => account.id !== accountId),
        );
      }

      toast({
        title: "Account Unlinked",
        description: "Google Ads account has been successfully unlinked.",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to unlink Google Ads account",
      );
      toast({
        title: "Error",
        description: "Failed to unlink Google Ads account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUnlinkingAccount(null);
    }
  };

  // Refresh account details
  const refreshAccount = async (accountId: number) => {
    setRefreshing(accountId);

    try {
      const response = await fetch(`/api/ads/accounts/${accountId}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Error refreshing account: ${response.statusText}`);
      }

      const updatedAccount = await response.json();

      // Update account in state
      setAccounts(
        accounts.map((account) =>
          account.id === accountId ? updatedAccount : account,
        ),
      );

      if (onAccountsChange) {
        onAccountsChange(
          accounts.map((account) =>
            account.id === accountId ? updatedAccount : account,
          ),
        );
      }

      toast({
        title: "Account Refreshed",
        description: "Google Ads account information has been updated.",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refresh Google Ads account",
      );
      toast({
        title: "Error",
        description: "Failed to refresh account information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(null);
    }
  };

  // Associate account with sandbox
  const associateWithSandbox = async () => {
    if (!accountForSandbox || selectedSandbox === null) {
      setShowSandboxDialog(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/ads/accounts/${accountForSandbox.id}/sandbox`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sandboxId: selectedSandbox,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Error associating account with sandbox: ${response.statusText}`,
        );
      }

      const updatedAccount = await response.json();

      // Update account in state
      setAccounts(
        accounts.map((account) =>
          account.id === accountForSandbox.id ? updatedAccount : account,
        ),
      );

      if (onAccountsChange) {
        onAccountsChange(
          accounts.map((account) =>
            account.id === accountForSandbox.id ? updatedAccount : account,
          ),
        );
      }

      toast({
        title: "Sandbox Associated",
        description: `Account ${accountForSandbox.cid} has been linked to the selected sandbox.`,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to associate account with sandbox",
      );
      toast({
        title: "Error",
        description: "Failed to link account to sandbox. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowSandboxDialog(false);
      setAccountForSandbox(null);
    }
  };

  // Open sandbox selection dialog
  const openSandboxDialog = (account: GoogleAdsAccount) => {
    setAccountForSandbox(account);
    setSelectedSandbox(account.sandboxId || null);
    setShowSandboxDialog(true);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Google Ads Integration</span>
          {accounts.length > 0 && (
            <Badge variant="outline" className="ml-2">
              {accounts.length} Account{accounts.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your Google Ads accounts to enable AI-powered campaign
          management and analytics.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <LinkIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  No Google Ads Accounts Connected
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Connect your Google Ads accounts to enable AI agents to
                  analyze performance and create campaigns.
                </p>
              </div>
            ) : (
              <Table>
                <TableCaption>Your connected Google Ads accounts</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sandbox</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="font-medium">
                          {account.name || "Unnamed Account"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          CID: {account.cid}
                        </div>
                      </TableCell>
                      <TableCell>
                        {account.isManagerAccount ? (
                          <Badge variant="default">Manager (MCC)</Badge>
                        ) : (
                          <Badge variant="outline">Standard</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.sandboxId ? (
                          <div className="flex items-center">
                            <Badge variant="secondary" className="mr-1">
                              {sandboxes.find((s) => s.id === account.sandboxId)
                                ?.name || `Sandbox ${account.sandboxId}`}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openSandboxDialog(account)}
                              className="h-6 w-6"
                            >
                              <RefreshCwIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSandboxDialog(account)}
                            className="h-7"
                          >
                            Assign
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => refreshAccount(account.id)}
                                disabled={refreshing === account.id}
                                className="h-8 w-8"
                              >
                                {refreshing === account.id ? (
                                  <RefreshCwIcon className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCwIcon className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Refresh account details</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => unlinkAccount(account.id)}
                                disabled={unlinkingAccount === account.id}
                                className="h-8 w-8"
                              >
                                {unlinkingAccount === account.id ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <UnlinkIcon className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Unlink this account</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground flex items-center">
          <InfoIcon className="h-4 w-4 mr-1" />
          {accounts.some((a) => a.isManagerAccount)
            ? "MCC account connected. You can manage multiple accounts."
            : "Connect an MCC account to manage multiple accounts."}
        </div>
        <Button onClick={initiateOAuth} disabled={linkingAccount || loading}>
          {linkingAccount ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Connecting...
            </>
          ) : (
            <>
              <LinkIcon className="mr-2 h-4 w-4" />
              {accounts.length > 0
                ? "Connect Another Account"
                : "Connect Google Ads"}
            </>
          )}
        </Button>
      </CardFooter>

      {/* Sandbox Selection Dialog */}
      <Dialog open={showSandboxDialog} onOpenChange={setShowSandboxDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associate with Sandbox</DialogTitle>
            <DialogDescription>
              Link this Google Ads account to a sandbox to enable AI agents to
              use it within that environment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sandbox" className="text-right">
                Sandbox
              </Label>
              <Select
                value={selectedSandbox?.toString() || ""}
                onValueChange={(value) => setSelectedSandbox(parseInt(value))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a sandbox" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (Unassign)</SelectItem>
                  {sandboxes.map((sandbox) => (
                    <SelectItem key={sandbox.id} value={sandbox.id.toString()}>
                      {sandbox.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSandboxDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={associateWithSandbox}>
              {selectedSandbox ? "Save Association" : "Remove Association"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default GoogleAdsAuth;
