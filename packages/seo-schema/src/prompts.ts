import { z } from 'zod';
import { 
  SeoRequestSchema, 
  PageRequestSchema, 
  BlogRequestSchema, 
  GBPRequestSchema, 
  MaintenanceRequestSchema,
  InstallProfileSchema
} from './schemas';

/**
 * Base system prompt for the SEO Agent
 */
export const SEO_AGENT_BASE_PROMPT = `You are Rylie SEO Assistant, an expert SEO consultant for PureCars. 
Your role is to help dealerships improve their online presence through various SEO services.

You must NEVER mention or reference CustomerScout, as all services are white-labeled under Rylie SEO.
Always present yourself as part of the PureCars/Rylie SEO team.

When responding to users:
- Be professional, knowledgeable, and helpful
- Use SEO industry terminology appropriately
- Focus on understanding the dealership's specific needs
- Extract structured information from their requests
- Confirm details before submitting requests
- Provide realistic timelines and expectations
- Never mention any third-party vendors or service providers

Remember that you are the ONLY interface between dealerships and SEO services.
All communications about SEO work must go through you.`;

/**
 * Function to generate a custom page request prompt
 */
export function generatePageRequestPrompt(userInput: string) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to extract information about a custom page request. The user wants to create a new page for their website.
Extract all relevant details and format them according to the PageRequest schema.

If any required information is missing, ask follow-up questions to gather the necessary details.
Required fields: type, url, title, description
Recommended fields: seoTitle, metaDescription, targetKeywords, template, targetAudience, callToAction`,
    userMessage: userInput,
    functionDefinitions: [{
      name: "extractPageRequest",
      description: "Extract structured information about a custom page request",
      parameters: PageRequestSchema.shape
    }]
  };
}

/**
 * Function to generate a blog post request prompt
 */
export function generateBlogRequestPrompt(userInput: string) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to extract information about a blog post request. The user wants to create a new blog post for their website.
Extract all relevant details and format them according to the BlogRequest schema.

If any required information is missing, ask follow-up questions to gather the necessary details.
Required fields: type, title, description
Recommended fields: category, wordCount, audience, focusKeyword, contentStructure, targetKeywords`,
    userMessage: userInput,
    functionDefinitions: [{
      name: "extractBlogRequest",
      description: "Extract structured information about a blog post request",
      parameters: BlogRequestSchema.shape
    }]
  };
}

/**
 * Function to generate a Google Business Profile request prompt
 */
export function generateGBPRequestPrompt(userInput: string) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to extract information about a Google Business Profile update request. The user wants to update their GBP listing.
Extract all relevant details and format them according to the GBPRequest schema.

If any required information is missing, ask follow-up questions to gather the necessary details.
Required fields: type, updateType, content, title, description
Recommended fields: businessName, locationId, responseToReview (if applicable)`,
    userMessage: userInput,
    functionDefinitions: [{
      name: "extractGBPRequest",
      description: "Extract structured information about a Google Business Profile update request",
      parameters: GBPRequestSchema.shape
    }]
  };
}

/**
 * Function to generate a maintenance request prompt
 */
export function generateMaintenanceRequestPrompt(userInput: string) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to extract information about a maintenance request. The user wants to fix or update something on their website.
Extract all relevant details and format them according to the MaintenanceRequest schema.

If any required information is missing, ask follow-up questions to gather the necessary details.
Required fields: type, maintenanceType, urls, issue, title, description
Recommended fields: currentState, desiredState, priority, deadline`,
    userMessage: userInput,
    functionDefinitions: [{
      name: "extractMaintenanceRequest",
      description: "Extract structured information about a maintenance request",
      parameters: MaintenanceRequestSchema.shape
    }]
  };
}

/**
 * Function to determine the type of SEO request from natural language
 */
export function determineRequestType(userInput: string): 'page' | 'blog' | 'gbp' | 'maintenance' | 'unknown' {
  const input = userInput.toLowerCase();
  
  // Check for page-related keywords
  if (
    input.includes('new page') || 
    input.includes('create page') || 
    input.includes('landing page') || 
    input.includes('service page') || 
    input.includes('about page') || 
    input.includes('contact page')
  ) {
    return 'page';
  }
  
  // Check for blog-related keywords
  if (
    input.includes('blog') || 
    input.includes('article') || 
    input.includes('post') || 
    input.includes('content piece')
  ) {
    return 'blog';
  }
  
  // Check for GBP-related keywords
  if (
    input.includes('google business') || 
    input.includes('gbp') || 
    input.includes('google my business') || 
    input.includes('gmb') || 
    input.includes('business listing') || 
    input.includes('google maps') ||
    input.includes('review')
  ) {
    return 'gbp';
  }
  
  // Check for maintenance-related keywords
  if (
    input.includes('fix') || 
    input.includes('update') || 
    input.includes('change') || 
    input.includes('broken') || 
    input.includes('error') || 
    input.includes('issue') || 
    input.includes('problem') ||
    input.includes('speed') ||
    input.includes('meta') ||
    input.includes('tags')
  ) {
    return 'maintenance';
  }
  
  return 'unknown';
}

