---
title: "pane executor 首次创建后就缓存，说明团队执行世界也要统一口音"
slug: "09-08-08-pane-executor"
date: 2026-04-09
topics: [多Agent协作]
summary: "Claude Code 不只缓存 backend，还缓存 `PaneBackendExecutor` 本身，说明它连执行器口音都想统一。 `registry.ts` 里的 `getPaneBacken..."
importance: 1
---

# pane executor 首次创建后就缓存，说明团队执行世界也要统一口音

Claude Code 不只缓存 backend，还缓存 `PaneBackendExecutor` 本身，说明它连执行器口音都想统一。

## 实现链

`registry.ts` 里的 `getPaneBackendExecutor()` 首次调用时创建 executor，之后直接复用 `cachedPaneBackendExecutor`。这样后续 spawn、sendMessage、terminate、kill 都走同一个执行器实例。

## 普通做法

普通做法会按需新建 executor，反正只是个包装器。

## 为什么不用

Claude Code 选择缓存，是因为 executor 里本来就持有 teammate 映射、cleanup 注册和上下文设定。频繁新建会让团队执行世界出现多份“谁是谁”的记忆。

## 代价

代价是 executor 生命周期变长，内部状态必须保持干净，否则会更容易积累陈旧引用。
