# 焦糖星球 — Claude Code 项目上下文（v0.3 constitution）

## 这个站是什么

**焦糖星球 = 中文圈关于「AI 时代工程实践」最值得读的写作站。**

- 形态：**单作者 publication**（不是个人博客，也不是多作者平台）。作者只有一个人——焦糖。但站的身份服从主题，不服从作者。
- 部署：GitHub Pages（https://jiaotangxq.github.io）
- 核心规则：**要么把一件事讲透，要么不写。** 不转载、不聚合、不写日记式快讯。

**最高优先级：流量为王。** 所有架构 / 内容 / 功能决策都服从这一目标 —— SEO 可索引、内容深度足够、topical authority 集中、转化路径通畅。

## 主题定位（钉死 12 个月）

> 焦糖星球只写 **AI 时代的工程实践**。围绕 4 个主题展开：

| Pillar | hub URL | 内容范围 |
|---|---|---|
| **AI 辅助开发** (`ai-coding`) | `/topics/ai-coding/` | Claude Code、Cursor、Codex CLI、subagent 工作流、AI 编程实战 |
| **AI Agent 工程** (`agent`) | `/topics/agent/` | tool use、planning、记忆、agent 评估、failure modes |
| **LLM 应用架构** (`llm-arch`) | `/topics/llm-arch/` | prompt cache、上下文工程、多 model 路由、token 成本、生产级 RAG |
| **AI 时代工程文化** (`culture`) | `/topics/culture/` | code review、技术决策、code ownership、工程师定位 |

**第 5 个 pillar `notes`（副线 = 阅读 / 思考方法）**：偶发出现，不开 hub 页，**不超过站内总量 1/4**。

主题外的写作冲动一律砍，包括但不限于：日记式快讯、随想、读后感（除非直接关联 AI 工程）、产品评论、生活感悟、不在 4 主题内的工程文章。

## 节奏（钉死 12 个月）

**分 tier 日更**：

- **A 类**：每周 1–2 篇，4000–7000 字深度长文。**SEO 主力 + 对读者的承诺**。默认工作日为周二 / 周四。
- **B 类**：其余天发 1500–2500 字深度短文。topical density + bonus，**不是承诺**。
- **A 类是欠债，B 类是惯性。** 某周 A 类没写完 → 砍掉那周所有 B 类，只发 A 类。

**6 个月不允许怀疑、不允许换打法。** 中文 SEO 起势最短周期 6–12 个月。

## 12 个月起步关键词清单（cornerstone + cluster）

每篇文章应优先打这个清单上的关键词，从 P0 开始排队：

| # | 关键词 | Pillar | 文体 | 优先级 |
|---|---|---|---|---|
| 1 | **Claude Code 实战 / 教程** | ai-coding | A 类 cornerstone (8000+) | **P0 第 1 篇** |
| 2 | Cursor vs Claude Code 实战对比 | ai-coding | A 类 cluster | P0 |
| 3 | Subagent 工程模式（多 agent 协作） | ai-coding | A 类 cluster | P0 |
| 4 | AI Agent 评估方法（agent eval） | agent | A 类 cornerstone | P1 |
| 5 | AI Agent tool use 实战 | agent | A 类 cluster | P1 |
| 6 | AI Agent failure modes 分析 | agent | A 类 cluster | P1 |
| 7 | Prompt cache 原理与优化 | llm-arch | A 类 cluster | P2 |
| 8 | Context engineering 实战 | llm-arch | A 类 cluster | P2 |
| 9 | LLM 应用 token 成本优化 | llm-arch | A 类 cluster | P2 |
| 10 | RAG 生产级架构 | llm-arch | A 类 cornerstone | P2 |
| 11 | AI 辅助开发的工程范式（思想长文） | culture | A 类 cornerstone | P3 |
| 12 | AI 时代的 code review | culture | A 类 cluster | P3 |

## 北极星指标 + 12 个月里程碑

> **北极星 = 邮件订阅数**（Buttondown 后台）。这是唯一直接拥有、抗平台风险的 audience asset。

