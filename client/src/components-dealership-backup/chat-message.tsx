import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BotIcon, UserIcon } from "lucide-react";

interface ChatMessageProps {
  message: string;
  isCustomer: boolean;
}

interface FormattedMessage {
  paragraphs: string[];
}

export function ChatMessage({ message, isCustomer }: ChatMessageProps) {
  // Process the message to extract and format URLs nicely
  const formatMessage = (text: string): FormattedMessage => {
    if (isCustomer) return { paragraphs: [text] }; // Only process AI responses

    // Process markdown-style links
    const processMarkdownLinks = (inputText: string): string => {
      // Replace markdown-style links [text](url) with just the URL
      const markdownLinkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
      return inputText.replace(markdownLinkRegex, (_, linkText, url) => {
        return `${linkText} (${url})`;
      });
    };

    // Find and process descriptive URLs to make them cleaner
    const processDescriptiveUrls = (inputText: string): string => {
      // Replace text like "Trade-In Valuation Tool: URL" with just the URL
      const labeledUrlRegex =
        /(.*?)(?:trade-in valuation tool|trade-in tool|finance application|finance app|application):\s*(https?:\/\/[^\s]+)/gi;
      return inputText.replace(labeledUrlRegex, (_, prefix, url) => {
        return `${prefix.trim()} ${url}`;
      });
    };

    // Process the text to clean it up
    let processedText = text;
    processedText = processMarkdownLinks(processedText);
    processedText = processDescriptiveUrls(processedText);

    // Split text by paragraph breaks and clean each paragraph
    const paragraphs = processedText.split("\n\n");
    const formattedParagraphs = paragraphs
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    // Return paragraphs for rendering
    return {
      paragraphs: formattedParagraphs,
    };
  };

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isCustomer ? "bg-muted justify-start" : "bg-primary/10 justify-start",
      )}
    >
      <Avatar
        className={cn("h-8 w-8", isCustomer ? "bg-secondary" : "bg-primary")}
      >
        {isCustomer ? (
          <UserIcon className="h-4 w-4 text-secondary-foreground" />
        ) : (
          <BotIcon className="h-4 w-4 text-primary-foreground" />
        )}
        <AvatarFallback>{isCustomer ? "C" : "AI"}</AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">
          {isCustomer ? "Customer" : "Rylie AI"}
        </p>

        {isCustomer ? (
          <div className="whitespace-pre-wrap text-sm">{message}</div>
        ) : (
          <div className="text-sm space-y-4 whitespace-pre-line">
            {formatMessage(message).paragraphs.map(
              (paragraph: string, i: number) => (
                <p key={i} className="leading-relaxed">
                  {paragraph}
                </p>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
