---
title: "retain 和 evictAfter 为什么让任务不会刚做完就消失"
slug: "05-08-03-retainevictafter"
date: 2026-04-09
topics: [任务与分派]
summary: "任务完成后立刻从界面和状态里消失，看起来省事，但对人很不友好。Claude Code 用 `retain` 和 `evictAfter` 给它留了一个体面退场期。 `LocalAgentTaskSta..."
importance: 1
---

# retain 和 evictAfter 为什么让任务不会刚做完就消失

任务完成后立刻从界面和状态里消失，看起来省事，但对人很不友好。Claude Code 用 `retain` 和 `evictAfter` 给它留了一个体面退场期。

## 实现链

`LocalAgentTaskState` 里有 `retain` 和 `evictAfter`。当任务完成、失败或被 kill 时，代码会把 `evictAfter` 设成当前时间加 `PANEL_GRACE_MS`，但如果任务仍被用户持有 `retain`，就不设驱逐时间。框架层 `evictTerminalTask()` 和 `applyTaskOffsetsAndEvictions()` 又会在真正删除前再次检查这两个字段。

这表示驱逐不是“状态一结束就立刻删”，而是“先进入可驱逐态，再看用户是否还在看它”。

## 普通做法

普通做法很可能在任务终态时立刻清理，或者简单保留一个极短 toast。反正任务已经结束了，数据没必要继续占内存。

## 为什么不用

Claude Code 不这么做，是因为任务结束并不代表人已经读完。特别是子 agent transcript、错误信息、最后一段结果，用户往往需要一点时间回看。`retain` 和 `evictAfter` 本质上是在把“人的阅读节奏”纳入任务生命周期。

## 代价

代价是终态任务会在内存和面板里多留一阵子，状态管理更复杂，也更容易出现“为什么它完成了还没消失”的疑问。但这是刻意设计，不是拖泥带水。
