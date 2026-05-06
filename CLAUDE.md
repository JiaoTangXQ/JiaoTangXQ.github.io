# 焦糖星球 — Claude Code 项目上下文

## 项目是什么

焦糖星球是焦糖的个人原创写作站，部署在 GitHub Pages（https://jiaotangxq.github.io）。

**核心定位**：只发原创长文。不转载、不聚合外部文章。一条规则 —— 要么把一件事讲透，要么不写。

**最高优先级**：流量为王。所有架构决策都服从这个目标 —— SEO 可索引、原创内容、作者身份、分发可达。

风格：editorial 杂志风。单栏正文、宋体标题、克制的排版纪律、把文字本身放在 C 位。

## 历史背景

v0.1（2025 - 2026.04）是一个 GPU 渲染的"思想宇宙"画布，每篇文章是一颗发光行星。视觉很强但有结构性问题：

1. 全 SPA 渲染，HTML 几乎为空（1.5KB），搜索引擎不可索引
2. 没有原创内容，靠外部 RSS 聚合凑数
3. sitemap 只收首页一条 URL
4. 流量几乎为 0

2026.05.01 重启为当前形态。旧版本完整封存在 git tag `v0.1-cosmos-archive`，源码归档在仓库根 `legacy/` 目录。详见 `src/content/posts/site-relaunch.mdx`。

## 技术栈

- **Astro 5**（核心，静态优先、零 JS 默认）
- **MDX**（文章撰写）
- **React 19**（仅作为 island，目前未使用）
- **Tailwind CSS 4**（@tailwindcss/vite 插件）
- **TypeScript**（严格模式，astro/tsconfigs/strict）
- **@astrojs/sitemap、@astrojs/rss**（SEO 一等公民）
- **rehype-slug + rehype-autolink-headings**（标题锚点）
- **shiki**（代码高亮，github-light-default 主题）
- **reading-time**（阅读时长估算，wordsPerMinute: 300 适配中文）

## 架构

```
src/
├── content.config.ts            # Astro Content Collections schema
├── content/
│   └── posts/*.mdx              # 原创文章 MDX 源
├── layouts/
│   ├── Base.astro               # HTML 头 + 全部 SEO meta（OG、Twitter、JSON-LD 占位）
│   └── Article.astro            # 文章页布局 + JSON-LD Article schema
├── components/
│   ├── SiteHeader.astro         # 顶部导航
│   ├── SiteFooter.astro         # 页脚（含 RSS、关于、彩蛋链接）
│   └── PostCard.astro           # 列表卡片
├── pages/
│   ├── index.astro              # 文章列表（SSG）
│   ├── posts/[...slug].astro    # 文章详情（SSG，每篇独立 HTML）
│   ├── about.astro              # 关于页
│   ├── universe.astro           # cosmos 归档说明页（noindex，footer 入口）
│   ├── 404.astro                # 404 页
│   └── rss.xml.ts               # RSS feed
├── lib/
│   └── format.ts                # 日期格式化、阅读时长估算
└── styles/
    └── global.css               # editorial 设计系统（tokens + 全部组件样式 + .prose）

legacy/                          # v0.1 cosmos 时期所有代码归档（不参与构建）
├── features/cosmos/             # GLSL/R3F 5 层渲染管线
├── features/articles/           # 旧文章布局
├── features/blindspot/          # 旧"盲点"统计组件
├── routes/                      # 旧 React Router 页面
├── lib/, styles/, app/          # 旧框架代码
└── tests-cosmos/                # 旧 cosmos UI 测试
```

构建产物（`dist/`）：每个页面一个独立 HTML，sitemap 自动收录所有非 `noindex` 页面，RSS 自动从 posts 集合生成。

## 内容数据模型

`src/content.config.ts` 定义 posts 集合 schema：

```ts
{
  title: string;            // 必填，文章标题
  subtitle?: string;        // 可选，副标题（斜体衬线渲染）
  description: string;      // 20–300 字，进入 meta description + OG + RSS
  date: Date;               // 发布日期（必填）
  updated?: Date;           // 更新日期（可选，渲染在文章 meta）
  tags: string[];           // 标签数组（默认 []）
  cluster?: string;         // 主题集群标识（用于未来分组）
  cover?: ImageMetadata;    // 封面图（可选）
  coverAlt?: string;        // 封面 alt 文案
  draft: boolean;           // 默认 false。draft=true 不进列表/RSS/sitemap
  lang: "zh" | "en";        // 默认 zh
}
```

新增文章：在 `src/content/posts/` 下放一个 `.mdx` 文件，frontmatter 满足 schema。文件名（不含扩展名）就是 slug，URL 为 `/posts/{slug}`。

## 常用命令

