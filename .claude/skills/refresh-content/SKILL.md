---
name: refresh-content
description: 刷新焦糖星球的外部内容：抓取 160 个信息源 → 逐篇中文化 + 立场标注 → 生成每日三题 → 重建 cosmos 数据 → 提交推送。当用户说"更新内容/日更/刷新/refresh content"时使用。
---

# 焦糖星球 · 内容刷新 skill

你是焦糖星球的内容策展 agent。这个 skill 完整地把信息源的增量内容，从原始 RSS 一直处理到线上部署。**全程无需任何外部 LLM API**——agent 本身就是 LLM。

## 何时触发

- 用户说「更新内容 / 日更 / refresh / 刷新焦糖星球」
- 用户在项目目录下直接调用 `/refresh-content`

## 产品规则（不可违反）

1. **所有 summary 必须是中文**。不允许保留英文 RSS 原文，也不允许"XXX 的外部内容摘要"这类占位句
2. **titleZh 必须写**——除非源本身就是中文（source 的 `language` 字段为 `zh`），此时可省略
3. **whyWorthReading 必须针对具体内容**，不能写万能句式
4. **立场标签**必须根据文章实际立场而非源的默认立场判断

## 总体流程（checklist）

- [ ] 0. **环境检查**：确认在项目根目录 + git 状态干净
- [ ] 1. **抓取候选**：运行 `npm run fetch:candidates`，得到 `content/external/candidates.json`
- [ ] 2. **决定处理量**：根据 candidates 数量决定本次处理多少（见下方 §批量策略）
- [ ] 3. **逐篇产出摘要**：按 `prompts/summarize-item.md` 的规范写每条 JSON 到 `content/external/pending-summaries/{slug}.json`
- [ ] 4. **合并入库**：运行 `npm run apply:summaries`
- [ ] 5. **生成每日三题**：按 `prompts/daily-topics.md` 分析近 72h 的新 items，写 `public/data/daily.json`
- [ ] 6. **重建数据**：运行 `npm run build:data`
- [ ] 7. **提交 + 推送**：`git add` 相关文件 + commit + push 到 master
- [ ] 8. **报告结果**：告诉用户本次处理了多少条、增加了哪些中文源、今日三题是什么

每完成一步把对应 checkbox 打勾。中途出错不要跳过，先修再继续。

---

## 步骤 0：环境检查

```bash
pwd                     # 应为项目根目录
git status --short      # 应无未提交的重要改动
ls content/external/    # 应有 items.json、sources.json
```

如果 git 有改动但不是内容管线相关（比如前端代码），照常继续。如果 candidates.json 已存在说明上次未完成，**不要删**，直接跳到步骤 2。

## 步骤 1：抓取候选

```bash
npm run fetch:candidates
```

预期输出：
- `📡 抓取 160 个信息源...`
- `✓ 抓取完成` + 数字统计

**重要**：该命令会自动跳过 `items.json` 里已有的 slug，所以**只有增量**进入 candidates.json。

如果 `新增待处理: 0 条` → 跳到步骤 5（只需要更新每日三题）。

## 步骤 2：决定本次处理量（批量策略）

读取 `content/external/candidates.json`，计数并判断：

```bash
node -e "const c = require('./content/external/candidates.json'); console.log(c.length)"
```

- **N ≤ 80**：全部处理。
- **80 < N ≤ 300**：按源均衡挑 80-100 条（每个源最多 3 条最新的），其余留给下次刷新。
- **N > 300**（首次冷启动可能发生）：挑 100-120 条「最值得先上线的」，优先规则：
  1. 源的 `sourceLanguage` 是 `zh`（中文源优先上线）
  2. 过去 7 天内的（fresh > stale）
  3. 覆盖更多的 source（避免一个源占 80%）
  4. 每个源最多 5 条

**在开始写 summary 之前**，先告诉用户本次准备处理多少条、来自多少个源、语言分布，等待口头确认再动手。

## 步骤 3：逐篇产出摘要

对选中的每一条 candidate：

1. 读取该条的 `title`、`rawExcerpt`、`sourceName`、`topics`、`sourceLanguage`、`sourceStance`
2. 按 **prompts/summarize-item.md** 里的规范产出一个 JSON 对象
3. 把 JSON 写到 `content/external/pending-summaries/{slug}.json`（文件名必须等于 slug）

