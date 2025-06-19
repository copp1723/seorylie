import { useEffect, useRef } from "react";
import { ChatMessage } from "./chat/ChatMessage";

interface EmbeddedChatProps {
  containerId?: string;
  autoOpen?: boolean;
}

export function EmbeddedChat({
  containerId = "rylie-chat",
  autoOpen = true,
}: EmbeddedChatProps) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoOpen && chatRef.current) {
      // Initialize chat here
      console.log("Chat initialized");
    }
  }, [autoOpen]);

  return (
    <div
      ref={chatRef}
      className="fixed bottom-4 right-4 w-[380px] bg-white rounded-lg shadow-lg"
    >
      <div className="p-4 border-b">
        <h3 className="font-medium">Chat with us</h3>
      </div>
      <div className="h-[400px] overflow-y-auto p-4">
        <ChatMessage
          message="Hi! How can I help you today?"
          isCustomer={false}
        />
      </div>
    </div>
  );
}
