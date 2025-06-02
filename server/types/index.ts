/**
 * Core type definitions for the Strands integration
 */

export enum AgentType {
  GENERAL = 'general-agent',
  INVENTORY = 'inventory-agent',
  FINANCE = 'finance-agent',
  SERVICE = 'service-agent',
  TRADE = 'trade-agent',
  SALES = 'sales-agent',
  CREDIT = 'credit-agent',
  LEASE = 'lease-agent'
}

export interface AgentResponse {
  success: boolean;
  response: string;
  selectedAgent?: string;
  reasoning?: string;
  processingTime?: number;
  conversationId?: string;
  confidence?: number;
  sentiment?: string;
  urgency?: string;
  priority?: string;
  escalated?: boolean;
  fallback?: boolean;
  error?: boolean;
  audioOutput?: {
    url?: string;
    data?: string;
    format?: 'mp3' | 'ogg' | 'pcm';
    tool_used?: 'speak_polly';
    text_spoken?: string;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface StrandsConfig {
  openAiApiKey?: string;
  anthropicApiKey?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  defaultModel?: string;
  enableVoice?: boolean;
  voiceProvider?: 'polly' | 'elevenlabs';
  dealershipId?: string;
  sandboxId?: string;
}

export interface StrandsToolConfig {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

export interface StrandsExecutorOptions {
  config: StrandsConfig;
  tools?: StrandsToolConfig[];
  systemPrompts?: Record<AgentType, string>;
  defaultAgentType?: AgentType;
}
