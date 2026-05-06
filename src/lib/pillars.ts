/**
 * 焦糖星球的 4 个主题 hub。每个 pillar 对应：
 *   - 一个 hub 页（/topics/{slug}/）
 *   - 一组 cornerstone + cluster 文章
 *   - SEO topical authority 的支柱
 *
 * 第 5 个 pillar "notes" 是副线（阅读 / 思考方法），不开 hub 页。
 */

export type PillarSlug = "ai-coding" | "agent" | "llm-arch" | "culture" | "notes";

export type PillarMeta = {
  slug: PillarSlug;
  /** hub 页 H1 + 全站显示用 */
  title: string;
  /** hub 页 H1 下方的 lede（一句话定位） */
  lede: string;
  /** hub 页正文段落（2-3 句话，SEO + 读者引导） */
  intro: string;
  /** SEO 用 description / OG */
  seoDescription: string;
};

export const PILLARS: Record<PillarSlug, PillarMeta> = {
  "ai-coding": {
    slug: "ai-coding",
    title: "AI 辅助开发",
    lede: "Claude Code、Cursor、subagent 工作流——把 AI 装进真实工程现场。",
    intro:
      "这一组文章关心一个具体问题：AI 编程工具进入工程师日常之后，工作流到底应该怎么变。我们记录真实项目里 Claude Code、Cursor、Codex CLI 的用法，subagent 协作模式，以及那些被官方文档跳过的边角问题。",
    seoDescription:
      "AI 辅助开发实战：Claude Code 实战、Cursor 用法、subagent 工程模式、AI 编程工作流的真实经验。",
  },
  agent: {
    slug: "agent",
    title: "AI Agent 工程",
    lede: "tool use、planning、记忆、评估——把 agent 从 demo 推进到生产。",
    intro:
      "Agent 在 demo 视频里很惊艳，跑到生产里立刻原形毕露。这组文章只关心工程问题：tool use 怎么设计、planning 在什么情况下崩盘、记忆机制如何选择、agent 评估怎么做、failure mode 长什么样。",
    seoDescription:
      "AI Agent 工程实战：agent 评估方法、tool use 设计、planning 崩盘分析、记忆机制选型、生产级 agent 架构。",
  },
  "llm-arch": {
    slug: "llm-arch",
    title: "LLM 应用架构",
    lede: "prompt cache、上下文工程、多 model 路由、token 成本——撑起一个真实 LLM 产品的工程脊柱。",
    intro:
      "把一个 LLM 应用做出来不难，把它做得稳、做得便宜、做得可观测才是工程问题。这组文章覆盖 prompt cache 命中率、上下文工程、多模型路由策略、token 成本控制、RAG 生产级架构这些工程脊柱层面的话题。",
    seoDescription:
      "LLM 应用架构实战：prompt cache 优化、上下文工程、多模型路由、token 成本控制、生产级 RAG 架构。",
  },
  culture: {
    slug: "culture",
    title: "AI 时代的工程文化",
    lede: "code review、技术决策、工程师定位——AI 介入之后，工作的形态在悄悄变。",
    intro:
      "工具改变之后，工程师的工作方式也在变。这组文章不写教程，写判断：AI 介入下的 code review 该怎么做、技术决策的尺度怎么调、code ownership 还成立吗、初级工程师的成长路径是什么。",
    seoDescription:
      "AI 时代的工程文化思考：code review 实践、技术决策方法、code ownership、工程师成长路径。",
  },
  notes: {
    slug: "notes",
    title: "副线：阅读 · 思考方法",
    lede: "主线之外偶尔出现的笔记。",
    intro: "工程之外的偶发记录。频率低，密度高，不超过站内总量 1/4。",
    seoDescription: "焦糖的阅读笔记与思考方法。",
  },
};

/**
 * 4 个有 hub 页的 pillar（不含 notes 副线）。
 */
export const HUB_PILLARS: PillarSlug[] = ["ai-coding", "agent", "llm-arch", "culture"];
