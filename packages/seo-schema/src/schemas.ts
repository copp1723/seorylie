import { z } from "zod";

/**
 * Common schema elements used across different SEO request types
 */
const commonFields = {
  title: z.string().min(3).max(100).describe("Title of the content"),
  description: z
    .string()
    .min(20)
    .max(2000)
    .describe("Detailed description of what is needed"),
  priority: z
    .enum(["low", "medium", "high"])
    .default("medium")
    .describe("Priority level for this request"),
  targetKeywords: z
    .array(z.string())
    .optional()
    .describe("Target keywords to focus on"),
  deadline: z
    .string()
    .optional()
    .describe("Requested completion date (YYYY-MM-DD)"),
  notes: z
    .string()
    .optional()
    .describe("Additional notes or special instructions"),
};

/**
 * Asset schema for files, images, and other resources
 */
export const AssetSchema = z.object({
  type: z
    .enum(["image", "document", "video", "link"])
    .describe("Type of asset"),
  url: z
    .string()
    .url()
    .optional()
    .describe("URL to the asset if already hosted"),
  name: z.string().optional().describe("Name of the asset"),
  description: z.string().optional().describe("Description of the asset"),
  contentType: z.string().optional().describe("MIME type of the asset"),
  size: z.number().optional().describe("Size of the asset in bytes"),
  s3Key: z
    .string()
    .optional()
    .describe("S3 key for assets stored in the neutral CDN"),
});

export type Asset = z.infer<typeof AssetSchema>;

/**
 * Schema for custom page requests
 */
export const PageRequestSchema = z.object({
  type: z.literal("page").describe("Request type: custom page"),
  url: z
    .string()
    .url()
    .or(z.string().regex(/^\/[\w\-\/]*$/))
    .describe("Target URL or path for the page"),
  template: z
    .enum(["landing", "about", "service", "contact", "custom"])
    .default("custom")
    .describe("Page template to use"),
  seoTitle: z
    .string()
    .max(60)
    .optional()
    .describe("SEO title tag (recommended: 50-60 characters)"),
  metaDescription: z
    .string()
    .max(160)
    .optional()
    .describe("Meta description (recommended: 150-160 characters)"),
  targetAudience: z
    .string()
    .optional()
    .describe("Target audience for this page"),
  callToAction: z
    .string()
    .optional()
    .describe("Primary call-to-action for the page"),
  assets: z
    .array(AssetSchema)
    .optional()
    .describe("Images, documents, or other assets for the page"),
  ...commonFields,
});

export type PageRequest = z.infer<typeof PageRequestSchema>;

/**
 * Schema for blog post requests
 */
export const BlogRequestSchema = z.object({
  type: z.literal("blog").describe("Request type: blog post"),
  category: z.string().optional().describe("Blog category"),
  wordCount: z
    .number()
    .min(300)
    .max(5000)
    .default(800)
    .describe("Target word count for the blog post"),
  audience: z
    .string()
    .optional()
    .describe("Target audience for this blog post"),
  focusKeyword: z.string().optional().describe("Primary keyword to focus on"),
  contentStructure: z
    .array(z.string())
    .optional()
    .describe("Suggested sections or structure for the blog post"),
  assets: z
    .array(AssetSchema)
    .optional()
    .describe("Images or other assets for the blog post"),
  ...commonFields,
});

export type BlogRequest = z.infer<typeof BlogRequestSchema>;

/**
 * Schema for Google Business Profile (GBP) requests
 */
export const GBPRequestSchema = z.object({
  type: z
    .literal("gbp")
    .describe("Request type: Google Business Profile update"),
  updateType: z
    .enum([
      "post",
      "hours",
      "photos",
      "services",
      "products",
      "attributes",
      "q_and_a",
      "reviews",
    ])
    .describe("Type of GBP update"),
  businessName: z
    .string()
    .optional()
    .describe("Business name if different from account name"),
  locationId: z
    .string()
    .optional()
    .describe("Location ID if multiple locations exist"),
  content: z.string().min(20).max(1500).describe("Content for the update"),
  assets: z
    .array(AssetSchema)
    .optional()
    .describe("Images or other assets for the GBP update"),
  responseToReview: z
    .object({
      reviewId: z.string(),
      rating: z.number().min(1).max(5),
      reviewContent: z.string(),
      responseContent: z.string().min(10).max(500),
    })
    .optional()
    .describe("Details for responding to a review"),
  ...commonFields,
});

export type GBPRequest = z.infer<typeof GBPRequestSchema>;

/**
 * Schema for maintenance requests
 */
export const MaintenanceRequestSchema = z.object({
  type: z.literal("maintenance").describe("Request type: maintenance task"),
  maintenanceType: z
    .enum([
      "broken_link",
      "content_update",
      "meta_tags",
      "schema_markup",
      "speed_optimization",
      "security",
      "analytics",
      "other",
    ])
    .describe("Type of maintenance task"),
  urls: z
    .array(z.string().url())
    .min(1)
    .describe("URLs affected by this maintenance task"),
  issue: z
    .string()
    .min(20)
    .describe("Description of the issue that needs maintenance"),
  currentState: z
    .string()
    .optional()
    .describe("Current state of the affected pages/elements"),
  desiredState: z
    .string()
    .optional()
    .describe("Desired state after maintenance"),
  assets: z
    .array(AssetSchema)
    .optional()
    .describe("Screenshots or other assets related to the issue"),
  ...commonFields,
});

