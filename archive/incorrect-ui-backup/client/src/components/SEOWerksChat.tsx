// File: /client/src/components/SEOWerksChat.tsx
// Purpose: A React component for the chat interface in the RylieSEO platform, integrated with OpenRouter API via backend.
// Displays dynamic task creation buttons when AI detects task intent, enhancing user experience for SEO Q&A and task initiation.
// Deployment Note for Render: Ensure this component is part of your React build with Vite. Render will bundle this automatically.
// If backend API is hosted on a separate Render service, update fetch URLs with the correct domain (e.g., use environment variable for API base URL).
// Ensure Tailwind CSS is configured in your project for styling as used below.

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: string; // 'user' or 'assistant'
  content: string;
}

const SEOWerksChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [taskSuggestion, setTaskSuggestion] = useState(false);
  const [taskOptions, setTaskOptions] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Send user message to backend API (which proxies to OpenRouter)
  const sendMessage = async () => {
    if (!input.trim() || isSending) return;

    setIsSending(true);
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      setTaskSuggestion(data.taskSuggestion || false);
      setTaskOptions(data.taskOptions || []);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Could not get response. Please try again.' }]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle task creation form opening (placeholder for modal or navigation)
  const openTaskForm = (taskType: string) => {
    // Implement logic to open a modal or navigate to a task creation form
    // For now, log the action and hide the suggestion
    console.log(`Opening task creation form for: ${taskType}`);
    setTaskSuggestion(false); // Hide buttons after selection
    
    // Example navigation (uncomment and adjust based on your routing setup with Wouter):
    // import { useRouter } from 'wouter';
    // const router = useRouter();
    // router.push(`/tasks/create?type=${taskType}`);
    
    // Alternatively, trigger a modal opening with taskType passed as prop
    alert(`Task creation for ${taskType} initiated. Form integration pending.`);
  };

  return (
    <div className="flex flex-col h-full w-full p-4 bg-gray-100 rounded-lg shadow-md max-h-[80vh]">
      {/* Chat messages container with auto-scroll */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 bg-white rounded-md border border-gray-200 mb-3"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            Welcome to RylieSEO Chat! Ask me anything about SEO or request a task.
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span 
                className={`inline-block p-2 rounded-lg text-sm ${
                  msg.role === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))
        )}
        {/* Display task creation suggestion buttons if triggered by AI */}
        {taskSuggestion && (
          <div className="mt-2 p-2 bg-yellow-50 rounded-md border border-yellow-200">
            <p className="mb-2 text-sm font-medium text-yellow-800">Ready to create a task? Choose an option:</p>
            <div className="flex flex-wrap gap-2">
              {taskOptions.map(option => (
                <button
                  key={option}
                  onClick={() => openTaskForm(option)}
                  className="px-3 py-1 text-white rounded text-sm hover:brightness-90 transition-all"
                  style={{ 
                    backgroundColor: option === 'landing_page' ? '#3b82f6' : option === 'blog_post' ? '#10b981' : '#8b5cf6' 
                  }}
                >
                  {option === 'landing_page' ? '📄 Landing Page' : option === 'blog_post' ? '✍️ Blog Post' : '📍 GBP Post'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Input area for sending messages */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Ask about SEO or request a task..."
          disabled={isSending}
        />
        <button
          onClick={sendMessage}
          disabled={isSending}
          className={`px-4 py-2 text-white rounded-md ${
            isSending ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default SEOWerksChat;