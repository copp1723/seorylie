import React, { useState, useEffect, useRef } from "react";
import {
  connectWebSocket,
  sendMessage,
  onMessage,
  onConnectionChange,
} from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const blogFormSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  keywords: z.string().min(1, "Keywords are required"),
  description: z.string().min(10, "Description is required"),
});

type BlogFormValues = z.infer<typeof blogFormSchema>;

interface Message {
  id: string;
  sender: "user" | "agent" | "system";
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  dealershipId: number;
  userId: number;
  userName: string;
  conversationId?: number;
  mode: "rylie_ai" | "direct_agent";
  agentName?: string;
  agentAvatar?: string;
  onConversationStart?: (conversationId: number) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  dealershipId,
  userId,
  userName,
  conversationId: initialConversationId,
  mode,
  agentName = mode === "rylie_ai" ? "Rylie AI" : "Support Agent",
  agentAvatar,
  onConversationStart,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>(
    initialConversationId,
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showBlogRequest, setShowBlogRequest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const blogForm = useForm<BlogFormValues>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: { topic: "", keywords: "", description: "" },
  });

  const handleBlogRequestSubmit = (values: BlogFormValues) => {
    sendMessage({
      type: "seo_task_request",
      conversationId,
      userId,
      dealershipId,
      payload: {
        topic: values.topic,
        keywords: values.keywords,
        description: values.description,
        type: "blog_post",
        priority: "medium",
      },
    });

    setShowBlogRequest(false);
    blogForm.reset();
  };

  // Connect to WebSocket when component mounts
  useEffect(() => {
    // Create WebSocket URL with correct protocol
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    // Connect to WebSocket
    connectWebSocket(wsUrl).catch((err) => {
      console.error("WebSocket connection error:", err);
    });

    // Register connection status handler
    const removeConnectionHandler = onConnectionChange((connected: boolean) => {
      setIsConnected(connected);

      if (connected) {
        // Send registration message when connected
        sendMessage({
          type: "register",
          userId,
          dealershipId,
          conversationId,
        });
      }
    });

    // Register message handler
    const removeMessageHandler = onMessage((data) => {
      if (data.type === "message") {
        const newMessage: Message = {
          id:
            data.id ||
            `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: data.sender,
          content: data.content,
          timestamp: new Date(data.timestamp || Date.now()),
        };

        setMessages((prev) => [...prev, newMessage]);
      } else if (data.type === "conversation_start") {
        setConversationId(data.conversationId);
        if (onConversationStart) {
          onConversationStart(data.conversationId);
        }
      } else if (data.type === "typing_indicator") {
        setIsTyping(data.isTyping);
      } else if (data.type === "task_complete") {
        const newMessage: Message = {
          id: `complete-${Date.now()}`,
          sender: "system",
          content: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
      } else if (data.type === "history") {
        // Handle conversation history
        if (Array.isArray(data.messages)) {
          const formattedMessages = data.messages.map((msg: any) => ({
            id:
              msg.id ||
              `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sender: msg.sender,
            content: msg.content,
            timestamp: new Date(msg.timestamp || Date.now()),
          }));

          setMessages(formattedMessages);
        }
      }
    });

    // Show welcome message
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      sender: "system",
      content:
        mode === "rylie_ai"
          ? `Welcome to our AI-powered chat support! I'm ${agentName}, your virtual assistant. How can I help you today?`
          : `Welcome! You're now connected with ${agentName}. Please describe how we can assist you today.`,
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);

    return () => {
      removeConnectionHandler();
      removeMessageHandler();
    };
  }, [
    dealershipId,
    userId,
    agentName,
    mode,
    conversationId,
    onConversationStart,
  ]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Send message through WebSocket
    sendMessage({
      type: "message",
      conversationId,
      userId,
      dealershipId,
      content: inputValue,
      timestamp: new Date().toISOString(),
      mode,
    });

    // If we reach this point, we at least attempted to send the message
    // The WebSocket utility will log warnings if the connection is closed

    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden bg-background">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Avatar>
            {agentAvatar ? (
              <AvatarImage src={agentAvatar} alt={agentName} />
            ) : (
              <AvatarFallback>{agentName.charAt(0)}</AvatarFallback>
            )}
          </Avatar>
          <div>
            <h3 className="font-medium">{agentName}</h3>
            <div className="flex items-center space-x-2">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? "Online" : "Connecting..."}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={mode === "rylie_ai" ? "secondary" : "default"}>
            {mode === "rylie_ai" ? "AI Mode" : "Direct Agent"}
          </Badge>
          <Dialog open={showBlogRequest} onOpenChange={setShowBlogRequest}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                New SEO Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request a Blog Post</DialogTitle>
              </DialogHeader>
              <Form {...blogForm}>
                <form
                  onSubmit={blogForm.handleSubmit(handleBlogRequestSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={blogForm.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Topic</FormLabel>
                        <FormControl>
                          <Input placeholder="Blog topic" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={blogForm.control}
                    name="keywords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Keywords</FormLabel>
                        <FormControl>
                          <Input placeholder="comma, separated" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={blogForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[120px]"
                            placeholder="Describe the request"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">Submit</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.sender !== "user" && message.sender !== "system" && (
                <Avatar className="h-8 w-8 mr-2">
                  {agentAvatar ? (
                    <AvatarImage src={agentAvatar} alt={agentName} />
                  ) : (
                    <AvatarFallback>{agentName.charAt(0)}</AvatarFallback>
                  )}
                </Avatar>
              )}

              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : message.sender === "system"
                      ? "bg-muted text-muted-foreground text-center w-full"
                      : "bg-secondary text-secondary-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {message.sender === "user" && (
                <Avatar className="h-8 w-8 ml-2">
                  <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <Avatar className="h-8 w-8 mr-2">
                {agentAvatar ? (
                  <AvatarImage src={agentAvatar} alt={agentName} />
                ) : (
                  <AvatarFallback>{agentName.charAt(0)}</AvatarFallback>
                )}
              </Avatar>
              <div className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div
                    className="w-2 h-2 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                  <div
                    className="w-2 h-2 rounded-full bg-current animate-bounce"
                    style={{ animationDelay: "600ms" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[80px] resize-none"
            disabled={!isConnected}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !inputValue.trim()}
            className="self-end"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
