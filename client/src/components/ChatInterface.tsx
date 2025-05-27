
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Send,
  Phone,
  Mail,
  User,
  Bot,
  Clock,
  Circle,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  conversationId: number;
  senderId: number;
  senderType: 'agent' | 'customer';
  content: string;
  messageType: 'text' | 'image' | 'file';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Define specific message types for better type safety
type WebSocketMessageType =
  | 'connection_established'
  | 'new_message'
  | 'typing_indicator'
  | 'conversation_created'
  | 'send_message'
  | 'join_conversation';

interface WebSocketMessage {
  type: WebSocketMessageType;
  connectionId?: string;
  messageHistory?: ChatMessage[];
  message?: ChatMessage;
  isTyping?: boolean;
  userId?: number;
  conversationId?: number;
  content?: string;
}

interface ChatInterfaceProps {
  dealershipId: number;
  conversationId?: number;
  userType: 'agent' | 'customer';
  userId?: number;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  onMessageSent?: (message: string) => void;
  mode?: 'rylie_ai' | 'direct_agent';
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  dealershipId,
  conversationId,
  userType,
  userId,
  customerInfo,
  onMessageSent,
  mode = 'direct_agent'
}) => {
  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  // Chat state
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000;

  // WebSocket connection management
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?dealershipId=${dealershipId}&userType=${userType}${userId ? `&userId=${userId}` : ''}${conversationId ? `&conversationId=${conversationId}` : ''}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
      reconnectAttempts.current = 0;

      // Send join message if we have a conversation ID
      if (conversationId) {
        ws.send(JSON.stringify({
          type: 'join_conversation',
          conversationId,
          userType,
          userId
        }));
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Try to reconnect unless it was a deliberate close
      if (reconnectAttempts.current < maxReconnectAttempts && event.code !== 1000) {
        reconnectAttempts.current += 1;
        setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage;
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current = ws;
  }, [dealershipId, conversationId, userType, userId]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    setLastActivity(new Date());

    switch (data.type) {
      case 'connection_established':
        setConnectionId(data.connectionId || null);

        // If we have history, load it
        if (data.messageHistory && Array.isArray(data.messageHistory)) {
          setMessages(data.messageHistory);
          scrollToBottom();
        }
        break;

      case 'new_message':
        if (data.message) {
          setMessages(prev => [...prev, data.message as ChatMessage]);
          scrollToBottom();
        }
        break;

      case 'typing_indicator':
        if (data.isTyping && data.userId !== undefined) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.add(data.userId!);
            return newSet;
          });
        } else if (!data.isTyping && data.userId !== undefined) {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.userId!);
            return newSet;
          });
        }
        break;

      case 'conversation_created':
        if (data.conversationId && !conversationId) {
          // Update URL if conversation was just created
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('conversationId', data.conversationId.toString());
          window.history.pushState({}, '', newUrl.toString());
        }
        break;

      default:
        console.log('Unhandled WebSocket message type:', data.type);
    }
  }, [conversationId]);

  // Auto-connect WebSocket on component mount
  useEffect(() => {
    connect();

    return () => {
      // Clean up WebSocket connection on unmount
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Send chat message
  const sendMessage = () => {
    if (!message.trim() || !isConnected) return;

    const messageData = {
      type: 'send_message',
      content: message,
      userType,
      dealershipId,
      conversationId,
      customerInfo,
      mode
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageData));
      setMessage('');

      // Call the optional callback
      if (onMessageSent) {
        onMessageSent(message);
      }
    }
  };

  // Send typing indicator
  const sendTypingIndicator = (isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_indicator',
        isTyping,
        userType,
        conversationId
      }));
    }
  };

  // Handle input changes and typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    sendTypingIndicator(e.target.value.length > 0);
  };

  // Handle keyboard submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden border-0 shadow-none">
      <CardHeader className="px-4 py-2 border-b bg-muted/30">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2">
            {mode === 'rylie_ai' ? (
              <>
                <Bot className="h-5 w-5" />
                <span>AI Assistant Mode</span>
              </>
            ) : (
              <>
                <User className="h-5 w-5" />
                <span>Direct Agent Mode</span>
              </>
            )}
          </CardTitle>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {isConnected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span>{isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full max-h-[500px] p-4">
          <div className="flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Bot className="h-8 w-8 mb-2" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[80%] ${msg.senderType === 'customer' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className={`h-8 w-8 ${msg.senderType === 'customer' ? 'bg-primary' : 'bg-secondary'}`}>
                      <AvatarFallback>
                        {msg.senderType === 'customer' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div
                        className={`p-3 rounded-lg ${
                          msg.senderType === 'customer'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {msg.content}
                      </div>

                      <div className="flex gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {typingUsers.size > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1">
                  <Circle className="h-2 w-2 animate-pulse" />
                  <Circle className="h-2 w-2 animate-pulse delay-75" />
                  <Circle className="h-2 w-2 animate-pulse delay-150" />
                </div>
                <span>Typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            className="flex-1"
          />

          <Button
            onClick={sendMessage}
            disabled={!isConnected || !message.trim()}
            className="px-3"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>

        {customerInfo && (
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            {customerInfo.name && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{customerInfo.name}</span>
              </div>
            )}

            {customerInfo.email && (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span>{customerInfo.email}</span>
              </div>
            )}

            {customerInfo.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                <span>{customerInfo.phone}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChatInterface;
