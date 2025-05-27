import { useState } from "react";
import { Card } from "@/components/ui/card";
import ConversationTable, { Conversation } from "@/components/conversation-table";

export default function Conversations() {
  const [conversationFilter, setConversationFilter] = useState("all");
  const [dealershipFilter, setDealershipFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sample data for the conversations page
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
    {
      id: 6,
      customerName: "John Smith",
      dealershipName: "Florida Motors",
      lastMessage: "Can I test drive the Ford Mustang?",
      status: "active",
      updatedAt: "2023-06-15T08:30:00Z",
    },
    {
      id: 7,
      customerName: "Emma Wilson",
      dealershipName: "California Cars",
      lastMessage: "What are the financing options?",
      status: "escalated",
      updatedAt: "2023-06-15T07:45:00Z",
    },
    {
      id: 8,
      customerName: "David Brown",
      dealershipName: "Texas Auto Group",
      lastMessage: "Does this Honda CR-V have all-wheel drive?",
      status: "completed",
      updatedAt: "2023-06-14T16:30:00Z",
    },
    {
      id: 9,
      customerName: "Sophia Lee",
      dealershipName: "Florida Motors",
      lastMessage: "What color options are available for the Camry?",
      status: "waiting",
      updatedAt: "2023-06-14T15:45:00Z",
    },
    {
      id: 10,
      customerName: "James Anderson",
      dealershipName: "California Cars",
      lastMessage: "I'm interested in the 2023 Tesla Model 3",
      status: "active",
      updatedAt: "2023-06-14T14:30:00Z",
    },
  ];

  // Filter conversations based on status and dealership
  const filteredConversations = sampleConversations.filter(
    (conversation) => {
      const matchesStatus =
        conversationFilter === "all" || conversation.status === conversationFilter;
      const matchesDealership =
        dealershipFilter === "all" ||
        conversation.dealershipName
          .toLowerCase()
          .includes(dealershipFilter.toLowerCase());
      const matchesSearch =
        searchQuery === "" ||
        conversation.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesDealership && matchesSearch;
    }
  );

  const handleViewConversation = (id: number) => {
    console.log(`View conversation ${id}`);
    // Navigate to conversation details page
  };

  return (
    <>
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <h1 className="text-2xl font-medium">Conversations</h1>
      </div>

      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="absolute top-2.5 left-3 material-icons text-neutral-400 text-sm">
              search
            </span>
          </div>
          <div className="relative">
            <select
              value={conversationFilter}
              onChange={(e) => setConversationFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="waiting">Waiting</option>
              <option value="escalated">Escalated</option>
              <option value="completed">Completed</option>
            </select>
            <span className="absolute top-2.5 right-3 material-icons text-neutral-400 text-sm pointer-events-none">
              arrow_drop_down
            </span>
          </div>
          <div className="relative">
            <select
              value={dealershipFilter}
              onChange={(e) => setDealershipFilter(e.target.value)}
              className="w-full px-4 py-2 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
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
        </div>
      </Card>

      <ConversationTable
        conversations={filteredConversations}
        onViewConversation={handleViewConversation}
      />
    </>
  );
}
