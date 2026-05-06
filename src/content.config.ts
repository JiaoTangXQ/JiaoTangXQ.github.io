import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      description: z.string().min(20).max(300),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      // 主题集群：定义文章归属的 4 个主题之一（第 5 个 notes 走副线）
      pillar: z
        .enum(["ai-coding", "agent", "llm-arch", "culture", "notes"])
        .optional(),
      // 文章档：A = 周深度长文（4000–7000 字 SEO 主力），B = 日常深度短文（1500–2500 字）
      tier: z.enum(["A", "B"]).default("A"),
      // 手动维护的相关文章 slug 列表，渲染在文章末尾的 "Related" 区块
      related: z.array(z.string()).default([]),
      // 系列文章：相同 series 标签的文章构成一个系列（≥3 篇时未来会出 UI）
      series: z.string().optional(),
      seriesOrder: z.number().int().positive().optional(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      draft: z.boolean().default(false),
      lang: z.enum(["zh", "en"]).default("zh"),
    }),
});

export const collections = { posts };