**批量推荐 10-20 条一批**，每完成一批告诉用户进度（"已处理 30/100"）。

**质量要求**：不要为了完成数量牺牲质量。如果一条内容质量很低（占位通知、短新闻、活动预告），可以给 `qualityScore < 0.6`，`scoreExternalItems` 会在步骤 4 里把它过滤掉。**不允许跳过不写 pending 文件**——写了低分才算完成，后续过滤才知道为什么丢。

## 步骤 4：合并入库

```bash
npm run apply:summaries
```

预期输出：
- 本批新增 summary 数
- 质量过滤后通过数（淘汰数）
- 已归档到 `_applied/`

如果看到大量 "slug 在 candidates 里找不到" 警告，说明你写错了文件名 → 停，检查并修复。

## 步骤 5：生成每日三题

读取 **prompts/daily-topics.md**，分析 `content/external/items.json` 中过去 **72 小时**（看 `date` 字段）的条目：

1. 聚类出 3 个值得放首屏的议题
2. 每个议题选 **2-3 个立场对立/互补的 slug**
3. 输出 JSON 写到 `public/data/daily.json`（覆盖旧的）

格式见 `prompts/daily-topics.md`。

## 步骤 6：重建 cosmos 数据

```bash
npm run build:data
```

预期输出：生成 `public/data/cosmos.json` 和 `public/data/search-index.json`。

如果报错（比如某条 item 缺字段），回步骤 3 修。

## 步骤 7：提交 + 推送

```bash
git add content/external/items.json \
        content/external/sources.json \
        content/external/pending-summaries/_applied/ \
        public/data/daily.json \
        public/data/cosmos.json \
        public/data/search-index.json

git commit -m "$(cat <<'EOF'
content: daily refresh YYYY-MM-DD

- 新增 N 篇外部内容（中文 M 篇 / 英文 K 篇）
- 更新每日三题：<三个议题标题>
- 源覆盖：X 个源贡献本次内容

🤖 Generated with Claude Code
EOF
)"

git push origin master
```

**把上面模板里的 YYYY-MM-DD / N / M / K / X / 议题标题 全部替换成实际值**。不要留占位符。

## 步骤 8：报告

最后告诉用户：

```
✅ 今日刷新完成

• 抓取 {total} 条候选，处理 {N} 条
• 新增中文内容 {M} 条，英文内容 {K} 条
• 今日三题：
  1. {议题一}（{立场1}/{立场2}/{立场3}）
  2. {议题二}（...）
  3. {议题三}（...）
• 已推送至 master，GitHub Actions 将在 ~2 分钟后部署
• 查看：https://jiaotangxq.github.io
```

---

## 批量策略（复用）

当本次要处理的 candidate 超过 100 条时，**不要一次性处理完**。流程：

1. 按上述规则选出第一批 80-100 条
2. 处理 → 合并 → build → commit → push
3. 告诉用户"本批已上线，剩余 X 条已留在 candidates.json 里，下次 /refresh-content 自动继续"

这样每次刷新都是**有限时长 + 确定产出**，不会把一次会话拖垮。

## 错误恢复

- **fetch:candidates 里某个源失败**：正常现象，13-20 个源偶发挂。**不用管**，下次会重试。
- **pending-summaries/*.json 写错格式**：`apply:summaries` 会报 bad file，删掉重写那个 slug 的即可。
- **build:data 报错**：通常是新 item 缺字段。回步骤 3 补。
- **git push 被拒**：可能远端有新 commit，先 `git pull --rebase` 再 push。

## 不要做

- ❌ 为了速度简化中文摘要（如用"本文介绍了..."开头）
- ❌ 跳过 titleZh（除非源是中文）
- ❌ 把英文 RSS 段落直接粘贴到 summary 字段
- ❌ 一次处理超过 120 条（累，质量下降）
- ❌ 用 stance 字段包装"看起来对立"但实际都是主流视角的议题
- ❌ 批量用 ANTHROPIC_API_KEY 或任何 API（**这个 skill 的核心是 agent 自己动手，不调外部 API**）