```bash
npm run dev       # Astro 开发服务器（默认 4321 端口）
npm run build     # astro check + astro build，输出 dist/
npm run preview   # 预览生产构建
```

## SEO 与流量优先级

每个新增 / 改动必须问：**这件事有助于流量吗？** 如果不是，要么砍掉、要么放到 P2 之后。

每个文章页必须包含：
- 标准 meta：title、description、canonical
- Open Graph：og:type=article、og:title、og:description、og:url、og:locale、article:published_time、article:tag
- Twitter Card
- JSON-LD Article schema（已在 Article.astro 实现）
- 全文进 sitemap、RSS

OG image（per-post）当前缺失 —— 是 launch 后第一个 P1 follow-up。

## 写作守则

新增文章前 / 改文章时遵守：

1. **不转载。** 只发原创。引用他人观点要做评论、对比或综述，不能整段复制。
2. **要么把一件事讲透，要么不写。** 频率不承诺，宁缺毋滥。
3. **不写日记式快讯。** 不发"今天在看什么"、"随想"、"最近在想 X"。每篇都要有一个明确的命题。
4. **description 字段必须自己写好。** 这是 meta description + OG + RSS 摘要的唯一来源，是潜在读者点不点开的决定性 1.5 秒。
5. **draft: true 用于工作中草稿。** 草稿文章 URL 仍可访问，但不进列表 / RSS / sitemap。

## 发布流程

```bash
git push origin master
```

GitHub Actions 自动执行：
1. `npm ci`
2. `npm run build`（astro check 会先跑类型检查）
3. `dist/` 部署到 GitHub Pages

通常 1-2 分钟后页面生效。Pages Source 必须设为 **"GitHub Actions"**（Settings → Pages → Source）。

本地验证：`npm run build && npm run preview`

## 当前形态（v0.2）

已完成：
- Astro 5 + MDX + Tailwind 4 完整骨架
- 全静态预渲染：每篇文章独立 HTML、sitemap 自动收录、RSS feed
- Editorial 视觉系统：宋体衬线 + 单栏 680px + 单一暖橙强调色 + 完整 .prose 排版
- 路由：`/`（列表）`/posts/{slug}`（文章）`/about`（关于）`/universe`（cosmos 归档说明，noindex）`/404` `/rss.xml`
- 首篇原创：`src/content/posts/site-relaunch.mdx`（重启自述）
- GitHub Actions 部署链路（Node 22）
- **favicon.svg**（深色圆角 + 焦糖色行星）
- **per-post OG image** 自动生成：`src/lib/og.ts` + `src/pages/og/[slug].png.ts`，satori + @resvg/resvg-js，按字符动态加载 fontsource 子集（Fraunces latin + Noto Serif SC CJK），输出到 `/og/{slug}.png`
- **JSON-LD Article schema** image 字段已补全（指向 OG 图）
- **Plausible 数据分析** 接入（`PUBLIC_PLAUSIBLE_DOMAIN` 环境变量启用，生产构建注入）
- **邮件订阅** `<SubscribeForm />` 组件（Buttondown 集成；`PUBLIC_BUTTONDOWN_USERNAME` 未设时显示占位 + RSS 入口；挂载于文章页底部和 /about）
- **阅读进度条** `<ReadingProgress />`（CSS scroll-driven animation 优先，老浏览器 JS fallback）
- **文章页 TOC** `<ArticleTOC />`（从 MarkdownHeadings 派生 h2/h3，IntersectionObserver 高亮当前段，≥1280px sticky 右栏）
- **站内搜索** Pagefind v1.5（构建期 `pagefind --site dist` 自动索引，header 「搜索」按钮 + ⌘K 唤起 `<dialog>` 模态框，editorial 主题覆盖默认 UI）
- 部署期环境变量通过 GitHub repo Variables 注入：`vars.PUBLIC_PLAUSIBLE_DOMAIN` / `vars.PUBLIC_BUTTONDOWN_USERNAME`

待办（按优先级）：
- **P0** — 写作。60 天内 8-10 篇能拿出手的原创长文
- **P1** — `/about` 真名 / 联系方式 / 简介（当前邮箱、X 仍是占位文案）
- **P1** — Plausible / Buttondown 注册账号 → GitHub repo Settings → Variables 填入 `PUBLIC_PLAUSIBLE_DOMAIN`、`PUBLIC_BUTTONDOWN_USERNAME` → 触发部署即可启用
- **P3** — cosmos /universe 完整迁移为 React island（前提是写作量起来后再说）

## 协作偏好

- 流量为王，每个决策都问"这件事有助于流量吗"
- 快速执行，少问多做。需求清晰时直接写代码
- 只在真正影响架构的决策点停下来确认
- 中文沟通
- 对视觉品质要求极高，不接受"能用就行"的实现
- 拒绝转载、聚合、AI 改写外部内容 —— 只做原创
