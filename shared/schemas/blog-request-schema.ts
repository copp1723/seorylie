import { z } from "zod";

export const BlogRequestSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  keywords: z.string().min(1, "Keywords are required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  deadline: z.string().optional(),
  type: z.string().default("blog_post"),
  title: z.string().optional(),
  sandbox_id: z.string().optional(),
});

export type BlogRequest = z.infer<typeof BlogRequestSchema>;
