import { z } from "zod";

// Common Schemas
const nonEmptyString = z
  .string()
  .min(1, { message: "This field cannot be empty." });

// Page Request Schema
export const PageRequestSchema = z.object({
  type: z.literal("page"),
  title: nonEmptyString.describe("The main title of the new page."),
  purpose: nonEmptyString.describe("The primary goal or purpose of this page."),
  targetUrlSlug: z
    .string()
    .optional()
    .describe(
      "Suggested URL slug (e.g., /new-service-page). If empty, one will be generated.",
    ),
  seoTitle: z
    .string()
    .max(70, "SEO title should ideally be under 70 characters.")
    .optional()
    .describe("Custom title for search engine results pages (SERPs)."),
  metaDescription: z
    .string()
    .max(160, "Meta description should ideally be under 160 characters.")
    .optional()
    .describe("Custom description for SERPs."),
  targetKeywords: z
    .array(nonEmptyString)
    .optional()
    .describe("A list of keywords this page should target."),
  templatePreference: z
    .string()
    .optional()
    .describe(
      "Any preference for page layout or template (e.g., 'Standard Service Page', 'Visual Showcase').",
    ),
  targetAudience: z
    .string()
    .optional()
    .describe("Specific audience this page is intended for."),
  callToAction: z
    .string()
    .optional()
    .describe(
      "Desired call to action on the page (e.g., 'Request a Quote', 'Learn More').",
    ),
  keyInformation: z
    .string()
    .optional()
    .describe(
      "Key information, selling points, or specific content to include.",
    ),
  additionalNotes: z
    .string()
    .optional()
    .describe("Any other relevant information or specific instructions."),
});
export type PageRequest = z.infer<typeof PageRequestSchema>;

// Blog Request Schema
export const BlogRequestSchema = z.object({
  type: z.literal("blog"),
  topic: nonEmptyString.describe("The main topic or subject of the blog post."),
  contentType: z
    .enum([
      "article",
      "listicle",
      "howToGuide",
      "newsUpdate",
      "caseStudy",
      "interview",
      "productReview",
    ])
    .default("article")
    .describe("The format or style of the blog post."),
  suggestedTitle: z
    .string()
    .optional()
    .describe("A suggested title for the blog post."),
  mainKeywords: z
    .array(nonEmptyString)
    .min(1, "At least one main keyword is required.")
    .describe("Primary keywords the blog post should focus on."),
  secondaryKeywords: z
    .array(nonEmptyString)
    .optional()
    .describe("Secondary or related keywords."),
  targetAudience: z
    .string()
    .optional()
    .describe("Specific audience for this blog post."),
  desiredTone: z
    .string()
    .optional()
    .describe(
      "Preferred tone of voice (e.g., formal, informal, expert, humorous).",
    ),
  wordCount: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Approximate desired word count (e.g., 500, 1000, 1500)."),
  callToAction: z
    .string()
    .optional()
    .describe("Desired call to action at the end of the blog post."),
  references: z
    .array(z.string().url({ message: "Invalid URL format for reference." }))
    .optional()
    .describe("Links to reference materials, sources, or competitor articles."),
  internalLinks: z
    .array(z.string())
    .optional()
    .describe(
      "Suggestions for internal links to include within the content (e.g., other pages on the site).",
    ),
  additionalNotes: z
    .string()
    .optional()
    .describe("Any other relevant information or specific instructions."),
});
export type BlogRequest = z.infer<typeof BlogRequestSchema>;

// GBP Request Schema (simplified for now)
export const GBPRequestSchema = z.object({
  type: z.literal("gbp"),
  updateType: z.enum(["post", "infoUpdate", "qAndA", "reviewResponse"]),
  content: nonEmptyString,
  title: z.string().optional(),
  description: z.string().optional(),
});
export type GBPRequest = z.infer<typeof GBPRequestSchema>;

// Maintenance Request Schema
export const MaintenanceRequestSchema = z.object({
  type: z.literal("maintenance"),
  maintenanceType: z.enum([
    "contentUpdate",
    "technicalFix",
    "metaTagUpdate",
    "speedOptimization",
  ]),
  urls: z.array(z.string().url()),
  issue: nonEmptyString,
  title: nonEmptyString,
  description: nonEmptyString,
});
export type MaintenanceRequest = z.infer<typeof MaintenanceRequestSchema>;

// Install Profile Schema
export const InstallProfileSchema = z.object({
  type: z.literal("install"),
  businessName: nonEmptyString,
  websiteUrl: z.string().url(),
  email: z.string().email(),
  additionalNotes: z.string().optional(),
});
export type InstallProfile = z.infer<typeof InstallProfileSchema>;

// Main SEO Request Schema
export const SeoRequestSchema = z.discriminatedUnion("type", [
  PageRequestSchema,
  BlogRequestSchema,
  GBPRequestSchema,
  MaintenanceRequestSchema,
  InstallProfileSchema,
]);
export type SeoRequest = z.infer<typeof SeoRequestSchema>;

// GA4 Report Schema
export const GA4ReportSchema = z.object({
  reportName: z.string(),
  metrics: z.record(z.any()),
  dimensions: z.record(z.any()),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
});
export type GA4Report = z.infer<typeof GA4ReportSchema>;