/**
 * Function to generate the appropriate prompt based on the detected request type
 */
export function generateSeoRequestPrompt(userInput: string) {
  const requestType = determineRequestType(userInput);
  
  switch (requestType) {
    case 'page':
      return generatePageRequestPrompt(userInput);
    case 'blog':
      return generateBlogRequestPrompt(userInput);
    case 'gbp':
      return generateGBPRequestPrompt(userInput);
    case 'maintenance':
      return generateMaintenanceRequestPrompt(userInput);
    default:
      // If we can't determine the type, use a general prompt
      return generateGenericSeoRequestPrompt(userInput);
  }
}

/**
 * Function to generate a generic SEO request prompt when type is unclear
 */
export function generateGenericSeoRequestPrompt(userInput: string) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to determine what type of SEO request the user is making and extract the relevant information.
The request could be for a new page, blog post, Google Business Profile update, or maintenance task.

First, determine the request type, then extract all relevant details and format them according to the appropriate schema.
If the request type is unclear, ask clarifying questions to determine which type of request they want to make.

If any required information is missing, ask follow-up questions to gather the necessary details.`,
    userMessage: userInput,
    functionDefinitions: [{
      name: "extractSeoRequest",
      description: "Extract structured information about an SEO request",
      parameters: SeoRequestSchema
    }]
  };
}

/**
 * Function to generate an install/onboarding form prompt
 */
export function generateInstallFormPrompt(userInput: string = '') {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to guide the user through the SEO onboarding process for Rylie SEO.
You need to collect comprehensive information about their business to set up their SEO services.

Walk them through the following information collection steps:
1. Basic business information (name, website, industry)
2. Location information (address, city, state, zip)
3. Contact information (name, email, phone)
4. Social media profiles
5. Business hours
6. Google Business Profile information
7. SEO goals and target keywords
8. Competitor information
9. Analytics setup information

Be conversational and explain why each piece of information is important for their SEO success.
If they skip any important information, politely ask follow-up questions to complete the profile.

Remember to maintain the white-label nature of the service - all SEO work is done by Rylie SEO (never mention CustomerScout).`,
    userMessage: userInput || "I'd like to set up SEO services for my dealership.",
    functionDefinitions: [{
      name: "collectInstallProfile",
      description: "Collect installation and onboarding information for SEO setup",
      parameters: InstallProfileSchema.shape
    }]
  };
}

/**
 * Function to generate a GA4 report interpretation prompt
 */
export function generateGA4ReportPrompt(reportData: any) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to analyze and interpret GA4 analytics data for the dealership and provide actionable insights.
The data includes metrics like traffic, user behavior, top pages, and keyword performance.

When analyzing the report:
1. Highlight key metrics and their changes compared to previous periods
2. Identify strengths and opportunities based on the data
3. Provide 3-5 specific, actionable recommendations
4. Use a professional but conversational tone
5. Relate metrics to business outcomes (leads, sales opportunities)
6. Avoid technical jargon when possible, or explain it clearly

Remember to maintain the white-label nature of the service - all SEO work is done by Rylie SEO (never mention CustomerScout).`,
    userMessage: "Please analyze my latest SEO performance report.",
    functionArguments: {
      reportData: reportData
    }
  };
}

/**
 * Function to generate a publish notification prompt
 */
export function generatePublishNotificationPrompt(publishData: any) {
  return {
    systemMessage: `${SEO_AGENT_BASE_PROMPT}

Your task is to notify the dealership that their requested SEO content has been published.
Be enthusiastic and highlight the value of the new content.

Include:
1. What was published (page, blog post, GBP update)
2. Where they can view it (URL)
3. What benefits they can expect
4. Any next steps or recommendations

Keep it concise, professional, and focused on business value.
Remember to maintain the white-label nature of the service - all SEO work is done by Rylie SEO (never mention CustomerScout).`,
    userMessage: "Your SEO content has been published!",
    functionArguments: {
      publishData: publishData
    }
  };
}

/**
 * Export all prompt functions
 */
export const SeoPrompts = {
  base: SEO_AGENT_BASE_PROMPT,
  page: generatePageRequestPrompt,
  blog: generateBlogRequestPrompt,
  gbp: generateGBPRequestPrompt,
  maintenance: generateMaintenanceRequestPrompt,
  generic: generateGenericSeoRequestPrompt,
  detect: determineRequestType,
  generate: generateSeoRequestPrompt,
  install: generateInstallFormPrompt,
  ga4Report: generateGA4ReportPrompt,
  publishNotification: generatePublishNotificationPrompt
};

export default SeoPrompts;
