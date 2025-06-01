// Re-export components from their organized directories

// Auth components
export { MagicLinkForm } from "./auth/magic-link-form";

// Chat components
export { default as ChatInterface } from "./chat-interface";
export { ChatMessage } from "./chat/ChatMessage";
export { default as ChatModeSettings } from "./chat/ChatModeSettings";

// Dashboard components
export { AIAnalyticsDashboard } from "./dashboard/AIAnalyticsDashboard";
export { ConversationLogs } from "./dashboard/ConversationLogs";

// Inventory components
export { VehicleCard } from "./inventory/VehicleCard";
export { VehicleList } from "./inventory/VehicleList";

// Form components
export { ContactForm } from "./forms/ContactForm";
