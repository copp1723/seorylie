import React, { useState } from 'react';
import { MessageCircle, Bot, User, Plus } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  status: 'online' | 'offline' | 'busy';
  lastMessage?: string;
  unreadCount?: number;
}

interface AgentSidebarLayoutProps {
  agents: Agent[];
  onAddAgent?: () => void;
}

export const AgentSidebarLayout: React.FC<AgentSidebarLayoutProps> = ({ 
  agents, 
  onAddAgent 
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    agents[0]?.id || null
  );
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">AI Agents</h2>
          <p className="text-sm text-gray-500 mt-1">
            {agents.filter(a => a.status === 'online').length} of {agents.length} online
          </p>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`w-full p-4 flex items-start space-x-3 hover:bg-gray-50 transition-colors ${
                selectedAgentId === agent.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  agent.avatar ? '' : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {agent.avatar ? (
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full" />
                  ) : (
                    <Bot className="w-6 h-6 text-white" />
                  )}
                </div>
                {/* Status Indicator */}
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  agent.status === 'online' ? 'bg-green-500' :
                  agent.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
              </div>

              {/* Agent Info */}
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{agent.name}</h3>
                  {agent.unreadCount && agent.unreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      {agent.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{agent.role}</p>
                {agent.lastMessage && (
                  <p className="text-sm text-gray-600 truncate mt-1">{agent.lastMessage}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Add Agent Button */}
        {onAddAgent && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onAddAgent}
              className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Agent</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex items-center justify-center">
        {selectedAgent ? (
          <div className="w-full max-w-4xl h-full flex flex-col p-6">
            {/* Chat Header */}
            <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedAgent.avatar ? '' : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {selectedAgent.avatar ? (
                    <img src={selectedAgent.avatar} alt={selectedAgent.name} className="w-full h-full rounded-full" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedAgent.name}</h3>
                  <p className="text-sm text-gray-500">{selectedAgent.role}</p>
                </div>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 bg-white border-x border-gray-200 overflow-y-auto p-6">
              {/* This is where your chat component would go */}
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg">Start a conversation with {selectedAgent.name}</p>
                  <p className="text-sm mt-2">Your chat interface will appear here</p>
                </div>
              </div>
            </div>

            {/* Chat Input Area */}
            <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 p-4">
              <div className="flex space-x-4">
                <input
                  type="text"
                  placeholder={`Message ${selectedAgent.name}...`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <Bot className="w-24 h-24 mx-auto mb-4" />
            <p className="text-xl">Select an agent to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};