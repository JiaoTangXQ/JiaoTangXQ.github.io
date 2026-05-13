# 焦糖星球 — 项目上下文

## 站点定位

焦糖星球现在是个人博客，不再是 AI 日报、AI 周报或内容代理站。

内容来自 HTML 文章文件夹：

```text
src/content/html-posts/<slug>/
  meta.yaml
  index.html
  assets/
```

`<slug>` 对应公开 URL：`/posts/<slug>/`。

## 内容规则

- 新文章由 `skills/write-html-blog-post/` 约束生成。
- 每篇文章必须有 `meta.yaml` 和正文片段 `index.html`。
- 首页、RSS、搜索和知识图谱只读取 `draft: false` 的文章。
- 草稿仍会生成详情页，但带 `noindex`。
- 正文里的 `[[概念]]` 会进入知识图谱。
- 不暴露私人地址、联系方式、证件、密钥、内部链接、非公开人物、未脱敏截图和私密聊天记录。

## 当前架构

```text
src/
├── content/html-posts/        # HTML 博客文章源
├── components/
│   ├── KnowledgeGraph.astro   # SVG 知识图谱
│   ├── SearchModal.astro      # Pagefind 搜索
│   ├── SiteFooter.astro
│   └── SiteHeader.astro
├── layouts/Base.astro         # HTML head、SEO、主题初始化
├── lib/
│   ├── format.ts
│   ├── html-posts.mjs         # 文章读取、YAML 解析、双链解析、图谱构建
│   └── seo.ts
├── pages/
│   ├── index.astro            # 首页：文章列表 + 图谱预览
│   ├── posts/[slug].astro     # HTML 文章页
│   ├── graph.astro            # 图谱页
│   ├── graph.json.ts          # 图谱 JSON
│   ├── tags/                  # 标签索引和标签页
│   ├── about.astro
│   ├── contact.astro
│   ├── rss.xml.ts
│   └── 404.astro
└── styles/global.css
```

## 已删除方向

- AI 日报、AI 周报。
- content-agent / ai-daily 生产线。
- legacy React / cosmos 代码。
- 旧 generated 内容代理图片。
- 营销、定价、退款、条款、隐私页面。

## 常用命令

```bash
npm run dev
npm run test
npm run build
npm run preview
```

`npm run build` 会执行：

```text
astro check
astro build
pagefind --site dist
node scripts/lint-seo.mjs
```

## 协作规则

- 中文沟通。
- 不要恢复日报、周报、content-agent、legacy cosmos。
- 新文章只放进 `src/content/html-posts/<slug>/`。
- 站点代码改动和文章生成分开处理。
- 提交前必须跑 `npm run test` 和 `npm run build`。
