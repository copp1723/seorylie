import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// Type for audit log data
interface AuditLog {
  id: number;
  eventType: string;
  userId: number | null;
  dealershipId: number | null;
  resourceId: string | null;
  resourceType: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: {
    meta?: {
      riskLevel: string;
      eventCategory: string;
      timestamp: string;
      os?: string;
      browser?: string;
    };
    [key: string]: any;
  };
  createdAt: string;
}

// Type for security event
interface SecurityEvent {
  id: number;
  type: string;
  severity: string;
  ip: string;
  timestamp: string;
  metadata: Record<string, any>;
}

// Type for API key access log
interface ApiKeyAccessLog {
  id: number;
  apiKeyId: number;
  endpoint: string;
  ip: string;
  timestamp: string;
  responseStatus: number | null;
}

const riskLevelColors = {
  high: "text-red-500 bg-red-100 border-red-200",
  medium: "text-amber-600 bg-amber-100 border-amber-200",
  low: "text-green-600 bg-green-100 border-green-200"
};

const eventCategoryIcons = {
  api_security: "key",
  authentication: "lock",
  user_management: "user",
  organization: "building",
  content: "file-text",
  security: "shield",
  data_management: "database",
  general: "activity"
};

export default function AuditLogs() {
  const [tab, setTab] = useState("audit_logs");
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string | null>(null);
  const [filterDealership, setFilterDealership] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const pageSize = 20;

  // Fetch audit logs with filters
  const { data: auditLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: [
      "audit-logs", 
      page, 
      filterType, 
      filterCategory, 
      filterRisk, 
      filterDealership, 
      searchQuery,
      fromDate,
      toDate
    ],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("pageSize", pageSize.toString());
      
      if (filterType) queryParams.append("eventType", filterType);
      if (filterCategory) queryParams.append("category", filterCategory);
      if (filterRisk) queryParams.append("riskLevel", filterRisk);
      if (filterDealership) queryParams.append("dealershipId", filterDealership.toString());
      if (searchQuery) queryParams.append("search", searchQuery);
      if (fromDate) queryParams.append("fromDate", fromDate.toISOString());
      if (toDate) queryParams.append("toDate", toDate.toISOString());
      
      const response = await apiRequest<{ logs: AuditLog[], total: number }>(`/api/audit-logs?${queryParams.toString()}`);
      return response;
    },
    enabled: tab === "audit_logs",
  });

  // Fetch security events with filters
  const { data: securityEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["security-events", page, searchQuery, fromDate, toDate, filterDealership],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("pageSize", pageSize.toString());
      
      if (searchQuery) queryParams.append("search", searchQuery);
      if (filterDealership) queryParams.append("dealershipId", filterDealership.toString());
      if (fromDate) queryParams.append("fromDate", fromDate.toISOString());
      if (toDate) queryParams.append("toDate", toDate.toISOString());
      
      const response = await apiRequest<{ events: SecurityEvent[], total: number }>(`/api/security-events?${queryParams.toString()}`);
      return response;
    },
    enabled: tab === "security_events",
  });

  // Fetch API key access logs with filters
  const { data: accessLogs, isLoading: isLoadingAccessLogs } = useQuery({
    queryKey: ["api-access-logs", page, searchQuery, fromDate, toDate, filterDealership],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("pageSize", pageSize.toString());
      
      if (searchQuery) queryParams.append("search", searchQuery);
      if (filterDealership) queryParams.append("dealershipId", filterDealership.toString());
      if (fromDate) queryParams.append("fromDate", fromDate.toISOString());
      if (toDate) queryParams.append("toDate", toDate.toISOString());
      
      const response = await apiRequest<{ logs: ApiKeyAccessLog[], total: number }>(`/api/api-access-logs?${queryParams.toString()}`);
      return response;
    },
    enabled: tab === "api_access",
  });

  // Fetch dealerships for filter dropdown
  const { data: dealerships = [] } = useQuery({
    queryKey: ["dealerships"],
    queryFn: async () => {
      const response = await apiRequest<any[]>("/api/dealerships");
      return response;
    },
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterType, filterCategory, filterRisk, filterDealership, searchQuery, fromDate, toDate]);

  // Handle clearing all filters
  const handleClearFilters = () => {
    setFilterType(null);
    setFilterCategory(null);
    setFilterRisk(null);
    setFilterDealership(null);
    setSearchQuery("");
    setFromDate(undefined);
    setToDate(undefined);
  };

  // Render different content based on active tab
  const renderTabContent = () => {
    switch (tab) {
      case "audit_logs":
        return renderAuditLogs();
      case "security_events":
        return renderSecurityEvents();
      case "api_access":
        return renderApiAccessLogs();
      case "reports":
        return renderReports();
      default:
        return renderAuditLogs();
    }
  };

  // Get risk level badge class
  const getRiskLevelClass = (level: string) => {
    return riskLevelColors[level as keyof typeof riskLevelColors] || "bg-gray-100 text-gray-800";
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  // Render audit logs table
  const renderAuditLogs = () => {
    if (isLoadingLogs) {
      return <div className="flex justify-center my-10">Loading audit logs...</div>;
    }

    if (!auditLogs?.logs || auditLogs.logs.length === 0) {
      return <div className="text-center my-10">No audit logs found matching the criteria.</div>;
    }

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>User/Resource</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs">
                  {formatTimestamp(log.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="material-icons text-sm">
                      {eventCategoryIcons[log.details.meta?.eventCategory as keyof typeof eventCategoryIcons] || "info"}
                    </span>
                    <span>{log.eventType.replace(/_/g, " ")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {log.details.meta?.eventCategory ? (
                    <Badge variant="outline">{log.details.meta.eventCategory.replace(/_/g, " ")}</Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {log.details.meta?.riskLevel ? (
                    <Badge className={getRiskLevelClass(log.details.meta.riskLevel)} variant="outline">
                      {log.details.meta.riskLevel}
                    </Badge>
                  ) : (
                    <Badge variant="outline">low</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {log.userId ? `User #${log.userId}` : ""} 
                  {log.resourceType ? `${log.resourceType} ${log.resourceId}` : ""}
                </TableCell>
                <TableCell className="font-mono text-xs">{log.ipAddress || "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {renderPagination(auditLogs.total)}
      </>
    );
  };

  // Render security events table
  const renderSecurityEvents = () => {
    if (isLoadingEvents) {
      return <div className="flex justify-center my-10">Loading security events...</div>;
    }

    if (!securityEvents?.events || securityEvents.events.length === 0) {
      return <div className="text-center my-10">No security events found matching the criteria.</div>;
    }

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {securityEvents.events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-mono text-xs">
                  {formatTimestamp(event.timestamp)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="material-icons text-sm">security</span>
                    <span>{event.type.replace(/_/g, " ")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    className={
                      event.severity === "critical" ? "bg-red-100 text-red-800 border-red-200" :
                      event.severity === "warning" ? "bg-amber-100 text-amber-800 border-amber-200" :
                      "bg-blue-100 text-blue-800 border-blue-200"
                    } 
                    variant="outline"
                  >
                    {event.severity}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{event.ip}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {renderPagination(securityEvents.total)}
      </>
    );
  };

  // Render API key access logs table
  const renderApiAccessLogs = () => {
    if (isLoadingAccessLogs) {
      return <div className="flex justify-center my-10">Loading API access logs...</div>;
    }

    if (!accessLogs?.logs || accessLogs.logs.length === 0) {
      return <div className="text-center my-10">No API access logs found matching the criteria.</div>;
    }

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>API Key ID</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accessLogs.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs">
                  {formatTimestamp(log.timestamp)}
                </TableCell>
                <TableCell>#{log.apiKeyId}</TableCell>
                <TableCell className="font-mono text-xs">{log.endpoint}</TableCell>
                <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                <TableCell>
                  <Badge 
                    className={
                      !log.responseStatus ? "bg-gray-100 text-gray-800" :
                      log.responseStatus >= 200 && log.responseStatus < 300 ? "bg-green-100 text-green-800" :
                      log.responseStatus >= 400 && log.responseStatus < 500 ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-800"
                    } 
                    variant="outline"
                  >
                    {log.responseStatus || "Unknown"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {renderPagination(accessLogs.total)}
      </>
    );
  };

  // Render security reports section
  const renderReports = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Compliance Report</CardTitle>
            <CardDescription>
              Create a comprehensive security compliance report for a specific time period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={setFromDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? format(toDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={setToDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dealership</label>
                <Select value={filterDealership?.toString() || ""} onValueChange={(value) => setFilterDealership(value ? parseInt(value) : null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dealership" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Dealerships</SelectItem>
                    {dealerships?.map((d: any) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full">Generate Report</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Security Activity Overview</CardTitle>
            <CardDescription>
              Summary of recent security-related activity across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">High Risk Events (24h)</div>
                  <div className="mt-1 text-2xl font-bold text-red-600">12</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Failed Logins (24h)</div>
                  <div className="mt-1 text-2xl font-bold text-amber-600">8</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">API Key Changes (7d)</div>
                  <div className="mt-1 text-2xl font-bold">5</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">Permission Changes (7d)</div>
                  <div className="mt-1 text-2xl font-bold">3</div>
                </div>
              </div>
              <Button variant="outline" className="w-full">View Detailed Reports</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render pagination controls
  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;

    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Logic to show current page and nearby pages
            let pageNum = 0;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            
            return (
              <PaginationItem key={pageNum}>
                <PaginationLink 
                  isActive={page === pageNum}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          
          <PaginationItem>
            <PaginationNext
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Security & Audit Logs</h1>
        <p className="text-muted-foreground">
          Monitor and analyze security-related activities across the platform
        </p>
      </div>
      
      <Tabs defaultValue="audit_logs" className="space-y-4" value={tab} onValueChange={setTab}>
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="audit_logs" className="flex gap-1.5 items-center">
              <span className="material-icons text-sm">receipt_long</span>
              <span>Audit Logs</span>
            </TabsTrigger>
            <TabsTrigger value="security_events" className="flex gap-1.5 items-center">
              <span className="material-icons text-sm">security</span>
              <span>Security Events</span>
            </TabsTrigger>
            <TabsTrigger value="api_access" className="flex gap-1.5 items-center">
              <span className="material-icons text-sm">api</span>
              <span>API Access</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex gap-1.5 items-center">
              <span className="material-icons text-sm">assessment</span>
              <span>Reports</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        {/* Filter controls for all tabs except reports */}
        {tab !== "reports" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    placeholder="Search by IP, ID, or details..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {tab === "audit_logs" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Event Type</label>
                      <Select value={filterType || "all_types"} onValueChange={(value) => setFilterType(value === "all_types" ? null : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_types">All Types</SelectItem>
                          <SelectItem value="api_key_created">API Key Created</SelectItem>
                          <SelectItem value="api_key_revoked">API Key Revoked</SelectItem>
                          <SelectItem value="admin_login">Admin Login</SelectItem>
                          <SelectItem value="admin_login_failed">Failed Login</SelectItem>
                          <SelectItem value="user_permission_changed">Permission Change</SelectItem>
                          <SelectItem value="prompt_modified">Prompt Modified</SelectItem>
                          <SelectItem value="security_alert">Security Alert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Risk Level</label>
                      <Select value={filterRisk || "all_levels"} onValueChange={(value) => setFilterRisk(value === "all_levels" ? null : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_levels">All Levels</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dealership</label>
                  <Select value={filterDealership?.toString() || "all_dealerships"} onValueChange={(value) => setFilterDealership(value === "all_dealerships" ? null : value ? parseInt(value) : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealership" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_dealerships">All Dealerships</SelectItem>
                      {Array.isArray(dealerships) && dealerships.map((d: any) => (
                        <SelectItem key={d.id} value={d.id.toString()}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fromDate ? format(fromDate, "PPP") : <span>Start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={fromDate}
                          onSelect={setFromDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {toDate ? format(toDate, "PPP") : <span>End date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={toDate}
                          onSelect={setToDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <div className="flex items-end space-x-2 sm:col-span-2 lg:col-span-1">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </Button>
                  <Button className="flex-1">Apply</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <TabsContent value={tab} className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTabContent()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}