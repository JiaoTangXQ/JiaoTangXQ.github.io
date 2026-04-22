---
title: "第十三卷回收索引：前四卷里的 max output tokens continuation 与 token budget continuation 的不同尺度续写"
slug: "254-max-output-tokens-continuationtoken-budget-continuation"
date: 2026-04-09
topics: [参考]
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 max output tokens continuation 与 token budget continuation 的不同尺度续写

## 实现链
遇到 `max_output_tokens` 时，系统会先尝试把上限提升到 `ESCALATED_MAX_TOKENS`，再不行就插入一条 `isMeta` 用户消息，明确要求“直接接着写，不要道歉，不要 recap”；`checkTokenBudget()` 走的则是百分比和 diminishing returns 的预算判断。

## 普通做法
更普通的做法，是给所有“继续”场景都塞同一种 `continue` 提示。

## 为什么不用
Claude Code 不这么做，因为硬截断和预算不值得再花本来就不是一回事，一个是在接断掉的话，一个是在管整轮成本。

## 代价
代价是 transcript 里会出现更多系统注入的 meta 消息，读日志时要知道它们不是用户原话。
