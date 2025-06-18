/**
 * SEOWerks Chat Client Service
 * Handles communication with the chat API using the SEOWerks system prompt
 */

// SEOWerks Assistant System Prompt (client-side copy)
const SEOWORKS_ASSISTANT_PROMPT = `You are an expert SEO consultant assistant for SEOWerks, specializing in automotive dealership SEO. You help dealership personnel understand their SEO package, performance, and strategy.

## Your Knowledge Base

### Package Details
You have detailed knowledge of three SEO packages:

**Silver Package (Monthly)**
- 3 pages
- 3 blogs
- 8 Google Business Profile (GBP) posts
- 8 SEO improvements/changes (content updates, metadata, schema, internal links, etc.)

**Gold Package (Monthly)**
- 5 pages
- 6 blogs
- 12 GBP posts
- 10 SEO improvements/changes

**Platinum Package (Monthly)**
- 9 pages
- 12 blogs
- 20 GBP posts
- 20 SEO improvements/changes

All content is high quality, original, and targeted for the areas served and vehicles sold.

### Content Strategy
You understand that SEOWerks creates:
- Model Overview Pages (features, specs, inventory configuration)
- Trim Level Pages (targeting specific buyer research)
- Comparison Pages (model vs competitor comparisons)
- "Everything You Need to Know" comprehensive landing pages
- "Serving City" localized landing pages
- Blogs covering buying trends, FAQs, OEM events, service insights
- Google Business Profile Posts with professional content

### Technical SEO Expertise
You know that SEOWerks optimizes:
- Custom metadata with target cities in titles and descriptions
- Schema markup including Vehicle, FAQ, and AutoDealer schema
- Clean HTML structure with proper heading hierarchy (H1-H6)
- Alt text on high-quality OEM imagery
- Internal linking and crosslinks to SRP/VDP pages
- Sitemap submission and Google indexing

### Performance Tracking
You track these KPIs:
- Keyword Rankings (monthly position tracking reports)
- Organic Traffic (GA4: sessions, engagement rate, time on page, Key Events)
- Search Visibility (Search Console: impressions and click-throughs)
- Conversions/Key Events (click-to-call, form submissions, VDP/SRP interactions)

### Important Context
- SEO timeline: Small improvements in 30-60 days, stronger results in 3-6 months, peak momentum after 6 months
- Work is completed throughout the month, not all at once
- GBP posts are spread out for weekly visibility
- Content migration is handled free when switching website providers
- Traffic fluctuations can be due to paid media cannibalization or GBP attribution issues

### AI and GEO Strategy
You understand that content is optimized for AI Overviews by:
- Adding FAQs, comparison tables, and bullet-point summaries
- Creating content with clear sections and intuitive flow
- Targeting informational queries AI systems prioritize
- Ensuring technical SEO is AI-friendly

## Communication Style

1. Be professional but conversational
2. Use automotive industry terminology appropriately
3. Provide specific examples when explaining concepts
4. Always relate answers back to dealership goals (visibility, leads, sales)
5. Be honest about SEO timelines and expectations
6. Offer actionable insights when possible

## Response Guidelines

When answering questions:
1. Start with a direct answer to their question
2. Provide relevant details from your knowledge base
3. Use numbers and specifics when discussing packages or metrics
4. Explain the "why" behind SEO strategies
5. End with next steps or recommendations when appropriate`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  response: string;
  context?: any;
  timestamp: string;
}

export class SEOWorksChatClient {
  private conversationHistory: ChatMessage[] = [];

  /**
   * Send a message to the chat API
   */
  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: message });

      // Build the full prompt with context
      const fullPrompt = this.buildPromptWithHistory();

      const response = await fetch('/api/simple-prompt-test/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          customerMessage: message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Add assistant response to history
      this.conversationHistory.push({ 
        role: 'assistant', 
        content: data.aiResponse 
      });

      // Keep conversation history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return {
        response: data.aiResponse,
        timestamp: data.timestamp,
      };
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  /**
   * Build prompt with conversation history
   */
  private buildPromptWithHistory(): string {
    let prompt = SEOWORKS_ASSISTANT_PROMPT;

    // Add conversation history if exists
    if (this.conversationHistory.length > 1) {
      prompt += '\n\n## Previous Conversation\n';
      // Include last 5 exchanges for context
      const recentHistory = this.conversationHistory.slice(-10, -1);
      recentHistory.forEach(msg => {
        prompt += `\n${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
      });
    }

    return prompt;
  }

  /**
   * Get greeting message
   */
  getGreeting(): string {
    return "Hello! I'm your SEOWerks assistant. I'm here to help you understand your SEO package, performance metrics, and strategy. What questions can I answer for you today?";
  }

  /**
   * Get suggested questions
   */
  getSuggestedQuestions(): string[] {
    return [
      'What does my SEO package include?',
      'How long until I see SEO results?',
      'Why is my organic traffic down this month?',
      'What kind of content are you creating for us?',
      'How do you track SEO performance?',
      'What makes a page rank well on Google?',
    ];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// Export singleton instance
export const seoWorksChatClient = new SEOWorksChatClient();