# 焦糖星球内容生产线

这套 `content-agent` 复刻的是 AI 日报的生产流程，不搬运别人已经生成好的文章。

## 流程

1. `ingest` 抓取 OpenAI RSS、AIbase、中文科技媒体、X/RSSHub、微信公众号/RSSHub、GitHub Trending、GitHub Search、产品 Changelog、AI Newsletter、论文热度、视频源、News Hacker、HN Search、Reddit、arXiv、Folo 和可选 AI Search。
2. `score` 去重、分类、打分，抽取图片/视频媒体，按新鲜度、来源类型和单源上限筛出核心信号。
3. `summarize` 使用 AI Provider 逐条改写；没有 API key 时走本地规则 fallback，并按栏目均衡入文。
4. `media` 使用原文页面作为 `Referer` 下载远程图片/直链视频到 `public/generated/content-agent/`，正文只引用本站本地路径，下载失败的热链不会渲染。
5. `style` 强制日报口吻：短句播报、emoji/颜文字、`(AI资讯)` 锚文本、媒体尾随、五行今日摘要。
6. `review` 输出人工审核清单到 `.cache/content-agent/reviews/`。
7. `daily` 写入 `src/content/dailies/YYYY-MM-DD.md`。
8. `weekly` 聚合一周摘要，写入 `src/content/posts/weekly/`。

## 常用命令

```bash
npm run agent:ingest -- --date=2026-05-07
npm run agent:summarize -- --date=2026-05-07
npm run agent:review -- --date=2026-05-07
npm run agent:daily -- --date=2026-05-07 --force
npm run agent:weekly -- --week=2026-W19 --date=2026-05-10 --force
```

一键跑完整日报：

```bash
npm run agent:run -- --date=2026-05-07 --force
```

发布正式内容时加 `--publish`，否则默认生成草稿。

## 配置

默认配置在 `scripts/content-agent/config.mjs`。如需覆盖，可以在仓库根目录创建 `content-agent.config.mjs`：

```js
export default {
  brand: "焦糖星球",
  sources: [
    {
      id: "custom-rss",
      type: "rss",
      name: "Custom RSS",
      url: "https://example.com/rss.xml",
      sourceType: "rss",
      section: "industry",
    },
  ],
};
```

## 环境变量

见 `.env.example`。正式生产至少需要：

```bash
OPENAI_API_KEY=...
CONTENT_AGENT_MODEL=gpt-5.4
```

Folo 是可选增强项。没有 Folo 时，生产线仍会从公开 RSS、RSSHub 桥接源、AIbase、News Hacker、GitHub Trending、GitHub Search、GitHub Changelog、arXiv 等来源生成内容。

新增情报池分层：

- `X/RSSHub`：官方账号、AI 编程关键词、Agent 工作流、GEO 提示词、OpenAI 发布信号。
- `微信公众号/RSSHub`：机器之心、新智元、量子位、AI 科技评论，并支持通过 `CONTENT_AGENT_WECHAT_RSSHUB_ROUTES` 追加具体路由。
- `GitHub Search`：按关键词和组织监听 AI Agent、MCP、AI Coding、RAG、LLM 推理、GEO prompt、computer use 等新项目。
- `Product Changelog`：GitHub、Vercel、Hugging Face、Simon Willison 等发布流。
- `AI Newsletter / Paper Trend`：Latent Space、Import AI、The Rundown、Ben's Bites、Hugging Face Daily Papers、Papers with Code、The Gradient。
- `Video/RSSHub`：YouTube/Bilibili 的 AI Agent、AI Coding 演示源，并支持 `CONTENT_AGENT_VIDEO_RSSHUB_ROUTES` 自定义扩展。

RSSHub 公共实例偶尔会失效，适配器会对单路由失败做静默跳过，避免整天日报失败。生产环境建议配置自己的 RSSHub 实例。

媒体来源优先使用原始信源提供的 `img`、`video`、`media:content`、`enclosure`、AIbase 缩略图和 GitHub OpenGraph 预览图。生成日报时会把可下载媒体落到 `public/generated/content-agent/YYYY-MM-DD/`，避免远程站点防盗链或限流导致图片不显示；不可下载的媒体会被丢弃，不依赖第三方日报站的静态资源。
