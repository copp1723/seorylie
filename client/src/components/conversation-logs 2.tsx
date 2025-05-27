import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Calendar,
  MessageCircle,
  User,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";

interface ConversationLog {
  conversation: {
    id: string;
    subject?: string;
    status: string;
    channel: string;
    createdAt: string;
    lastMessageAt?: string;
    customer?: {
      id: string;
      fullName: string;
      email?: string;
      phone?: string;
    };
    lead?: {
      id: string;
      leadNumber: string;
      status: string;
    };
    assignedUser?: {
      id: number;
      name: string;
      email: string;
    };
  };
  messageCount: number;
  hasEscalations: boolean;
  escalationCount: number;
}

interface ConversationAnalytics {
  totalConversations: number;
  activeConversations: number;
  escalatedConversations: number;
  avgResponseTime: number;
  avgConversationLength: number;
}

interface ConversationLogsFilters {
  status?: string[];
  assignedUserId?: number;
  escalatedOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function ConversationLogs() {
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [analytics, setAnalytics] = useState<ConversationAnalytics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter states
  const [filters, setFilters] = useState<ConversationLogsFilters>({
    sortBy: "last_message_at",
    sortOrder: "desc",
  });
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Mock dealership ID - in real app this would come from user context
  const dealershipId = 1;

  const fetchConversationLogs = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        dealershipId: dealershipId.toString(),
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(
            ([_, value]) => value != null && value !== "",
          ),
        ),
      });

      if (filters.status && filters.status.length > 0) {
        queryParams.set("status", filters.status.join(","));
      }

      const response = await fetch(`/api/conversation-logs?${queryParams}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotal(data.total);
        setAnalytics(data.analytics);
      } else {
        console.error("Failed to fetch conversation logs");
      }
    } catch (error) {
      console.error("Error fetching conversation logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversationDetails = async (conversationId: string) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(
        `/api/conversation-logs/${conversationId}?dealershipId=${dealershipId}`,
        { credentials: "include" },
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data);
      }
    } catch (error) {
      console.error("Error fetching conversation details:", error);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversationLogs();
  }, [page, filters]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0); // Reset to first page when filters change
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "waiting_response":
        return "secondary";
      case "escalated":
        return "destructive";
      case "resolved":
        return "outline";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  const exportLogs = async () => {
    try {
      const response = await fetch("/api/conversation-logs/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          filters: { dealershipId, ...filters },
          format: "json",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `conversation-logs-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting logs:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Conversations
              </CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.totalConversations}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.activeConversations}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escalated</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.escalatedConversations}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Length</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.avgConversationLength.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">messages</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conversation Logs</CardTitle>
              <CardDescription>
                View and filter conversation history with filtering and
                analytics
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button variant="outline" size="sm" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        {filtersVisible && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 py-4">
              <Input
                placeholder="Search..."
                value={filters.searchTerm || ""}
                onChange={(e) =>
                  handleFilterChange("searchTerm", e.target.value)
                }
              />

              <Select
                value={filters.status?.join(",") || ""}
                onValueChange={(value) =>
                  handleFilterChange("status", value ? [value] : undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="waiting_response">
                    Waiting Response
                  </SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="From Date"
                value={filters.dateFrom || ""}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              />

              <Input
                type="date"
                placeholder="To Date"
                value={filters.dateTo || ""}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              />

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.escalatedOnly || false}
                  onChange={(e) =>
                    handleFilterChange("escalatedOnly", e.target.checked)
                  }
                />
                <span className="text-sm">Escalated Only</span>
              </label>

              <Button
                onClick={() =>
                  setFilters({ sortBy: "last_message_at", sortOrder: "desc" })
                }
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Conversation Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading conversations...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No conversations found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.conversation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {log.conversation.customer?.fullName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.conversation.customer?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {log.conversation.subject || "No subject"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={getStatusBadgeVariant(
                            log.conversation.status,
                          )}
                        >
                          {log.conversation.status}
                        </Badge>
                        {log.hasEscalations && (
                          <Badge variant="destructive" className="text-xs">
                            {log.escalationCount} escalation
                            {log.escalationCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {log.conversation.channel}
                    </TableCell>
                    <TableCell>{log.messageCount}</TableCell>
                    <TableCell>
                      {log.conversation.lastMessageAt
                        ? format(
                            new Date(log.conversation.lastMessageAt),
                            "MMM d, HH:mm",
                          )
                        : "No messages"}
                    </TableCell>
                    <TableCell>
                      {log.conversation.assignedUser?.name || "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              fetchConversationDetails(log.conversation.id)
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Conversation Details</DialogTitle>
                            <DialogDescription>
                              Full conversation history and details
                            </DialogDescription>
                          </DialogHeader>

                          {detailsLoading ? (
                            <div className="text-center py-8">
                              Loading conversation details...
                            </div>
                          ) : selectedConversation ? (
                            <Tabs defaultValue="messages" className="w-full">
                              <TabsList>
                                <TabsTrigger value="messages">
                                  Messages
                                </TabsTrigger>
                                <TabsTrigger value="details">
                                  Details
                                </TabsTrigger>
                                <TabsTrigger value="escalations">
                                  Escalations
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent
                                value="messages"
                                className="space-y-4"
                              >
                                <div className="max-h-96 overflow-y-auto space-y-3">
                                  {selectedConversation.messages?.map(
                                    (message: any) => (
                                      <div
                                        key={message.id}
                                        className={`p-3 rounded-lg ${
                                          message.sender === "customer"
                                            ? "bg-blue-50 border-l-4 border-blue-500"
                                            : "bg-gray-50 border-l-4 border-gray-500"
                                        }`}
                                      >
                                        <div className="flex justify-between items-start mb-2">
                                          <span className="font-medium capitalize">
                                            {message.sender}
                                          </span>
                                          <span className="text-sm text-muted-foreground">
                                            {format(
                                              new Date(message.createdAt),
                                              "MMM d, HH:mm",
                                            )}
                                          </span>
                                        </div>
                                        <div className="text-sm">
                                          {message.content}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </TabsContent>

                              <TabsContent value="details">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-2">
                                      Customer
                                    </h4>
                                    <p>
                                      {
                                        selectedConversation.conversation
                                          ?.conversation?.customer?.fullName
                                      }
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {
                                        selectedConversation.conversation
                                          ?.conversation?.customer?.email
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-2">Lead</h4>
                                    <p>
                                      {
                                        selectedConversation.conversation
                                          ?.conversation?.lead?.leadNumber
                                      }
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Status:{" "}
                                      {
                                        selectedConversation.conversation
                                          ?.conversation?.lead?.status
                                      }
                                    </p>
                                  </div>
                                </div>
                              </TabsContent>

                              <TabsContent value="escalations">
                                {selectedConversation.escalations?.length >
                                0 ? (
                                  <div className="space-y-3">
                                    {selectedConversation.escalations.map(
                                      (escalation: any) => (
                                        <div
                                          key={escalation.id}
                                          className="p-3 border rounded-lg"
                                        >
                                          <div className="font-medium">
                                            {escalation.reason}
                                          </div>
                                          <div className="text-sm text-muted-foreground mb-2">
                                            {format(
                                              new Date(escalation.requestedAt),
                                              "MMM d, HH:mm",
                                            )}
                                          </div>
                                          <div className="text-sm">
                                            {escalation.description}
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    No escalations for this conversation
                                  </div>
                                )}
                              </TabsContent>
                            </Tabs>
                          ) : null}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1} to{" "}
              {Math.min((page + 1) * pageSize, total)} of {total} conversations
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(Math.max(0, page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / pageSize) - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
