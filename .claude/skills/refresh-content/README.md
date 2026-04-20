# refresh-content skill

焦糖星球内容日更 skill。

## 使用

```bash
cd /path/to/JiaoTangXQ.github.io
claude   # 或 codex
# 输入：/refresh-content  或  更新内容
```

Agent 会自动：
1. 抓 160 个信息源（RSS + RSSHub failover）
2. 跳过已处理 slug，只处理新增
3. 逐篇中文化 + 评分 + 立场标签（约 80-120 条/次）
4. 质量过滤（淘汰 quality < 0.6）
5. 生成"每日三题"立场对立组合
6. 重建 cosmos 数据
7. 提交 + push → GitHub Actions 自动部署

预计每次 10-25 分钟，取决于新增量和 agent 速度。

## 结构

```
.claude/skills/refresh-content/
  SKILL.md                    # agent 执行指令
  prompts/
    summarize-item.md         # 单条摘要规范
    daily-topics.md           # 每日三题规范
  README.md                   # 本文件
```

## 配套脚本

- `npm run fetch:candidates` — 抓所有源，写 `content/external/candidates.json`
- `npm run apply:summaries` — 合并 agent 产出，质量过滤，写 `content/external/items.json`
- `npm run build:data` — 重建 `public/data/cosmos.json` + `search-index.json`

## 增删源

编辑 `content/external/sources.json`：

```json
{
  "id": "unique-id",
  "name": "人类可读名",
  "siteUrl": "https://...",
  "feedUrl": "https://.../feed",
  "defaultTopics": ["技术", "思考"],
  "language": "zh",
  "stance": "independent",
  "enabled": true
}
```

RSSHub 源（走 failover 实例）：

```json
{
  "id": "rsshub-...",
  "name": "...",
  "siteUrl": "https://...",
  "feedUrl": "",
  "type": "rsshub",
  "rsshubRoute": "/zhihu/daily",
  "defaultTopics": [...],
  "language": "zh",
  "stance": "...",
  "enabled": true
}
```

### 默认 RSSHub 实例

```
https://rsshub.rssforever.com
https://rsshub.liumingye.cn
```

自定义：设 `RSSHUB_INSTANCES` 环境变量（逗号分隔）。

## 故障排除

**fetch 某个源失败** — 正常，13-20 源偶发 fail，下次重试。多次失败可在 `sources.json` 里标 `enabled: false`。

**agent 中途停了** — 已处理的 slug 在 `pending-summaries/` 里保留，下次运行会跳过已做的；`candidates.json` 也是增量式。

**某个 RSSHub 路由长期 503** — 该实例禁用了这个路由（公共实例不支持全部）。换路由或自建。

**要自建 RSSHub**：一行部署到 Cloudflare Workers（参考 rsshub.docs 的 Workers 分支）。
