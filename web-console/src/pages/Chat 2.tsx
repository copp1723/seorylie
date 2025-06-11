import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useBranding } from "../contexts/BrandingContext";
import { useAuth } from "../contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean;
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const { user } = useAuth();

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

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate API call to your backend
    try {
      // Mock response - replace with actual API call
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: generateMockResponse(inputValue),
          sender: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);
      }, 1500);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const generateMockResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('keyword') || input.includes('seo')) {
      return "I can help you with keyword research and SEO optimization! Here are some suggestions:\n\n1. **Keyword Research**: I can analyze your target keywords and suggest improvements\n2. **On-page SEO**: Let's optimize your title tags, meta descriptions, and content\n3. **Technical SEO**: I can help identify technical issues affecting your rankings\n\nWhat specific area would you like to focus on?";
    }
    
    if (input.includes('content') || input.includes('blog')) {
      return "Content is crucial for SEO success! I can help you:\n\n• **Blog Strategy**: Develop a content calendar targeting your keywords\n• **Content Optimization**: Improve existing content for better rankings\n• **Topic Research**: Find trending topics in your industry\n• **Content Audits**: Analyze your current content performance\n\nWould you like me to create a content request for you?";
    }
    
    if (input.includes('page') || input.includes('landing')) {
      return "Creating optimized pages is essential for SEO! I can assist with:\n\n• **Landing Page Creation**: Build pages that convert and rank\n• **Page Structure**: Optimize your information architecture\n• **Internal Linking**: Improve your site's link structure\n• **User Experience**: Enhance page speed and usability\n\nShall I help you create a new page request?";
    }
    
    return `I understand you're asking about "${userInput}". As your SEO assistant, I can help with various tasks including:\n\n• **Content Creation**: Blog posts, landing pages, and copy\n• **Technical SEO**: Site audits, speed optimization, and fixes\n• **Keyword Research**: Finding the right terms to target\n• **Analytics**: Understanding your SEO performance\n\nWhat specific SEO challenge can I help you solve today?`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "How can I improve my website's SEO?",
    "Create a blog post about local SEO",
    "Audit my website's technical SEO",
    "Help me with keyword research"
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
                    onClick={() => setInputValue(question)}
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