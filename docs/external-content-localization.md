# 外部内容中文摘要规范

这份文档约束 `content/external/items.json` 的发布质量。

## 核心规则

- 外部内容的 `summary` 必须是中文。
- `summary` 必须由执行这次任务的 AI 自己阅读标题和英文摘录后重新归纳，不能直接发布英文 feed 摘录。
- 不允许保留占位文本，例如 `XXX 的外部内容摘要。`
- 可以保留专有名词原文，但整句主体必须是自然中文。
- `whyWorthReading` 可以沿用现有文案，重点是先把 `summary` 做成可发布的中文摘要。

## 什么时候做

每次运行完 `npm run refresh:external` 之后，在发布前都要检查并重写 `content/external/items.json` 里的外部摘要。

## 推荐流程

1. 运行 `npm run refresh:external` 更新外部内容缓存。
2. 打开 `content/external/items.json`。
3. 逐条把 `summary` 改写成 1 句中文摘要。
4. 不改 `slug`、`sourceUrl`、`date`、`sourceName`。
5. 运行测试和构建，确认站点可发布。

## 写作要求

- 优先忠实，不要编造原文没有提供的事实。
- 摘要尽量直说“这篇内容在讲什么”，不要写成营销文案。
- 控制长度，通常 20 到 80 个中文字符足够。
- 如果原始摘录信息太弱，就根据标题和已知上下文做保守归纳，不要空着。

## 工程护栏

- `scripts/content/readExternalContent.mts` 会在读取缓存时校验：如果 `summary` 不是中文，或者还是占位文本，构建会直接失败。
- `scripts/content/external-merge.test.mjs` 会回归检查外部摘要是否已经本地化成中文。

## 结论

更新外部内容时，不要把“生成中文摘要”外包给下一步。执行任务的 AI 自己完成归纳和翻译，然后再发布。