| 时间点 | MAU | 邮件订阅 | X 关注 | 文章存量 |
|---|---|---|---|---|
| 第 3 月底（基建期末） | 200 | 30 | 200 | ~25 篇 |
| 第 6 月底（起势期末） | 1,000 | 100 | 600 | ~50 篇 |
| 第 12 月底（飞轮期末） | 5,000 | 500 | 2,000 | ~120 篇 |

辅助监控：Plausible MAU、GSC 上 Top 12 关键词位次、X analytics、Buttondown 订阅数。

**退出条款**：
- 第 6 月末数据 < 目标 30%（< 300 MAU）→ 调整关键词组合 + 强化分发
- 第 12 月末数据 < 目标 20%（< 1k MAU）→ 允许重新评估打法
- 任何时间点超出目标 → 不庆祝、不加节奏，按计划走

## 分发协议（每篇必做）

**A. 每篇发完必做（10–15 分钟）**：
1. **X thread**（@leadbelief）— 7–15 tweets 拆核心论点 + 末 tweet 放原文链接
2. **2 条内链** — 这篇 link 到 2 篇老文；如合适回去把 1 篇老文加 link 指向新文
3. **更新对应 hub 页**（pillar 字段会自动让文章出现在 hub）

**B. 每周 30 分钟**：
1. 知乎答题 1 篇，结尾"完整版原文：[链接]"
2. Search Console 检查本周文章 impression / 位次
3. X 上 reply / quote 1–2 条 AI 工程同行（Eugene Yan、Simon Willison、Hamel Husain、idoubi、karminski 等）

**C. 每月 1 小时**：
1. 选 1 篇 3 个月前老文 update（修错 / 补案例 / 改 `updated` 字段）
2. GitHub 相关 repo（anthropic-cookbook、langchain 等）有价值评论 + 链接
3. 12 关键词复盘：已写几个、ranking 怎样、要不要补 cluster

## 不做清单（明确砍掉）

- ❌ **评论系统** — 强制走 X reply (@leadbelief) 作为唯一互动入口
- ❌ **多语言 / 英文版** — 12 月后再评估
- ❌ **付费内容 / 会员** — 12 月内不做
- ❌ **微信公众号** — 6 月后再评估
- ❌ **Webmention / IndieWeb / PWA** — 零 ROI
- ❌ **Cosmos `/universe` 重启** — 永封存
- ❌ **多作者后台 / SaaS 化** — 不是产品方向
- ❌ **dev.to / medium 镜像** — 稀释 SEO
- ❌ **小红书 / 抖音 分发** — 风格不匹配
- ❌ **即刻** — 6 月后再评估

## 写作守则

新增文章必须满足：

1. **不转载。** 引用他人观点要做评论、对比或综述，不能整段复制。
2. **要么把一件事讲透，要么不写。** 频率不承诺，宁缺毋滥。
3. **不写日记式快讯 / 随想 / "今天读了什么"。** 每篇都要有一个明确的命题。
4. **必须在 4 个 pillar（或 notes 副线）之内。** 主题外冲动一律砍。
5. **frontmatter 必填 `pillar` 字段**（除非是 notes 副线或 meta 类公告）。`tier` 默认 A，B 类要显式标。
6. **`description` 字段必须自己写好。** 这是 meta description + OG + RSS 摘要的唯一来源，是潜在读者点不点开的决定性 1.5 秒。
7. **draft: true 用于工作中草稿。** 草稿 URL 仍可访问，但不进列表 / RSS / sitemap。

## 技术栈

- **Astro 5**（核心，静态优先、零 JS 默认）
- **MDX**（文章撰写）
- **React 19**（仅作 island，目前未使用）
- **Tailwind CSS 4**（@tailwindcss/vite 插件）
- **TypeScript**（严格模式）
- **@astrojs/sitemap、@astrojs/rss**（SEO 一等公民）
- **rehype-slug + rehype-autolink-headings**（标题锚点）
- **shiki**（代码高亮，github-light-default 主题）
- **reading-time**（阅读时长估算，wordsPerMinute: 300 适配中文）
- **satori + @resvg/resvg-js**（per-post OG 图，按字符动态加载 fontsource 子集）
- **Pagefind v1.5**（站内搜索，构建期索引）
- **Plausible**（数据分析，env: `PUBLIC_PLAUSIBLE_DOMAIN`）
- **Buttondown**（邮件 newsletter，env: `PUBLIC_BUTTONDOWN_USERNAME = JiaoTangXQ`）

