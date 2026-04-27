# 外部文章内容管线规则

这个目录是焦糖星球外部文章的受控缓存。后续 AI 即使没有历史对话，也必须按这里的规则处理外部文章。

## 核心原则

- 外部文章刷新和清洗是纯代码管线，零 LLM。
- 不用 AI 改写、润色、翻译或摘要正文。
- 正文只做确定性结构化：安全 HTML、段落、小节标题、链接、代码格式。
- 中国政治相关内容必须在规则层过滤，不靠人工记忆。
- 不手工编辑 `items.json` 正文。规则变化后用命令批量重写缓存。

## 常用命令

```bash
npm run refresh:content
npm run normalize:content
npm run build:data
npm run build
```

命令用途：

- `npm run refresh:content`：抓 RSS/Atom 新文章，只处理新 slug。
- `npm run normalize:content`：对现有 `content/external/items.json` 全量重跑规则，剔除已命中的中国政治内容，并重新清洗正文。
- `npm run build:data`：把缓存生成到 `public/data/cosmos.json`、`public/data/search-index.json`、`public/data/external/*.json`。
- `npm run build`：完整生产构建和 SEO 预渲染。

## 代码入口

- `scripts/content/external/refresh.mts`：外部文章刷新主流程。
- `scripts/content/external/qualityFilter.mts`：规则质量过滤入口。
- `scripts/content/external/chinaPoliticsFilter.mts`：中国政治相关内容过滤规则。
- `scripts/content/external/sanitizeContent.mts`：正文安全清洗和纯文本结构化规则。
- `scripts/content/external/normalizeExistingItems.mts`：现有缓存全量重跑规则的命令入口。
- `scripts/content/external-refresh.test.mjs`：内容过滤和清洗规则的回归测试。

## 每次拉文章的固定流程

1. `refresh.mts` 读取 `content/external/sources.json`。
2. `normalizeFeedItems.mts` 把 RSS/Atom 条目归一成候选内容。
3. `qualityFilter.mts` 先调用 `chinaPoliticsFilter.mts`，命中的中国政治相关候选直接丢弃。
4. 过关候选尝试通过 `extractFullArticle.mts` 抓全文，失败时退回 RSS 摘录。
5. `sanitizeContent.mts` 清洗正文：
   - 删除危险标签和属性。
   - 把纯文本正文转成 `<p>`。
   - 把 `https://...`、`www...`、`chat.deepseek.com` 这类裸链接转成 `<a>`。
   - 把 `01、...`、`02、...` 这类中文编号小节转成 `<h2>`。
   - 保留行内代码和 fenced code block，不把代码里的 URL linkify。
   - 避免把模型版本号、小数点版本号误判成标题。
6. 写入 `content/external/items.json`。

## 中国政治过滤规则

规则统一放在 `chinaPoliticsFilter.mts`：

- 直接政治关键词：习近平、中共、共产党、解放军、台海、西藏、新疆等。
- 中国实体 + 政治/外交/安全/军事/制裁/宣传/签证等语境。
- 中美、对华、台海、跨国安全或外交上下文。

必须保留的边界：

- 中国商业、供应链、AI、科技、公司、产品类文章不应因为出现 China/中国 就被误杀。
- 新增过滤词必须先在 `external-refresh.test.mjs` 加正反例。
- 如果规则变更，必须运行 `npm run normalize:content` 清理既有缓存，再运行 `npm run build:data`。

## 修改规则时的验收

至少运行：

```bash
node --import tsx --test --test-name-pattern "sanitizeHtml|china politics|normalizeExternalRecords" scripts/content/external-refresh.test.mjs
npm run normalize:content
npm run build:data
npx -y -p typescript tsc --noEmit
```

发布前跑：

```bash
npm run build
```

如果 `tsx` 在沙箱里报 `/var/.../tsx-*.pipe` 的 `EPERM`，需要在非沙箱/授权环境重新运行同一个命令。
