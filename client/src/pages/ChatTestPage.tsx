import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bot,
  User,
  Settings,
  TestTube,
  Send,
  Phone,
  Mail,
  Clock,
  Circle,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface ChatMessage {
  id: string;
  conversationId: number;
  senderId: number;
  senderType: "agent" | "customer";
  content: string;
  messageType: "text" | "image" | "file";
  timestamp: Date;
  metadata?: any;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

const ChatTestPage: React.FC = () => {
  // Test configuration state
  const [mode, setMode] = useState<"rylie_ai" | "direct_agent">("direct_agent");
  const [userType, setUserType] = useState<"agent" | "customer">("customer");
  const [dealershipId] = useState(1);
  const [conversationId] = useState(1);

  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  // Chat state
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000;

  const customerInfo = {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
  };

  // WebSocket connection management
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
        setLastActivity(new Date());
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionId(null);

        // Attempt to reconnect if not a clean close
        if (
          event.code !== 1000 &&
          reconnectAttempts.current < maxReconnectAttempts
        ) {
          reconnectAttempts.current++;
          console.log(
            `Attempting to reconnect... (${reconnectAttempts.current}/${maxReconnectAttempts})`,
          );

          setTimeout(
            () => {
              connect();
            },
            reconnectInterval * Math.pow(2, reconnectAttempts.current - 1),
          );
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastActivity(new Date());
          handleIncomingMessage(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      setIsConnecting(false);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      setLastActivity(new Date());
    } else {
      console.warn("WebSocket is not connected. Message not sent:", message);
    }
  }, []);

  const handleIncomingMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case "connection_established":
        setConnectionId(data.connectionId);
        console.log("Connection established with ID:", data.connectionId);
        break;

      case "authenticated":
        console.log("User authenticated:", data.userType);
        break;

      case "joined_conversation":
        console.log("Joined conversation:", data.conversationId);
        if (data.recentMessages && Array.isArray(data.recentMessages)) {
          setMessages(
            data.recentMessages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            })),
          );
        }
        break;

      case "new_message":
        if (data.message) {
          setMessages((prev) => [
            ...prev,
            {
              ...data.message,
              timestamp: new Date(data.message.timestamp),
            },
          ]);
        }
        break;

      case "typing_indicator":
        if (
          data.isTyping &&
          data.userId !== (userType === "customer" ? 999 : 1)
        ) {
          setTypingUsers((prev) => new Set([...prev, data.userId]));
        } else {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(data.userId);
            return newSet;
          });
        }
        break;

      case "user_joined":
        console.log("User joined:", data.userId, data.userType);
        break;

      case "user_left":
        console.log("User left:", data.userId, data.userType);
        break;

      case "error":
        console.error("WebSocket error:", data.error);
        break;

      case "pong":
        // Handle ping/pong for connection health
        break;

      default:
        console.log("Unknown message type:", data.type, data);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect]);

  // Authenticate and join conversation when connected
  useEffect(() => {
    if (isConnected && connectionId) {
      // Authenticate
      sendMessage({
        type: "authenticate",
        token: "demo-token",
        userId: userType === "customer" ? 999 : 1,
        dealershipId,
        userType,
      });

      // Join conversation
      setTimeout(() => {
        sendMessage({
          type: "join_conversation",
          conversationId,
        });
      }, 100);
    }
  }, [
    isConnected,
    connectionId,
    dealershipId,
    conversationId,
    userType,
    sendMessage,
  ]);

  // Send periodic pings to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendMessage({ type: "ping" });
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  const handleSendMessage = () => {
    if (!message.trim() || !isConnected) return;

    const messageData = {
      type: "send_message",
      content: message.trim(),
      messageType: "text",
      metadata: {
        customerInfo,
        timestamp: new Date().toISOString(),
      },
    };

    sendMessage(messageData);
    setMessage("");

    // Stop typing indicator
    if (isTyping) {
      sendMessage({
        type: "typing",
        isTyping: false,
      });
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (value: string) => {
    setMessage(value);

    // Send typing indicator
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      sendMessage({
        type: "typing",
        isTyping: true,
      });
    } else if (!value.trim() && isTyping) {
      setIsTyping(false);
      sendMessage({
        type: "typing",
        isTyping: false,
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getConnectionStatus = () => {
    if (isConnecting)
      return { icon: Loader2, text: "Connecting...", color: "yellow" };
    if (isConnected)
      return { icon: CheckCircle, text: "Connected", color: "green" };
    return { icon: AlertCircle, text: "Disconnected", color: "red" };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <TestTube className="w-8 h-8 text-blue-500" />
          Rylie Chat System Test
        </h1>
        <p className="text-gray-600">
          Test the dual-mode chat system with WebSocket integration
        </p>
      </div>

      {/* Configuration Panel */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Test Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operation Mode</label>
              <Select
                value={mode}
                onValueChange={(value: "rylie_ai" | "direct_agent") =>
                  setMode(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rylie_ai">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-blue-500" />
                      Rylie AI Mode
                    </div>
                  </SelectItem>
                  <SelectItem value="direct_agent">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-500" />
                      Direct Agent Mode
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">User Type</label>
              <Select
                value={userType}
                onValueChange={(value: "agent" | "customer") =>
                  setUserType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer View</SelectItem>
                  <SelectItem value="agent">Agent View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Dealership ID: {dealershipId}</Badge>
            <Badge variant="outline">Conversation ID: {conversationId}</Badge>
            <Badge variant={mode === "rylie_ai" ? "default" : "secondary"}>
              {mode === "rylie_ai" ? "AI Mode" : "Agent Mode"}
            </Badge>
            <Badge variant="outline">
              {userType === "agent" ? "Agent" : "Customer"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="flex flex-col h-[600px] max-w-2xl mx-auto">
        {/* Header */}
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {mode === "rylie_ai" ? (
                <>
                  <Bot className="w-5 h-5 text-blue-500" />
                  <span>Rylie AI Assistant</span>
                </>
              ) : (
                <>
                  <User className="w-5 h-5 text-green-500" />
                  <span>Live Chat Support</span>
                </>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              <StatusIcon
                className={`w-4 h-4 ${
                  status.color === "green"
                    ? "text-green-500"
                    : status.color === "yellow"
                      ? "text-yellow-500 animate-spin"
                      : "text-red-500"
                }`}
              />
              <span className="text-sm text-gray-600">{status.text}</span>
            </div>
          </div>

          {/* Customer info (shown when agent view) */}
          {userType === "agent" && (
            <div className="mt-2 pt-2 border-t text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">Customer:</span>
                <span>{customerInfo.name}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <div className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{customerInfo.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{customerInfo.phone}</span>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        {/* Messages Area */}
        <CardContent className="flex-grow p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Bot className="w-12 h-12 mb-2" />
                  <p className="text-center">
                    No messages yet. Send a message to start the conversation.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className={`flex ${msg.senderType === userType ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex ${msg.senderType === userType ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[80%]`}
                    >
                      <Avatar
                        className={`w-8 h-8 ${msg.senderType === userType ? "ml-2" : "mr-2"}`}
                      >
                        <AvatarFallback
                          className={`${
                            msg.senderType === "agent"
                              ? "bg-green-100 text-green-600"
                              : "bg-blue-100 text-blue-600"
                          }`}
                        >
                          {msg.senderType === "agent" ? "A" : "C"}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div
                          className={`rounded-lg p-3 ${
                            msg.senderType === userType
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          <p className="break-words">{msg.content}</p>
                        </div>
                        <div
                          className={`text-xs mt-1 text-gray-500 flex gap-1 ${
                            msg.senderType === userType
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(msg.timestamp)}</span>
                          {msg.senderType === "agent" &&
                            mode === "rylie_ai" && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 ml-1"
                              >
                                AI
                              </Badge>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="flex items-center justify-center gap-1 w-12">
                    <Circle className="w-1.5 h-1.5 animate-pulse" />
                    <Circle className="w-1.5 h-1.5 animate-pulse [animation-delay:0.2s]" />
                    <Circle className="w-1.5 h-1.5 animate-pulse [animation-delay:0.4s]" />
                  </div>
                  <span>
                    {userType === "customer" ? "Agent" : "Customer"} is
                    typing...
                  </span>
                </div>
              )}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Area */}
        <div className="p-4 border-t flex gap-2">
          <Input
            placeholder={`Type a message as ${userType}...`}
            value={message}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={!isConnected}
            className="flex-grow"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !message.trim()}
            className="gap-1"
          >
            <Send className="w-4 h-4" />
            Send
          </Button>
        </div>
      </Card>

      {/* Instructions */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Test Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Select <strong>Operation Mode</strong> to test different chat
              modes:
              <ul className="list-disc list-inside ml-5 mt-1">
                <li>
                  <strong>Rylie AI Mode:</strong> Automated AI-powered responses
                </li>
                <li>
                  <strong>Direct Agent Mode:</strong> Human agent handling
                  conversations
                </li>
              </ul>
            </li>
            <li>
              Select <strong>User Type</strong> to switch between views:
              <ul className="list-disc list-inside ml-5 mt-1">
                <li>
                  <strong>Customer:</strong> Simulates the customer-facing
                  interface
                </li>
                <li>
                  <strong>Agent:</strong> Simulates the agent dashboard
                  interface
                </li>
              </ul>
            </li>
            <li>Type messages and observe real-time message delivery</li>
            <li>Look for typing indicators when the other party is typing</li>
            <li>
              Test WebSocket reconnection by temporarily disabling your network
            </li>
          </ol>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <p className="text-blue-800 dark:text-blue-300 font-medium">
              WebSocket Connection Status:
            </p>
            <p className="mt-1">
              {isConnected ? (
                <span className="text-green-600 dark:text-green-400">
                  ✓ Connected to WebSocket server
                </span>
              ) : isConnecting ? (
                <span className="text-yellow-600 dark:text-yellow-400">
                  ⟳ Connecting to WebSocket server...
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400">
                  ✗ Disconnected from WebSocket server
                </span>
              )}
            </p>
            {connectionId && (
              <p className="mt-1 text-xs">Connection ID: {connectionId}</p>
            )}
            {lastActivity && (
              <p className="mt-1 text-xs">
                Last activity: {lastActivity.toLocaleTimeString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatTestPage;
