---
title: "第十三卷回收索引：前四卷里的 `StreamingToolExecutor` 把复杂时序压进小连接件"
slug: "256-streamingtoolexecutor"
date: 2026-04-09
topics: [参考]
importance: 0.9
---

# 第十三卷回收索引：前四卷里的 `StreamingToolExecutor` 把复杂时序压进小连接件

## 实现链
`StreamingToolExecutor` 维护的是一张小型执行账本：工具会经历 `queued / executing / completed / yielded`，同时还要跟并发安全、进度消息和延后合并的 `contextModifiers` 一起协同。

## 普通做法
更普通的做法，是直接 `Promise.all()` 一把并发，或者干脆全串行。

## 为什么不用
Claude Code 不这么做，因为它要同时保住速度、结果顺序和上下文一致性，不能把任何一项随便让出去。

## 代价
代价是执行器本身会长成一个小调度器，理解门槛比普通工具循环高得多。
