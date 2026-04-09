---
title: "outputFile 为什么把后台工作变成可追踪过程"
slug: "05-03-02-outputfile"
date: 2026-04-09
topics: [任务与分派]
summary: "后台任务最怕“只有结果，没有过程”。Claude Code 用 `outputFile` 把这个问题正面解决。 `TaskStateBase` 默认带 `outputFile` 和 `outputOf..."
importance: 1
---

# outputFile 为什么把后台工作变成可追踪过程

后台任务最怕“只有结果，没有过程”。Claude Code 用 `outputFile` 把这个问题正面解决。

## 实现链

`TaskStateBase` 默认带 `outputFile` 和 `outputOffset`。对 `LocalAgentTask` 来说，`registerAsyncAgent()` 和 `registerAgentForeground()` 一开始就会调用 `initTaskOutputAsSymlink()`，把任务输出路径接到 agent transcript。框架层再用 `getTaskOutputDelta()` 按 `outputOffset` 增量读取。

这意味着后台 agent 不是只在内存里偷偷跑，而是有一条可以被追读的磁盘侧链。

## 普通做法

普通做法常把后台过程留在内存日志里，或者只在结束时吐一段总结。这样实现简单，也不需要考虑文件生命周期。

## 为什么不用

Claude Code 不满足于“最后告诉你结果”。它需要在运行中查看、恢复、流式追加、通知主会话，还要在某些情况下把 transcript 保留下来。只有结果没有过程，很多治理动作都做不了。

所以它给每个任务一个输出文件，本质上是在给任务建立“施工记录”。这不是装饰，是管理能力的前提。

## 代价

代价是要面对磁盘 I/O、增量读取、符号链接初始化、回收清理这些额外复杂度。相比纯内存实现更重，但也换来了可恢复、可追踪和可审计。
