import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const dailies = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/dailies" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(20).max(300),
    date: z.coerce.date(),
    draft: z.boolean().default(true),
    sections: z.array(
      z.object({
        title: z.string().min(1),
        items: z.array(
          z.object({
            title: z.string().min(1),
            summary: z.string().min(20),
            whyItMatters: z.string().optional(),
            sourceName: z.string().min(1),
            sourceUrl: z.string().url(),
            tags: z.array(z.string()).default([]),
          }),
        ),
      }),
    ),
  }),
});

export const collections = { dailies };