export type MaintenanceRequest = z.infer<typeof MaintenanceRequestSchema>;

/**
 * Combined schema for all SEO request types
 */
export const SeoRequestSchema = z.discriminatedUnion("type", [
  PageRequestSchema,
  BlogRequestSchema,
  GBPRequestSchema,
  MaintenanceRequestSchema,
]);

export type SeoRequest = z.infer<typeof SeoRequestSchema>;

/**
 * Schema for the vendor response to SEO requests
 */
export const VendorResponseSchema = z.object({
  requestId: z.string().uuid().describe("ID of the original request"),
  status: z
    .enum(["received", "in_progress", "completed", "rejected", "needs_info"])
    .describe("Status of the request"),
  message: z.string().optional().describe("Message from the vendor"),
  completedUrl: z
    .string()
    .url()
    .optional()
    .describe("URL of the completed work"),
  completedAssets: z
    .array(AssetSchema)
    .optional()
    .describe("Assets produced by the vendor"),
  reportUrl: z.string().url().optional().describe("URL to the detailed report"),
  reportS3Key: z
    .string()
    .optional()
    .describe("S3 key for the transformed report"),
  completedDate: z
    .string()
    .optional()
    .describe("Date when the request was completed"),
  metrics: z
    .object({
      impressions: z.number().optional(),
      clicks: z.number().optional(),
      position: z.number().optional(),
      conversions: z.number().optional(),
    })
    .optional()
    .describe("Performance metrics if available"),
});

export type VendorResponse = z.infer<typeof VendorResponseSchema>;

/**
 * Schema for the installation/onboarding form
 */
export const InstallProfileSchema = z.object({
  businessName: z.string().min(2).max(100).describe("Business name"),
  website: z.string().url().describe("Business website URL"),
  industry: z.string().describe("Business industry"),
  primaryLocation: z
    .object({
      address: z.string(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      country: z.string().default("USA"),
    })
    .describe("Primary business location"),
  additionalLocations: z
    .array(
      z.object({
        address: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string().default("USA"),
      }),
    )
    .optional()
    .describe("Additional business locations"),
  contactPerson: z
    .object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
    })
    .describe("Primary contact person"),
  socialProfiles: z
    .object({
      facebook: z.string().url().optional(),
      twitter: z.string().url().optional(),
      instagram: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      youtube: z.string().url().optional(),
      pinterest: z.string().url().optional(),
    })
    .optional()
    .describe("Social media profiles"),
  businessHours: z
    .array(
      z.object({
        day: z.enum([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ]),
        open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        closed: z.boolean().default(false),
      }),
    )
    .optional()
    .describe("Business hours"),
  googleBusinessProfile: z
    .object({
      profileId: z.string().optional(),
      profileUrl: z.string().url().optional(),
      hasAccess: z.boolean().default(false),
    })
    .optional()
    .describe("Google Business Profile information"),
  seoGoals: z.array(z.string()).min(1).describe("SEO goals and objectives"),
  targetKeywords: z.array(z.string()).min(1).describe("Target keywords"),
  competitors: z.array(z.string()).optional().describe("Main competitors"),
  analyticsSetup: z
    .object({
      hasGoogleAnalytics: z.boolean().default(false),
      analyticsId: z.string().optional(),
      hasGoogleSearchConsole: z.boolean().default(false),
      searchConsoleVerified: z.boolean().default(false),
    })
    .describe("Analytics setup information"),
  additionalNotes: z
    .string()
    .optional()
    .describe("Additional notes or requirements"),
  sandbox_id: z.string().uuid().describe("Sandbox ID for tenant isolation"),
  created_at: z
    .date()
    .default(() => new Date())
    .describe("Creation timestamp"),
  updated_at: z
    .date()
    .default(() => new Date())
    .describe("Last update timestamp"),
});

export type InstallProfile = z.infer<typeof InstallProfileSchema>;

/**
 * Schema for GA4 report data
 */
export const GA4ReportSchema = z.object({
  period: z
    .object({
      startDate: z.string(),
      endDate: z.string(),
    })
    .describe("Reporting period"),
  metrics: z
    .object({
      users: z.number(),
      newUsers: z.number(),
      sessions: z.number(),
      bounceRate: z.number(),
      avgSessionDuration: z.number(),
      pageviews: z.number(),
      organicTraffic: z.number(),
      organicConversions: z.number().optional(),
    })
    .describe("Core metrics"),
  topPages: z
    .array(
      z.object({
        path: z.string(),
        pageviews: z.number(),
        avgTimeOnPage: z.number(),
        entrances: z.number(),
        bounceRate: z.number(),
      }),
    )
    .max(10)
    .describe("Top performing pages"),
  topKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      }),
    )
    .max(10)
    .optional()
    .describe("Top performing keywords"),
  deviceBreakdown: z
    .object({
      desktop: z.number(),
      mobile: z.number(),
      tablet: z.number(),
    })
    .describe("Traffic by device type"),
  sandbox_id: z.string().uuid().describe("Sandbox ID for tenant isolation"),
  created_at: z
    .date()
    .default(() => new Date())
    .describe("Report generation timestamp"),
});

export type GA4Report = z.infer<typeof GA4ReportSchema>;
