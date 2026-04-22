---
title: "pendingMessages 为什么要先排队再过轮次"
slug: "232-pendingmessages"
date: 2026-04-09
topics: [消息队列, 并发控制, Claude Code 内核]
importance: 0.9
---

# pendingMessages 为什么要先排队再过轮次

面试题版本：**"如果用户在 Claude 正在执行工具的过程中发了一条新消息，这条消息会立即处理吗？还是会被排队？排队的意义是什么？"**

## 多消息来源的并发问题

在 Claude Code 运行的任意时刻，可能同时有多种消息要进入会话：

1. 后台任务 A 完成，生成一条 `tool_result` 通知
2. 后台任务 B 也完成了，生成另一条通知
3. 用户发了一条新消息
4. 系统检测到 token 预算不足，要注入一条预算警告

如果这些消息都立即插入对话历史，会发生什么？

**顺序混乱**：用户消息在任务通知之前还是之后？系统消息应该在哪里插入？没有确定的顺序，对话历史会变得不可预期。

**推理被打断**：如果模型正在推理（处于 `executing` 状态），中途插入新消息会让模型的当前推理结果和修改后的历史不一致。

**轮次概念崩溃**：Claude Code 的主循环是"一次用户输入 → 模型推理 → 工具执行 → 结果处理"的轮次结构。随意插入消息会破坏这个轮次边界。

## pendingMessages 的设计

`pendingMessages` 是一个队列，所有要进入对话的"外来"消息先放入这里：

```typescript
// 各种消息来源统一入队
pendingMessages.push(taskCompletionNotification)
pendingMessages.push(userInterruptMessage)
pendingMessages.push(systemBudgetWarning)
```

在每个轮次边界（上一轮结束、下一轮开始之前），主循环检查 `pendingMessages`：

```typescript
// 轮次开始时处理积压消息
if (pendingMessages.length > 0) {
  const messagesToProcess = dequeueAll(pendingMessages)
  // 按优先级和时序合并到会话历史
  mergeMessagesToHistory(messagesToProcess)
}
```

消息在队列里等待，不是立即插入，等到轮次边界时批量、有序地合并。

## 轮次边界是安全的合并点

轮次边界是消息合并的安全点，因为：
- 上一轮的所有工具调用已经完成
- 所有 `tool_result` 已经有对应的 `tool_use`
- 模型的推理已经结束，消息历史是完整的
- 状态机（`transition`）已经决定了下一步

在这个状态下合并新消息，不会破坏现有消息的完整性，也不会打断正在进行的推理。

## 优先级排序

并非所有待处理消息的优先级相同：

**用户中断消息**（Ctrl+C 发出的）：最高优先级，应该排在最前面
**系统警告消息**（token 预算、错误）：高优先级，在用户消息之前
**任务完成通知**：普通优先级，按完成时间排序
**后台信息更新**：低优先级，可以合并多条为一条

`pendingMessages` 的队列机制让这种优先级排序有了实施的基础：在合并时按优先级重新排序，而不是按到达时间盲目追加。

## 与 AbortController 的协同

当用户发出中断（Ctrl+C），这会触发 `abortController.abort()`，同时也会往 `pendingMessages` 里放入一条用户中断消息。

这两件事结合起来：
- `abort()` 让当前执行中的工具尽快停止
- 中断消息被放入 `pendingMessages`，等工具停止后在轮次边界被处理
- 主循环在处理中断消息时，更新会话状态，让用户知道什么被取消了

两个机制协同，保证了中断是有序的（工具停止 → 消息处理），而不是混乱的（各种状态同时改变）。

## 面试角度的总结

`pendingMessages` 排队机制解决的是"多消息来源如何安全、有序地合并进对话历史"的问题。核心设计决策是：**外来消息不立即插入，而是等到轮次边界时批量合并**。这保护了对话历史的完整性，让主循环可以在每轮开始时看到完整、有序的消息集合，而不是在推理过程中被动地处理随时插入的消息。
