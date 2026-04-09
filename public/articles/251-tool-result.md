---
title: "第十三卷回收索引：前四卷里的 `tool_result` 让每次动作都正式结案"
slug: "251-tool-result"
date: 2026-04-09
topics: [参考]
summary: "`query()` 会显式检查 `tool_use` 后面有没有对应的 `tool_result`，中断、fallback 或异常路径还会主动补 `yieldMissingToolResultBloc..."
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 `tool_result` 让每次动作都正式结案

## 实现链
`query()` 会显式检查 `tool_use` 后面有没有对应的 `tool_result`，中断、fallback 或异常路径还会主动补 `yieldMissingToolResultBlocks()`，避免一条动作链悬空。

## 普通做法
更普通的做法，是只在内存里记工具结果，或者直接把结果拼回 assistant 文本里。

## 为什么不用
Claude Code 不这么做，因为 transcript、resume 和下一轮推理都需要正式的动作记录，而不是一段随手拼出来的自然语言。

## 代价
代价是消息更重、类型更多，但换来的是每次动作都能被明确结案。
