import React, { useState, useEffect, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import {
  Clipboard,
  Download,
  Trash2,
  AlertCircle,
  Terminal,
  ArrowDown,
  Info,
} from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Badge } from "../ui/badge";

// Types for the LiveConsole component
export interface ConsoleMessage {
  id?: string;
  type: "system" | "agent" | "tool" | "error" | "info" | string;
  content: string;
  timestamp: Date;
  data?: any;
  metadata?: Record<string, any>;
}

export interface LiveConsoleProps {
  messages: ConsoleMessage[];
  isLoading?: boolean;
  onClearMessages?: () => void;
  onExportMessages?: () => void;
  className?: string;
  maxHeight?: string;
  title?: string;
  showToolbar?: boolean;
}

/**
 * LiveConsole Component
 *
 * A terminal-style console for displaying real-time agent execution logs
 * with color coding, auto-scroll, and export functionality.
 */
export const LiveConsole: React.FC<LiveConsoleProps> = ({
  messages,
  isLoading = false,
  onClearMessages,
  onExportMessages,
  className = "",
  maxHeight = "400px",
  title = "Console",
  showToolbar = true,
}) => {
  // Refs for scroll management
  const consoleRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // State for auto-scroll and other UI controls
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [copied, setCopied] = useState(false);

  // Filter messages based on selected filter
  const filteredMessages = filter
    ? messages.filter((msg) => msg.type === filter)
    : messages;

  // Handle auto-scrolling when new messages arrive
  useEffect(() => {
    if (autoScroll && isAtBottom && scrollAreaRef.current) {
      scrollToBottom();
    }
  }, [messages, autoScroll, isAtBottom]);

  // Scroll to the bottom of the console
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  };

  // Handle scroll events to determine if we're at the bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isBottom =
      Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) <
      10;
    setIsAtBottom(isBottom);
  };

  // Copy console content to clipboard
  const copyToClipboard = () => {
    const text = filteredMessages
      .map(
        (msg) =>
          `[${msg.timestamp.toLocaleTimeString()}] [${msg.type.toUpperCase()}] ${msg.content}`,
      )
      .join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy console content:", err);
      });
  };

  // Export console content as a file
  const exportConsole = () => {
    if (onExportMessages) {
      onExportMessages();
      return;
    }

    const text = filteredMessages
      .map(
        (msg) =>
          `[${msg.timestamp.toISOString()}] [${msg.type.toUpperCase()}] ${msg.content}`,
      )
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-console-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get the appropriate color for a message type
  const getMessageColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case "error":
        return "text-red-400";
      case "system":
        return "text-blue-400";
      case "agent":
        return "text-green-400";
      case "tool":
        return "text-yellow-400";
      case "info":
        return "text-purple-400";
      default:
        return "text-gray-300";
    }
  };

  // Get the appropriate icon for a message type
  const getMessageIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "error":
        return <AlertCircle className="h-3 w-3 mr-1" />;
      case "system":
        return <Terminal className="h-3 w-3 mr-1" />;
      case "info":
        return <Info className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium flex items-center">
            <Terminal className="h-4 w-4 mr-2" />
            {title}
          </h3>
        </div>
        <div
          className="bg-black rounded-md p-4 overflow-hidden font-mono text-sm text-white"
          style={{ height: maxHeight }}
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 bg-gray-800" />
            <Skeleton className="h-4 w-1/2 bg-gray-800" />
            <Skeleton className="h-4 w-5/6 bg-gray-800" />
            <Skeleton className="h-4 w-2/3 bg-gray-800" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      {/* Console Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium flex items-center">
          <Terminal className="h-4 w-4 mr-2" />
          {title}
          <Badge variant="outline" className="ml-2 text-xs">
            {filteredMessages.length} message
            {filteredMessages.length !== 1 ? "s" : ""}
          </Badge>
        </h3>

        {showToolbar && (
          <div className="flex items-center space-x-2">
            <Tabs defaultValue="all" className="h-8">
              <TabsList className="h-7">
                <TabsTrigger
                  value="all"
                  className="text-xs px-2 h-6"
                  onClick={() => setFilter(null)}
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="text-xs px-2 h-6"
                  onClick={() => setFilter("system")}
                >
                  System
                </TabsTrigger>
                <TabsTrigger
                  value="agent"
                  className="text-xs px-2 h-6"
                  onClick={() => setFilter("agent")}
                >
                  Agent
                </TabsTrigger>
                <TabsTrigger
                  value="tool"
                  className="text-xs px-2 h-6"
                  onClick={() => setFilter("tool")}
                >
                  Tool
                </TabsTrigger>
                <TabsTrigger
                  value="error"
                  className="text-xs px-2 h-6"
                  onClick={() => setFilter("error")}
                >
                  Error
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Console Content */}
      <div
        ref={consoleRef}
        className="bg-black rounded-md overflow-hidden font-mono text-sm text-white relative"
        style={{ height: maxHeight }}
      >
        <ScrollArea
          ref={scrollAreaRef as any}
          className="h-full p-4"
          onScroll={handleScroll}
        >
          {filteredMessages.length === 0 ? (
            <div className="text-gray-400 text-center h-full flex flex-col justify-center items-center">
              <Terminal className="h-8 w-8 mb-2 opacity-50" />
              <p>No console output yet.</p>
              <p className="mt-2 text-xs">Execute an agent to see logs here.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMessages.map((msg, index) => (
                <div key={msg.id || index} className="leading-relaxed">
                  <span className="text-gray-500">
                    [{msg.timestamp.toLocaleTimeString()}]{" "}
                  </span>
                  <span
                    className={`${getMessageColor(msg.type)} inline-flex items-center`}
                  >
                    {getMessageIcon(msg.type)}
                    {msg.content}
                  </span>

                  {/* Render JSON data if present */}
                  {msg.data && (
                    <div className="pl-6 mt-1 mb-2 text-xs">
                      <div className="bg-gray-900 p-2 rounded overflow-x-auto">
                        <pre className="text-gray-300">
                          {JSON.stringify(msg.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Scroll to bottom button - only shown when not at bottom */}
        {!isAtBottom && filteredMessages.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-4 right-4 h-8 w-8 rounded-full opacity-80 shadow-md"
                  onClick={scrollToBottom}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Scroll to bottom</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Console Footer */}
      {showToolbar && (
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={copyToClipboard}
                    disabled={filteredMessages.length === 0}
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? "Copied!" : "Copy to clipboard"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={exportConsole}
                    disabled={filteredMessages.length === 0}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export as log file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onClearMessages}
                    disabled={filteredMessages.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear console</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
            />
            <Label htmlFor="auto-scroll" className="text-sm">
              Auto-scroll
            </Label>
          </div>
        </div>
      )}
    </Card>
  );
};

export default LiveConsole;
