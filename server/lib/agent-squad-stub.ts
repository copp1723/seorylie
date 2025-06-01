/**
 * Agent Squad Stub Implementation
 * 
 * This is a minimal stub implementation of the agent-squad package
 * to allow the server to run without the external dependency.
 * 
 * TODO: Replace with actual agent-squad package when available
 */

export interface ConversationMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface RetrievalResult {
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  name: string;
  description?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export class Retriever {
  constructor(private config?: { apiKey?: string; model?: string }) {}

  async retrieve(query: string, options?: { limit?: number }): Promise<RetrievalResult[]> {
    // Stub implementation - returns empty results
    console.log(`[Agent Squad Stub] Retriever.retrieve called with query: ${query}`);
    return [];
  }

  async addDocument(content: string, metadata?: Record<string, any>): Promise<void> {
    // Stub implementation
    console.log(`[Agent Squad Stub] Retriever.addDocument called`);
  }
}

export class InMemoryChatStorage {
  private messages: ConversationMessage[] = [];

  constructor() {}

  async addMessage(message: ConversationMessage): Promise<void> {
    this.messages.push({
      ...message,
      id: message.id || Math.random().toString(36).substring(7),
      timestamp: message.timestamp || new Date()
    });
  }

  async getMessages(limit?: number): Promise<ConversationMessage[]> {
    return limit ? this.messages.slice(-limit) : this.messages;
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}

export class OpenAIClassifier {
  constructor(private config: { apiKey: string; model?: string }) {}

  async classify(text: string, categories: string[]): Promise<{ category: string; confidence: number }> {
    // Stub implementation - returns first category with low confidence
    console.log(`[Agent Squad Stub] OpenAIClassifier.classify called for text: ${text.substring(0, 50)}...`);
    return {
      category: categories[0] || 'unknown',
      confidence: 0.5
    };
  }
}

export class OpenAIAgent {
  constructor(private config: AgentConfig & { apiKey: string; model?: string }) {}

  async generateResponse(
    messages: ConversationMessage[], 
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    // Stub implementation - returns a placeholder response
    console.log(`[Agent Squad Stub] OpenAIAgent.generateResponse called for ${this.config.name}`);
    return `This is a stub response from ${this.config.name}. The actual agent implementation is not available.`;
  }

  async chat(message: string, context?: ConversationMessage[]): Promise<string> {
    console.log(`[Agent Squad Stub] OpenAIAgent.chat called for ${this.config.name}`);
    return this.generateResponse([
      ...(context || []),
      { role: 'user', content: message }
    ]);
  }
}

export class AgentSquad {
  private agents: Map<string, OpenAIAgent> = new Map();
  private storage: InMemoryChatStorage;
  private classifier?: OpenAIClassifier;

  constructor(private config: { apiKey: string; model?: string }) {
    this.storage = new InMemoryChatStorage();
  }

  addAgent(name: string, agent: OpenAIAgent): void {
    this.agents.set(name, agent);
    console.log(`[Agent Squad Stub] Added agent: ${name}`);
  }

  setClassifier(classifier: OpenAIClassifier): void {
    this.classifier = classifier;
    console.log(`[Agent Squad Stub] Classifier set`);
  }

  async routeMessage(message: string, context?: ConversationMessage[]): Promise<{
    agent: string;
    response: string;
    confidence: number;
  }> {
    console.log(`[Agent Squad Stub] AgentSquad.routeMessage called`);
    
    // Simple routing - use first available agent
    const agentNames = Array.from(this.agents.keys());
    const selectedAgent = agentNames[0] || 'default';
    
    let response = 'No agents available';
    if (this.agents.has(selectedAgent)) {
      response = await this.agents.get(selectedAgent)!.chat(message, context);
    }

    return {
      agent: selectedAgent,
      response,
      confidence: 0.8
    };
  }

  async chat(message: string, options?: { agentName?: string }): Promise<string> {
    console.log(`[Agent Squad Stub] AgentSquad.chat called`);
    
    if (options?.agentName && this.agents.has(options.agentName)) {
      return await this.agents.get(options.agentName)!.chat(message);
    }

    const result = await this.routeMessage(message);
    return result.response;
  }

  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getStorage(): InMemoryChatStorage {
    return this.storage;
  }
}

// Default exports for compatibility
export default {
  AgentSquad,
  OpenAIAgent,
  OpenAIClassifier,
  InMemoryChatStorage,
  Retriever
};