## 架构

```
src/
├── content.config.ts            # Astro Content Collections schema (含 tier、pillar)
├── content/
│   └── posts/*.mdx              # 原创文章 MDX 源
├── layouts/
│   ├── Base.astro               # HTML 头骨架，只接受 seo: SeoData
│   └── Article.astro            # 文章页布局（接受 view: PostView）
├── components/
│   ├── SiteHeader.astro         # 顶部导航
│   ├── SiteFooter.astro         # 页脚（含 4 hub 链接 + X / GitHub / RSS）
│   ├── PostCard.astro           # 列表卡片
│   ├── ArticleTOC.astro         # 文章 TOC（h2/h3）
│   ├── ReadingProgress.astro    # 阅读进度条
│   ├── SearchModal.astro        # ⌘K 搜索（Pagefind）
│   ├── SubscribeForm.astro      # Buttondown 订阅表单
│   └── AuthorCard.astro         # 文章末尾作者卡片
├── pages/
│   ├── index.astro              # 文章列表（SSG）
│   ├── posts/[...slug].astro    # 文章详情（SSG）
│   ├── topics/[pillar]/         # 4 个主题 hub 页（topical authority 脊梁）
│   ├── about.astro              # 关于页
│   ├── universe.astro           # cosmos 归档说明（noindex）
│   ├── 404.astro                # 404 页
│   ├── rss.xml.ts               # RSS feed（已发布文章）
│   └── og/[slug].png.ts         # per-post OG 图
├── lib/
│   ├── posts.ts                 # 领域查询：getPublishedPosts / getAllPostsForBuild
│   ├── post-view.ts             # 文章衍生数据：buildPostView / postSummary
│   ├── seo.ts                   # SEO 数据：seoForPost / seoForPage
│   ├── pillars.ts               # 4 个主题 hub 元数据
│   ├── og.ts                    # OG 图生成（satori + resvg）
│   └── format.ts                # 日期格式化、阅读时长估算
└── styles/
    └── global.css               # editorial 设计系统（tokens + 全部组件样式 + .prose）

legacy/                          # v0.1 cosmos 时期所有代码归档（不参与构建）
```

## 内容数据模型

```ts
// src/content.config.ts
{
  title: string;            // 必填
  subtitle?: string;        // 可选副标题（斜体衬线渲染）
  description: string;      // 20–300 字。meta description + OG + RSS 摘要
  date: Date;               // 发布日期
  updated?: Date;           // 更新日期
  tags: string[];           // 标签
  pillar?: "ai-coding" | "agent" | "llm-arch" | "culture" | "notes";
  tier: "A" | "B";          // 默认 A。A=周长文，B=日短文
  cover?: ImageMetadata;    // 封面图（暂未接通到 OG，TODO P1）
  coverAlt?: string;
  draft: boolean;           // 默认 false
  lang: "zh" | "en";        // 默认 zh
}
```

新增文章：在 `src/content/posts/` 放一个 `.mdx`，文件名（不含扩展名）= slug，URL 为 `/posts/{slug}`。

## 常用命令

```bash
npm run dev       # Astro 开发服务器（默认 4321 端口）
npm run build     # astro check + astro build + pagefind 索引
npm run preview   # 预览生产构建
```

## 部署

```bash
git push origin master
```

GitHub Actions 自动 build + deploy。Pages Source 必须设为 **GitHub Actions**。

部署期 env 通过 GitHub repo Settings → Secrets and variables → Actions → **Variables**：
- `PUBLIC_PLAUSIBLE_DOMAIN` — Plausible 数据分析（可选）
- `PUBLIC_BUTTONDOWN_USERNAME = JiaoTangXQ` — 邮件 newsletter（必填）

## 协作偏好

- 流量为王，每个决策都问"这件事有助于流量吗"
- 快速执行，少问多做。需求清晰时直接写代码
- 只在真正影响架构的决策点停下来确认
- 中文沟通
- 对视觉品质要求极高，不接受"能用就行"的实现
- 拒绝转载、聚合、AI 改写外部内容 —— 只做原创
- 拒绝主题外的内容 —— 4 个 pillar 之外不写
