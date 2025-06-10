import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useBranding } from "../contexts/BrandingContext";
import { useAuth } from "../contexts/AuthContext";
import { generateChatResponse, submitSEORequest, type ChatMessage } from "../services/chat-service";

// Use the enhanced ChatMessage interface from chat-service
type Message = ChatMessage;

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your SEO assistant. How can I help you improve your website's search engine optimization today?",
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  // const { user } = useAuth(); // Available for future use

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    const currentInput = inputValue;
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      // Use the enhanced chat service
      const response = await generateChatResponse(currentInput);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.content,
        sender: 'assistant',
        timestamp: new Date(),
        hasRequestButton: response.hasRequestButton,
        requestData: response.requestData
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmitRequest = async (requestData: { type: string; query: string; context?: any }) => {
    setSubmittingRequest(requestData.type);

    try {
      const result = await submitSEORequest(requestData);

      const responseMessage: Message = {
        id: Date.now().toString(),
        content: result.success
          ? `✅ ${result.message}${result.requestId ? ` (Request ID: ${result.requestId})` : ''}`
          : `❌ ${result.message}`,
        sender: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, responseMessage]);
    } catch (error) {
      console.error('Error submitting request:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "❌ There was an error submitting your request. Please try again or contact support.",
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSubmittingRequest(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "What tasks have been completed this week?",
    "What are my weekly analytics?",
    "How does my F-150 compare to competitors?",
    "What's included in my SEO package?",
    "How can I improve my SEO rankings?",
    "What's my organic traffic compared to last year?"
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground">SEO Assistant</h2>
        <p className="text-muted-foreground">
          Get expert SEO advice and submit requests through our AI assistant
        </p>
      </div>

      <Card className="flex flex-1 flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5" style={{ color: branding.primaryColor }} />
            <span>{branding.companyName} SEO Assistant</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                
                <div className={`flex-1 max-w-xs sm:max-w-md md:max-w-lg ${
                  message.sender === 'user' ? 'text-right' : ''
                }`}>
                  <div className={`rounded-lg px-4 py-2 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Request Button for Assistant Messages */}
                  {message.sender === 'assistant' && message.hasRequestButton && message.requestData && (
                    <div className="mt-3">
                      <Button
                        onClick={() => handleSubmitRequest(message.requestData!)}
                        disabled={submittingRequest === message.requestData.type}
                        className="text-xs px-3 py-1 h-auto"
                        variant="outline"
                      >
                        {submittingRequest === message.requestData.type ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Submit Request to SEO Team
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1 max-w-xs">
                  <div className="rounded-lg px-4 py-2 bg-muted">
                    <div className="flex items-center space-x-1">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Typing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length === 1 && (
            <div className="border-t border-border p-4 bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                Try asking:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputValue(question);
                      // Auto-send the question after a brief delay
                      setTimeout(() => {
                        handleSendMessage();
                      }, 100);
                    }}
                    className="text-left text-sm p-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-border p-4">
            <div className="flex space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about SEO..."
                className="flex-1"
                disabled={isTyping}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputValue.trim() || isTyping}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}