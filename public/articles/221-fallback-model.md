---
title: "fallback model 切换前为什么要先清空 assistantMessages？"
slug: "221-fallback-model"
date: 2026-04-09
topics: [Claude Code 源码, fallback, 错误恢复]
importance: 0.9
---

# fallback model 切换前为什么要先清空 assistantMessages？

## 问题背景

当主模型（如 claude-sonnet）因为高并发负载返回 `FallbackTriggeredError` 时，Claude Code 会切换到备用模型（fallback model）重试这一轮。

切换模型听起来简单：把 `currentModel` 改成备用模型，重新发 API 请求。但 `query.ts` 里的实际实现比这复杂得多，而且每一步都有具体原因。

## 实际的清理流程

```typescript
// query.ts — fallback 触发时的处理
if (innerError instanceof FallbackTriggeredError && fallbackModel) {
  currentModel = fallbackModel
  attemptWithFallback = true

  // 1. 先补全悬空的 tool_result
  yield* yieldMissingToolResultBlocks(
    assistantMessages,
    'Model fallback triggered',
  )
  
  // 2. 清空本轮积累的状态
  assistantMessages.length = 0
  toolResults.length = 0
  toolUseBlocks.length = 0
  needsFollowUp = false

  // 3. 丢弃旧 executor，创建新的
  if (streamingToolExecutor) {
    streamingToolExecutor.discard()
    streamingToolExecutor = new StreamingToolExecutor(...)
  }

  // 4. 更新 toolUseContext
  toolUseContext.options.mainLoopModel = fallbackModel
  
  // 5. 如果有 thinking signature，strip 掉
  if (process.env.USER_TYPE === 'ant') {
    messagesForQuery = stripSignatureBlocks(messagesForQuery)
  }
}
```

为什么要做这些步骤？每一步都有来历。

## 步骤一：先补全 tool_result

fallback 发生在流式响应过程中——主模型可能已经发出了一些 `tool_use` blocks，但由于切换中断，这些工具调用没有收到结果。

如果直接清空 `assistantMessages` 而不先补全，这些 `tool_use` 就会在消息历史里「悬空」——下一次 API 调用会因为协议违规而失败。

所以必须先 `yieldMissingToolResultBlocks`，给每个已发出的 `tool_use` 补一个错误类型的 `tool_result`，然后再清空。

## 步骤二：清空本轮状态

这次 fallback 对应的是**整个请求重试**——不是从中间续接，而是用新模型从这一轮的起点重新来。

所以本轮积累的 `assistantMessages`、`toolResults`、`toolUseBlocks` 全部作废。如果不清空，旧模型的部分输出会混入新模型的请求，结果不可预测。

## 步骤三：discard executor

`StreamingToolExecutor` 里可能还有队列中或执行中的工具。这些工具的 `tool_use_id` 是对应旧模型这次请求的——如果重试后新模型发出了同名工具调用，旧的 `tool_use_id` 已经失效，会产生「孤立的 tool_result」。

`executor.discard()` 把当前 executor 标记为废弃，防止它继续 yield 结果。然后创建一个新的干净 executor 给 fallback 请求用。

## 步骤四：strip thinking signature

这是一个 Anthropic 内部的边缘情况：不同模型对 thinking blocks 的处理不同。如果主模型的历史里有 thinking signature，直接传给 fallback 模型可能触发 400 错误。

在切换之前把 signature blocks 清除，让 fallback 模型拿到的是干净的历史。

## 核心原则

这个 fallback 实现体现了一个更广泛的恢复设计原则：

**切换路径之前，先把现场清干净。不能把旧路径的脏状态带入新路径。**

更简单的实现是「直接切换模型重发请求」，但这会把旧的 tool_use IDs、旧的 thinking blocks、旧的 executor 状态全部带入新请求，导致一系列难以追踪的错误。

Claude Code 选择花更多代码做清理，换来的是 fallback 请求能在一个干净的状态下开始，和第一次发起请求没有本质区别。

## 面试要点

「系统如何实现 fallback」的完整答案应该包括：

1. 触发条件是什么（`FallbackTriggeredError`）
2. 切换前需要做哪些清理（补 tool_result、清 executor、strip signatures）
3. 为什么每步清理都必要（避免状态污染和协议违规）

能说清楚清理步骤的原因，说明理解了分布式异步系统中状态转换的核心挑战。
