import { useState } from "react";

export interface Conversation {
  id: number;
  customerName: string;
  dealershipName: string;
  lastMessage: string;
  status: "active" | "waiting" | "escalated" | "completed";
  updatedAt: string;
}

interface ConversationTableProps {
  conversations: Conversation[];
  onViewConversation: (id: number) => void;
}

// Define status classes type for better type safety
type StatusClassMap = {
  [K in Conversation["status"]]: string;
};

export default function ConversationTable({
  conversations,
  onViewConversation,
}: ConversationTableProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  const statusClasses: StatusClassMap = {
    active: "text-success-800 bg-success-100",
    waiting: "text-warning-800 bg-warning-100",
    escalated: "text-error-800 bg-error-100",
    completed: "text-neutral-800 bg-neutral-100",
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedConversations = conversations.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const totalPages = Math.ceil(conversations.length / itemsPerPage);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-medium">Recent Conversations</h2>
        <a href="#" className="text-sm text-primary hover:underline">
          View all
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50">
              <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                CUSTOMER
              </th>
              <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                DEALERSHIP
              </th>
              <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                LAST MESSAGE
              </th>
              <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                STATUS
              </th>
              <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedConversations.map((conversation: Conversation) => (
              <tr
                key={conversation.id}
                className="hover:bg-neutral-50 cursor-pointer transition-colors"
                onClick={() => onViewConversation(conversation.id)}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center">
                    <span className="font-medium">
                      {conversation.customerName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-sm text-neutral-600">
                  {conversation.dealershipName}
                </td>
                <td className="px-4 py-3.5 text-sm text-neutral-600 max-w-xs truncate">
                  {conversation.lastMessage}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      statusClasses[conversation.status]
                    }`}
                  >
                    {conversation.status.charAt(0).toUpperCase() +
                      conversation.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-primary text-sm hover:underline">
                    View
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-right border-t">
        <div className="inline-flex items-center text-sm">
          <button
            onClick={() =>
              setCurrentPage((prev: number) => Math.max(prev - 1, 1))
            }
            className="p-1 text-neutral-500 rounded hover:bg-neutral-100 disabled:opacity-50"
            disabled={currentPage === 1}
          >
            <span className="material-icons text-sm">chevron_left</span>
          </button>
          <span className="mx-2 text-neutral-500">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev: number) => Math.min(prev + 1, totalPages))
            }
            className="p-1 text-neutral-500 rounded hover:bg-neutral-100 disabled:opacity-50"
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <span className="material-icons text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
