// Re-export enhanced AI service for backward compatibility
export {
  EnhancedAIService,
  aiService,
  enhancedAIService,
} from "./enhanced-ai-service";
export type { AIResponse, AIServiceOptions } from "./enhanced-ai-service";
export default aiService;
