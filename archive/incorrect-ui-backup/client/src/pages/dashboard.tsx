import React, { useState, useEffect, Suspense } from "react";
import StatusCard from "@/components/status-card";
import ConversationTable, {
  Conversation,
} from "@/components/conversation-table";
import ApiStatus from "@/components/api-status";
import FeaturedDealership from "@/components/featured-dealership";
import ConversationChart from "@/components/conversation-chart";
import PersonaChart from "@/components/persona-chart";
import FeaturedSection from "@/components/featured-section";
import { useLoading } from "@/contexts/LoadingContext";
import {
  SkeletonDashboard,
  SkeletonCard,
  SkeletonTable,
} from "@/components/loading/SkeletonLoader";
import { ViewportLazyLoad } from "@/utils/lazy-loading";
import { logEvent } from "@/utils/analytics";

// Lazy load components that aren't immediately visible
const LazyConversationChart = React.lazy(() => import("@/components/conversation-chart"));
const LazyPersonaChart = React.lazy(() => import("@/components/persona-chart"));

export default function Dashboard() {
  const [dealershipFilter, setDealershipFilter] = useState("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<any[]>([]);
  const [conversationChartData, setConversationChartData] = useState<any[]>([]);
  const [personaChartData, setPersonaChartData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Get loading utilities from context
  const {
    startLoading,
    stopLoading,
    isLoadingKey,
    setProgress,
    getKeyProgress,
    withLoading,
    setError: setLoadingError,
  } = useLoading();

  // Loading keys
  const DASHBOARD_LOAD_KEY = "dashboard-initial-load";
  const CONVERSATIONS_KEY = "dashboard-conversations";
  const API_STATUS_KEY = "dashboard-api-status";
  const CHART_DATA_KEY = "dashboard-chart-data";
  const FILTER_CHANGE_KEY = "dashboard-filter-change";

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        startLoading(DASHBOARD_LOAD_KEY, "Loading dashboard...");

        // Simulate staggered loading for better UX
        await Promise.all([
          loadConversations(),
          loadApiStatus(),
          loadChartData(),
        ]);

        // Mark initial load as complete
        setInitialLoadComplete(true);
        stopLoading(DASHBOARD_LOAD_KEY);

        // Log performance metrics
        logEvent("dashboard_loaded", {
          loadTime: performance.now(),
          dealershipFilter,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown error loading dashboard";
        setError(errorMessage);
        setLoadingError(DASHBOARD_LOAD_KEY, errorMessage);
        stopLoading(DASHBOARD_LOAD_KEY);
      }
    };

    loadDashboardData();

    // Cleanup
    return () => {
      stopLoading(DASHBOARD_LOAD_KEY);
      stopLoading(CONVERSATIONS_KEY);
      stopLoading(API_STATUS_KEY);
      stopLoading(CHART_DATA_KEY);
    };
  }, []);

  // Handle filter changes
  useEffect(() => {
    if (initialLoadComplete) {
      handleFilterChange();
    }
  }, [dealershipFilter, initialLoadComplete]);

  // Load conversations data
  const loadConversations = async () => {
    try {
      startLoading(CONVERSATIONS_KEY, "Loading conversations...");
      setProgress(DASHBOARD_LOAD_KEY, 25);

      // Simulate API call with delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Sample data for the dashboard
      const sampleConversations: Conversation[] = [
        {
          id: 1,
          customerName: "Sarah Miller",
          dealershipName: "Florida Motors",
          lastMessage: "Do you have the 2023 RAV4 in blue?",
          status: "active",
          updatedAt: "2023-06-15T14:30:00Z",
        },
        {
          id: 2,
          customerName: "Michael Chang",
          dealershipName: "Texas Auto Group",
          lastMessage: "I'd like to schedule a test drive",
          status: "waiting",
          updatedAt: "2023-06-15T13:45:00Z",
        },
        {
          id: 3,
          customerName: "Jessica Williams",
          dealershipName: "California Cars",
          lastMessage: "What warranty options are available?",
          status: "escalated",
          updatedAt: "2023-06-15T12:15:00Z",
        },
        {
          id: 4,
          customerName: "Robert Johnson",
          dealershipName: "Florida Motors",
          lastMessage: "What's the mileage on the 2022 Civic?",
          status: "completed",
          updatedAt: "2023-06-15T10:30:00Z",
        },
        {
          id: 5,
          customerName: "Amanda Garcia",
          dealershipName: "Texas Auto Group",
          lastMessage: "Is the Silverado still available?",
          status: "active",
          updatedAt: "2023-06-15T09:45:00Z",
        },
      ];

      setConversations(sampleConversations);
      stopLoading(CONVERSATIONS_KEY);
      setProgress(DASHBOARD_LOAD_KEY, 50);
      return sampleConversations;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load conversations";
      setLoadingError(CONVERSATIONS_KEY, errorMessage);
      throw err;
    }
  };

  // Load API status
  const loadApiStatus = async () => {
    try {
      startLoading(API_STATUS_KEY, "Checking API status...");
      setProgress(DASHBOARD_LOAD_KEY, 75);

      // Simulate API call with delay
      await new Promise((resolve) => setTimeout(resolve, 400));

      const endpoints = [
        {
          path: "/inbound",
          status: "operational" as const,
          uptime: "100% uptime",
        },
        {
          path: "/reply",
          status: "operational" as const,
          uptime: "99.8% uptime",
        },
        {
          path: "/handover",
          status: "operational" as const,
          uptime: "99.9% uptime",
        },
      ];

      setApiEndpoints(endpoints);
      stopLoading(API_STATUS_KEY);
      return endpoints;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load API status";
      setLoadingError(API_STATUS_KEY, errorMessage);
      throw err;
    }
  };

  // Load chart data
  const loadChartData = async () => {
    try {
      startLoading(CHART_DATA_KEY, "Loading analytics data...");

      // Simulate API call with delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const convData = [
        { name: "Mon", count: 30 },
        { name: "Tue", count: 45 },
        { name: "Wed", count: 60 },
        { name: "Thu", count: 75 },
        { name: "Fri", count: 50 },
        { name: "Sat", count: 85 },
        { name: "Sun", count: 70 },
      ];

      const personaData = [
        { name: "Friendly Advisor", value: 85, percentage: "28.4%" },
        { name: "Technical Expert", value: 74, percentage: "24.7%" },
        { name: "Concierge", value: 65, percentage: "21.9%" },
        { name: "Sales Assistant", value: 54, percentage: "18.2%" },
        { name: "Service Advisor", value: 47, percentage: "15.8%" },
      ];

      setConversationChartData(convData);
      setPersonaChartData(personaData);
      stopLoading(CHART_DATA_KEY);
      setProgress(DASHBOARD_LOAD_KEY, 100);
      return { convData, personaData };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load chart data";
      setLoadingError(CHART_DATA_KEY, errorMessage);
      throw err;
    }
  };

  // Handle filter change
  const handleFilterChange = async () => {
    try {
      startLoading(FILTER_CHANGE_KEY, `Filtering by ${dealershipFilter}...`);

      // Simulate API call with delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Filter conversations based on dealership
      const filteredConversations =
        dealershipFilter === "all"
          ? await loadConversations()
          : (await loadConversations()).filter((conv) => {
              if (dealershipFilter === "florida")
                return conv.dealershipName === "Florida Motors";
              if (dealershipFilter === "texas")
                return conv.dealershipName === "Texas Auto Group";
              if (dealershipFilter === "california")
                return conv.dealershipName === "California Cars";
              return true;
            });

      setConversations(filteredConversations);
      stopLoading(FILTER_CHANGE_KEY);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to apply filter";
      setLoadingError(FILTER_CHANGE_KEY, errorMessage);
    }
  };

  // Handle retry on error
  const handleRetry = async () => {
    setError(null);
    const loadDashboardData = async () => {
      try {
        startLoading(DASHBOARD_LOAD_KEY, "Retrying dashboard load...");

        await Promise.all([
          loadConversations(),
          loadApiStatus(),
          loadChartData(),
        ]);

        setInitialLoadComplete(true);
        stopLoading(DASHBOARD_LOAD_KEY);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown error loading dashboard";
        setError(errorMessage);
        setLoadingError(DASHBOARD_LOAD_KEY, errorMessage);
        stopLoading(DASHBOARD_LOAD_KEY);
      }
    };

    loadDashboardData();
  };

  const handleViewConversation = (id: number) => {
    // Navigate to conversation details page
  };

  // Show full page loading skeleton during initial load
  if (isLoadingKey(DASHBOARD_LOAD_KEY) && !initialLoadComplete) {
    return (
      <div
        className="animate-fadeIn"
        role="progressbar"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <SkeletonDashboard
          cards={3}
          showCharts={true}
          showTables={true}
          showStats={true}
          animation="wave"
        />
      </div>
    );
  }

  // Show error state with retry button
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="text-error text-xl">
          <span className="material-icons text-3xl mb-2">error_outline</span>
          <p>Failed to load dashboard</p>
        </div>
        <p className="text-neutral-600">{error}</p>
        <button
          onClick={handleRetry}
          className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
        >
          <span className="material-icons text-sm mr-2">refresh</span>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Dashboard Header */}
      <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
          <div className="relative">
            <select
              value={dealershipFilter}
              onChange={(e) => setDealershipFilter(e.target.value)}
              className="block w-full h-10 px-4 pr-8 text-sm border border-neutral-200 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              disabled={isLoadingKey(FILTER_CHANGE_KEY)}
              aria-busy={isLoadingKey(FILTER_CHANGE_KEY)}
            >
              <option value="all">All Dealerships</option>
              <option value="florida">Florida Motors</option>
              <option value="texas">Texas Auto Group</option>
              <option value="california">California Cars</option>
            </select>
            <span className="absolute top-2.5 right-3 material-icons text-neutral-400 text-sm pointer-events-none">
              {isLoadingKey(FILTER_CHANGE_KEY)
                ? "hourglass_empty"
                : "arrow_drop_down"}
            </span>
          </div>
          <button className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium text-white bg-primary rounded-lg shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors">
            <span className="material-icons text-sm mr-2">add</span>
            New Connection
          </button>
        </div>
      </div>

      {/* Main Content - Focus on testing, setup and monitoring */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-8">
        {/* System Status */}
        {isLoadingKey(API_STATUS_KEY) ? (
          <SkeletonCard
            height="160px"
            lines={2}
            animation="wave"
            aria-label="Loading system status"
          />
        ) : (
          <StatusCard
            title="System Status"
            value="Operational"
            icon="check_circle"
            iconBgColor="bg-success/10"
            iconColor="text-success"
            progressValue={99}
            progressColor="bg-success"
            progressLabel="API & Services"
          />
        )}

        {/* Prompt Testing */}
        {isLoadingKey(API_STATUS_KEY) ? (
          <SkeletonCard
            height="160px"
            lines={2}
            animation="wave"
            aria-label="Loading prompt testing status"
          />
        ) : (
          <StatusCard
            title="Prompt Testing"
            value="Ready"
            icon="psychology"
            iconBgColor="bg-primary/10"
            iconColor="text-primary"
            trend={{
              value: "5",
              direction: "up",
              label: "templates available",
            }}
          />
        )}

        {/* Setup Tools */}
        {isLoadingKey(API_STATUS_KEY) ? (
          <SkeletonCard
            height="160px"
            lines={2}
            animation="wave"
            aria-label="Loading dealership setup status"
          />
        ) : (
          <StatusCard
            title="Dealership Setup"
            value="Configure"
            icon="settings"
            iconBgColor="bg-info/10"
            iconColor="text-info"
            trend={{
              value: "3",
              direction: "up",
              label: "steps to complete",
            }}
          />
        )}
      </div>

      {/* API Status and Dealership Configuration */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* API Status */}
        <div>
          {isLoadingKey(API_STATUS_KEY) ? (
            <SkeletonTable
              rows={3}
              columns={3}
              animation="wave"
              showHeader={true}
              showPagination={false}
              aria-label="Loading API status"
            />
          ) : (
            <ApiStatus endpoints={apiEndpoints} />
          )}
        </div>

        {/* Dealership Setup */}
        <div>
          {isLoadingKey(API_STATUS_KEY) ? (
            <SkeletonCard
              height="200px"
              lines={3}
              animation="wave"
              aria-label="Loading dealership configuration"
            />
          ) : (
            <FeaturedDealership
              name="Dealership Configuration"
              subtitle="Testing, Setup & Support"
              stats={{
                conversations: 0,
                conversionRate: "Configure Now",
              }}
            />
          )}
        </div>
      </div>

      {/* Lazy loaded charts section */}
      <ViewportLazyLoad rootMargin="200px">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mt-8">
          <Suspense
            fallback={
              <SkeletonCard
                height="300px"
                header={true}
                lines={1}
                animation="wave"
                aria-label="Loading conversation chart"
              />
            }
          >
            <LazyConversationChart data={conversationChartData} />
          </Suspense>

          <Suspense
            fallback={
              <SkeletonCard
                height="300px"
                header={true}
                lines={1}
                animation="wave"
                aria-label="Loading persona chart"
              />
            }
          >
            <LazyPersonaChart data={personaChartData} />
          </Suspense>
        </div>
      </ViewportLazyLoad>

      {/* Conversations Table - Loaded when visible */}
      <ViewportLazyLoad rootMargin="100px">
        <div className="mt-8">
          {isLoadingKey(CONVERSATIONS_KEY) ||
          isLoadingKey(FILTER_CHANGE_KEY) ? (
            <SkeletonTable
              rows={5}
              columns={4}
              animation="wave"
              showHeader={true}
              showPagination={true}
              aria-label="Loading conversations"
            />
          ) : (
            <ConversationTable
              conversations={conversations}
              onViewConversation={handleViewConversation}
            />
          )}
        </div>
      </ViewportLazyLoad>
    </div>
  );
}
