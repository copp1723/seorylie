import StatusCard from "@/components/status-card";
import ConversationTable, { Conversation } from "@/components/conversation-table";
import ApiStatus from "@/components/api-status";
import FeaturedDealership from "@/components/featured-dealership";
import ConversationChart from "@/components/conversation-chart";
import PersonaChart from "@/components/persona-chart";
import FeaturedSection from "@/components/featured-section";
import { useState } from "react";

export default function Dashboard() {
  const [dealershipFilter, setDealershipFilter] = useState("all");
  
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

  const apiEndpoints = [
    { path: "/inbound", status: "operational" as const, uptime: "100% uptime" },
    { path: "/reply", status: "operational" as const, uptime: "99.8% uptime" },
    { path: "/handover", status: "operational" as const, uptime: "99.9% uptime" },
  ];

  const conversationChartData = [
    { name: "Mon", count: 30 },
    { name: "Tue", count: 45 },
    { name: "Wed", count: 60 },
    { name: "Thu", count: 75 },
    { name: "Fri", count: 50 },
    { name: "Sat", count: 85 },
    { name: "Sun", count: 70 },
  ];

  const personaChartData = [
    { name: "Friendly Advisor", value: 85, percentage: "28.4%" },
    { name: "Technical Expert", value: 74, percentage: "24.7%" },
    { name: "Concierge", value: 65, percentage: "21.9%" },
    { name: "Sales Assistant", value: 54, percentage: "18.2%" },
    { name: "Service Advisor", value: 47, percentage: "15.8%" },
  ];

  const handleViewConversation = (id: number) => {
    console.log(`View conversation ${id}`);
    // Navigate to conversation details page
  };

  return (
    <>
      {/* Dashboard Header */}
      <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
          <div className="relative">
            <select
              value={dealershipFilter}
              onChange={(e) => setDealershipFilter(e.target.value)}
              className="block w-full h-10 px-4 pr-8 text-sm border border-neutral-200 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="all">All Dealerships</option>
              <option value="florida">Florida Motors</option>
              <option value="texas">Texas Auto Group</option>
              <option value="california">California Cars</option>
            </select>
            <span className="absolute top-2.5 right-3 material-icons text-neutral-400 text-sm pointer-events-none">
              arrow_drop_down
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
        
        {/* Prompt Testing */}
        <StatusCard
          title="Prompt Testing"
          value="Ready"
          icon="psychology"
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
          trend={{
            value: "5",
            direction: "up",
            label: "templates available"
          }}
        />
        
        {/* Setup Tools */}
        <StatusCard
          title="Dealership Setup"
          value="Configure"
          icon="settings"
          iconBgColor="bg-info/10"
          iconColor="text-info"
          trend={{
            value: "3",
            direction: "up",
            label: "steps to complete"
          }}
        />
      </div>
      
      {/* API Status and Dealership Configuration */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* API Status */}
        <div>
          <ApiStatus endpoints={apiEndpoints} />
        </div>

        {/* Dealership Setup */}
        <div>
          <FeaturedDealership
            name="Dealership Configuration"
            subtitle="Testing, Setup & Support"
            stats={{
              conversations: 0,
              conversionRate: "Configure Now",
            }}
          />
        </div>
      </div>


    </>
  );
}
