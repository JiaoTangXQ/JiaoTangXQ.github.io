---
title: "pendingMessages 为什么不立刻硬塞给子 agent"
slug: "05-08-02-pendingmessagesagent"
date: 2026-04-09
topics: [任务与分派]
summary: "Claude Code 给正在运行的子 agent 发新消息时，不是马上把消息插进当前回合，而是先排进 `pendingMessages`。 `queuePendingMessage()` 只是把字符..."
importance: 1
---

# pendingMessages 为什么不立刻硬塞给子 agent

Claude Code 给正在运行的子 agent 发新消息时，不是马上把消息插进当前回合，而是先排进 `pendingMessages`。

## 实现链

`queuePendingMessage()` 只是把字符串追加到任务对象的 `pendingMessages` 数组里；真正取走这些消息，要等 `drainPendingMessages()` 在合适边界统一清空并返回。代码注释已经写明：这些消息是“mid-turn via SendMessage, drained at tool-round boundaries”。

这意味着消息注入被限制在清晰边界，而不是随时插针。

## 普通做法

更直觉的做法，是一旦用户或上级有新话要说，就立刻塞进当前执行上下文，让 agent 立刻响应。

## 为什么不用

Claude Code 不这么做，是因为正在跑的模型回合不是线程安全的对话容器。你中途硬塞，很容易把当前推理打碎，造成上下文乱序、显示错位，甚至让 agent 对一半旧状态一半新状态作答。

它选择先排队，再在轮次边界交付，本质上是在保护回合原子性。

## 代价

代价是消息不会“秒进”，用户可能感觉不是最即时。但 Claude Code 更在意一致性，而不是表面上的立刻响应。
